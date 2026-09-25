'use client'

import React, { useState } from 'react'
import {
  Send,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Mail,
  Wallet,
} from 'lucide-react'
import { Facehash } from 'facehash'
import { sileo } from 'sileo'
import type { Token, ParsedReplyIntent, SwapResult } from '@/types'
import type { UserWalletInfo } from '@/lib/solana/user-wallet'
import { PREFLIGHT_AGENT_EMAIL } from '@/lib/constants'

type DealCardProps = {
  tokens: Token[]
  selectedSymbol: string
  userEmail: string | null
  brokerAddress?: string
  brokerBalanceSol?: number
  userWallet?: UserWalletInfo | null
  onSelectSymbol: (symbol: string) => void
  onTradeExecuted: (
    swap: SwapResult,
    token: Token,
    amountUsd: number,
    action: 'BUY' | 'SELL',
  ) => void
  onOpenBrokerModal?: () => void
  onRequireAuth?: () => void
  onOpenOnboarding?: () => void
}

export function DealCard({
  tokens,
  selectedSymbol,
  userEmail,
  brokerAddress,
  brokerBalanceSol,
  userWallet,
  onSelectSymbol,
  onTradeExecuted,
  onOpenBrokerModal,
  onRequireAuth,
  onOpenOnboarding,
}: DealCardProps) {
  const [amountUsd, setAmountUsd] = useState<number>(250)
  const [action, setAction] = useState<'BUY' | 'SELL'>('BUY')
  const [isExecuting, setIsExecuting] = useState<boolean>(false)
  const [isGeneratingMemo, setIsGeneratingMemo] = useState<boolean>(false)
  const [dealMemo, setDealMemo] = useState<string>('')
  const [showMemo, setShowMemo] = useState<boolean>(false)

  const selectedToken =
    tokens.find(t => t.symbol === selectedSymbol) || tokens[0]

  async function handleFetchMemo() {
    if (!selectedToken) return
    setIsGeneratingMemo(true)
    setShowMemo(true)
    try {
      const res = await fetch('/api/memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedToken.symbol,
          email: userEmail || 'investor@preflight.trade',
        }),
      })
      const data = (await res.json()) as { memo?: string }
      if (data.memo) {
        setDealMemo(data.memo)
      }
    } catch {
      setDealMemo(
        `Deal Memo for ${selectedToken.name} (${selectedToken.symbol}):\nTrading at $${selectedToken.tokenPrice.toFixed(2)} with implied valuation of ${selectedToken.markValuation ? `$${(selectedToken.markValuation / 1e9).toFixed(1)}B` : 'N/A'}.\n\nReply BUY $200 or PASS.`,
      )
    } finally {
      setIsGeneratingMemo(false)
    }
  }

  async function handleConfirmAndSend() {
    if (!selectedToken) return
    if (!userEmail) {
      sileo.warning({
        title: 'Connect Email Required',
        description:
          'Connect your email so Preflight can credit your allocated shares.',
      })
      if (onRequireAuth) onRequireAuth()
      return
    }

    setIsExecuting(true)
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedToken.symbol,
          amountUsd,
          action,
          email: userEmail,
        }),
      })
      const data = (await res.json()) as {
        success: boolean
        swap?: SwapResult
        error?: string
      }
      if (data.success && data.swap) {
        onTradeExecuted(data.swap, selectedToken, amountUsd, action)
      } else {
        if (
          data.error &&
          (data.error.includes('Devnet SOL') ||
            data.error.includes('gas') ||
            data.error.includes('faucet') ||
            data.error.includes('Agent Broker Wallet')) &&
          onOpenBrokerModal
        ) {
          onOpenBrokerModal()
        } else {
          sileo.error({
            title: 'Order Failed',
            description: data.error || 'Execution failed on Solana Devnet',
          })
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      sileo.error({
        title: 'Execution Error',
        description: msg,
      })
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div className='relative flex flex-col items-center justify-center min-h-[520px] w-full px-4 py-8'>
      <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
        <div className='h-[380px] w-[380px] sm:h-[480px] sm:w-[480px] rounded-full bg-gradient-to-tr from-blue-200/50 via-sky-100/60 to-transparent blur-3xl opacity-80' />
      </div>

      <div className='relative z-10 flex flex-col items-center text-center max-w-md w-full'>
        <div className='mb-6 flex flex-wrap justify-center gap-1.5 p-1 rounded-full bg-white/80 border border-zinc-200 shadow-xs backdrop-blur-sm'>
          {tokens.slice(0, 6).map(t => (
            <button
              key={t.symbol}
              onClick={() => {
                onSelectSymbol(t.symbol)
                setShowMemo(false)
              }}
              className={`rounded-full px-3.5 py-1 text-xs font-pixel transition ${
                selectedSymbol === t.symbol
                  ? 'bg-black text-white shadow-xs '
                  : 'text-zinc-600 hover:text-black'
              }`}
            >
              {t.symbol}
            </button>
          ))}
        </div>

        <div className='relative mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg ring-8 ring-blue-50/70 border border-blue-100/50'>
          <Send className='h-8 w-8 text-blue-600 -rotate-45 translate-x-0.5' />
        </div>

        <div className='flex flex-col items-center'>
          <div className='flex items-baseline gap-2'>
            <span className='font-hand text-4xl sm:text-5xl text-zinc-900 tracking-wide'>
              {action === 'BUY' ? 'Sending' : 'Selling'}
            </span>
            <span className='font-pixel text-4xl sm:text-5xl  tracking-tight text-blue-600'>
              ${amountUsd}
            </span>
          </div>

          <div className='mt-1 font-hand text-3xl sm:text-4xl text-zinc-800 tracking-wide'>
            to {selectedToken?.name} ({selectedToken?.symbol})
          </div>

          <div className='mt-2 flex items-center gap-2'>
            <span className='rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-pixel text-zinc-600 border border-zinc-200'>
              PreStocks • SPV 0% fee
            </span>
          </div>

          <p className='mt-3 text-xs font-pixel text-zinc-400'>
            Estimated arrival: ~8 seconds on Solana Devnet.
          </p>
        </div>

        <div className='mt-5 flex items-center gap-2'>
          {[100, 250, 500, 1000].map(amt => (
            <button
              key={amt}
              type='button'
              onClick={() => setAmountUsd(amt)}
              className={`rounded-full px-3 py-1 text-xs font-pixel transition ${
                amountUsd === amt
                  ? 'bg-blue-600 text-white '
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-300'
              }`}
            >
              ${amt}
            </button>
          ))}
          <button
            type='button'
            onClick={() => setAction(action === 'BUY' ? 'SELL' : 'BUY')}
            className='rounded-full px-3.5 py-1 text-xs font-pixel text-zinc-600 border border-zinc-200 hover:border-zinc-400 hover:text-black transition'
          >
            Switch to {action === 'BUY' ? 'Sell' : 'Buy'}
          </button>
        </div>

        <div className='mt-8 flex flex-col items-center gap-3 w-full'>
          {!userEmail ? (
            <button
              type='button'
              onClick={onRequireAuth}
              className='flex items-center gap-1.5 font-pixel text-xs text-zinc-400 hover:text-zinc-700 transition'
            >
              <Wallet className='h-3.5 w-3.5' />
              <span>
                No wallet connected &bull; Connect email to generate dedicated
                wallet
              </span>
            </button>
          ) : (
            <button
              type='button'
              onClick={onOpenOnboarding}
              className='flex items-center gap-1.5 font-pixel text-xs text-zinc-700 hover:text-black transition'
              title='Your Dedicated Solana Wallet & Onboarding Directive'
            >
              <div className='rounded-full overflow-hidden border border-zinc-200 shrink-0'>
                <Facehash
                  name={userWallet?.publicKey || userEmail}
                  size={14}
                  interactive={false}
                  showInitial={false}
                />
              </div>
              <span className='underline decoration-dotted underline-offset-4'>
                Your Wallet:{' '}
                {userWallet
                  ? `${userWallet.publicKey.slice(0, 4)}...${userWallet.publicKey.slice(-4)}`
                  : 'Generating...'}
              </span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px]  border ${
                  userWallet?.isFunded
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {userWallet?.balanceSol
                  ? `${userWallet.balanceSol.toFixed(3)} SOL`
                  : '0.00 SOL (Needs Gas)'}
              </span>
            </button>
          )}

          <button
            type='button'
            onClick={handleConfirmAndSend}
            disabled={isExecuting}
            className='w-full max-w-xs rounded-full bg-black py-3.5 px-8 text-2xl font-hand text-white shadow-xl hover:bg-zinc-800 transition transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50'
          >
            {isExecuting ? (
              <span className='inline-flex items-center gap-2 font-pixel text-sm'>
                <RefreshCw className='h-4 w-4 animate-spin' />
                Executing on Solana...
              </span>
            ) : !userEmail ? (
              'Connect Email to Trade'
            ) : (
              'Confirm & Send'
            )}
          </button>

          <div className='flex flex-col items-center gap-1.5 w-full'>
            <a
              href={`mailto:${PREFLIGHT_AGENT_EMAIL}?subject=${encodeURIComponent(`${action} $${amountUsd} ${selectedToken?.symbol}`)}&body=${encodeURIComponent(`${action} $${amountUsd} ${selectedToken?.symbol}\n\nPlease execute this order for ${selectedToken?.name}.`)}`}
              className='inline-flex items-center gap-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 px-3.5 py-1.5 font-pixel text-xs text-zinc-700 transition'
              title='Send trade order via email to Preflight Broker Agent'
            >
              <Mail className='h-3.5 w-3.5 text-blue-600' />
              <span>
                Or Email Broker: {action} ${amountUsd} {selectedToken?.symbol}
              </span>
            </a>
            <span className='font-pixel text-[10px] text-zinc-400'>
              Agent inbox:{' '}
              <span className='font-mono text-zinc-600'>
                {PREFLIGHT_AGENT_EMAIL}
              </span>
            </span>
          </div>

          <p className='font-pixel text-[11px] text-zinc-400 text-center max-w-xs'>
            {userEmail ? (
              <>
                Preflight Agent signs and executes directly on Solana Devnet on
                behalf of <span className='text-zinc-700 '>{userEmail}</span>.
              </>
            ) : (
              <>
                Zero-wallet execution: connect your email to allocate shares on
                Solana Devnet.
              </>
            )}
          </p>

          <button
            type='button'
            onClick={handleFetchMemo}
            className='font-hand text-base text-zinc-400 hover:text-zinc-700 transition pt-1'
          >
            {showMemo ? 'Hide AI Deal Memo' : 'Read Agent Deal Memo'}
          </button>
        </div>

        {showMemo && (
          <div className='mt-6 w-full text-left rounded-2xl bg-white border border-zinc-200/80 p-5 shadow-xs'>
            <div className='flex items-center justify-between pb-2 border-b border-zinc-100'>
              <span className='font-hand text-xl text-zinc-900'>
                Agent Deal Memo ({selectedToken?.symbol})
              </span>
              <span className='text-[10px] font-pixel text-blue-600 '>
                Gemini Flash
              </span>
            </div>
            {isGeneratingMemo ? (
              <div className='py-6 flex items-center justify-center gap-2 text-xs font-pixel text-zinc-400'>
                <RefreshCw className='h-3.5 w-3.5 animate-spin text-blue-600' />
                Generating memo...
              </div>
            ) : (
              <p className='mt-3 text-xs text-zinc-700 font-pixel leading-relaxed whitespace-pre-wrap'>
                {dealMemo}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
