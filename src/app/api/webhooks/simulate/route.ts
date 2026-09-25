import { NextRequest, NextResponse } from 'next/server'
import { handleInbound } from '@/lib/email/handler'
import {
  recordWebhookEvent,
  completeWebhookEvent,
  failWebhookEvent,
} from '@/lib/db/webhook-store'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const from = String(body.from || 'investor@solana.org')
      .toLowerCase()
      .trim()
    const text = String(body.text || body.body || 'PORTFOLIO')
    const subject = String(body.subject || text)
    const inbox =
      (body.inbox as 'subscribe' | 'agent') ||
      (text.toLowerCase().includes('subscribe') ? 'subscribe' : 'agent')

    const eventId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const payload = { eventId, from, subject, text, inbox, simulated: true }

    await recordWebhookEvent(eventId, 'simulation', payload)

    const message = {
      id: eventId,
      from,
      subject,
      text,
      threadId: eventId,
    }

    const result = await handleInbound(message, inbox)
    await completeWebhookEvent(eventId, result)

    return NextResponse.json({
      success: true,
      simulated: true,
      eventId,
      sender: from,
      inbox,
      intentResult: result,
      note: 'Email reaction and on-chain action processed & logged to Upstash Redis',
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
