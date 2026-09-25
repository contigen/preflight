'use client'

import React, { useState, useEffect } from 'react'
import {
  Check,
  Mail,
  ExternalLink,
  Zap,
  Layers,
  Briefcase,
  BookOpen,
  User,
  ChevronDown,
  X,
  LogOut,
  AtSign,
  Compass,
  Wallet,
} from 'lucide-react'
import { Facehash } from 'facehash'
import { sileo } from 'sileo'
import type { Token, PortfolioPosition, SwapResult } from '@/types'
import type { ActivityEvent } from '@/lib/db/store'
import type { UserWalletInfo } from '@/lib/solana/user-wallet'
import { DealCard } from './deal-card'
import { MarketTable } from './market-table'
import { ActivityThread } from './activity-thread'
import { TokenModal } from './token-modal'
import { SubscribeDialog } from './subscribe-dialog'
import { HowItWorks } from './how-it-works'
import { BrokerModal } from './broker-modal'
import { OnboardingModal } from './onboarding-modal'
import { PREFLIGHT_AGENT_EMAIL } from '@/lib/constants'

type PreflightViewProps = {
  initialTokens: Token[]
  initialPortfolio: Record<string, PortfolioPosition>
  initialActivity: ActivityEvent[]
}

export function PreflightView({
  initialTokens,
  initialPortfolio,
  initialActivity,
}: PreflightViewProps) {
  const [tokens] = useState<Token[]>(initialTokens)
  const [positions, setPositions] =
    useState<Record<string, PortfolioPosition>>(initialPortfolio)
  const [activity, setActivity] = useState<ActivityEvent[]>(initialActivity)
  const [activeTab, setActiveTab] = useState<
    'DEAL' | 'MARKETS' | 'ACTIVITY' | 'GUIDE'
  >('DEAL')
  const [selectedSymbol, setSelectedSymbol] = useState<string>('ANTHROPIC')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false)
  const [tempEmailInput, setTempEmailInput] = useState<string>('')
  const [dossierToken, setDossierToken] = useState<Token | null>(null)
  const [isSubscribeOpen, setIsSubscribeOpen] = useState<boolean>(false)
  const [tradeReceipt, setTradeReceipt] = useState<{
    swap: SwapResult
    token: Token
    amountUsd: number
    action: 'BUY' | 'SELL'
  } | null>(null)
  const [brokerAddress, setBrokerAddress] = useState<string>(
    '57T4nWpYQA8yyRmrhBJRjEaR1E648fcYyGcHXzwSrfrr',
  )
  const [brokerBalanceSol, setBrokerBalanceSol] = useState<number>(0)
  const [isBrokerModalOpen, setIsBrokerModalOpen] = useState<boolean>(false)
  const [userWallet, setUserWallet] = useState<UserWalletInfo | null>(null)
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false)

  useEffect(() => {
    function fetchUserWallet(email: string) {
      fetch(`/api/user/wallet?email=${encodeURIComponent(email)}`)
        .then(r => r.json())
        .then(data => {
          if (data.wallet) setUserWallet(data.wallet)
        })
        .catch(() => {})
    }

    const savedEmail = localStorage.getItem('preflight_email')
    if (savedEmail) {
      setUserEmail(savedEmail)
      setTempEmailInput(savedEmail)
      fetchUserWallet(savedEmail)
      fetch(`/api/portfolio?email=${encodeURIComponent(savedEmail)}`)
        .then(r => r.json())
        .then(data => {
          if (data.positions && Array.isArray(data.positions)) {
            const map: Record<string, PortfolioPosition> = {}
            for (const p of data.positions) {
              map[p.symbol] = {
                symbol: p.symbol,
                qty: p.qty,
                avgPrice: p.avgPrice,
                totalInvested: p.totalInvested,
              }
            }
            setPositions(map)
          }
        })
        .catch(() => {})
    }

    async function fetchBrokerWallet() {
      try {
        const res = await fetch('/api/agent/wallet')
        const data = (await res.json()) as {
          success?: boolean
          publicKey?: string
          balanceSol?: number
        }
        if (data.publicKey) {
          setBrokerAddress(data.publicKey)
        }
        if (typeof data.balanceSol === 'number') {
          setBrokerBalanceSol(data.balanceSol)
        }
      } catch {}
    }
    fetchBrokerWallet()
  }, [])

  function handleTradeExecuted(
    swap: SwapResult,
    token: Token,
    amountUsd: number,
    action: 'BUY' | 'SELL',
  ) {
    const newEvent: ActivityEvent = {
      id: `act_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: action === 'BUY' ? 'TRADE_EXECUTED' : 'TRADE_SOLD',
      summary: `${action === 'BUY' ? 'Bought' : 'Sold'} ${token.symbol}`,
      details: { amountUsd, symbol: token.symbol, email: userEmail || 'Guest' },
      txHash: swap.txHash,
      symbol: token.symbol,
    }

    setActivity(prev => [newEvent, ...prev])

    setPositions(prev => {
      const next = { ...prev }
      const current = next[token.symbol] || {
        symbol: token.symbol,
        qty: 0,
        avgPrice: 0,
        totalInvested: 0,
      }
      const tokenQty = amountUsd / token.tokenPrice

      if (action === 'BUY') {
        const totalInvested = current.totalInvested + amountUsd
        const qty = current.qty + tokenQty
        next[token.symbol] = {
          symbol: token.symbol,
          qty,
          avgPrice: qty > 0 ? totalInvested / qty : 0,
          totalInvested,
        }
      } else {
        const sellQty = Math.min(tokenQty, current.qty)
        const qty = current.qty - sellQty
        const totalInvested = Math.max(
          0,
          current.totalInvested - sellQty * current.avgPrice,
        )
        if (qty <= 0.0001) {
          delete next[token.symbol]
        } else {
          next[token.symbol] = {
            symbol: token.symbol,
            qty,
            avgPrice: current.avgPrice,
            totalInvested,
          }
        }
      }
      return next
    })

    setTradeReceipt({ swap, token, amountUsd, action })

    sileo.success({
      title:
        action === 'BUY'
          ? 'Autonomous Broker Executed Trade'
          : 'Autonomous Broker Liquidated',
      description: `Settled on Solana Devnet: ${swap.txHash.slice(0, 6)}...${swap.txHash.slice(-6)}`,
      button: {
        title: 'Solscan',
        onClick: () => window.open(swap.explorerUrl, '_blank'),
      },
    })
  }

  function handleSelectTokenFromTable(symbol: string) {
    setSelectedSymbol(symbol)
    setActiveTab('DEAL')
  }

  function handleEmailUpdated(clean: string) {
    setUserEmail(clean)
    setTempEmailInput(clean)
    localStorage.setItem('preflight_email', clean)
    fetch(`/api/user/wallet?email=${encodeURIComponent(clean)}`)
      .then(r => r.json())
      .then(data => {
        if (data.wallet) setUserWallet(data.wallet)
      })
      .catch(() => {})
    fetch(`/api/portfolio?email=${encodeURIComponent(clean)}`)
      .then(r => r.json())
      .then(data => {
        if (data.positions && Array.isArray(data.positions)) {
          const map: Record<string, PortfolioPosition> = {}
          for (const p of data.positions) {
            map[p.symbol] = {
              symbol: p.symbol,
              qty: p.qty,
              avgPrice: p.avgPrice,
              totalInvested: p.totalInvested,
            }
          }
          setPositions(map)
        }
      })
      .catch(() => {})
  }

  function handleSwitchEmail(e: React.FormEvent) {
    e.preventDefault()
    const clean = tempEmailInput.trim().toLowerCase()
    if (!clean) return
    setUserEmail(clean)
    localStorage.setItem('preflight_email', clean)
    setIsEmailModalOpen(false)
    sileo.success({
      title: 'Email Connected',
      description: `Active session: ${clean}. Autonomous broker ready to route orders.`,
    })
    fetch(`/api/user/wallet?email=${encodeURIComponent(clean)}`)
      .then(r => r.json())
      .then(data => {
        if (data.wallet) setUserWallet(data.wallet)
      })
      .catch(() => {})
    fetch(`/api/portfolio?email=${encodeURIComponent(clean)}`)
      .then(r => r.json())
      .then(data => {
        if (data.positions && Array.isArray(data.positions)) {
          const map: Record<string, PortfolioPosition> = {}
          for (const p of data.positions) {
            map[p.symbol] = {
              symbol: p.symbol,
              qty: p.qty,
              avgPrice: p.avgPrice,
              totalInvested: p.totalInvested,
            }
          }
          setPositions(map)
        }
      })
      .catch(() => {})
  }

  function handleDisconnect() {
    localStorage.removeItem('preflight_email')
    setUserEmail(null)
    setUserWallet(null)
    setTempEmailInput('')
    setPositions({})
    sileo.info({
      title: 'Disconnected',
      description: 'Browsing as unauthenticated guest.',
    })
  }

  return (
    <div className='relative min-h-screen w-full bg-[#fafafa] text-zinc-900 flex flex-col justify-between'>
      <header className='sticky top-0 z-30 w-full bg-white/85 backdrop-blur-md border-b border-zinc-100'>
        <div className='mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6'>
          <div className='flex items-center gap-2 sm:gap-3'>
            <button
              type='button'
              onClick={() => setActiveTab('DEAL')}
              className='flex items-center gap-2 text-left'
            >
              <span className='font-hand text-3xl tracking-tight text-zinc-900 hover:text-blue-600 transition'>
                Preflight
              </span>
            </button>
            <span className='rounded-full bg-zinc-100 px-2.5 py-0.5 font-pixel text-[10px] text-zinc-500 border border-zinc-200'>
              Solana Devnet
            </span>
            <a
              href={`mailto:${PREFLIGHT_AGENT_EMAIL}`}
              className='hidden lg:flex items-center gap-1.5 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200/90 px-2.5 py-0.5 font-pixel text-[11px] text-blue-700 transition'
              title='Preflight Autonomous Broker Email Interface'
            >
              <div className='rounded-full overflow-hidden shrink-0 border border-blue-200'>
                <Facehash
                  name={PREFLIGHT_AGENT_EMAIL}
                  size={14}
                  interactive={false}
                  showInitial={false}
                />
              </div>
              <span className='font-mono text-[10px]'>
                {PREFLIGHT_AGENT_EMAIL}
              </span>
            </a>
          </div>

          <div className='hidden md:flex items-center rounded-full bg-zinc-100 p-1 text-xs font-pixel'>
            <button
              type='button'
              onClick={() => setActiveTab('DEAL')}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition ${
                activeTab === 'DEAL'
                  ? 'bg-white text-black  shadow-xs'
                  : 'text-zinc-500 hover:text-black'
              }`}
            >
              <Zap className='h-3.5 w-3.5' />
              <span>Deal Flow</span>
            </button>

            <button
              type='button'
              onClick={() => setActiveTab('MARKETS')}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition ${
                activeTab === 'MARKETS'
                  ? 'bg-white text-black  shadow-xs'
                  : 'text-zinc-500 hover:text-black'
              }`}
            >
              <Layers className='h-3.5 w-3.5' />
              <span>Markets</span>
            </button>

            <button
              type='button'
              onClick={() => setActiveTab('ACTIVITY')}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition ${
                activeTab === 'ACTIVITY'
                  ? 'bg-white text-black  shadow-xs'
                  : 'text-zinc-500 hover:text-black'
              }`}
            >
              <Briefcase className='h-3.5 w-3.5' />
              <span>Holdings</span>
            </button>

            <button
              type='button'
              onClick={() => setActiveTab('GUIDE')}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition ${
                activeTab === 'GUIDE'
                  ? 'bg-white text-black  shadow-xs'
                  : 'text-zinc-500 hover:text-black'
              }`}
            >
              <BookOpen className='h-3.5 w-3.5' />
              <span>How It Works</span>
            </button>

            <button
              type='button'
              onClick={() => setIsOnboardingOpen(true)}
              className='flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-blue-600 hover:text-blue-800 transition '
            >
              <Compass className='h-3.5 w-3.5' />
              <span>Directive</span>
            </button>
          </div>

          <div className='flex items-center gap-2'>
            {userEmail && (
              <button
                type='button'
                onClick={() => setIsOnboardingOpen(true)}
                className='hidden xl:flex items-center gap-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 border border-zinc-200/80 px-2.5 py-1 font-pixel text-xs text-zinc-700 transition'
                title='Your Dedicated Solana Wallet & Onboarding Directive'
              >
                <div className='rounded-full overflow-hidden shrink-0 border border-zinc-200'>
                  <Facehash
                    name={userWallet?.publicKey || userEmail}
                    size={14}
                    interactive={false}
                    showInitial={false}
                  />
                </div>
                <span>Wallet:</span>
                <span className='font-mono text-[10px]'>
                  {userWallet
                    ? `${userWallet.publicKey.slice(0, 4)}...${userWallet.publicKey.slice(-4)}`
                    : '...'}
                </span>
                <span
                  className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[9px]  ${
                    userWallet?.isFunded
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  {userWallet?.balanceSol
                    ? `${userWallet.balanceSol.toFixed(2)} SOL`
                    : '0 SOL'}
                </span>
              </button>
            )}

            {!userEmail ? (
              <button
                type='button'
                onClick={() => {
                  setTempEmailInput('')
                  setIsEmailModalOpen(true)
                }}
                className='flex items-center gap-1.5 rounded-full bg-black hover:bg-zinc-800 text-white px-3.5 py-1.5 font-pixel text-xs transition shadow-xs'
              >
                <User className='h-3.5 w-3.5 text-zinc-300' />
                <span>Connect Email</span>
              </button>
            ) : (
              <div className='flex items-center gap-1.5'>
                <button
                  type='button'
                  onClick={() => {
                    setTempEmailInput(userEmail)
                    setIsEmailModalOpen(true)
                  }}
                  className='flex items-center gap-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 border border-zinc-200/80 px-2.5 py-1 font-pixel text-xs text-zinc-700 transition'
                >
                  <div className='rounded-full overflow-hidden shrink-0 border border-zinc-200'>
                    <Facehash
                      name={userEmail}
                      size={14}
                      interactive={false}
                      showInitial={false}
                    />
                  </div>
                  <span className='max-w-[100px] sm:max-w-[150px] truncate'>
                    {userEmail}
                  </span>
                  <ChevronDown className='h-3 w-3 text-zinc-400' />
                </button>
                <button
                  type='button'
                  onClick={handleDisconnect}
                  className='p-1.5 rounded-full text-zinc-400 hover:text-rose-600 hover:bg-zinc-100 transition'
                  title='Disconnect Email'
                >
                  <LogOut className='h-3 w-3' />
                </button>
              </div>
            )}

            <button
              type='button'
              onClick={() => setIsSubscribeOpen(true)}
              className='flex items-center gap-1.5 rounded-full bg-black px-4 py-1.5 font-hand text-base text-white shadow-xs hover:bg-zinc-800 transition'
            >
              <Mail className='h-3.5 w-3.5' />
              <span className='hidden sm:inline'>Deal Alerts</span>
            </button>
          </div>
        </div>

        <div className='flex md:hidden overflow-x-auto px-4 py-2 border-t border-zinc-100 gap-1 bg-zinc-50/50 text-xs font-pixel'>
          <button
            type='button'
            onClick={() => setActiveTab('DEAL')}
            className={`rounded-full px-3 py-1 transition ${activeTab === 'DEAL' ? 'bg-black text-white ' : 'text-zinc-600'}`}
          >
            Deal Flow
          </button>
          <button
            type='button'
            onClick={() => setActiveTab('MARKETS')}
            className={`rounded-full px-3 py-1 transition ${activeTab === 'MARKETS' ? 'bg-black text-white ' : 'text-zinc-600'}`}
          >
            Markets
          </button>
          <button
            type='button'
            onClick={() => setActiveTab('ACTIVITY')}
            className={`rounded-full px-3 py-1 transition ${activeTab === 'ACTIVITY' ? 'bg-black text-white ' : 'text-zinc-600'}`}
          >
            Holdings
          </button>
          <button
            type='button'
            onClick={() => setActiveTab('GUIDE')}
            className={`rounded-full px-3 py-1 transition ${activeTab === 'GUIDE' ? 'bg-black text-white ' : 'text-zinc-600'}`}
          >
            How It Works
          </button>
          <button
            type='button'
            onClick={() => setIsOnboardingOpen(true)}
            className='rounded-full px-3 py-1 transition text-blue-600 '
          >
            Directive
          </button>
        </div>
      </header>

      <main className='flex-1 w-full flex flex-col items-center justify-start'>
        {activeTab === 'DEAL' && (
          <div className='w-full flex flex-col items-center'>
            <div className='w-full max-w-lg px-4 pt-4 pb-1'>
              <div className='flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/90 via-sky-50/40 to-white border border-blue-200/80 shadow-xs'>
                <div className='flex items-center gap-2.5'>
                  <div className='h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0'>
                    <Compass className='h-4 w-4' />
                  </div>
                  <div>
                    <div className='font-hand text-xl text-zinc-900 leading-none'>
                      The Preflight Directive
                    </div>
                    <div className='font-pixel text-[11px] text-zinc-500 mt-0.5'>
                      1. Understand Flow &bull; 2. Fund Wallet &bull; 3. Copy
                      Agent Mail
                    </div>
                  </div>
                </div>
                <button
                  type='button'
                  onClick={() => setIsOnboardingOpen(true)}
                  className='rounded-full bg-black hover:bg-zinc-800 text-white px-4 py-1.5 font-hand text-base shadow-xs shrink-0 transition'
                >
                  Onboarding &rarr;
                </button>
              </div>
            </div>

            <DealCard
              tokens={tokens}
              selectedSymbol={selectedSymbol}
              userEmail={userEmail}
              brokerAddress={brokerAddress}
              brokerBalanceSol={brokerBalanceSol}
              userWallet={userWallet}
              onSelectSymbol={setSelectedSymbol}
              onTradeExecuted={handleTradeExecuted}
              onOpenBrokerModal={() => setIsBrokerModalOpen(true)}
              onRequireAuth={() => setIsEmailModalOpen(true)}
              onOpenOnboarding={() => setIsOnboardingOpen(true)}
            />

            <div className='w-full max-w-md px-4 mt-2 mb-8 text-center'>
              <button
                type='button'
                onClick={() => setActiveTab('GUIDE')}
                className='font-hand text-base text-zinc-500 hover:text-black underline underline-offset-4'
              >
                New to pre-IPO tokens? Read how Preflight works &rarr;
              </button>
            </div>
          </div>
        )}

        {activeTab === 'MARKETS' && (
          <MarketTable
            tokens={tokens}
            onSelectTokenForTrade={handleSelectTokenFromTable}
            onOpenDossier={setDossierToken}
          />
        )}

        {activeTab === 'ACTIVITY' && (
          <ActivityThread
            positions={positions}
            tokens={tokens}
            activity={activity}
            onBack={() => setActiveTab('DEAL')}
            onNewAllocation={() => setActiveTab('DEAL')}
          />
        )}

        {activeTab === 'GUIDE' && (
          <HowItWorks
            onStartTrading={() => setActiveTab('DEAL')}
            onOpenSubscribe={() => setIsSubscribeOpen(true)}
          />
        )}
      </main>

      <footer className='py-6 text-center border-t border-zinc-100 bg-white/50'>
        <div className='mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3 font-pixel text-xs text-zinc-400'>
          <div>
            Preflight • The Autonomous Pre-IPO Broker • Stocklana Hackathon
          </div>
          <div>PreStocks Track Submission ($10,000 Bounty)</div>
        </div>
      </footer>

      {isEmailModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150'>
          <div className='w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200'>
            <div className='flex items-center gap-2.5 mb-2'>
              <div className='rounded-full overflow-hidden border border-zinc-200 shrink-0'>
                <Facehash
                  name={tempEmailInput || 'Investor'}
                  size={26}
                  interactive={false}
                  showInitial={false}
                />
              </div>
              <div>
                <h3 className='font-hand text-2xl text-zinc-900 leading-none'>
                  {userEmail ? 'Account Session' : 'Connect Email'}
                </h3>
                <p className='font-pixel text-[11px] text-zinc-500 mt-0.5'>
                  Preflight Autonomous Broker
                </p>
              </div>
            </div>
            <p className='font-pixel text-xs text-zinc-500 mb-4 leading-relaxed'>
              Enter your email address to associate your pre-IPO token
              allocations and receive personalized deal memos.
            </p>

            <form onSubmit={handleSwitchEmail} className='flex flex-col gap-3'>
              <input
                type='email'
                required
                value={tempEmailInput}
                onChange={e => setTempEmailInput(e.target.value)}
                placeholder='your-email@example.com'
                className='w-full rounded-2xl bg-zinc-50 border border-zinc-200 px-3.5 py-2.5 font-pixel text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-black'
              />

              <div className='flex items-center justify-end gap-2 mt-2'>
                <button
                  type='button'
                  onClick={() => setIsEmailModalOpen(false)}
                  className='rounded-full px-4 py-1.5 font-hand text-base text-zinc-600 hover:text-black'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  className='rounded-full bg-black px-5 py-1.5 font-hand text-base text-white hover:bg-zinc-800 shadow-md'
                >
                  {userEmail ? 'Update Email' : 'Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TokenModal
        token={dossierToken}
        onClose={() => setDossierToken(null)}
        onTrade={sym => {
          setSelectedSymbol(sym)
          setActiveTab('DEAL')
        }}
      />

      <SubscribeDialog
        isOpen={isSubscribeOpen}
        onClose={() => setIsSubscribeOpen(false)}
      />

      {tradeReceipt && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs'>
          <div className='relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-zinc-100'>
            <div className='flex items-center justify-between border-b border-zinc-100 pb-3'>
              <div className='flex items-center gap-2'>
                <div className='h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600'>
                  <Check className='h-5 w-5 stroke-[2.5]' />
                </div>
                <div>
                  <h3 className='font-hand text-2xl text-zinc-900'>
                    Trade Settled on Solana
                  </h3>
                  <p className='font-pixel text-[11px] text-zinc-400'>
                    Preflight Autonomous Broker
                  </p>
                </div>
              </div>
              <button
                type='button'
                onClick={() => setTradeReceipt(null)}
                className='rounded-full bg-zinc-100 p-1.5 text-zinc-400 hover:text-black'
              >
                <X className='h-4 w-4' />
              </button>
            </div>

            <div className='mt-4 p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200'>
              <div className='flex items-center gap-1.5 font-hand text-blue-900 text-lg'>
                <div className='rounded-full overflow-hidden shrink-0 border border-zinc-200'>
                  <Facehash
                    name={brokerAddress || 'Preflight Broker'}
                    size={16}
                    interactive={false}
                    showInitial={false}
                  />
                </div>
                <span>Zero Wallet Prompt (Autonomous Broker)</span>
              </div>
              <p className='mt-1 text-xs font-pixel text-blue-800/90 leading-relaxed'>
                Preflight is designed so you never need to connect Phantom or
                approve wallet popups. The autonomous broker agent signed and
                confirmed this trade on Solana Devnet on behalf of{' '}
                <span className=' text-blue-950'>
                  {userEmail || 'your account'}
                </span>
                .
              </p>
            </div>

            <div className='mt-4 space-y-2.5 font-pixel text-xs border border-zinc-200/80 rounded-2xl p-4 bg-zinc-50/60'>
              <div className='flex justify-between items-center'>
                <span className='text-zinc-500'>Asset:</span>
                <span className=' text-zinc-900'>
                  {tradeReceipt.token.name} ({tradeReceipt.token.symbol})
                </span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-zinc-500'>Order:</span>
                <span className=' text-blue-600'>
                  {tradeReceipt.action} ${tradeReceipt.amountUsd}
                </span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-zinc-500'>Tokens Acquired:</span>
                <span className=' text-zinc-800'>
                  {(
                    tradeReceipt.amountUsd / tradeReceipt.token.tokenPrice
                  ).toFixed(4)}{' '}
                  {tradeReceipt.token.symbol}
                </span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-zinc-500'>Execution Keypair:</span>
                <span className='text-emerald-700 '>
                  Autonomous Devnet Broker
                </span>
              </div>
              <div className='flex justify-between items-center pt-2 border-t border-zinc-200/60'>
                <span className='text-zinc-500'>Solana Explorer:</span>
                <a
                  href={tradeReceipt.swap.explorerUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-blue-600 hover:underline flex items-center gap-1 font-pixel text-[11px]'
                >
                  <span className='truncate max-w-[140px]'>
                    {tradeReceipt.swap.txHash}
                  </span>
                  <ExternalLink className='h-3 w-3 shrink-0' />
                </a>
              </div>
            </div>

            <div className='mt-6 flex items-center justify-end gap-2 border-t border-zinc-100 pt-3'>
              <button
                type='button'
                onClick={() => setTradeReceipt(null)}
                className='rounded-full border border-zinc-200 px-4 py-1.5 font-hand text-base text-zinc-600 hover:text-black'
              >
                Close
              </button>
              <button
                type='button'
                onClick={() => {
                  setTradeReceipt(null)
                  setActiveTab('ACTIVITY')
                }}
                className='rounded-full bg-black px-5 py-1.5 font-hand text-base text-white hover:bg-zinc-800 shadow-md'
              >
                View in Holdings &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      <BrokerModal
        isOpen={isBrokerModalOpen}
        onClose={() => setIsBrokerModalOpen(false)}
        brokerAddress={brokerAddress}
        brokerBalanceSol={brokerBalanceSol}
        onBalanceUpdated={newBal => setBrokerBalanceSol(newBal)}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        userEmail={userEmail}
        onEmailUpdated={handleEmailUpdated}
      />
    </div>
  )
}
