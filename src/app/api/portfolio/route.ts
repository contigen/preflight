import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/store'
import { fetchAllTokens } from '@/lib/tokens/aggregator'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')
  if (!email) {
    return NextResponse.json({
      success: true,
      email: null,
      summary: {
        totalValue: 0,
        totalInvested: 0,
        totalPnl: 0,
        totalPnlPct: 0,
        positionsCount: 0,
      },
      positions: [],
      activity: db.getActivityLog().slice(0, 10),
    })
  }

  const portfolio = db.getPortfolio(email)
  let tokens = db.getSnapshot()
  if (tokens.length === 0) {
    tokens = await fetchAllTokens()
    db.setSnapshot(tokens)
  }

  let totalValue = 0
  let totalInvested = 0

  const positions = Object.values(portfolio).map(pos => {
    const current = tokens.find(t => t.symbol === pos.symbol)
    const currentPrice = current?.tokenPrice || pos.avgPrice
    const currentValue = pos.qty * currentPrice
    const pnl = currentValue - pos.totalInvested
    const pnlPct = pos.totalInvested > 0 ? (pnl / pos.totalInvested) * 100 : 0

    totalValue += currentValue
    totalInvested += pos.totalInvested

    return {
      symbol: pos.symbol,
      qty: pos.qty,
      avgPrice: pos.avgPrice,
      currentPrice,
      totalInvested: pos.totalInvested,
      currentValue,
      pnl,
      pnlPct,
      token: current,
    }
  })

  const totalPnl = totalValue - totalInvested
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0

  return NextResponse.json({
    success: true,
    email,
    summary: {
      totalValue,
      totalInvested,
      totalPnl,
      totalPnlPct,
      positionsCount: positions.length,
    },
    positions,
    activity: db.getActivityLog().slice(0, 10),
  })
}
