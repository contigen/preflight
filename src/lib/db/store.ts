import type {
  SubscriberProfile,
  TradeIntent,
  PortfolioPosition,
  Token,
} from '@/types'
import { redis } from './redis'

export type ActivityEvent = {
  id: string
  timestamp: string
  type:
    | 'SUBSCRIBE'
    | 'DEAL_ALERT'
    | 'INTENT_CREATED'
    | 'TRADE_EXECUTED'
    | 'TRADE_SOLD'
    | 'REDEMPTION_ALERT'
  summary: string
  details?: Record<string, unknown>
  txHash?: string
  symbol?: string
}

class Store {
  public subscribers = new Map<string, SubscriberProfile>()
  public pendingIntents = new Map<string, TradeIntent>()
  public portfolios = new Map<string, Record<string, PortfolioPosition>>()
  public lastAlertedToken = new Map<string, string>()
  public lastSnapshot: Token[] = []
  public activityLog: ActivityEvent[] = []

  constructor() {
    this.hydrateFromRedis()
  }

  private hydrateFromRedis() {
    if (!redis) return

    redis
      .hgetall<Record<string, string | SubscriberProfile>>(
        'preflight:subscribers',
      )
      .then(subs => {
        if (subs) {
          for (const [key, val] of Object.entries(subs)) {
            try {
              const sub: SubscriberProfile =
                typeof val === 'string'
                  ? JSON.parse(val)
                  : (val as SubscriberProfile)
              if (sub && sub.email) {
                this.subscribers.set(key.toLowerCase().trim(), sub)
              }
            } catch {}
          }
        }
      })
      .catch(() => {})

    redis
      .hgetall<Record<string, string | Record<string, PortfolioPosition>>>(
        'preflight:portfolios',
      )
      .then(ports => {
        if (ports) {
          for (const [key, val] of Object.entries(ports)) {
            try {
              const p: Record<string, PortfolioPosition> =
                typeof val === 'string'
                  ? JSON.parse(val)
                  : (val as Record<string, PortfolioPosition>)
              if (p) {
                this.portfolios.set(key.toLowerCase().trim(), p)
              }
            } catch {}
          }
        }
      })
      .catch(() => {})

    redis
      .lrange<string | ActivityEvent>('preflight:activity', 0, 49)
      .then(items => {
        if (items && Array.isArray(items) && items.length > 0) {
          const list: ActivityEvent[] = []
          for (const item of items) {
            try {
              const act: ActivityEvent =
                typeof item === 'string'
                  ? JSON.parse(item)
                  : (item as ActivityEvent)
              if (act && act.id) list.push(act)
            } catch {}
          }
          if (list.length > 0) {
            this.activityLog = list
          }
        }
      })
      .catch(() => {})

    redis
      .hgetall<Record<string, string | TradeIntent>>('preflight:intents')
      .then(intents => {
        if (intents) {
          for (const [key, val] of Object.entries(intents)) {
            try {
              const item: TradeIntent =
                typeof val === 'string' ? JSON.parse(val) : (val as TradeIntent)
              if (item && item.id) {
                this.pendingIntents.set(key, item)
              }
            } catch {}
          }
        }
      })
      .catch(() => {})
  }

  addSubscriber(
    email: string,
    profile: Partial<SubscriberProfile>,
  ): SubscriberProfile {
    const normalizedEmail = email.toLowerCase().trim()
    const existing = this.subscribers.get(normalizedEmail)
    const sub: SubscriberProfile = {
      email: normalizedEmail,
      sectors: profile.sectors || existing?.sectors || [],
      maxUsd: profile.maxUsd || existing?.maxUsd || 500,
      notifyOnNew: profile.notifyOnNew ?? existing?.notifyOnNew ?? true,
      notifyOnMove: profile.notifyOnMove ?? existing?.notifyOnMove ?? true,
      name: profile.name || existing?.name || null,
      joinedAt: existing?.joinedAt || new Date().toISOString(),
    }
    this.subscribers.set(normalizedEmail, sub)
    this.logActivity('SUBSCRIBE', `Subscribed ${normalizedEmail}`, {
      sectors: sub.sectors,
    })

    if (redis) {
      redis
        .hset('preflight:subscribers', {
          [normalizedEmail]: JSON.stringify(sub),
        })
        .catch(() => {})
    }

    return sub
  }

  getSubscriber(email: string): SubscriberProfile | undefined {
    return this.subscribers.get(email.toLowerCase().trim())
  }

  getAllSubscribers(): SubscriberProfile[] {
    return Array.from(this.subscribers.values())
  }

  isSubscribed(email: string): boolean {
    return this.subscribers.has(email.toLowerCase().trim())
  }

  async fetchSubscriberFromRedis(
    email: string,
  ): Promise<SubscriberProfile | null> {
    const normalized = email.toLowerCase().trim()
    const inMem = this.subscribers.get(normalized)
    if (inMem) return inMem
    if (!redis) return null
    try {
      const val = await redis.hget<string | SubscriberProfile>(
        'preflight:subscribers',
        normalized,
      )
      if (!val) return null
      const sub: SubscriberProfile =
        typeof val === 'string' ? JSON.parse(val) : val
      if (sub && sub.email) {
        this.subscribers.set(normalized, sub)
        return sub
      }
      return null
    } catch {
      return null
    }
  }

  unsubscribe(email: string): boolean {
    const normalized = email.toLowerCase().trim()
    const res = this.subscribers.delete(normalized)
    if (redis) {
      redis.hdel('preflight:subscribers', normalized).catch(() => {})
    }
    return res
  }

  setLastAlertedToken(email: string, symbol: string) {
    const normalized = email.toLowerCase().trim()
    this.lastAlertedToken.set(normalized, symbol)
    if (redis) {
      redis
        .hset('preflight:last_alerted', { [normalized]: symbol })
        .catch(() => {})
    }
  }

  getLastAlertedToken(email: string): string | undefined {
    return this.lastAlertedToken.get(email.toLowerCase().trim())
  }

  createIntent(
    email: string,
    type: 'BUY' | 'SELL',
    token: Token,
    amountUsd: number,
    tokenQty: number,
    priceAtIntent: number,
    pct?: number,
  ): TradeIntent {
    const id = `intent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const expiresAt = Date.now() + 15 * 60 * 1000

    const intent: TradeIntent = {
      id,
      type,
      email: email.toLowerCase().trim(),
      token,
      amountUsd,
      tokenQty,
      pct,
      priceAtIntent,
      expiresAt,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    }

    this.pendingIntents.set(id, intent)
    this.logActivity(
      'INTENT_CREATED',
      `New ${type} intent for ${token.symbol}: ${tokenQty.toFixed(4)} tokens ($${amountUsd.toFixed(2)})`,
      { intentId: id, email, symbol: token.symbol },
    )

    if (redis) {
      redis
        .hset('preflight:intents', { [id]: JSON.stringify(intent) })
        .catch(() => {})
    }

    return intent
  }

  getIntent(id: string): TradeIntent | undefined {
    return this.pendingIntents.get(id)
  }

  getLatestPendingIntent(email: string): TradeIntent | null {
    const now = Date.now()
    const normalized = email.toLowerCase().trim()
    const intents = Array.from(this.pendingIntents.values())
      .filter(
        i =>
          i.email === normalized && i.status === 'PENDING' && i.expiresAt > now,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return intents[0] || null
  }

  async fetchLatestPendingIntentFromRedis(
    email: string,
  ): Promise<TradeIntent | null> {
    const inMem = this.getLatestPendingIntent(email)
    if (inMem) return inMem
    if (!redis) return null
    try {
      const all =
        await redis.hgetall<Record<string, string | TradeIntent>>(
          'preflight:intents',
        )
      if (!all) return null
      const now = Date.now()
      const normalized = email.toLowerCase().trim()
      const list: TradeIntent[] = []
      for (const [key, val] of Object.entries(all)) {
        try {
          const item: TradeIntent =
            typeof val === 'string' ? JSON.parse(val) : (val as TradeIntent)
          if (item && item.id) {
            this.pendingIntents.set(key, item)
            if (
              item.email === normalized &&
              item.status === 'PENDING' &&
              item.expiresAt > now
            ) {
              list.push(item)
            }
          }
        } catch {}
      }
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return list[0] || null
    } catch {
      return null
    }
  }

  confirmIntent(id: string, txHash?: string): TradeIntent | null {
    const intent = this.pendingIntents.get(id)
    if (!intent || intent.status !== 'PENDING') return null

    intent.status = 'CONFIRMED'
    intent.txHash = txHash

    if (intent.type === 'BUY') {
      this._addToPortfolio(
        intent.email,
        intent.token.symbol,
        intent.tokenQty,
        intent.priceAtIntent,
      )
      this.logActivity(
        'TRADE_EXECUTED',
        `Bought ${intent.tokenQty.toFixed(4)} ${intent.token.symbol} @ $${intent.priceAtIntent.toFixed(2)}`,
        { email: intent.email, txHash, amountUsd: intent.amountUsd },
        txHash,
        intent.token.symbol,
      )
    } else if (intent.type === 'SELL') {
      this.reducePortfolio(intent.email, intent.token.symbol, intent.tokenQty)
      this.logActivity(
        'TRADE_SOLD',
        `Sold ${intent.tokenQty.toFixed(4)} ${intent.token.symbol} @ $${intent.priceAtIntent.toFixed(2)}`,
        { email: intent.email, txHash, proceedsUsd: intent.amountUsd },
        txHash,
        intent.token.symbol,
      )
    }

    if (redis) {
      redis
        .hset('preflight:intents', { [id]: JSON.stringify(intent) })
        .catch(() => {})
    }

    return intent
  }

  cancelIntent(id: string) {
    const intent = this.pendingIntents.get(id)
    if (intent) {
      intent.status = 'CANCELLED'
      if (redis) {
        redis
          .hset('preflight:intents', { [id]: JSON.stringify(intent) })
          .catch(() => {})
      }
    }
  }

  _addToPortfolio(email: string, symbol: string, qty: number, price: number) {
    const normalized = email.toLowerCase().trim()
    if (!this.portfolios.has(normalized)) {
      this.portfolios.set(normalized, {})
    }
    const port = this.portfolios.get(normalized)!
    if (!port[symbol]) {
      port[symbol] = { symbol, qty: 0, avgPrice: 0, totalInvested: 0 }
    }
    const pos = port[symbol]
    pos.totalInvested += qty * price
    pos.qty += qty
    pos.avgPrice = pos.qty > 0 ? pos.totalInvested / pos.qty : 0

    if (redis) {
      redis
        .hset('preflight:portfolios', { [normalized]: JSON.stringify(port) })
        .catch(() => {})
    }
  }

  reducePortfolio(email: string, symbol: string, qty: number): number | null {
    const normalized = email.toLowerCase().trim()
    const port = this.portfolios.get(normalized)
    if (!port || !port[symbol]) return null

    const pos = port[symbol]
    const sellQty = Math.min(qty, pos.qty)
    pos.qty -= sellQty
    pos.totalInvested -= sellQty * pos.avgPrice

    if (pos.qty <= 0.0001) {
      delete port[symbol]
    }

    if (redis) {
      redis
        .hset('preflight:portfolios', { [normalized]: JSON.stringify(port) })
        .catch(() => {})
    }

    return sellQty
  }

  getPortfolio(email: string): Record<string, PortfolioPosition> {
    return this.portfolios.get(email.toLowerCase().trim()) || {}
  }

  setSnapshot(tokens: Token[]) {
    this.lastSnapshot = tokens
  }

  getSnapshot(): Token[] {
    return this.lastSnapshot
  }

  logActivity(
    type: ActivityEvent['type'],
    summary: string,
    details?: Record<string, unknown>,
    txHash?: string,
    symbol?: string,
  ) {
    const event: ActivityEvent = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      type,
      summary,
      details,
      txHash,
      symbol,
    }
    this.activityLog.unshift(event)
    if (this.activityLog.length > 50) this.activityLog.pop()

    if (redis) {
      redis.lpush('preflight:activity', JSON.stringify(event)).catch(() => {})
      redis.ltrim('preflight:activity', 0, 49).catch(() => {})
    }
  }

  getActivityLog(): ActivityEvent[] {
    return this.activityLog
  }
}

const globalForStore = globalThis as unknown as { preflightStore?: Store }
export const db = globalForStore.preflightStore || new Store()
if (process.env.NODE_ENV !== 'production') {
  globalForStore.preflightStore = db
}
