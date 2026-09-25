export type TokenSource = 'PreStocks' | 'Tessera'

export type Sector =
  | 'AI'
  | 'Defense'
  | 'Space'
  | 'Prediction Markets'
  | 'Robotics'
  | 'Biotech'
  | 'Fintech'
  | 'General'

export type Token = {
  source: TokenSource
  name: string
  symbol: string
  code?: string
  description?: string
  image?: string
  contractAddress?: string
  mint?: string
  tokenPrice: number
  markPrice?: number
  impliedValuation?: number
  markValuation?: number
  supply?: number
  sector: string
  premium?: string | null
  legalStructure: string
  transferFeePct: number
  standard?: 'SPL' | 'Token-2022'
  holders?: number
  url: string
  solscan?: string
  changeType?: 'NEW_LISTING' | 'PRICE_MOVE'
  changePct?: string | null
  porFeed?: string
  decimals?: number
  feeBps?: number
}

export type TesseraHolders = {
  address: string
  amount: number
  uiAmount: number | null
}

export type TesseraOnChain = {
  symbol: string
  mint: string
  decimals: number
  totalSupply: number | null
  rawSupply: string
  transferFeeBps: number
  transferFeePct: number
  standard: 'Token-2022'
  topHolders: TesseraHolders[]
  solscan?: string
}

export type TesseraPoR = {
  symbol: string
  feedUrl: string
  feedId: string
  verifiedBy: string
  auditedBy: string
  custodian: string
  reserve: string
  onChain: boolean
  note: string
}

export type AuctionPhase = {
  name: string
  desc: string
}

export type TesseraAuction = {
  symbol: string
  mechanism: string
  phases: AuctionPhase[]
  antiSniper: boolean
  uniformPrice: boolean
  status: 'LIVE' | 'UPCOMING' | 'CLOSED' | 'MONITORING'
  note: string
}

export type TesseraEnrichedToken = Token & {
  onChain: TesseraOnChain | null
  por: TesseraPoR | null
  auction: TesseraAuction | null
  marketCapStr: string
  priceStr: string
  feeOnTransfer: string
  tradeableOn: string[]
  custodian: string
  auditedBy: string
  geography: string
}

export type RedemptionAlertData = {
  symbol: string
  eventType: 'IPO' | 'CHANGE_OF_CONTROL'
  redemptionStartDate: string
  windowDays: number
  deadline: string
  daysLeft: number
  stablecoin: string
  transferFeeOnSell: string
  warning: string
  howToRedeem: string
  taxNote: string
}

export type SubscriberProfile = {
  email: string
  sectors: string[]
  maxUsd: number
  notifyOnNew: boolean
  notifyOnMove: boolean
  name: string | null
  joinedAt: string
}

export type IntentType =
  | 'BUY'
  | 'SELL'
  | 'CONFIRM'
  | 'PASS'
  | 'PORTFOLIO'
  | 'MARKET'
  | 'UNSUBSCRIBE'
  | 'REDEEM'
  | 'AUCTION'
  | 'UNCLEAR'

export type ParsedReplyIntent = {
  intent: IntentType
  symbol: string | null
  amountUsd: number | null
  tokenQty: number | null
  pct: number | null
  confidence: 'HIGH' | 'LOW'
  raw?: string
}

export type TradeIntent = {
  id: string
  type: 'BUY' | 'SELL'
  email: string
  token: Token
  amountUsd: number
  tokenQty: number
  pct?: number
  priceAtIntent: number
  expiresAt: number
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED'
  createdAt: string
  txHash?: string
}

export type PortfolioPosition = {
  symbol: string
  qty: number
  avgPrice: number
  totalInvested: number
}

export type PortfolioDigestHolding = {
  symbol: string
  qty: string
  avgPrice: string
  currentPrice: string
  currentValue: string
  pnl: string
  pnlPct: string
}

export type SwapResult = {
  txHash: string
  feePct: string
  feeUsd: string
  slippagePct: string
  network: 'devnet'
  explorerUrl: string
}
