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
        'User-Agent': 'Mozilla/5.0 (compatible; PreflightApp/1.0)',
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
    return PRESTOCKS_SEED
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

export const PRESTOCKS_SEED: Token[] = [
  {
    source: 'PreStocks',
    name: 'Anthropic',
    symbol: 'ANTHROPIC',
    sector: 'AI',
    tokenPrice: 390.0,
    markPrice: 380.0,
    markValuation: 225_000_000_000,
    impliedValuation: 225_000_000_000,
    premium: '2.63',
    legalStructure: 'SPV-backed token',
    transferFeePct: 0,
    standard: 'SPL',
    contractAddress: 'Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw',
    url: 'https://prestocks.com/anthropic',
    solscan:
      'https://solscan.io/token/Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw',
    description: 'AI safety research company behind Claude',
  },
  {
    source: 'PreStocks',
    name: 'OpenAI',
    symbol: 'OPENAI',
    sector: 'AI',
    tokenPrice: 175.0,
    markPrice: 172.0,
    markValuation: 300_000_000_000,
    impliedValuation: 300_000_000_000,
    premium: '1.74',
    legalStructure: 'SPV-backed token',
    transferFeePct: 0,
    standard: 'SPL',
    contractAddress: 'PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF',
    url: 'https://prestocks.com/openai',
    solscan:
      'https://solscan.io/token/PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF',
    description: 'Creator of ChatGPT, GPT-4, and frontier foundation models',
  },
  {
    source: 'PreStocks',
    name: 'SpaceX',
    symbol: 'SPACEX',
    sector: 'Space',
    tokenPrice: 420.0,
    markPrice: 415.0,
    markValuation: 350_000_000_000,
    impliedValuation: 350_000_000_000,
    premium: '1.20',
    legalStructure: 'SPV-backed token',
    transferFeePct: 0,
    standard: 'SPL',
    contractAddress: 'PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh',
    url: 'https://prestocks.com/spacex',
    solscan:
      'https://solscan.io/token/PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh',
    description:
      'Aerospace manufacturer, Starlink operator, and space transport leader',
  },
  {
    source: 'PreStocks',
    name: 'Anduril',
    symbol: 'ANDURIL',
    sector: 'Defense',
    tokenPrice: 95.0,
    markPrice: 92.0,
    markValuation: 28_000_000_000,
    impliedValuation: 28_000_000_000,
    premium: '3.26',
    legalStructure: 'SPV-backed token',
    transferFeePct: 0,
    standard: 'SPL',
    contractAddress: 'PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB',
    url: 'https://prestocks.com/anduril',
    solscan:
      'https://solscan.io/token/PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB',
    description: 'Autonomous defense technology, AI hardware, and Lattice OS',
  },
  {
    source: 'PreStocks',
    name: 'Kalshi',
    symbol: 'KALSHI',
    sector: 'Prediction Markets',
    tokenPrice: 33.0,
    markPrice: 32.0,
    markValuation: 2_000_000_000,
    impliedValuation: 2_000_000_000,
    premium: '3.13',
    legalStructure: 'SPV-backed token',
    transferFeePct: 0,
    standard: 'SPL',
    contractAddress: 'PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua',
    url: 'https://prestocks.com/kalshi',
    solscan:
      'https://solscan.io/token/PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua',
    description:
      'CFTC-regulated event contracts and prediction market exchange',
  },
  {
    source: 'PreStocks',
    name: 'Neuralink',
    symbol: 'NEURALINK',
    sector: 'Robotics',
    tokenPrice: 52.0,
    markPrice: 50.0,
    markValuation: 8_000_000_000,
    impliedValuation: 8_000_000_000,
    premium: '4.00',
    legalStructure: 'SPV-backed token',
    transferFeePct: 0,
    standard: 'SPL',
    contractAddress: 'PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S',
    url: 'https://prestocks.com/neuralink',
    solscan:
      'https://solscan.io/token/PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S',
    description:
      'Ultra-high bandwidth brain-computer interfaces for human cognition',
  },
  {
    source: 'PreStocks',
    name: 'FigureAI',
    symbol: 'FIGUREAI',
    sector: 'Robotics',
    tokenPrice: 18.0,
    markPrice: 17.5,
    markValuation: 2_600_000_000,
    impliedValuation: 2_600_000_000,
    premium: '2.86',
    legalStructure: 'SPV-backed token',
    transferFeePct: 0,
    standard: 'SPL',
    contractAddress: 'PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd',
    url: 'https://prestocks.com/figureai',
    solscan:
      'https://solscan.io/token/PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd',
    description:
      'Autonomous humanoid robots designed for industrial deployment',
  },
  {
    source: 'PreStocks',
    name: 'Polymarket',
    symbol: 'POLYMARKET',
    sector: 'Prediction Markets',
    tokenPrice: 8.5,
    markPrice: 8.2,
    markValuation: 1_000_000_000,
    impliedValuation: 1_000_000_000,
    premium: '3.66',
    legalStructure: 'SPV-backed token',
    transferFeePct: 0,
    standard: 'SPL',
    contractAddress: 'Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP',
    url: 'https://prestocks.com/polymarket',
    solscan:
      'https://solscan.io/token/Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP',
    description:
      'Decentralized information markets protocol and global forecasting platform',
  },
]
