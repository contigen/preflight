import {
  extractPreferences,
  parseReplyIntent,
  generatePortfolioDigest,
} from '../ai/gemini'
import { fetchAllTokens } from '../tokens/aggregator'
import { db } from '../db/store'
import { executeDevnetTrade, calculateTradeQuote } from '../solana/devnet'
import { sendEmail } from './client'
import { start } from 'workflow/api'
import { dealAlertWorkflow, orderQuoteWorkflow } from '@/workflows/deal-flow'
import type { Token, SubscriberProfile, ParsedReplyIntent } from '@/types'

export type InboundEmailMessage = {
  id?: string
  from?: string
  subject?: string
  text?: string
  html?: string
  threadId?: string
  headers?: Record<string, string>
}

export async function handleInbound(
  message: InboundEmailMessage,
  inbox: 'subscribe' | 'agent',
): Promise<{ status: string; intent?: string }> {
  const from = extractSenderEmail(message.from)
  if (!from || isSystemOrAutomatedSender(from, message.headers)) {
    return { status: 'ignored_automated_sender' }
  }
  const rawBody = message.text || message.html?.replace(/<[^>]+>/g, '') || ''
  const body = stripQuotedEmailText(rawBody)
  const threadId = message.threadId || message.id

  if (inbox === 'subscribe') {
    await handleSubscribe(from, body, message.subject)
    return { status: 'subscribed' }
  }

  const inReplyToToken =
    message.headers?.['x-preflight-token'] ||
    message.headers?.['X-Preflight-Token'] ||
    db.getLastAlertedToken(from)

  const res = await handleAgentReply(from, body, threadId, inReplyToToken)
  return { status: 'processed', intent: res }
}

export async function handleSubscribe(
  from: string,
  body: string,
  subject?: string,
) {
  if (db.isSubscribed(from)) {
    await sendEmail('subscribe', {
      to: from,
      subject: "Re: You're already subscribed to Preflight",
      text: `Hey! You're already subscribed to Preflight deal alerts.\n\nWe monitor PreStocks pre-IPO markets 24/7 for you.\nReply BUY <amount> to any alert to invest, or reply PORTFOLIO to check your positions.\n\n— Preflight`,
    })
    return
  }

  const prefs = await extractPreferences(
    body || subject || 'Interested in pre-IPO deals',
  )
  db.addSubscriber(from, prefs)

  const greeting = prefs.name ? `Hey ${prefs.name}` : 'Hey'
  const sectorList =
    prefs.sectors.length > 0
      ? prefs.sectors.join(', ')
      : 'AI, Space, Defense, Robotics'

  await sendEmail('subscribe', {
    to: from,
    subject: "You're In: Preflight Pre-IPO Dealflow",
    text: `${greeting}! Welcome to Preflight.

We've configured your deal stream:
• Sectors: ${sectorList}
• Max per allocation: $${prefs.maxUsd}
• New listings: ${prefs.notifyOnNew ? 'Active' : 'Off'}
• Price move alerts (>3%): ${prefs.notifyOnMove ? 'Active' : 'Off'}

Markets Monitored:
• PreStocks: ANDURIL, ANTHROPIC, FIGUREAI, KALSHI, NEURALINK, OPENAI, POLYMARKET, SPACEX

How to invest:
When an alert lands in your inbox, simply reply:
  "BUY $200"
  "BUY 0.5"
  "PASS" (to skip)

Reply PORTFOLIO anytime for holdings.
Reply UNSUBSCRIBE to opt out.

— Preflight Broker`,
  })
}

export async function handleAgentReply(
  from: string,
  body: string,
  threadId?: string,
  inReplyToToken?: string,
): Promise<string> {
  const cleanBody = stripQuotedEmailText(body)
  if (!cleanBody) {
    return 'EMPTY_BODY'
  }

  const parsed = await parseReplyIntent(cleanBody)

  let isSubscribed = db.isSubscribed(from)
  if (!isSubscribed) {
    const fromRedis = await db.fetchSubscriberFromRedis(from)
    if (fromRedis) isSubscribed = true
  }

  if (!isSubscribed) {
    if (parsed.intent === 'BUY') {
      db.addSubscriber(from, {
        email: from,
        sectors: ['AI', 'Tech'],
        maxUsd: Math.max(parsed.amountUsd || 500, 1000),
        name: from.split('@')[0],
      })
    } else {
      const domain = process.env.AGENTMAIL_DOMAIN || 'preflight.agentmail.to'
      await sendEmail('agent', {
        to: from,
        subject: 'Join Preflight Dealflow',
        text: `Looks like you haven't subscribed yet!\n\nEmail subscribe@${domain} with your investment preferences to start receiving deal memos.\n\n— Preflight`,
        threadId,
      })
      return 'NOT_SUBSCRIBED'
    }
  }

  switch (parsed.intent) {
    case 'BUY':
      await handleBuyIntent(from, parsed, threadId, inReplyToToken)
      break

    case 'SELL':
      await handleSellIntent(from, parsed, threadId, inReplyToToken)
      break

    case 'CONFIRM':
      await handleConfirm(from, threadId)
      break

    case 'PASS':
      await sendEmail('agent', {
        to: from,
        subject: 'Opportunity Skipped',
        text: `Understood! Passed on this deal. We'll alert you on the next high-conviction move.\n\n— Preflight`,
        threadId,
      })
      break

    case 'PORTFOLIO':
      await handlePortfolioRequest(from, threadId)
      break

    case 'MARKET':
      await handleMarketList(from, threadId)
      break

    case 'UNSUBSCRIBE':
      db.unsubscribe(from)
      await sendEmail('agent', {
        to: from,
        subject: 'Unsubscribed from Preflight',
        text: `You have been removed from deal alerts. Email subscribe@... anytime if you'd like to return.\n\n— Preflight`,
        threadId,
      })
      break

    default:
      if (
        cleanBody.length > 0 &&
        !from.includes('stocklana.com') &&
        !from.includes('agentmail.to')
      ) {
        await sendEmail('agent', {
          to: from,
          subject: 'Preflight Command Guide',
          text: `I couldn't quite determine your request. Here are the valid commands:

• BUY $200 — allocate $200 to this deal
• BUY 0.5 — buy 0.5 tokens
• SELL 50% — sell half your position
• CONFIRM — execute pending order
• PASS — skip this deal
• PORTFOLIO — view current positions and P&L
• UNSUBSCRIBE — stop all alerts

— Preflight`,
          threadId,
        })
      }
  }

  return parsed.intent
}

async function handleBuyIntent(
  from: string,
  parsed: ParsedReplyIntent,
  threadId?: string,
  inReplyToToken?: string,
) {
  let tokens = db.getSnapshot()
  if (tokens.length === 0) {
    tokens = await fetchAllTokens()
    db.setSnapshot(tokens)
  }

  let token: Token | undefined
  if (parsed.symbol) {
    token = tokens.find(
      t => t.symbol.toUpperCase() === parsed.symbol!.toUpperCase(),
    )
  }
  if (!token && inReplyToToken) {
    token = tokens.find(
      t => t.symbol.toUpperCase() === inReplyToToken.toUpperCase(),
    )
  }

  if (!token) {
    const symbolList = tokens
      .slice(0, 8)
      .map(t => `${t.name} (${t.symbol}) - $${t.tokenPrice.toFixed(2)}`)
      .join('\n• ')
    await sendEmail('agent', {
      to: from,
      subject: 'Which asset would you like to buy?',
      text: `Please specify the pre-IPO company you want to allocate to.\n\nAvailable PreStocks:\n• ${symbolList}\n\nExample reply:\n  BUY $200 ANTHROPIC\n  BUY 0.5 SPACEX\n\n— Preflight`,
      threadId,
    })
    return
  }

  const pricePerToken = token.tokenPrice
  if (pricePerToken <= 0) {
    await sendEmail('agent', {
      to: from,
      subject: `Price unavailable for ${token.symbol}`,
      text: `Could not determine current price for ${token.name}. Please try again shortly.\n\n— Preflight`,
      threadId,
    })
    return
  }

  let amountUsd = parsed.amountUsd
  let tokenQty = parsed.tokenQty

  if (amountUsd && !tokenQty) {
    tokenQty = amountUsd / pricePerToken
  } else if (tokenQty && !amountUsd) {
    amountUsd = tokenQty * pricePerToken
  } else if (!amountUsd && !tokenQty) {
    amountUsd = 100
    tokenQty = 100 / pricePerToken
  }

  const existing = await db.fetchLatestPendingIntentFromRedis(from)
  if (
    existing &&
    existing.token.symbol === token.symbol &&
    Math.abs(existing.amountUsd - amountUsd!) < 0.01 &&
    Date.now() - new Date(existing.createdAt).getTime() < 60000
  ) {
    return
  }

  const quote = calculateTradeQuote(token, amountUsd!)
  const intent = db.createIntent(
    from,
    'BUY',
    token,
    amountUsd!,
    tokenQty!,
    pricePerToken,
  )

  await sendEmail('agent', {
    to: from,
    subject: `Confirm Trade Order: ${token.symbol} 🔐`,
    text: `Order Summary:

Action:     BUY
Asset:      ${token.name} (${token.symbol})
Source:     ${token.source}
Allocation: $${amountUsd!.toFixed(2)} USD -> ~${tokenQty!.toFixed(4)} tokens
Execution:  $${pricePerToken.toFixed(2)} per token
Est. Fee:   ${quote.feePct}% ($${quote.feeUsd})
Est. Slip:  ~${quote.slippagePct}%
Network:    Solana Devnet

⏱ This locked quote expires in 15 minutes.

Reply CONFIRM to execute on-chain.
Reply PASS to cancel.

Intent ID: ${intent.id}
— Preflight`,
    threadId,
  })
}

async function handleSellIntent(
  from: string,
  parsed: ParsedReplyIntent,
  threadId?: string,
  inReplyToToken?: string,
) {
  const portfolio = db.getPortfolio(from)
  const holdings = Object.keys(portfolio)

  if (holdings.length === 0) {
    await sendEmail('agent', {
      to: from,
      subject: 'Portfolio Empty',
      text: 'You do not currently own any positions to sell.\n\n— Preflight',
      threadId,
    })
    return
  }

  let targetSymbol = parsed.symbol?.toUpperCase()
  if (!targetSymbol && inReplyToToken && portfolio[inReplyToToken]) {
    targetSymbol = inReplyToToken.toUpperCase()
  }
  if (!targetSymbol && holdings.length === 1) {
    targetSymbol = holdings[0]
  }

  if (!targetSymbol || !portfolio[targetSymbol]) {
    const list = holdings
      .map(h => `${h} (${portfolio[h].qty.toFixed(4)} tokens)`)
      .join(', ')
    await sendEmail('agent', {
      to: from,
      subject: 'Which position do you want to sell?',
      text: `Please specify which asset you want to sell. Your active holdings: ${list}\n\nExample:\n  SELL 50% ${holdings[0]}\n  SELL 1 ${holdings[0]}\n\n— Preflight`,
      threadId,
    })
    return
  }

  const pos = portfolio[targetSymbol]
  let tokens = db.getSnapshot()
  if (!tokens.length) {
    tokens = await fetchAllTokens()
    db.setSnapshot(tokens)
  }
  const token = tokens.find(t => t.symbol === targetSymbol) || {
    source: 'PreStocks' as const,
    name: targetSymbol,
    symbol: targetSymbol,
    tokenPrice: pos.avgPrice,
    sector: 'Tech',
    legalStructure: 'pre-IPO',
    transferFeePct: 0,
    url: 'https://prestocks.com',
  }

  const currentPrice = token.tokenPrice || pos.avgPrice

  let sellQty = 0
  if (parsed.pct) {
    sellQty = pos.qty * (parsed.pct / 100)
  } else if (parsed.tokenQty) {
    sellQty = Math.min(parsed.tokenQty, pos.qty)
  } else if (parsed.amountUsd) {
    sellQty = Math.min(parsed.amountUsd / currentPrice, pos.qty)
  } else {
    sellQty = pos.qty
  }

  if (sellQty <= 0) {
    await sendEmail('agent', {
      to: from,
      subject: 'Invalid Quantity',
      text: `Could not calculate sell quantity for ${targetSymbol}.\n\n— Preflight`,
      threadId,
    })
    return
  }

  const proceeds = sellQty * currentPrice

  const intent = db.createIntent(
    from,
    'SELL',
    token,
    proceeds,
    sellQty,
    currentPrice,
    parsed.pct || undefined,
  )

  await sendEmail('agent', {
    to: from,
    subject: `Confirm Trade Order: Sell ${targetSymbol} 🔐`,
    text: `Sell Order Summary:

Action:     SELL
Asset:      ${targetSymbol}
Quantity:   ${sellQty.toFixed(4)} tokens
Price:      $${currentPrice.toFixed(2)} per token
Gross Return: $${proceeds.toFixed(2)} USDC
Network:    Solana Devnet

⏱ This locked quote expires in 15 minutes.

Reply CONFIRM to execute on-chain.
Reply PASS to cancel.

Intent ID: ${intent.id}
— Preflight`,
    threadId,
  })
}

async function handleConfirm(from: string, threadId?: string) {
  const pending = db.getLatestPendingIntent(from)
  if (!pending) {
    const fromRedis = await db.fetchLatestPendingIntentFromRedis(from)
    if (fromRedis && fromRedis.status === 'PENDING') {
      db.pendingIntents.set(fromRedis.id, fromRedis)
      return handleConfirm(from, threadId)
    }

    await sendEmail('agent', {
      to: from,
      subject: 'No Pending Order',
      text: 'You do not have any pending quotes awaiting confirmation. Reply BUY <amount> to any deal alert to request a quote.\n\n— Preflight',
      threadId,
    })
    return
  }

  if (Date.now() > pending.expiresAt) {
    db.cancelIntent(pending.id)
    await sendEmail('agent', {
      to: from,
      subject: 'Quote Expired',
      text: 'This quote has expired. Reply BUY <amount> to request a new execution quote.\n\n— Preflight',
      threadId,
    })
    return
  }

  try {
    const swapResult = await executeDevnetTrade(
      pending.token,
      pending.amountUsd,
      from,
    )
    db.confirmIntent(pending.id, swapResult.txHash)

    if (pending.type === 'BUY') {
      await sendEmail('agent', {
        to: from,
        subject: `Trade Executed: ${pending.token.symbol} on Solana Devnet`,
        text: `Your purchase has settled on Solana.

Token:       ${pending.token.name} (${pending.token.symbol})
Amount Paid: $${pending.amountUsd.toFixed(2)} USDC
Received:    ${pending.tokenQty.toFixed(4)} tokens
Unit Cost:   $${pending.priceAtIntent.toFixed(2)}
Network:     Solana Devnet
Tx Hash:     ${swapResult.txHash}
Explorer:    https://explorer.solana.com/tx/${swapResult.txHash}?cluster=devnet

Your portfolio is updated. Reply PORTFOLIO anytime to review positions.

— Preflight`,
        threadId,
      })
    } else {
      await sendEmail('agent', {
        to: from,
        subject: `Trade Executed: Sold ${pending.token.symbol} on Solana Devnet`,
        text: `Your sale has settled on Solana.

Token:       ${pending.token.name} (${pending.token.symbol})
Sold Qty:    ${pending.tokenQty.toFixed(4)} tokens
Proceeds:    $${pending.amountUsd.toFixed(2)} USDC
Network:     Solana Devnet
Tx Hash:     ${swapResult.txHash}
Explorer:    https://explorer.solana.com/tx/${swapResult.txHash}?cluster=devnet

Your portfolio is updated. Reply PORTFOLIO anytime to review positions.

— Preflight`,
        threadId,
      })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await sendEmail('agent', {
      to: from,
      subject: 'Trade Execution Failed',
      text: `We could not settle your trade on-chain:\n\n${msg}\n\nPlease verify your devnet balance or try again shortly.\n\n— Preflight`,
      threadId,
    })
  }
}

async function handlePortfolioRequest(from: string, threadId?: string) {
  let tokens = db.getSnapshot()
  if (tokens.length === 0) {
    tokens = await fetchAllTokens()
    db.setSnapshot(tokens)
  }

  const portfolio = db.getPortfolio(from)
  const digest = await generatePortfolioDigest(portfolio, tokens)

  await sendEmail('agent', {
    to: from,
    subject: 'Preflight Portfolio Digest',
    text: digest.body,
    threadId,
  })
}

async function handleMarketList(from: string, threadId?: string) {
  let tokens = db.getSnapshot()
  if (tokens.length === 0) {
    tokens = await fetchAllTokens()
    db.setSnapshot(tokens)
  }

  const prestocks = tokens.filter(t => t.source === 'PreStocks')

  const prestocksLines = prestocks.map(
    t =>
      `• ${t.name} (${t.symbol}): $${t.tokenPrice.toFixed(2)} | Implied Val: $${t.markValuation ? (t.markValuation / 1e9).toFixed(1) + 'B' : 'N/A'} | NAV Prem: ${t.premium || '0'}%`,
  )

  const text = `Preflight Live Market Catalog

PreStocks (SPV-backed 1:1 exposure on Solana):
${prestocksLines.join('\n')}

To purchase any asset, reply:
"BUY $100 <SYMBOL>" (e.g. "BUY $100 ANTHROPIC" or "BUY $250 SPACEX")

Reply PORTFOLIO anytime to review holdings.

— Preflight Dealflow`

  await sendEmail('agent', {
    to: from,
    subject: 'Available Pre-IPO Stocks & Tokens',
    text,
    threadId,
  })
}

export async function sendDealAlert(
  subscriber: SubscriberProfile,
  token: Token,
  memo: string,
) {
  try {
    await start(dealAlertWorkflow, [subscriber, token, memo])
  } catch {
    const subject =
      token.changeType === 'NEW_LISTING'
        ? `New Pre-IPO Listing: ${token.name} (${token.symbol})`
        : `${token.symbol} Pre-IPO Price Moved ${token.changePct}%`

    db.setLastAlertedToken(subscriber.email, token.symbol)

    await sendEmail('agent', {
      to: subscriber.email,
      subject,
      text: memo,
      headers: {
        'X-Preflight-Token': token.symbol,
      },
    })

    db.logActivity(
      'DEAL_ALERT',
      `Alert sent to ${subscriber.email} for ${token.symbol}`,
      {
        symbol: token.symbol,
        price: token.tokenPrice,
      },
    )
  }
}

export function extractSenderEmail(from?: string): string {
  if (!from) return ''
  const match = from.match(/<([^>]+)>/) || from.match(/([^\s<]+@[^\s>]+)/)
  return match ? match[1].toLowerCase().trim() : from.toLowerCase().trim()
}

export function stripQuotedEmailText(raw: string): string {
  if (!raw) return ''
  const lines = raw.split(/\r?\n/)
  const cleanLines: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('>')) continue
    if (/^on\s.+wrote:$/i.test(trimmed)) break
    if (/^---+\s*(original message|forwarded message)\s*---+/i.test(trimmed))
      break
    if (/^from:\s/i.test(trimmed) && cleanLines.length > 0) break
    if (
      trimmed.startsWith('--') &&
      (trimmed.includes('Sent via AgentMail') || trimmed.includes('Preflight'))
    )
      break
    cleanLines.push(line)
  }
  return cleanLines.join('\n').trim()
}

export function isSystemOrAutomatedSender(
  from: string,
  headers?: Record<string, string>,
): boolean {
  const f = from.toLowerCase().trim()
  if (
    !f ||
    f.includes('mailer-daemon') ||
    f.includes('postmaster') ||
    f.includes('noreply') ||
    f.includes('no-reply') ||
    f.includes('amazonses.com') ||
    f.includes('agentmail.to') ||
    f.includes('stocklana.com') ||
    f.includes('example.com')
  ) {
    return true
  }
  if (headers) {
    const auto = headers['auto-submitted'] || headers['Auto-Submitted']
    if (auto && auto !== 'no') return true
    const prec = headers['precedence'] || headers['Precedence']
    if (prec === 'bulk' || prec === 'junk' || prec === 'auto_reply') return true
  }
  return false
}
