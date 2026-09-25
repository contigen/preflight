import { NextResponse } from 'next/server'
import { executeDevnetTrade } from '@/lib/solana/devnet'
import { db } from '@/lib/db/store'
import { fetchAllTokens } from '@/lib/tokens/aggregator'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      symbol?: string
      amountUsd?: number
      action?: 'BUY' | 'SELL'
      email?: string
    }

    const { symbol, amountUsd, action = 'BUY', email } = body

    if (!email) {
      return NextResponse.json(
        {
          error:
            'Authentication required: please connect your email to execute orders',
        },
        { status: 401 },
      )
    }

    if (!symbol || !amountUsd || amountUsd <= 0) {
      return NextResponse.json(
        { error: 'Invalid symbol or amountUsd' },
        { status: 400 },
      )
    }

    const tokens = await fetchAllTokens()
    const token = tokens.find(
      t =>
        t.symbol.toUpperCase() === symbol.toUpperCase() ||
        t.name.toUpperCase().includes(symbol.toUpperCase()),
    )

    if (!token) {
      return NextResponse.json(
        { error: `Token ${symbol} not found` },
        { status: 404 },
      )
    }

    const swap = await executeDevnetTrade(token, Number(amountUsd), email)
    const tokenQty = Number(amountUsd) / token.tokenPrice

    if (action === 'BUY') {
      db.createIntent(
        email,
        'BUY',
        token,
        Number(amountUsd),
        tokenQty,
        token.tokenPrice,
      )
      const latestIntent = db.getLatestPendingIntent(email)
      if (latestIntent) {
        db.confirmIntent(latestIntent.id, swap.txHash)
      }
    } else {
      db.createIntent(
        email,
        'SELL',
        token,
        Number(amountUsd),
        tokenQty,
        token.tokenPrice,
      )
      const latestIntent = db.getLatestPendingIntent(email)
      if (latestIntent) {
        db.confirmIntent(latestIntent.id, swap.txHash)
      }
    }

    return NextResponse.json({
      success: true,
      swap,
      portfolio: db.getPortfolio(email),
      activity: db.getActivityLog(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
