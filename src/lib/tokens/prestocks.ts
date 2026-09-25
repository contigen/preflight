import type { Token } from '@/types'

const PRESTOCKS_URL = 'https://prestocks.com/api/prestocks'

type RawPreStocksToken = {
  name: string
  symbol: string
  description?: string
  image?: string
  contract_address?: string
  tokenPrice: number
  markPrice?: number
  impliedValuation?: number
  markValuation?: number
  supply?: number
  sector?: string
}

export async function fetchPreStocks(): Promise<Token[]> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(PRESTOCKS_URL, {
      headers: {
        Accept: 'application/json',
        Referer: 'https://prestocks.com/',
      },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      throw new Error(`PreStocks HTTP ${res.status}`)
    }

    const data = (await res.json()) as RawPreStocksToken[]
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Empty PreStocks response')
    }

    return data.map(t => {
      const premium =
        t.markPrice && t.markPrice > 0
          ? (((t.tokenPrice - t.markPrice) / t.markPrice) * 100).toFixed(2)
          : null

      return {
        source: 'PreStocks',
        name: t.name,
        symbol: t.symbol?.toUpperCase(),
        description: t.description,
        image: t.image,
        contractAddress: t.contract_address,
        tokenPrice: Number(t.tokenPrice) || 0,
        markPrice: t.markPrice ? Number(t.markPrice) : undefined,
        impliedValuation: t.impliedValuation
          ? Number(t.impliedValuation)
          : undefined,
        markValuation: t.markValuation ? Number(t.markValuation) : undefined,
        supply: t.supply ? Number(t.supply) : undefined,
        sector: t.sector || inferSector(t.name),
        premium,
        legalStructure: 'SPV-backed token',
        transferFeePct: 0,
        standard: 'SPL',
        url: `https://prestocks.com/${t.symbol?.toLowerCase()}`,
        solscan: t.contract_address
          ? `https://solscan.io/token/${t.contract_address}`
          : undefined,
      }
    })
  } catch {
    const { db } = await import('@/lib/db/store')
    return db.getSnapshot().filter(t => t.source === 'PreStocks')
  }
}

export function inferSector(name = ''): string {
  const n = name.toLowerCase()
  if (['anthropic', 'openai', 'figureai', 'ai'].some(k => n.includes(k)))
    return 'AI'
  if (['spacex', 'rocket', 'space'].some(k => n.includes(k))) return 'Space'
  if (['anduril', 'defense'].some(k => n.includes(k))) return 'Defense'
  if (['kalshi', 'polymarket', 'predict'].some(k => n.includes(k)))
    return 'Prediction Markets'
  if (['neuralink', 'robot', 'figure'].some(k => n.includes(k)))
    return 'Robotics'
  return 'General'
}
