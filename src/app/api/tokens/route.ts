import { NextResponse } from 'next/server'
import { fetchAllTokens } from '@/lib/tokens/aggregator'
import { db } from '@/lib/db/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const tokens = await fetchAllTokens()
    db.setSnapshot(tokens)

    const totalValuation = tokens.reduce(
      (sum, t) => sum + (t.markValuation || t.impliedValuation || 0),
      0,
    )

    const prestocksCount = tokens.filter(t => t.source === 'PreStocks').length

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalTokens: tokens.length,
        prestocksCount,
        totalTrackedValuation: totalValuation,
        valuationDisplay: `$${(totalValuation / 1e9).toFixed(1)}B`,
      },
      tokens,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { success: false, error: msg, tokens: db.getSnapshot() },
      { status: 500 },
    )
  }
}
