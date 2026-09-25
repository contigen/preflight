import {
  extractPreferences,
  parseReplyIntent,
  generatePortfolioDigest,
} from '../ai/gemini'
import { fetchAllTokens } from '../tokens/aggregator'
import { db } from '../db/store'
import { executeDevnetTrade, calculateTradeQuote } from '../solana/devnet'
import {
  buildRedemptionAlert,
  fetchTesseraAuction,
  TESSERA,
} from '../tokens/tessera'
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
      text: `Hey! You're already subscribed to Preflight deal alerts.\n\nWe monitor PreStocks and Tessera 24/7 for you.\nReply BUY <amount> to any alert to invest, or reply PORTFOLIO to check your positions.\n\n— Preflight`,
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
    subject: "✅ You're In — Preflight Pre-IPO Dealflow",
    text: `${greeting}! Welcome to Preflight. 🛫

We've configured your deal stream:
• Sectors: ${sectorList}
• Max per allocation: $${prefs.maxUsd}
• New listings: ${prefs.notifyOnNew ? 'Active' : 'Off'}
• Price move alerts (>3%): ${prefs.notifyOnMove ? 'Active' : 'Off'}

Markets Monitored:
• PreStocks: ANDURIL, ANTHROPIC, FIGUREAI, KALSHI, NEURALINK, OPENAI, POLYMARKET, SPACEX
• Tessera: T-OpenAI, T-Kalshi, T-SpaceX (Token-2022 + Chainlink PoR)

How to invest:
When an alert lands in your inbox, simply reply:
  "BUY $200"
  "BUY 0.5"
  "PASS" (to skip)

Reply PORTFOLIO anytime for holdings.
Reply UNSUBSCRIBE to opt out.

— Preflight Broker 🤖`,
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
        subject: 'Opportunity Skipped 👍',
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

    case 'REDEEM':
      await handleRedeemInfo(from, cleanBody, threadId)
      break

    case 'AUCTION':
      await handleAuctionInfo(from, cleanBody, threadId)
      break

    default:
      if (
        cleanBody.length > 0 &&
        !from.includes('stocklana.com') &&
        !from.includes('agentmail.to')
      ) {
        await sendEmail('agent', {
          to: from,
          subject: 'Preflight Command Guide 🤔',
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
      subject: 'Select Asset to Buy 🎯',
      text: `Which pre-IPO asset would you like to purchase?\n\nPlease specify the asset symbol in your reply, for example:\n  "BUY $100 ANTHROPIC"\n  "BUY $250 SPACEX"\n\nAvailable Assets:\n• ${symbolList}\n\n— Preflight`,
      threadId,
    })
    return
  }

  const pricePerToken = token.tokenPrice
  let amountUsd = parsed.amountUsd
  let tokenQty = parsed.tokenQty

  if (amountUsd && !tokenQty) {
    tokenQty = amountUsd / pricePerToken
  } else if (tokenQty && !amountUsd) {
    amountUsd = tokenQty * pricePerToken
  } else if (!amountUsd && !tokenQty) {
    await sendEmail('agent', {
      to: from,
      subject: `Specify Amount for ${token.name} 💰`,
      text: `How much would you like to invest in ${token.name} (${token.symbol})?

Current Price: $${pricePerToken.toFixed(2)}
Examples:
  BUY $200
  BUY 0.5

— Preflight`,
      threadId,
    })
    return
  }

  const subscriber = db.getSubscriber(from)
  if (subscriber && amountUsd! > subscriber.maxUsd) {
    await sendEmail('agent', {
      to: from,
      subject: `Over Your $${subscriber.maxUsd} Risk Limit ⚠️`,
      text: `Your max deal size is set to $${subscriber.maxUsd}, but this order would be $${amountUsd!.toFixed(2)}.

Reply "BUY $${subscriber.maxUsd}" to invest up to your limit, or "PASS" to cancel.

— Preflight`,
      threadId,
    })
    return
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

  const transferFeeNote =
    token.source === 'Tessera'
      ? '\nToken-2022 Transfer Fee: 0.20% (standard built-in protocol fee)'
      : ''

  await sendEmail('agent', {
    to: from,
    subject: `Confirm Trade Order: ${token.symbol} 🔐`,
    text: `Order Summary:

Action:     BUY
Asset:      ${token.name} (${token.symbol})
Source:     ${token.source}
Allocation: $${amountUsd!.toFixed(2)} USD -> ~${tokenQty!.toFixed(4)} tokens
Execution:  $${pricePerToken.toFixed(2)} per token
Est. Fee:   ${quote.feePct}% ($${quote.feeUsd})${transferFeeNote}
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
    source: targetSymbol.startsWith('T-') ? 'Tessera' : 'PreStocks',
    name: targetSymbol,
    symbol: targetSymbol,
    tokenPrice: pos.avgPrice,
    sector: 'Tech',
    legalStructure: 'pre-IPO',
    transferFeePct: targetSymbol.startsWith('T-') ? 0.2 : 0,
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
  const transferFee = token.source === 'Tessera' ? proceeds * 0.002 : 0
  const netProceeds = proceeds - transferFee

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
    subject: `Confirm SELL Order: ${targetSymbol} 📉`,
    text: `Sell Order Summary:

Action:       SELL
Asset:        ${targetSymbol}
Quantity:     ${sellQty.toFixed(4)} of ${pos.qty.toFixed(4)} tokens (${((sellQty / pos.qty) * 100).toFixed(0)}%)
Price:        $${currentPrice.toFixed(2)} per token
Gross Return: $${proceeds.toFixed(2)} USDC${transferFee > 0 ? `\nProtocol Fee: -$${transferFee.toFixed(4)} (Tessera 0.2% Token-2022)` : ''}
Net Return:   $${netProceeds.toFixed(2)} USDC

Reply CONFIRM to execute liquidation.
Reply PASS to cancel.

Intent ID: ${intent.id}
— Preflight`,
    threadId,
  })
}

async function handleConfirm(from: string, threadId?: string) {
  let intent = db.getLatestPendingIntent(from)
  if (!intent) {
    intent = await db.fetchLatestPendingIntentFromRedis(from)
  }
  if (!intent) {
    await sendEmail('agent', {
      to: from,
      subject: 'No Active Order Found',
      text: 'No pending trade order was found (quotes expire after 15 minutes). Send a new BUY or SELL request to begin.\n\n— Preflight',
      threadId,
    })
    return
  }

  const swapResult = await executeDevnetTrade(
    intent.token,
    intent.amountUsd,
    from,
  )
  db.confirmIntent(intent.id, swapResult.txHash)

  if (intent.type === 'BUY') {
    await sendEmail('agent', {
      to: from,
      subject: `✅ Trade Executed: ${intent.token.symbol} on Solana Devnet`,
      text: `Your purchase has settled on Solana! 🚀

Token:       ${intent.token.name} (${intent.token.symbol})
Amount Paid: $${intent.amountUsd.toFixed(2)} USDC
Received:    ${intent.tokenQty.toFixed(4)} tokens
Unit Cost:   $${intent.priceAtIntent.toFixed(2)}
Network:     Solana Devnet
Tx Hash:     ${swapResult.txHash}
Explorer:    https://explorer.solana.com/tx/${swapResult.txHash}?cluster=devnet

Your portfolio is updated. Reply PORTFOLIO anytime to review positions.

— Preflight 🛫`,
      threadId,
    })
  } else {
    await sendEmail('agent', {
      to: from,
      subject: `✅ Liquidation Executed: Sold ${intent.token.symbol}`,
      text: `Your sell order has settled on Solana Devnet!

Asset:       ${intent.token.symbol}
Sold:        ${intent.tokenQty.toFixed(4)} tokens
Proceeds:    $${intent.amountUsd.toFixed(2)} USDC
Tx Hash:     ${swapResult.txHash}
Explorer:    https://explorer.solana.com/tx/${swapResult.txHash}?cluster=devnet

Reply PORTFOLIO to view remaining holdings.

— Preflight 🛫`,
      threadId,
    })
  }
}

async function handlePortfolioRequest(from: string, threadId?: string) {
  const portfolio = db.getPortfolio(from)
  const holdings = Object.keys(portfolio)

  if (holdings.length === 0) {
    await sendEmail('agent', {
      to: from,
      subject: 'Preflight Portfolio Empty 📭',
      text: `You have no open pre-IPO positions.\n\nWhen a deal memo arrives, reply BUY <amount> to open your first allocation.\n\n— Preflight`,
      threadId,
    })
    return
  }

  let tokens = db.getSnapshot()
  if (!tokens.length) {
    tokens = await fetchAllTokens()
    db.setSnapshot(tokens)
  }

  const digest = await generatePortfolioDigest(portfolio, tokens)

  await sendEmail('agent', {
    to: from,
    subject: '📊 Preflight Portfolio Digest',
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
  const tessera = tokens.filter(t => t.source === 'Tessera')

  const prestocksLines = prestocks.map(
    t =>
      `• ${t.name} (${t.symbol}): $${t.tokenPrice.toFixed(2)} | Implied Val: $${t.markValuation ? (t.markValuation / 1e9).toFixed(1) + 'B' : 'N/A'} | NAV Prem: ${t.premium || '0'}%`,
  )

  const tesseraLines = tessera.map(
    t =>
      `• ${t.name} (${t.symbol}): $${t.tokenPrice.toFixed(2)} | Implied Val: $${t.markValuation ? (t.markValuation / 1e9).toFixed(1) + 'B' : 'N/A'} | 0.20% Fee | Chainlink PoR`,
  )

  const text = `Preflight Live Market Catalog 🛫

PreStocks (SPV-backed 1:1 exposure on Solana):
${prestocksLines.join('\n')}

Tessera (Institutional Token-2022 + Proof of Reserve):
${tesseraLines.join('\n')}

To purchase any asset, reply:
"BUY $100 <SYMBOL>" (e.g. "BUY $100 ANTHROPIC" or "BUY $250 SPACEX")

Reply PORTFOLIO anytime to review holdings.

— Preflight Dealflow`

  await sendEmail('agent', {
    to: from,
    subject: '📈 Available Pre-IPO Stocks & Tokens',
    text,
    threadId,
  })
}

async function handleRedeemInfo(from: string, body: string, threadId?: string) {
  const symbols = ['T-OpenAI', 'T-Kalshi', 'T-SpaceX']
  const mentioned = symbols.find(s =>
    body.toUpperCase().includes(s.toUpperCase().replace('T-', '')),
  )

  await sendEmail('agent', {
    to: from,
    subject: 'Tessera Redemption Architecture 🏛️',
    text: `Tessera T-Token Redemption Lifecycle:

1. TRIGGER:
   Occurs only upon an official IPO or Change of Control event (>50% voting).

2. PROCEEDS & LOCK-UP:
   Following post-IPO lock-up expiration (typically 90-180 days), Tessera distributes exit proceeds in stablecoins (USDC).

3. REDEMPTION WINDOW (CRITICAL):
   Tessera announces a formal Redemption Start Date with a fixed window (typically 30 days).
   ⚠️ FORFEITURE WARNING: Missing the deadline results in permanent loss of proceeds.

4. SECONDARY LIQUIDITY:
   You do not need to wait for an IPO. T-Tokens are continuously tradeable on Jupiter and Meteora DEXs with a 0.20% Token-2022 transfer fee.

${mentioned ? `Active feed for ${mentioned}: ${TESSERA.MINTS[mentioned]?.porFeed ? `https://data.chain.link/streams/${TESSERA.MINTS[mentioned].porFeed}` : 'tessera.pe'}` : ''}

— Preflight Dealflow`,
    threadId,
  })
}

async function handleAuctionInfo(
  from: string,
  body: string,
  threadId?: string,
) {
  const symbols = ['T-OpenAI', 'T-Kalshi', 'T-SpaceX']
  const mentioned = symbols.find(s =>
    body.toUpperCase().includes(s.toUpperCase().replace('T-', '')),
  )
  const auction = mentioned ? await fetchTesseraAuction(mentioned) : null

  await sendEmail('agent', {
    to: from,
    subject: 'Meteora Alpha Vault Pro-Rata Auction Mechanics 🏛️',
    text: `Tessera Primary Issuance Mechanics:

${auction?.phases?.map((p, i) => `Phase ${i + 1}: ${p.name}\n  ${p.desc}`).join('\n\n') || `Phase 1: Deposit Period (USDC deposit)\nPhase 2: Uniform Price Acquisition\nPhase 3: Vesting / Claiming`}

Key Advantages:
✅ Anti-Sniper: Bot speed confers zero advantage.
✅ Uniform Pricing: All depositors enter at the exact same valuation.
✅ Pro-Rata Allocation: Oversubscribed rounds provide proportional refunds.

— Preflight Dealflow`,
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
        ? `🆕 New Pre-IPO Listing: ${token.name} (${token.symbol})`
        : `📈 ${token.symbol} Pre-IPO Price Moved ${token.changePct}%`

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

export async function sendRedemptionAlert(
  symbol: string,
  eventType: 'IPO' | 'CHANGE_OF_CONTROL',
  redemptionStartDate: string,
  windowDays = 30,
) {
  const alert = buildRedemptionAlert(
    symbol,
    eventType,
    redemptionStartDate,
    windowDays,
  )
  const subscribers = db.getAllSubscribers()

  for (const sub of subscribers) {
    const portfolio = db.getPortfolio(sub.email)
    if (!portfolio[symbol] && !portfolio[symbol.replace('T-', '')]) continue

    await sendEmail('agent', {
      to: sub.email,
      subject: `🚨 CRITICAL: ${symbol} ${eventType} — Redeem by ${alert.deadline}`,
      text: `ACTION REQUIRED: ${symbol} Liquidity Event

${alert.warning}

Event:             ${eventType}
Window Closes:     ${alert.deadline} (${alert.daysLeft} days remaining)
Payout Asset:      ${alert.stablecoin}

How to claim:
${alert.howToRedeem}

— Preflight`,
    })

    db.logActivity(
      'REDEMPTION_ALERT',
      `Redemption notice sent for ${symbol} to ${sub.email}`,
      {
        symbol,
        deadline: alert.deadline,
      },
    )
  }
}

export async function sendAuctionAlert(symbol: string, auctionData: unknown) {
  const subscribers = db.getAllSubscribers()
  for (const sub of subscribers) {
    await sendEmail('agent', {
      to: sub.email,
      subject: `🏛️ Meteora Alpha Vault LIVE: ${symbol} (Pro-Rata Anti-Sniper)`,
      text: `A new primary allocation for ${symbol} is open on Tessera.\n\nAll depositors receive uniform pricing. Deposit USDC on tessera.pe/auction.\n\n— Preflight`,
    })
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
