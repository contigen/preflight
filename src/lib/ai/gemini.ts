import { createGoogleGenerativeAI, google } from '@ai-sdk/google'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import type {
  Token,
  SubscriberProfile,
  ParsedReplyIntent,
  PortfolioPosition,
} from '@/types'

const PreferenceSchema = z.object({
  sectors: z
    .array(z.string())
    .describe('Sectors of interest e.g. AI, Space, Defense, Robotics'),
  maxUsd: z
    .number()
    .describe('Maximum investment per deal in USD, default 500'),
  notifyOnNew: z.boolean().describe('Whether to alert on new listings'),
  notifyOnMove: z
    .boolean()
    .describe('Whether to alert on significant price changes'),
  name: z
    .string()
    .nullable()
    .describe("Subscriber's name if identified, else null"),
})

export async function extractPreferences(
  emailBody: string,
): Promise<z.infer<typeof PreferenceSchema>> {
  if (
    !process.env.GEMINI_API_KEY &&
    !process.env.GOOGLE_GENERATIVE_AI_API_KEY
  ) {
    return {
      sectors: ['AI', 'Space'],
      maxUsd: 500,
      notifyOnNew: true,
      notifyOnMove: true,
      name: null,
    }
  }

  try {
    const { output } = await generateText({
      model: google('gemini-3.6-flash'),
      output: Output.object({
        schema: PreferenceSchema,
      }),
      prompt: `
You are parsing an investor onboarding email for Preflight, an AI dealflow agent for PreStocks pre-IPO tokens on Solana.
Extract the investor's preferences.

Available sectors: AI, Defense, Space, Prediction Markets, Robotics, Biotech, Fintech, General.
Default maxUsd to 500 if not stated. Default notifyOnNew and notifyOnMove to true.

Email content:
"""
${emailBody}
"""
      `.trim(),
    })

    return output
  } catch {
    return {
      sectors: ['AI', 'Space'],
      maxUsd: 500,
      notifyOnNew: true,
      notifyOnMove: true,
      name: null,
    }
  }
}

const ReplyIntentSchema = z.object({
  intent: z.enum([
    'BUY',
    'SELL',
    'CONFIRM',
    'PASS',
    'PORTFOLIO',
    'MARKET',
    'UNSUBSCRIBE',
    'UNCLEAR',
  ]),
  symbol: z
    .string()
    .nullable()
    .describe(
      'The token symbol if explicitly mentioned (e.g. SPACEX, OPENAI, ANTHROPIC)',
    ),
  amountUsd: z.number().nullable().describe('USD dollar amount specified'),
  tokenQty: z.number().nullable().describe('Token unit count specified'),
  pct: z
    .number()
    .nullable()
    .describe('Percentage amount specified for SELL (e.g. 50 for 50%)'),
  confidence: z.enum(['HIGH', 'LOW']),
})

function parseIntentFallback(emailBody: string): ParsedReplyIntent {
  const lower = emailBody.toLowerCase().trim()

  if (
    lower === 'confirm' ||
    lower.startsWith('confirm') ||
    lower === 'yes' ||
    lower.startsWith('yes ') ||
    lower.includes('do it') ||
    lower.includes('proceed') ||
    lower.includes('execute')
  ) {
    return {
      intent: 'CONFIRM',
      symbol: null,
      amountUsd: null,
      tokenQty: null,
      pct: null,
      confidence: 'HIGH',
    }
  }

  if (
    lower === 'pass' ||
    lower.startsWith('pass') ||
    lower === 'skip' ||
    lower.startsWith('skip') ||
    lower.includes('cancel')
  ) {
    return {
      intent: 'PASS',
      symbol: null,
      amountUsd: null,
      tokenQty: null,
      pct: null,
      confidence: 'HIGH',
    }
  }

  const isMarketInquiry =
    lower.includes('what stocks') ||
    lower.includes('available stocks') ||
    lower.includes('available to purchase') ||
    lower.includes('available to buy') ||
    lower.includes('what can i buy') ||
    lower.includes('what can i purchase') ||
    lower.includes('what tokens') ||
    lower.includes('list stocks') ||
    lower.includes('list tokens') ||
    lower.includes('show deals') ||
    lower.includes('market catalog') ||
    lower === 'market' ||
    lower === 'deals' ||
    lower === 'stocks' ||
    lower === 'tokens'

  if (isMarketInquiry) {
    return {
      intent: 'MARKET',
      symbol: null,
      amountUsd: null,
      tokenQty: null,
      pct: null,
      confidence: 'HIGH',
    }
  }

  const mentionsInvest =
    lower.includes('invest') ||
    lower.includes('buy') ||
    lower.includes('allocate') ||
    lower.includes('purchase') ||
    lower.includes('put in') ||
    lower.includes('take')

  if (mentionsInvest) {
    const amountMatch =
      lower.match(/\$([0-9,.]+)/) ||
      lower.match(/([0-9,.]+)\s*(?:dollars|usd)/i) ||
      lower.match(/(?:invest|buy|allocate|put)\s*(?:\$)?([0-9,.]+)/i)

    let amountUsd: number | null = null
    if (amountMatch && amountMatch[1]) {
      amountUsd = parseFloat(amountMatch[1].replace(/,/g, ''))
    }

    const knownSymbols = [
      'ANTHROPIC',
      'OPENAI',
      'SPACEX',
      'ANDURIL',
      'KALSHI',
      'FIGUREAI',
      'NEURALINK',
      'POLYMARKET',
    ]

    let detectedSymbol: string | null = null
    for (const sym of knownSymbols) {
      if (lower.includes(sym.toLowerCase())) {
        detectedSymbol = sym
        break
      }
    }

    return {
      intent: 'BUY',
      symbol: detectedSymbol,
      amountUsd: amountUsd || 100,
      tokenQty: null,
      pct: null,
      confidence: 'HIGH',
    }
  }

  if (
    lower.startsWith('sell') ||
    lower.includes('liquidate') ||
    lower.includes('exit')
  ) {
    const pctMatch = lower.match(/(\d+)%/)
    const isHalf = lower.includes('half')
    const pct = pctMatch ? parseFloat(pctMatch[1]) : isHalf ? 50 : null
    return {
      intent: 'SELL',
      symbol: null,
      amountUsd: null,
      tokenQty: null,
      pct,
      confidence: 'HIGH',
    }
  }

  if (
    lower.includes('portfolio') ||
    lower.includes('holdings') ||
    lower.includes('positions')
  ) {
    return {
      intent: 'PORTFOLIO',
      symbol: null,
      amountUsd: null,
      tokenQty: null,
      pct: null,
      confidence: 'HIGH',
    }
  }

  if (
    lower.includes('unsubscribe') ||
    lower.includes('opt out') ||
    lower.includes('stop')
  ) {
    return {
      intent: 'UNSUBSCRIBE',
      symbol: null,
      amountUsd: null,
      tokenQty: null,
      pct: null,
      confidence: 'HIGH',
    }
  }

  return {
    intent: 'UNCLEAR',
    symbol: null,
    amountUsd: null,
    tokenQty: null,
    pct: null,
    confidence: 'LOW',
  }
}

export async function parseReplyIntent(
  emailBody: string,
): Promise<ParsedReplyIntent> {
  const hasKey = Boolean(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  )
  if (!hasKey) {
    return parseIntentFallback(emailBody)
  }

  try {
    const { output } = await generateText({
      model: google('gemini-3.6-flash'),
      output: Output.object({
        schema: ReplyIntentSchema,
      }),
      prompt: `
Parse a subscriber's reply to a PreStocks pre-IPO deal alert email from Preflight.

CRITICAL INSTRUCTIONS:
1. Focus exclusively on the subscriber's top-level reply.
2. If the user says "CONFIRM", "yes", "proceed", "execute" -> intent=CONFIRM.
3. If the user says "PASS", "skip", "no thanks" -> intent=PASS.
4. Any lines starting with ">" or standard quote headers are previous thread context and MUST NOT be used to infer a new intent if the user is confirming or passing.

Examples:
- "CONFIRM", "yes please", "do it", "execute" -> intent=CONFIRM
- "PASS", "not now", "skip", "no thanks" -> intent=PASS
- "BUY $200" or "buy two hundred dollars" -> intent=BUY, amountUsd=200
- "I like to invest $100 in Anthropic" -> intent=BUY, symbol="ANTHROPIC", amountUsd=100
- "Invest $150 in Anthropic" -> intent=BUY, symbol="ANTHROPIC", amountUsd=150
- "BUY 0.5 tokens" -> intent=BUY, tokenQty=0.5
- "sell half my SPACEX" -> intent=SELL, symbol="SPACEX", pct=50
- "sell 2 tokens of ANTHROPIC" -> intent=SELL, symbol="ANTHROPIC", tokenQty=2
- "sell $100 KALSHI" -> intent=SELL, symbol="KALSHI", amountUsd=100
- "exit ANTHROPIC" or "liquidate OpenAI" -> intent=SELL, pct=100
- "show my portfolio", "what are my holdings" -> intent=PORTFOLIO
- "what stocks are available to purchase?", "what can I buy?", "what tokens are available?", "list stocks", "market", "show deals" -> intent=MARKET
- "unsubscribe", "stop" -> intent=UNSUBSCRIBE

Reply message:
"""
${emailBody}
"""
      `.trim(),
    })

    return output
  } catch {
    return parseIntentFallback(emailBody)
  }
}

export async function generateDealMemo(
  token: Token,
  subscriber: SubscriberProfile,
): Promise<string> {
  const prompt = `
You are Preflight, an institutional pre-IPO dealflow broker for PreStocks on Solana.
Write a concise, high-conviction deal alert memo (under 200 words).
Do NOT include a subject line.

Asset details:
- Name: ${token.name} (${token.symbol})
- Source: PreStocks
- Current Token Price: $${token.tokenPrice.toFixed(2)}
- Mark Price: $${token.markPrice?.toFixed(2) || 'N/A'}
- Implied Valuation: $${token.markValuation ? (token.markValuation / 1e9).toFixed(1) + 'B' : 'N/A'}
- NAV Premium / Discount: ${token.premium || '0'}%
- Legal Structure: SPV-backed pre-IPO token
- Transfer Fee: 0% (standard SPL token)
- Description: ${token.description || 'Leading high-growth pre-IPO company'}
- Movement: ${token.changeType === 'NEW_LISTING' ? 'New Primary Listing' : `Price Moved ${token.changePct}%`}
- Solana Contract: ${token.contractAddress || 'prestocks.com'}

Investor Profile:
- Name: ${subscriber.name || 'Investor'}
- Target Sectors: ${subscriber.sectors.join(', ') || 'General'}
- Max Deal Size: $${subscriber.maxUsd}

Rules:
1. Explain the thesis in 2 punchy sentences.
2. Highlight the NAV premium/discount and SPV liquidity on Solana.
3. Conclude with exactly these two actionable lines:
Reply BUY <amount> — e.g. "BUY $200" or "BUY 0.5"
Reply PASS to skip this opportunity.
  `.trim()

  if (
    !process.env.GEMINI_API_KEY &&
    !process.env.GOOGLE_GENERATIVE_AI_API_KEY
  ) {
    return (
      `Deal Alert: ${token.name} (${token.symbol}) @ $${token.tokenPrice.toFixed(2)}\n` +
      `Implied Valuation: $${token.markValuation ? (token.markValuation / 1e9).toFixed(1) + 'B' : 'N/A'}\n\n` +
      `${token.description || 'High growth pre-IPO asset'}.\n` +
      `SPV-backed PreStocks token with zero transfer fee.\n\n` +
      `Reply BUY <amount> — e.g. "BUY $200" or "BUY 0.5"\nReply PASS to skip this opportunity.`
    )
  }

  try {
    const { text } = await generateText({
      model: google('gemini-3.6-flash'),
      prompt,
    })
    return text.trim()
  } catch {
    return (
      `Deal Alert: ${token.name} (${token.symbol}) @ $${token.tokenPrice.toFixed(2)}\n` +
      `Reply BUY <amount> — e.g. "BUY $200"\nReply PASS to skip.`
    )
  }
}

export async function generatePortfolioDigest(
  portfolio: Record<string, PortfolioPosition>,
  currentTokens: Token[],
): Promise<{ body: string; totalValue: number; totalPnl: number }> {
  const entries = Object.entries(portfolio)
  if (entries.length === 0) {
    return {
      body: 'You currently hold no active pre-IPO positions. Reply to any deal alert to begin building your portfolio.',
      totalValue: 0,
      totalPnl: 0,
    }
  }

  let totalValue = 0
  let totalInvested = 0

  const lines = entries.map(([symbol, pos]) => {
    const current = currentTokens.find(t => t.symbol === symbol)
    const currentPrice = current?.tokenPrice || pos.avgPrice
    const value = pos.qty * currentPrice
    const pnl = value - pos.totalInvested
    const pnlPct =
      pos.totalInvested > 0
        ? ((pnl / pos.totalInvested) * 100).toFixed(1)
        : '0.0'

    totalValue += value
    totalInvested += pos.totalInvested

    return `• ${symbol}: ${pos.qty.toFixed(4)} tokens | Avg: $${pos.avgPrice.toFixed(2)} | Current: $${currentPrice.toFixed(2)} | Value: $${value.toFixed(2)} (${pnl >= 0 ? '+' : ''}${pnlPct}%)`
  })

  const totalPnl = totalValue - totalInvested
  const totalPnlPct =
    totalInvested > 0 ? ((totalPnl / totalInvested) * 100).toFixed(1) : '0.0'

  const body = `
Preflight Portfolio Digest

Holdings:
${lines.join('\n')}

Total Portfolio Value: $${totalValue.toFixed(2)}
Total Unrealized P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)} (${totalPnl >= 0 ? '+' : ''}${totalPnlPct}%)

Commands:
- Reply "BUY <amount>" to invest in active deals
- Reply "SELL <symbol> <amount>" to exit a position
- Reply "PORTFOLIO" anytime for updated valuation
  `.trim()

  return { body, totalValue, totalPnl }
}
