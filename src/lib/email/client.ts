import { AgentMailClient } from 'agentmail'
import { recordSentEmail } from '../db/webhook-store'

let clientInstance: AgentMailClient | null = null

export function getAgentMailClient(): AgentMailClient | null {
  if (clientInstance) return clientInstance

  const apiKey = process.env.AGENTMAIL_API_KEY
  if (!apiKey) {
    return null
  }

  try {
    clientInstance = new AgentMailClient({ apiKey, maxRetries: 0 })
    return clientInstance
  } catch {
    return null
  }
}

export type SendEmailParams = {
  to: string
  subject: string
  text: string
  replyTo?: string
  threadId?: string
  headers?: Record<string, string>
}

export type SendEmailResult = {
  success: boolean
  messageId?: string
  error?: string
}

import { PREFLIGHT_AGENT_EMAIL } from '@/lib/constants'
export { PREFLIGHT_AGENT_EMAIL }

export async function sendEmail(
  inbox: 'subscribe' | 'agent',
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const normalizedTo = (params.to || '').toLowerCase().trim()
  if (
    !normalizedTo ||
    normalizedTo.includes('stocklana.com') ||
    normalizedTo.includes('agentmail.to') ||
    normalizedTo.includes('amazonses.com') ||
    normalizedTo.includes('mailer-daemon') ||
    normalizedTo.includes('example.com') ||
    normalizedTo.includes('postmaster')
  ) {
    return {
      success: false,
      error: 'Blocked recipient address',
    }
  }

  const client = getAgentMailClient()
  const inboxAddress = PREFLIGHT_AGENT_EMAIL

  if (!client) {
    const error = 'AGENTMAIL_API_KEY is not configured'
    await recordSentEmail({
      id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      inbox,
      to: params.to,
      subject: params.subject,
      text: params.text,
      status: 'FAILED',
      error,
    })
    return {
      success: false,
      error,
    }
  }

  try {
    const response = await client.inboxes.messages.send(inboxAddress, {
      to: params.to,
      subject: params.subject,
      text: params.text,
    })

    await recordSentEmail({
      id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      inbox,
      to: params.to,
      subject: params.subject,
      text: params.text,
      messageId: response.messageId,
      status: 'SENT',
    })

    return {
      success: true,
      messageId: response.messageId,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const isRateLimit =
      message.includes('429') ||
      message.includes('RateLimitError') ||
      message.includes('limit exceeded')

    await recordSentEmail({
      id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      inbox,
      to: params.to,
      subject: params.subject,
      text: params.text,
      status: 'FAILED',
      error: message,
    })

    if (isRateLimit && process.env.NODE_ENV !== 'production') {
      return {
        success: true,
        messageId: `<dev-ratelimited-${Date.now()}@preflight.local>`,
        error:
          'AgentMail daily limit reached (100/day on free plan). Simulated delivery in local environment.',
      }
    }

    return {
      success: false,
      error: message,
    }
  }
}
