import { sleep } from 'workflow'
import { db } from '@/lib/db/store'
import { sendEmail } from '@/lib/email/client'
import { executeDevnetTrade } from '@/lib/solana/devnet'
import type { SubscriberProfile, Token, SwapResult } from '@/types'

export type OrderWorkflowParams = {
  userEmail: string
  token: Token
  amountUsd: number
  tokenQty: number
  pricePerToken: number
  quote: SwapResult
  intentId: string
}

export async function sendDealMemoStep(
  subscriber: SubscriberProfile,
  token: Token,
  memo: string,
): Promise<{ success: boolean; messageId?: string }> {
  'use step'

  const subject =
    token.changeType === 'NEW_LISTING'
      ? `🆕 New Pre-IPO Listing: ${token.name} (${token.symbol})`
      : `📈 ${token.symbol} Pre-IPO Price Moved ${token.changePct}%`

  db.setLastAlertedToken(subscriber.email, token.symbol)

  const res = await sendEmail('agent', {
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

  return { success: res.success, messageId: res.messageId }
}

export async function sendQuoteStep(
  params: OrderWorkflowParams,
): Promise<{ success: boolean; messageId?: string }> {
  'use step'

  const transferFeeNote =
    params.token.source === 'Tessera'
      ? '\nToken-2022 Transfer Fee: 0.20% (standard built-in protocol fee)'
      : ''

  const text = `Order Summary:

Action:     BUY
Asset:      ${params.token.name} (${params.token.symbol})
Source:     ${params.token.source}
Allocation: $${params.amountUsd.toFixed(2)} USD -> ~${params.tokenQty.toFixed(4)} tokens
Execution:  $${params.pricePerToken.toFixed(2)} per token
Est. Fee:   ${params.quote.feePct}% ($${params.quote.feeUsd})${transferFeeNote}
Est. Slip:  ~${params.quote.slippagePct}%
Network:    Solana Devnet

⏱ This locked quote expires in 15 minutes.

Reply CONFIRM to execute on-chain.
Reply PASS to cancel.

Intent ID: ${params.intentId}
— Preflight`

  const res = await sendEmail('agent', {
    to: params.userEmail,
    subject: `Confirm Trade Order: ${params.token.symbol} 🔐`,
    text,
  })

  return { success: res.success, messageId: res.messageId }
}

export async function checkAndExpireQuoteStep(
  intentId: string,
  userEmail: string,
  symbol: string,
): Promise<boolean> {
  'use step'

  const intent = db.getIntent(intentId)
  if (intent && intent.status === 'PENDING') {
    db.cancelIntent(intentId)

    await sendEmail('agent', {
      to: userEmail,
      subject: `Quote Expired: ${symbol} ⏱️`,
      text: `Your 15-minute locked quote for ${symbol} has expired.\n\nReply BUY <amount> anytime to receive a fresh execution quote.\n\n— Preflight`,
    })

    return true
  }

  return false
}

export async function executeSettlementStep(
  intentId: string,
  userEmail: string,
  token: Token,
  amountUsd: number,
  tokenQty: number,
  priceAtIntent: number,
): Promise<{ txHash: string; messageId?: string }> {
  'use step'

  const swapResult = await executeDevnetTrade(token, amountUsd, userEmail)
  db.confirmIntent(intentId, swapResult.txHash)

  const res = await sendEmail('agent', {
    to: userEmail,
    subject: `✅ Trade Executed: ${token.symbol} on Solana Devnet`,
    text: `Your purchase has settled on Solana! 🚀

Token:       ${token.name} (${token.symbol})
Amount Paid: $${amountUsd.toFixed(2)} USDC
Received:    ${tokenQty.toFixed(4)} tokens
Unit Cost:   $${priceAtIntent.toFixed(2)}
Network:     Solana Devnet
Tx Hash:     ${swapResult.txHash}
Explorer:    https://explorer.solana.com/tx/${swapResult.txHash}?cluster=devnet

Your portfolio is updated. Reply PORTFOLIO anytime to review positions.

— Preflight 🛫`,
  })

  return { txHash: swapResult.txHash, messageId: res.messageId }
}

export async function dealAlertWorkflow(
  subscriber: SubscriberProfile,
  token: Token,
  memo: string,
) {
  'use workflow'

  await sendDealMemoStep(subscriber, token, memo)
}

export async function orderQuoteWorkflow(params: OrderWorkflowParams) {
  'use workflow'

  await sendQuoteStep(params)
  await sleep('15m')
  await checkAndExpireQuoteStep(
    params.intentId,
    params.userEmail,
    params.token.symbol,
  )
}

export async function executeTradeWorkflow(
  intentId: string,
  userEmail: string,
  token: Token,
  amountUsd: number,
  tokenQty: number,
  priceAtIntent: number,
) {
  'use workflow'

  await executeSettlementStep(
    intentId,
    userEmail,
    token,
    amountUsd,
    tokenQty,
    priceAtIntent,
  )
}
