import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { handleInbound } from '@/lib/email/handler'
import {
  recordWebhookEvent,
  completeWebhookEvent,
  failWebhookEvent,
  getRecentWebhooks,
  getRecentOutbox,
} from '@/lib/db/webhook-store'
import { db } from '@/lib/db/store'
import { PREFLIGHT_AGENT_EMAIL } from '@/lib/constants'

export async function GET() {
  const [recentWebhooks, recentOutbox] = await Promise.all([
    getRecentWebhooks(15),
    getRecentOutbox(15),
  ])

  const hasSecret = Boolean(process.env.AGENTMAIL_WEBHOOK_SECRET)

  return NextResponse.json({
    status: 'online',
    agentEmail: PREFLIGHT_AGENT_EMAIL,
    workflowEngine: 'workflow-sdk (durable orchestrator enabled)',
    webhookConfig: {
      endpoint: '/api/webhooks/agentmail',
      supportedEvents: [
        'message.received',
        'message.delivered',
        'message.bounced',
      ],
      idempotency: 'Redis SETNX with 24h TTL',
      signatureVerification: hasSecret
        ? 'Svix active'
        : 'optional (set AGENTMAIL_WEBHOOK_SECRET)',
      dlq: 'preflight:webhooks:dlq',
    },
    recentWebhooks,
    recentOutbox,
  })
}

export async function POST(req: NextRequest) {
  let rawBody = ''
  try {
    rawBody = await req.text()
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : 'Failed to read request body'
    return NextResponse.json({ success: false, error: msg }, { status: 400 })
  }

  const secret = process.env.AGENTMAIL_WEBHOOK_SECRET
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  let payload: Record<string, unknown> = {}

  if (secret && svixId && svixTimestamp && svixSignature) {
    try {
      const wh = new Webhook(secret)
      payload =
        (wh.verify(rawBody, {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        }) as unknown as Record<string, unknown>) || {}
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Svix signature verification failed'
      return NextResponse.json({ success: false, error: msg }, { status: 401 })
    }
  } else {
    try {
      payload = JSON.parse(rawBody || '{}')
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 },
      )
    }
  }

  const eventType = String(
    payload.event_type || payload.type || payload.event || 'message.received',
  )
  const eventId = String(
    svixId ||
      payload.event_id ||
      payload.id ||
      `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  )

  const { isDuplicate } = await recordWebhookEvent(
    eventId,
    'agentmail',
    payload,
  )
  if (isDuplicate) {
    return NextResponse.json({
      success: true,
      duplicate: true,
      eventId,
      message: 'Webhook already processed',
    })
  }

  if (eventType === 'message.delivered') {
    db.logActivity(
      'DEAL_ALERT',
      'AgentMail notification delivered to recipient',
      {
        eventId,
        messageId: payload.message_id || payload.id,
      },
    )
    await completeWebhookEvent(eventId, { handled: 'message.delivered' })
    return NextResponse.json({
      success: true,
      eventId,
      eventType,
      status: 'logged',
    })
  }

  if (eventType === 'message.bounced') {
    db.logActivity('DEAL_ALERT', 'AgentMail message bounced', {
      eventId,
      recipient: payload.recipient,
    })
    await completeWebhookEvent(eventId, { handled: 'message.bounced' })
    return NextResponse.json({
      success: true,
      eventId,
      eventType,
      status: 'logged',
    })
  }

  if (eventType !== 'message.received') {
    await completeWebhookEvent(eventId, {
      handled: 'ignored_event_type',
      eventType,
    })
    return NextResponse.json({
      success: true,
      eventId,
      eventType,
      status: 'ignored',
    })
  }

  try {
    const rawMsg =
      (payload.message as Record<string, unknown>) ||
      (payload.data as Record<string, unknown>) ||
      payload

    const { searchParams } = new URL(req.url)
    let inbox = searchParams.get('inbox') as 'subscribe' | 'agent' | null

    const to = String(
      rawMsg.to || rawMsg.recipient || rawMsg.inbox_id || payload.to || '',
    ).toLowerCase()

    if (!inbox) {
      inbox = to.includes('subscribe') ? 'subscribe' : 'agent'
    }

    const fromStr = String(
      rawMsg.from || rawMsg.sender || payload.from || '',
    ).trim()
    if (!fromStr) {
      await completeWebhookEvent(eventId, { handled: 'ignored_empty_sender' })
      return NextResponse.json({
        success: true,
        eventId,
        eventType,
        status: 'ignored_empty_sender',
      })
    }

    const message = {
      id: String(rawMsg.id || rawMsg.messageId || rawMsg.message_id || eventId),
      from: fromStr,
      subject: String(rawMsg.subject || ''),
      text: String(rawMsg.text || rawMsg.body || ''),
      html: typeof rawMsg.html === 'string' ? rawMsg.html : undefined,
      threadId: String(
        rawMsg.threadId || rawMsg.thread_id || rawMsg.id || eventId,
      ),
      headers: (rawMsg.headers as Record<string, string>) || undefined,
    }

    const result = await handleInbound(message, inbox)
    await completeWebhookEvent(eventId, result)

    return NextResponse.json({
      success: true,
      eventId,
      eventType,
      inbox,
      result,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await failWebhookEvent(eventId, msg)
    return NextResponse.json(
      { success: false, eventId, error: msg },
      { status: 500 },
    )
  }
}
