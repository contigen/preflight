'use client'

import React, { useState } from 'react'
import {
  Send,
  RefreshCw,
  Mail,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react'
import { Facehash } from 'facehash'
import { sileo } from 'sileo'
import { PREFLIGHT_AGENT_EMAIL } from '@/lib/constants'
import type { Token, SwapResult } from '@/types'
import type { UserWalletInfo } from '@/lib/solana/user-wallet'

type DealCardProps = {
  tokens: Token[]
  selectedSymbol: string
  userEmail: string | null
  brokerAddress: string
  brokerBalanceSol: number
  userWallet: UserWalletInfo | null
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
  const [isExecuting, setIsExecuting] = useState(false)
  const [showMemo, setShowMemo] = useState(false)
  const [dealMemo, setDealMemo] = useState<string>('')
  const [isGeneratingMemo, setIsGeneratingMemo] = useState(false)

  const selectedToken =
    tokens.find(t => t.symbol === selectedSymbol) || tokens[0]

  async function handleFetchMemo() {
    if (!selectedToken) return
    if (dealMemo && showMemo) {
      setShowMemo(false)
      return
    }
    setShowMemo(true)
    if (dealMemo) return

    setIsGeneratingMemo(true)
    try {
      const res = await fetch('/api/memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: selectedToken,
          subscriber: {
            email: userEmail || 'investor@preflight.io',
            sectors: [selectedToken.sector],
            maxUsd: amountUsd,
            name: userEmail ? userEmail.split('@')[0] : 'Investor',
          },
        }),
      })
      const data = (await res.json()) as { success: boolean; memo?: string }
      if (data.success && data.memo) {
        setDealMemo(data.memo)
      } else {
        setDealMemo(
          `Deal Alert: ${selectedToken.name} (${selectedToken.symbol})\nPreStocks SPV beneficial ownership on Solana with 0% transfer fee. Reply BUY $${amountUsd} to allocate.`,
        )
      }
    } catch {
      setDealMemo(
        `Deal Alert: ${selectedToken.name} (${selectedToken.symbol})\nPreStocks SPV beneficial ownership on Solana with 0% transfer fee. Reply BUY $${amountUsd} to allocate.`,
      )
    } finally {
      setIsGeneratingMemo(false)
    }
  }

  async function handleConfirmAndSend() {
    if (!userEmail) {
      if (onRequireAuth) onRequireAuth()
      return
    }
    if (!selectedToken) return

    if (userWallet && !userWallet.isFunded && userWallet.balanceSol < 0.005) {
      sileo.warning({
        title: 'User Wallet Gas Needed',
        description: `Your dedicated wallet (${userWallet.publicKey.slice(0, 4)}...${userWallet.publicKey.slice(-4)}) has 0 SOL for Solana gas. Please fund it via the directive.`,
        button: onOpenOnboarding
          ? {
              title: 'Fund Wallet',
              onClick: onOpenOnboarding,
            }
          : undefined,
      })
      return
    }

    if (brokerBalanceSol < 0.005) {
      sileo.warning({
        title: 'Broker Wallet Gas Needed',
        description:
          'Agent broker needs Devnet SOL to settle on-chain transactions.',
        button: onOpenBrokerModal
          ? {
              title: 'Fund Gas',
              onClick: onOpenBrokerModal,
            }
          : undefined,
      })
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

  const tokenPrice = selectedToken?.tokenPrice || 1
  const tokenQuantity = amountUsd / tokenPrice

  return (
    <div className='w-full max-w-lg mx-auto px-4 py-6'>
      <div className='relative w-full rounded-3xl bg-white border border-zinc-200/90 shadow-sm p-6 sm:p-7'>
        <div className='w-full mb-6'>
          <div className='flex items-center justify-between mb-2.5 px-0.5'>
            <span className='font-pixel text-[11px] uppercase tracking-wider text-zinc-400 font-bold'>
              PreStocks Assets
            </span>
            <span className='font-pixel text-[11px] text-emerald-600 font-bold'>
              0% Protocol Fee
            </span>
          </div>
          <div className='grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-zinc-100/80 border border-zinc-200/60'>
            {tokens.map(t => {
              const isSelected = selectedSymbol === t.symbol
              return (
                <button
                  key={t.symbol}
                  type='button'
                  onClick={() => {
                    onSelectSymbol(t.symbol)
                    setShowMemo(false)
                  }}
                  className={`py-2 px-1 rounded-xl text-xs font-pixel transition text-center truncate ${
                    isSelected
                      ? 'bg-black text-white font-bold shadow-xs'
                      : 'text-zinc-600 hover:text-black hover:bg-white/60'
                  }`}
                  title={`${t.name} - $${t.tokenPrice.toFixed(2)}`}
                >
                  {t.symbol}
                </button>
              )
            })}
          </div>
        </div>

        <div className='flex items-center justify-between w-full mb-5 pb-4 border-b border-zinc-100'>
          <div className='flex items-center gap-1 rounded-full bg-zinc-100 p-0.5 text-xs font-pixel'>
            <button
              type='button'
              onClick={() => setAction('BUY')}
              className={`rounded-full px-4 py-1.5 transition ${
                action === 'BUY'
                  ? 'bg-black text-white font-bold shadow-xs'
                  : 'text-zinc-600 hover:text-black'
              }`}
            >
              Buy
            </button>
            <button
              type='button'
              onClick={() => setAction('SELL')}
              className={`rounded-full px-4 py-1.5 transition ${
                action === 'SELL'
                  ? 'bg-rose-600 text-white font-bold shadow-xs'
                  : 'text-zinc-600 hover:text-black'
              }`}
            >
              Sell
            </button>
          </div>

          <div className='text-right'>
            <div className='font-pixel text-[10px] text-zinc-400 uppercase'>
              Market Price
            </div>
            <div className='font-pixel text-sm font-bold text-zinc-900'>
              ${selectedToken?.tokenPrice.toFixed(2)}
            </div>
          </div>
        </div>

        <div className='flex flex-col items-center my-4'>
          <div className='font-pixel text-5xl sm:text-6xl font-bold tracking-tight text-blue-600'>
            ${amountUsd}
          </div>
          <div className='mt-2 font-hand text-2xl sm:text-3xl text-zinc-900'>
            {action === 'BUY' ? 'Allocating to' : 'Liquidating'}{' '}
            {selectedToken?.name}
          </div>
          <div className='mt-1 font-pixel text-xs text-zinc-500'>
            &asymp; {tokenQuantity.toFixed(4)} {selectedToken?.symbol} tokens
          </div>
        </div>

        <div className='flex items-center justify-center gap-2 mb-6'>
          {[100, 250, 500, 1000].map(amt => (
            <button
              key={amt}
              type='button'
              onClick={() => setAmountUsd(amt)}
              className={`rounded-full px-3.5 py-1 text-xs font-pixel transition ${
                amountUsd === amt
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              ${amt}
            </button>
          ))}
        </div>

        <div className='w-full rounded-2xl bg-zinc-50 border border-zinc-200/70 p-3.5 mb-5 space-y-2 font-pixel text-xs'>
          <div className='flex justify-between items-center text-zinc-600'>
            <span>Asset Structure</span>
            <span className='font-bold text-zinc-800'>
              1:1 SPV Beneficial Ownership
            </span>
          </div>
          <div className='flex justify-between items-center text-zinc-600'>
            <span>Secondary Mark Premium</span>
            <span className='font-bold text-emerald-600'>
              {selectedToken?.premium || '0'}%
            </span>
          </div>
          <div className='flex justify-between items-center text-zinc-600'>
            <span>Protocol Fee</span>
            <span className='font-bold text-zinc-800'>0.00%</span>
          </div>
          <div className='flex justify-between items-center text-zinc-600'>
            <span>Settlement Network</span>
            <span className='font-bold text-zinc-800'>Solana Devnet</span>
          </div>
          {userWallet && (
            <div className='flex justify-between items-center text-zinc-600 pt-1.5 border-t border-zinc-200/60'>
              <span>Wallet Gas</span>
              <span
                className={`font-bold ${
                  userWallet.isFunded ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {userWallet.balanceSol.toFixed(3)} SOL
              </span>
            </div>
          )}
        </div>

        <button
          type='button'
          onClick={handleConfirmAndSend}
          disabled={isExecuting}
          className='w-full rounded-2xl bg-black py-3.5 px-6 text-xl font-hand text-white shadow-md hover:bg-zinc-800 transition active:scale-[0.99] disabled:opacity-50'
        >
          {isExecuting ? (
            <span className='inline-flex items-center gap-2 font-pixel text-sm'>
              <RefreshCw className='h-4 w-4 animate-spin' />
              Executing on Solana...
            </span>
          ) : !userEmail ? (
            'Connect Email to Trade'
          ) : (
            'Confirm & Settle Trade'
          )}
        </button>

        <div className='mt-4 flex flex-col items-center gap-1.5 w-full text-center'>
          <a
            href={`mailto:${PREFLIGHT_AGENT_EMAIL}?subject=${encodeURIComponent(`${action} $${amountUsd} ${selectedToken?.symbol}`)}&body=${encodeURIComponent(`${action} $${amountUsd} ${selectedToken?.symbol}\n\nPlease execute this order for ${selectedToken?.name}.`)}`}
            className='inline-flex items-center gap-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 px-3.5 py-1.5 font-pixel text-xs text-zinc-700 transition'
          >
            <Mail className='h-3.5 w-3.5 text-blue-600' />
            <span>
              Or Email Broker: {action} ${amountUsd} {selectedToken?.symbol}
            </span>
          </a>
          <span className='font-pixel text-[11px] text-zinc-400'>
            Agent inbox:{' '}
            <code className='text-zinc-600 select-all'>
              {PREFLIGHT_AGENT_EMAIL}
            </code>
          </span>
        </div>

        <div className='mt-4 pt-3 border-t border-zinc-100 flex flex-col items-center'>
          <button
            type='button'
            onClick={handleFetchMemo}
            className='inline-flex items-center gap-1.5 font-pixel text-xs text-zinc-500 hover:text-black transition'
          >
            <Sparkles className='h-3.5 w-3.5 text-blue-600' />
            <span>{showMemo ? 'Hide AI Deal Memo' : 'Read AI Deal Memo'}</span>
            {showMemo ? (
              <ChevronUp className='h-3 w-3' />
            ) : (
              <ChevronDown className='h-3 w-3' />
            )}
          </button>

          {showMemo && (
            <div className='mt-3 w-full text-left rounded-2xl bg-zinc-50 border border-zinc-200/80 p-4 shadow-xs'>
              <div className='flex items-center justify-between pb-2 border-b border-zinc-200/60'>
                <span className='font-hand text-lg text-zinc-900'>
                  Valuation Memo ({selectedToken?.symbol})
                </span>
                <span className='text-[10px] font-pixel text-blue-600 font-bold'>
                  Gemini 3.6 Flash
                </span>
              </div>
              {isGeneratingMemo ? (
                <div className='py-4 flex items-center justify-center gap-2 text-xs font-pixel text-zinc-400'>
                  <RefreshCw className='h-3.5 w-3.5 animate-spin text-blue-600' />
                  Generating memo...
                </div>
              ) : (
                <p className='mt-2.5 text-xs text-zinc-700 font-pixel leading-relaxed whitespace-pre-wrap'>
                  {dealMemo}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
