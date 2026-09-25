import { NextResponse } from 'next/server'
import { generateDealMemo } from '@/lib/ai/gemini'
import { fetchAllTokens } from '@/lib/tokens/aggregator'
import { db } from '@/lib/db/store'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      symbol?: string
      email?: string
    }

    const { symbol, email = 'investor@preflight.trade' } = body

    if (!symbol) {
      return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })
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

    const subscriber = db.getSubscriber(email) || {
      email,
      sectors: ['AI', 'Space'],
      maxUsd: 500,
      notifyOnNew: true,
      notifyOnMove: true,
      name: null,
      joinedAt: new Date().toISOString(),
    }

    const memo = await generateDealMemo(token, subscriber)

    return NextResponse.json({
      success: true,
      memo,
      symbol: token.symbol,
      token,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
