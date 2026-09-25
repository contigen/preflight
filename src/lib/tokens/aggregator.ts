import { fetchPreStocks } from './prestocks'
import { db } from '@/lib/db/store'
import type { Token, SubscriberProfile } from '@/types'

export async function fetchAllTokens(): Promise<Token[]> {
  try {
    const prestocks = await fetchPreStocks()
    if (prestocks.length > 0) {
      return prestocks
    }
  } catch (error) {
    console.error('Failed to fetch PreStocks:', error)
  }

  return db.getSnapshot().filter(t => t.source === 'PreStocks')
}

export function detectMoves(
  current: Token[],
  lastSnapshot: Token[],
  thresholdPct = 3,
): Token[] {
  const moves: Token[] = []

  for (const token of current) {
    const prev = lastSnapshot.find(t => t.symbol === token.symbol)
    if (!prev) {
      moves.push({ ...token, changeType: 'NEW_LISTING', changePct: null })
      continue
    }

    if (prev.tokenPrice > 0) {
      const changePct =
        ((token.tokenPrice - prev.tokenPrice) / prev.tokenPrice) * 100
      if (Math.abs(changePct) >= thresholdPct) {
        moves.push({
          ...token,
          changeType: 'PRICE_MOVE',
          changePct: changePct.toFixed(2),
        })
      }
    }
  }

  return moves
}

export function shouldNotifySubscriber(
  subscriber: SubscriberProfile,
  token: Token,
): boolean {
  if (!subscriber.sectors || subscriber.sectors.length === 0) return true

  const tokenText =
    `${token.name} ${token.symbol} ${token.sector || ''}`.toLowerCase()
  const sectorMap: Record<string, string[]> = {
    AI: ['anthropic', 'openai', 'figureai', 'ai', 'artificial intelligence'],
    Defense: ['anduril', 'defense', 'military', 'autonomous'],
    Space: ['spacex', 'space', 'aerospace', 'starlink'],
    'Prediction Markets': ['kalshi', 'polymarket', 'prediction', 'forecast'],
    Robotics: ['figureai', 'neuralink', 'robot', 'humanoid'],
    Biotech: ['neuralink', 'bio', 'medical'],
    Fintech: ['kalshi', 'fintech', 'market'],
  }

  return subscriber.sectors.some(pref => {
    const keywords = sectorMap[pref] || [pref.toLowerCase()]
    return keywords.some(kw => tokenText.includes(kw))
  })
}
