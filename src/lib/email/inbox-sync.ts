import { getAgentMailClient, PREFLIGHT_AGENT_EMAIL } from './client'
import { handleInbound } from './handler'
import {
  recordWebhookEvent,
  completeWebhookEvent,
  failWebhookEvent,
} from '../db/webhook-store'

export type IngestResult = {
  id: string
  from: string
  subject: string
  status: 'processed' | 'skipped_duplicate' | 'ignored' | 'failed'
  error?: string
}

export type SyncInboxSummary = {
  timestamp: string
  totalFetched: number
  processedCount: number
  results: IngestResult[]
}

export async function syncInboundInbox(limit = 20): Promise<SyncInboxSummary> {
  const client = getAgentMailClient()
  const summary: SyncInboxSummary = {
    timestamp: new Date().toISOString(),
    totalFetched: 0,
    processedCount: 0,
    results: [],
  }

  if (!client) {
    return summary
  }

  try {
    const res = await client.inboxes.messages.list(PREFLIGHT_AGENT_EMAIL)
    const messages = (res.messages || res || []) as Array<{
      messageId?: string
      id?: string
      from?: string
      to?: string[]
      subject?: string
      preview?: string
      text?: string
      html?: string
      threadId?: string
      labels?: string[]
      headers?: Record<string, string>
    }>

    summary.totalFetched = messages.length

    for (const msg of messages.slice(0, limit)) {
      const eventId = String(msg.messageId || msg.id || '')
      if (!eventId) continue

      if (Array.isArray(msg.labels) && msg.labels.includes('sent')) {
        continue
      }

      const from = String(msg.from || '').toLowerCase()
      if (
        !from ||
        from.includes('mailer-daemon') ||
        from.includes('amazonses.com') ||
        from.includes('agentmail.to') ||
        from.includes('postmaster') ||
        from.includes('noreply') ||
        from.includes('stocklana.com') ||
        from.includes('example.com')
      ) {
        summary.results.push({
          id: eventId,
          from,
          subject: String(msg.subject || ''),
          status: 'ignored',
        })
        continue
      }

      const { isDuplicate } = await recordWebhookEvent(
        eventId,
        'inbox_polling',
        msg,
      )
      if (isDuplicate) {
        summary.results.push({
          id: eventId,
          from,
          subject: String(msg.subject || ''),
          status: 'skipped_duplicate',
        })
        continue
      }

      try {
        const textContent = msg.text || msg.preview || ''
        const inboundMessage = {
          id: eventId,
          from: msg.from,
          subject: msg.subject,
          text: textContent,
          html: msg.html,
          threadId: msg.threadId || eventId,
          headers: msg.headers,
        }

        const result = await handleInbound(inboundMessage, 'agent')
        await completeWebhookEvent(eventId, result)

        summary.processedCount++
        summary.results.push({
          id: eventId,
          from: String(msg.from || ''),
          subject: String(msg.subject || ''),
          status: 'processed',
        })
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        await failWebhookEvent(eventId, errorMsg)
        summary.results.push({
          id: eventId,
          from: String(msg.from || ''),
          subject: String(msg.subject || ''),
          status: 'failed',
          error: errorMsg,
        })
      }
    }

    return summary
  } catch (err: unknown) {
    return summary
  }
}
