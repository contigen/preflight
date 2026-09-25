export type SectorComparable = {
  sector: string
  ticker: string
  name: string
  approxMarketCap: string
  evToRevenueMultiple: string
}

const PUBLIC_BENCHMARKS: Record<string, SectorComparable[]> = {
  AI: [
    {
      sector: 'AI',
      ticker: 'MSFT',
      name: 'Microsoft',
      approxMarketCap: '$3.1T',
      evToRevenueMultiple: '12.4x',
    },
    {
      sector: 'AI',
      ticker: 'NVDA',
      name: 'Nvidia',
      approxMarketCap: '$2.9T',
      evToRevenueMultiple: '24.1x',
    },
    {
      sector: 'AI',
      ticker: 'GOOGL',
      name: 'Alphabet',
      approxMarketCap: '$2.1T',
      evToRevenueMultiple: '6.8x',
    },
  ],
  Space: [
    {
      sector: 'Space',
      ticker: 'LMT',
      name: 'Lockheed Martin',
      approxMarketCap: '$130B',
      evToRevenueMultiple: '1.9x',
    },
    {
      sector: 'Space',
      ticker: 'RKLB',
      name: 'Rocket Lab',
      approxMarketCap: '$5.2B',
      evToRevenueMultiple: '14.2x',
    },
  ],
  Defense: [
    {
      sector: 'Defense',
      ticker: 'LMT',
      name: 'Lockheed Martin',
      approxMarketCap: '$130B',
      evToRevenueMultiple: '1.9x',
    },
    {
      sector: 'Defense',
      ticker: 'PLTR',
      name: 'Palantir',
      approxMarketCap: '$85B',
      evToRevenueMultiple: '32.0x',
    },
    {
      sector: 'Defense',
      ticker: 'NOC',
      name: 'Northrop Grumman',
      approxMarketCap: '$75B',
      evToRevenueMultiple: '1.8x',
    },
  ],
  'Prediction Markets': [
    {
      sector: 'Prediction Markets',
      ticker: 'HOOD',
      name: 'Robinhood',
      approxMarketCap: '$19B',
      evToRevenueMultiple: '8.5x',
    },
    {
      sector: 'Prediction Markets',
      ticker: 'CME',
      name: 'CME Group',
      approxMarketCap: '$78B',
      evToRevenueMultiple: '14.1x',
    },
    {
      sector: 'Prediction Markets',
      ticker: 'DKNG',
      name: 'DraftKings',
      approxMarketCap: '$18B',
      evToRevenueMultiple: '3.7x',
    },
  ],
  Robotics: [
    {
      sector: 'Robotics',
      ticker: 'TSLA',
      name: 'Tesla (Optimus)',
      approxMarketCap: '$720B',
      evToRevenueMultiple: '7.1x',
    },
    {
      sector: 'Robotics',
      ticker: 'ISRG',
      name: 'Intuitive Surgical',
      approxMarketCap: '$170B',
      evToRevenueMultiple: '21.5x',
    },
  ],
}

export function getSectorComparables(sector: string): SectorComparable[] {
  return PUBLIC_BENCHMARKS[sector] || PUBLIC_BENCHMARKS['AI']
}

export function formatComparablesForMemo(sector: string): string {
  const comps = getSectorComparables(sector)
  if (!comps.length) return ''
  const list = comps
    .map(
      c =>
        `${c.ticker} (${c.name}): ${c.approxMarketCap} [~${c.evToRevenueMultiple} EV/Rev]`,
    )
    .join(', ')
  return `Public Market Benchmarks: ${list}`
}
