import { NextResponse } from 'next/server'
import {
  fetchAllTokens,
  detectMoves,
  shouldNotifySubscriber,
} from '@/lib/tokens/aggregator'
import { fetchTesseraAuction } from '@/lib/tokens/tessera'
import { db } from '@/lib/db/store'
import { generateDealMemo } from '@/lib/ai/gemini'
import { sendDealAlert, sendAuctionAlert } from '@/lib/email/handler'
import { syncInboundInbox } from '@/lib/email/inbox-sync'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handleMonitorCycle()
}

export async function POST() {
  return handleMonitorCycle()
}

async function handleMonitorCycle() {
  try {
    try {
      await syncInboundInbox()
    } catch {}

    const currentTokens = await fetchAllTokens()
    const lastSnapshot = db.getSnapshot()

    if (lastSnapshot.length === 0) {
      db.setSnapshot(currentTokens)
      return NextResponse.json({
        success: true,
        message: `Initial snapshot initialized with ${currentTokens.length} tokens`,
        movesDetected: 0,
      })
    }

    const moves = detectMoves(currentTokens, lastSnapshot, 3)
    const subscribers = db.getAllSubscribers()
    let alertsSent = 0

    for (const move of moves) {
      for (const sub of subscribers) {
        if (!shouldNotifySubscriber(sub, move)) continue

        try {
          const memo = await generateDealMemo(move, sub)
          await sendDealAlert(sub, move, memo)
          alertsSent++
        } catch {}
      }
    }

    const tesseraSymbols = ['T-OpenAI', 'T-Kalshi', 'T-SpaceX']
    let liveAuctionsFound = 0
    for (const symbol of tesseraSymbols) {
      try {
        const auction = await fetchTesseraAuction(symbol)
        if (auction.status === 'LIVE') {
          liveAuctionsFound++
          await sendAuctionAlert(symbol, auction)
        }
      } catch {}
    }

    db.setSnapshot(currentTokens)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tokensCount: currentTokens.length,
      movesCount: moves.length,
      alertsSent,
      liveAuctionsFound,
      moves,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
