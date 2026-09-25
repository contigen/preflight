import { Connection, PublicKey } from '@solana/web3.js'
import type {
  Token,
  TesseraOnChain,
  TesseraPoR,
  TesseraAuction,
  TesseraEnrichedToken,
  RedemptionAlertData,
} from '@/types'

export const TESSERA = {
  TOKEN_PROGRAM: 'TESQvsR4TmYxiroPPQgZpVRoSFG8pru4fsYr67iv6kf',
  REFERRAL_PROGRAM: 'TESMgr3q4s1CK5nGz7bmkbMQBQeSt8N9wpZjTDWm2cY',
  FIREBLOCKS_AUTH: 'EXvTtxurWBUNNCtLojaN8ZBJFNJPZFSH3szoih9hh7YW',

  MINTS: {
    'T-SpaceX': {
      mint: 'TSPXcLV76s6V2zDiZQ18kBfcbnjaE2ZzNT3ga2Pd99v',
      decimals: 9,
      feeBps: 20,
      porFeed: 'tspacex-usd-smartdata-datalink',
      solscan:
        'https://solscan.io/token/TSPXcLV76s6V2zDiZQ18kBfcbnjaE2ZzNT3ga2Pd99v',
    },
    'T-Kalshi': {
      mint: 'TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ',
      decimals: 9,
      feeBps: 20,
      porFeed: 'tkalshi-usd-smartdata-datalink',
      solscan:
        'https://solscan.io/token/TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ',
    },
    'T-OpenAI': {
      mint: 'oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ',
      decimals: 9,
      feeBps: 20,
      porFeed: 'topenai--nav-streams',
      solscan:
        'https://solscan.io/token/oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ',
    },
  } as Record<
    string,
    {
      mint: string
      decimals: number
      feeBps: number
      porFeed: string
      solscan: string
    }
  >,

  CHAINLINK_BASE: 'https://data.chain.link/streams',
  API_BASE: 'https://rest-api.tessera.pe/v1/public',
}

const mainnetConnection = new Connection(
  process.env.SOLANA_MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com',
  'confirmed',
)

type RawTesseraToken = {
  name: string
  symbol: string
  code?: string
  sector?: string
  mint?: string
  markPrice: number
  markValuation?: number
  holders?: number
}

export async function fetchTesseraTokens(): Promise<Token[]> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(`${TESSERA.API_BASE}/token-details`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      throw new Error(`Tessera HTTP ${res.status}`)
    }

    const data = (await res.json()) as RawTesseraToken[]
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Empty Tessera response')
    }

    return data.map(t => {
      const config = TESSERA.MINTS[t.symbol] || {}
      return {
        source: 'Tessera',
        name: t.name,
        symbol: t.symbol,
        code: t.code,
        sector: t.sector || 'Tech',
        mint: t.mint || config.mint,
        contractAddress: t.mint || config.mint,
        tokenPrice: Number(t.markPrice) || 0,
        markPrice: Number(t.markPrice) || 0,
        markValuation: t.markValuation ? Number(t.markValuation) : undefined,
        impliedValuation: t.markValuation ? Number(t.markValuation) : undefined,
        holders: t.holders ? Number(t.holders) : undefined,
        transferFeePct: 0.2,
        standard: 'Token-2022',
        legalStructure: 'Loan participation right (not a security)',
        url: 'https://tessera.pe',
        solscan:
          config.solscan ||
          (t.mint ? `https://solscan.io/token/${t.mint}` : undefined),
        porFeed: config.porFeed,
        decimals: config.decimals || 9,
        feeBps: config.feeBps || 20,
      }
    })
  } catch {
    return TESSERA_SEED
  }
}

export async function fetchTesseraMintOnChain(
  symbol: string,
): Promise<TesseraOnChain | null> {
  const mintConfig = TESSERA.MINTS[symbol]
  if (!mintConfig) return null

  try {
    const mintPubkey = new PublicKey(mintConfig.mint)

    const [supplyResp, accountsResp] = await Promise.all([
      mainnetConnection.getTokenSupply(mintPubkey),
      mainnetConnection.getTokenLargestAccounts(mintPubkey),
    ])

    const supply = supplyResp.value
    const topHolders = accountsResp.value.slice(0, 5).map(a => ({
      address: a.address.toBase58(),
      amount: parseFloat(a.amount) / 10 ** mintConfig.decimals,
      uiAmount: a.uiAmount,
    }))

    return {
      symbol,
      mint: mintConfig.mint,
      decimals: supply.decimals,
      totalSupply: supply.uiAmount,
      rawSupply: supply.amount,
      transferFeeBps: mintConfig.feeBps,
      transferFeePct: mintConfig.feeBps / 100,
      standard: 'Token-2022',
      topHolders,
      solscan: mintConfig.solscan,
    }
  } catch {
    return null
  }
}

export async function fetchTesseraPoR(
  symbol: string,
): Promise<TesseraPoR | null> {
  const feedId = TESSERA.MINTS[symbol]?.porFeed
  if (!feedId) return null

  return {
    symbol,
    feedUrl: `${TESSERA.CHAINLINK_BASE}/${feedId}`,
    feedId,
    verifiedBy: 'Chainlink SmartData (DataLink)',
    auditedBy: 'Accretion Labs / Independent Auditors (~monthly)',
    custodian: 'Fireblocks — Cayman Islands Segregated Portfolio Company (SPC)',
    reserve: '1:1 verified backing (token supply ≤ verified assets in custody)',
    onChain: true,
    note: 'Auditors verify holdings; Chainlink oracle publishes on-chain reserve proof',
  }
}

export async function fetchTesseraAuction(
  symbol: string,
): Promise<TesseraAuction> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${TESSERA.API_BASE}/auctions`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      const auctions = (await res.json()) as Array<{
        symbol: string
        status?: 'LIVE' | 'UPCOMING' | 'CLOSED'
      }>
      const found = auctions.find(a => a.symbol === symbol)
      if (found) {
        return {
          symbol,
          mechanism: 'Meteora Alpha Vault — Pro-Rata',
          phases: [
            {
              name: 'Deposit Period',
              desc: 'Commit USDC — no bot speed advantage, deposit amount sets allocation',
            },
            {
              name: 'Token Acquisition',
              desc: 'Alpha Vault executes uniform price purchase before open pool listing',
            },
            {
              name: 'Vesting & Claiming',
              desc: 'Claim tokens according to lock-up schedule on tessera.pe/vesting',
            },
          ],
          antiSniper: true,
          uniformPrice: true,
          status: found.status || 'MONITORING',
          note: 'Check tessera.pe/auction for live commitments and timeline',
        }
      }
    }
  } catch {}

  return {
    symbol,
    mechanism: 'Meteora Alpha Vault — Pro-Rata',
    phases: [
      {
        name: 'Deposit Period',
        desc: 'Commit USDC — no bot speed advantage, deposit amount sets allocation',
      },
      {
        name: 'Token Acquisition',
        desc: 'Alpha Vault executes uniform price purchase before open pool listing',
      },
      {
        name: 'Vesting & Claiming',
        desc: 'Claim tokens according to lock-up schedule on tessera.pe/vesting',
      },
    ],
    antiSniper: true,
    uniformPrice: true,
    status: 'MONITORING',
    note: 'Uniform price allocation with proportional refund on oversubscription',
  }
}

export function buildRedemptionAlert(
  symbol: string,
  eventType: 'IPO' | 'CHANGE_OF_CONTROL',
  redemptionStartDate: string,
  windowDays = 30,
): RedemptionAlertData {
  const deadline = new Date(redemptionStartDate)
  deadline.setDate(deadline.getDate() + windowDays)
  const daysLeft = Math.max(
    0,
    Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  )

  return {
    symbol,
    eventType,
    redemptionStartDate,
    windowDays,
    deadline: deadline.toISOString().split('T')[0],
    daysLeft,
    stablecoin: "USDC (at Tessera's discretion)",
    transferFeeOnSell:
      '0.2% (Token-2022 applies if sold on DEX instead of redeemed)',
    warning: `⚠️ CRITICAL: Must redeem by ${deadline.toDateString()}. Unclaimed proceeds are permanently forfeited.`,
    howToRedeem:
      'Visit tessera.pe → Redemption tab → Connect Solana wallet → Claim USDC proceeds',
    taxNote: 'Redemption is a taxable capital event. Consult your tax advisor.',
  }
}

export async function getTesseraEnrichedToken(
  symbol: string,
): Promise<TesseraEnrichedToken | null> {
  const [tokens, onChain, por, auction] = await Promise.all([
    fetchTesseraTokens(),
    fetchTesseraMintOnChain(symbol),
    fetchTesseraPoR(symbol),
    fetchTesseraAuction(symbol),
  ])

  const base = tokens.find(t => t.symbol === symbol)
  if (!base) return null

  return {
    ...base,
    onChain,
    por,
    auction,
    marketCapStr: base.markValuation
      ? `$${(base.markValuation / 1e9).toFixed(1)}B`
      : 'N/A',
    priceStr: `$${base.tokenPrice.toFixed(2)}`,
    feeOnTransfer:
      '0.2% deducted automatically on every transfer (Token-2022 standard)',
    tradeableOn: ['Jupiter', 'Meteora'],
    custodian: 'Fireblocks (Cayman Islands SPC)',
    auditedBy: 'Accretion Labs',
    geography: 'Non-US persons (terms at tessera.pe/terms)',
  }
}

export function buildTesseraContext(enriched: TesseraEnrichedToken): string {
  const { por, auction, onChain } = enriched

  return `
TESSERA TOKEN SPECIFICATION:
• Legal Structure: ${enriched.legalStructure}
• Token Standard: Token-2022 (built-in 0.20% transfer fee on every movement)
• Transfer Fee: ${enriched.feeOnTransfer}
• Institutional Custody: ${enriched.custodian}
• Audit: ${enriched.auditedBy}
• Proof of Reserve: Chainlink PoR (${por?.reserve || '1:1 verified backing'})
  Feed: ${por?.feedUrl || 'data.chain.link'}
• On-Chain Total Supply: ${onChain?.totalSupply ? onChain.totalSupply.toLocaleString() : 'see Solscan'} tokens
• Holder Concentration: ${onChain?.topHolders?.length ? `${onChain.topHolders.length} largest accounts on-chain` : 'see Solscan'}
• Liquidity Pools: ${enriched.tradeableOn.join(', ')}
• Primary Auction Model: ${auction?.mechanism || 'Meteora Alpha Vault — Pro-Rata'} (anti-sniper, uniform price)
• Solscan: ${enriched.solscan || 'solscan.io'}
  `.trim()
}

export const TESSERA_SEED: Token[] = [
  {
    source: 'Tessera',
    name: 'T-OpenAI',
    symbol: 'T-OpenAI',
    code: 'tOpenAI',
    sector: 'AI',
    mint: 'oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ',
    contractAddress: 'oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ',
    tokenPrice: 812.79,
    markPrice: 812.79,
    markValuation: 950_000_000_000,
    impliedValuation: 950_000_000_000,
    holders: 8259,
    transferFeePct: 0.2,
    standard: 'Token-2022',
    legalStructure: 'Loan participation right (not a security)',
    url: 'https://tessera.pe',
    solscan:
      'https://solscan.io/token/oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ',
    feeBps: 20,
    decimals: 9,
    porFeed: 'topenai--nav-streams',
    description:
      'Tessera T-Token providing economic exposure to OpenAI equity value via Cayman SPC',
  },
  {
    source: 'Tessera',
    name: 'T-Kalshi',
    symbol: 'T-Kalshi',
    code: 'tKalshi',
    sector: 'Prediction Markets',
    mint: 'TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ',
    contractAddress: 'TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ',
    tokenPrice: 413.8,
    markPrice: 413.8,
    markValuation: 14_000_000_000,
    impliedValuation: 14_000_000_000,
    holders: 2605,
    transferFeePct: 0.2,
    standard: 'Token-2022',
    legalStructure: 'Loan participation right (not a security)',
    url: 'https://tessera.pe',
    solscan:
      'https://solscan.io/token/TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ',
    feeBps: 20,
    decimals: 9,
    porFeed: 'tkalshi-usd-smartdata-datalink',
    description:
      'Tessera T-Token providing economic exposure to Kalshi equity value',
  },
  {
    source: 'Tessera',
    name: 'T-SpaceX',
    symbol: 'T-SpaceX',
    code: 'tSpaceX',
    sector: 'Space',
    mint: 'TSPXcLV76s6V2zDiZQ18kBfcbnjaE2ZzNT3ga2Pd99v',
    contractAddress: 'TSPXcLV76s6V2zDiZQ18kBfcbnjaE2ZzNT3ga2Pd99v',
    tokenPrice: 423.0,
    markPrice: 423.0,
    markValuation: 800_000_000_000,
    impliedValuation: 800_000_000_000,
    holders: 1274,
    transferFeePct: 0.2,
    standard: 'Token-2022',
    legalStructure: 'Loan participation right (not a security)',
    url: 'https://tessera.pe',
    solscan:
      'https://solscan.io/token/TSPXcLV76s6V2zDiZQ18kBfcbnjaE2ZzNT3ga2Pd99v',
    feeBps: 20,
    decimals: 9,
    porFeed: 'tspacex-usd-smartdata-datalink',
    description:
      'Tessera T-Token providing economic exposure to SpaceX equity value',
  },
]
