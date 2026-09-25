import { redis } from './redis'

export type WebhookStatus =
  'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'DUPLICATE' | 'FAILED'

export type WebhookRecord = {
  id: string
  source: string
  receivedAt: string
  status: WebhookStatus
  payload: unknown
  result?: unknown
  error?: string
}

export type OutboxRecord = {
  id: string
  timestamp: string
  inbox: 'subscribe' | 'agent'
  to: string
  subject: string
  text: string
  messageId?: string
  status: 'SENT' | 'FAILED'
  error?: string
}

const memoryWebhookLog: WebhookRecord[] = []
const memoryOutboxLog: OutboxRecord[] = []

export async function recordWebhookEvent(
  id: string,
  source: string,
  payload: unknown,
): Promise<{ isDuplicate: boolean; record: WebhookRecord }> {
  const record: WebhookRecord = {
    id,
    source,
    receivedAt: new Date().toISOString(),
    status: 'RECEIVED',
    payload,
  }

  memoryWebhookLog.unshift(record)
  if (memoryWebhookLog.length > 100) memoryWebhookLog.pop()

  if (!redis) {
    return { isDuplicate: false, record }
  }

  try {
    const isNew = await redis.set(`preflight:webhooks:idempotency:${id}`, '1', {
      nx: true,
      ex: 86400,
    })

    if (!isNew) {
      record.status = 'DUPLICATE'
      return { isDuplicate: true, record }
    }

    await Promise.all([
      redis.lpush('preflight:webhooks:events', JSON.stringify(record)),
      redis.ltrim('preflight:webhooks:events', 0, 99),
      redis.hset(`preflight:webhooks:records`, {
        [id]: JSON.stringify(record),
      }),
    ])

    return { isDuplicate: false, record }
  } catch {
    return { isDuplicate: false, record }
  }
}

export async function completeWebhookEvent(
  id: string,
  result: unknown,
): Promise<void> {
  const inMem = memoryWebhookLog.find(r => r.id === id)
  if (inMem) {
    inMem.status = 'COMPLETED'
    inMem.result = result
  }

  if (!redis) return

  try {
    const raw = await redis.hget<string>('preflight:webhooks:records', id)
    if (raw) {
      const parsed: WebhookRecord =
        typeof raw === 'string' ? JSON.parse(raw) : raw
      parsed.status = 'COMPLETED'
      parsed.result = result
      await redis.hset('preflight:webhooks:records', {
        [id]: JSON.stringify(parsed),
      })
    }
  } catch {}
}

export async function failWebhookEvent(
  id: string,
  error: string,
): Promise<void> {
  const inMem = memoryWebhookLog.find(r => r.id === id)
  if (inMem) {
    inMem.status = 'FAILED'
    inMem.error = error
  }

  if (!redis) return

  try {
    const failureRecord = {
      id,
      failedAt: new Date().toISOString(),
      error,
    }
    await Promise.all([
      redis.lpush('preflight:webhooks:dlq', JSON.stringify(failureRecord)),
      redis.ltrim('preflight:webhooks:dlq', 0, 99),
    ])

    const raw = await redis.hget<string>('preflight:webhooks:records', id)
    if (raw) {
      const parsed: WebhookRecord =
        typeof raw === 'string' ? JSON.parse(raw) : raw
      parsed.status = 'FAILED'
      parsed.error = error
      await redis.hset('preflight:webhooks:records', {
        [id]: JSON.stringify(parsed),
      })
    }
  } catch {}
}

export async function recordSentEmail(record: OutboxRecord): Promise<void> {
  memoryOutboxLog.unshift(record)
  if (memoryOutboxLog.length > 100) memoryOutboxLog.pop()

  if (!redis) return

  try {
    await Promise.all([
      redis.lpush('preflight:email_outbox', JSON.stringify(record)),
      redis.ltrim('preflight:email_outbox', 0, 99),
    ])
  } catch {}
}

export async function getRecentWebhooks(limit = 20): Promise<WebhookRecord[]> {
  if (!redis) {
    return memoryWebhookLog.slice(0, limit)
  }

  try {
    const items = await redis.lrange<string | WebhookRecord>(
      'preflight:webhooks:events',
      0,
      limit - 1,
    )
    if (!items || items.length === 0) {
      return memoryWebhookLog.slice(0, limit)
    }
    return items.map(item =>
      typeof item === 'string' ? JSON.parse(item) : item,
    )
  } catch {
    return memoryWebhookLog.slice(0, limit)
  }
}

export async function getRecentOutbox(limit = 20): Promise<OutboxRecord[]> {
  if (!redis) {
    return memoryOutboxLog.slice(0, limit)
  }

  try {
    const items = await redis.lrange<string | OutboxRecord>(
      'preflight:email_outbox',
      0,
      limit - 1,
    )
    if (!items || items.length === 0) {
      return memoryOutboxLog.slice(0, limit)
    }
    return items.map(item =>
      typeof item === 'string' ? JSON.parse(item) : item,
    )
  } catch {
    return memoryOutboxLog.slice(0, limit)
  }
}
