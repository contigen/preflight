import { NextResponse } from 'next/server'
import { parseReplyIntent } from '@/lib/ai/gemini'
import { fetchAllTokens } from '@/lib/tokens/aggregator'
import { db } from '@/lib/db/store'
import { executeDevnetTrade } from '@/lib/solana/devnet'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      text?: string
      email?: string
      contextSymbol?: string
    }

    const { text, email, contextSymbol } = body

    if (!email) {
      return NextResponse.json(
        {
          error:
            'Please connect your email to interact with the autonomous agent.',
        },
        { status: 401 },
      )
    }

    if (!text) {
      return NextResponse.json({ error: 'Missing text body' }, { status: 400 })
    }

    const tokens = await fetchAllTokens()
    const intent = await parseReplyIntent(text)

    const targetSymbol = intent.symbol || contextSymbol || 'ANTHROPIC'
    const matchedToken = tokens.find(
      t => t.symbol.toUpperCase() === targetSymbol.toUpperCase(),
    )

    let executionResult = null

    if (intent.intent === 'CONFIRM' && matchedToken) {
      const pending = db.getLatestPendingIntent(email)
      const amountUsd = pending ? pending.amountUsd : intent.amountUsd || 250
      const swap = await executeDevnetTrade(matchedToken, amountUsd, email)
      if (pending) {
        db.confirmIntent(pending.id, swap.txHash)
      } else {
        const tokenQty = amountUsd / matchedToken.tokenPrice
        const created = db.createIntent(
          email,
          'BUY',
          matchedToken,
          amountUsd,
          tokenQty,
          matchedToken.tokenPrice,
        )
        db.confirmIntent(created.id, swap.txHash)
      }
      executionResult = swap
    } else if (intent.intent === 'BUY' && matchedToken && intent.amountUsd) {
      const tokenQty = intent.amountUsd / matchedToken.tokenPrice
      db.createIntent(
        email,
        'BUY',
        matchedToken,
        intent.amountUsd,
        tokenQty,
        matchedToken.tokenPrice,
      )
    } else if (intent.intent === 'SELL' && matchedToken && intent.amountUsd) {
      const tokenQty = intent.amountUsd / matchedToken.tokenPrice
      db.createIntent(
        email,
        'SELL',
        matchedToken,
        intent.amountUsd,
        tokenQty,
        matchedToken.tokenPrice,
      )
    }

    return NextResponse.json({
      success: true,
      intent,
      token: matchedToken || null,
      executionResult,
      portfolio: db.getPortfolio(email),
      activity: db.getActivityLog(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
