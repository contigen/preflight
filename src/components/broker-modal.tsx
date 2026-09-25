'use client'

import React, { useState } from 'react'
import {
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  X,
  ShieldCheck,
  Droplets,
  Mail,
} from 'lucide-react'
import { Facehash } from 'facehash'
import { PREFLIGHT_AGENT_EMAIL } from '@/lib/constants'

type BrokerModalProps = {
  isOpen: boolean
  onClose: () => void
  brokerAddress: string
  brokerBalanceSol: number
  onBalanceUpdated?: (newBalance: number) => void
}

export function BrokerModal({
  isOpen,
  onClose,
  brokerAddress,
  brokerBalanceSol,
  onBalanceUpdated,
}: BrokerModalProps) {
  const [copied, setCopied] = useState<boolean>(false)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isAirdropping, setIsAirdropping] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  if (!isOpen) return null

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(brokerAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  async function handleRefresh() {
    setIsRefreshing(true)
    setStatusMessage(null)
    try {
      const res = await fetch('/api/agent/wallet')
      const data = (await res.json()) as {
        success?: boolean
        balanceSol?: number
      }
      if (typeof data.balanceSol === 'number' && onBalanceUpdated) {
        onBalanceUpdated(data.balanceSol)
      }
    } catch {
      setStatusMessage('Failed to refresh balance')
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleAirdrop() {
    setIsAirdropping(true)
    setStatusMessage(null)
    try {
      const res = await fetch('/api/agent/wallet', { method: 'POST' })
      const data = (await res.json()) as {
        success?: boolean
        message?: string
        balanceSol?: number
      }
      if (typeof data.balanceSol === 'number' && onBalanceUpdated) {
        onBalanceUpdated(data.balanceSol)
      }
      setStatusMessage(
        data.message ||
          (data.success ? 'Airdrop succeeded!' : 'Airdrop failed'),
      )
    } catch {
      setStatusMessage('RPC network error requesting airdrop')
    } finally {
      setIsAirdropping(false)
    }
  }

  const hasFunds = brokerBalanceSol > 0.0001

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200'>
      <div className='relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-zinc-200'>
        <button
          type='button'
          onClick={onClose}
          className='absolute top-5 right-5 p-1 rounded-full text-zinc-400 hover:text-black hover:bg-zinc-100 transition'
        >
          <X className='h-5 w-5' />
        </button>

        <div className='flex items-center gap-3'>
          <div className='flex h-11 w-11 items-center justify-center rounded-2xl overflow-hidden border border-zinc-200/80 shadow-2xs'>
            <Facehash
              name={brokerAddress || 'Preflight Broker'}
              size={44}
              interactive={true}
              showInitial={false}
            />
          </div>
          <div>
            <h2 className='font-hand text-2xl text-zinc-900 leading-none'>
              Autonomous Broker Agent
            </h2>
            <p className='mt-0.5 font-pixel text-xs text-zinc-500'>
              Zero-Wallet Execution Architecture
            </p>
          </div>
        </div>

        <div className='mt-5 rounded-2xl bg-zinc-50 p-4 border border-zinc-200/80'>
          <div className='flex items-center justify-between'>
            <span className='font-pixel text-[11px] uppercase tracking-wider text-zinc-400'>
              Agent Broker Public Key
            </span>
            <span className='inline-flex items-center gap-1 font-pixel text-[10px] text-zinc-500 bg-white px-2 py-0.5 rounded-full border border-zinc-200'>
              Devnet
            </span>
          </div>

          <div className='mt-2 flex items-center justify-between gap-2 bg-white rounded-xl p-2.5 border border-zinc-200'>
            <code className='font-pixel text-xs text-zinc-800 break-all select-all'>
              {brokerAddress}
            </code>
            <button
              type='button'
              onClick={handleCopy}
              className='flex-shrink-0 flex items-center gap-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 text-xs font-pixel text-zinc-700 transition'
            >
              {copied ? (
                <>
                  <Check className='h-3.5 w-3.5 text-emerald-600' />
                  <span className='text-emerald-700'>Copied</span>
                </>
              ) : (
                <>
                  <Copy className='h-3.5 w-3.5' />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className='mt-3 flex items-center justify-between pt-2 border-t border-zinc-200/60'>
            <div className='flex items-center gap-2'>
              <span className='font-pixel text-xs text-zinc-500'>
                Gas Balance:
              </span>
              <span className='font-pixel text-sm font-bold text-zinc-900'>
                {brokerBalanceSol.toFixed(4)} SOL
              </span>
            </div>

            <div className='flex items-center gap-1.5'>
              <button
                type='button'
                onClick={handleRefresh}
                disabled={isRefreshing}
                className='flex items-center gap-1 rounded-full bg-white hover:bg-zinc-100 border border-zinc-200 px-2.5 py-1 font-pixel text-[11px] text-zinc-600 transition disabled:opacity-50'
              >
                <RefreshCw
                  className={`h-3 w-3 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`}
                />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>

        <div className='mt-3 rounded-2xl bg-blue-50/70 p-3.5 border border-blue-200/80'>
          <div className='flex items-center justify-between'>
            <span className='font-pixel text-[11px] uppercase tracking-wider text-blue-700 font-bold'>
              Agent Email Interface
            </span>
            <span className='inline-flex items-center gap-1 font-pixel text-[10px] text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200'>
              AgentMail.to
            </span>
          </div>

          <div className='mt-2 flex items-center justify-between gap-2 bg-white rounded-xl p-2.5 border border-blue-200/80'>
            <code className='font-pixel text-xs text-blue-900 select-all font-mono'>
              {PREFLIGHT_AGENT_EMAIL}
            </code>
            <a
              href={`mailto:${PREFLIGHT_AGENT_EMAIL}`}
              className='flex-shrink-0 flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 px-2.5 py-1 text-xs font-pixel text-white transition'
            >
              <Mail className='h-3.5 w-3.5' />
              <span>Email Agent</span>
            </a>
          </div>
          <p className='mt-2 font-pixel text-[11px] text-blue-700 leading-relaxed'>
            Reply directly to any alert from this address with commands like
            &quot;BUY $250&quot; or &quot;CONFIRM&quot; to execute autonomously.
          </p>
        </div>

        <div className='mt-3'>
          {hasFunds ? (
            <div className='flex items-center gap-2 rounded-2xl bg-emerald-50 p-3.5 border border-emerald-200 text-emerald-800 font-pixel text-xs'>
              <ShieldCheck className='h-4 w-4 text-emerald-600 flex-shrink-0' />
              <span>
                Broker is funded and ready to broadcast live on-chain Solana
                transactions.
              </span>
            </div>
          ) : (
            <div className='rounded-2xl bg-amber-50 p-3.5 border border-amber-200 text-amber-900'>
              <div className='flex items-start gap-2'>
                <AlertCircle className='h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0' />
                <div className='font-pixel text-xs space-y-1'>
                  <p className='font-bold'>Broker Needs Devnet SOL For Gas</p>
                  <p className='text-amber-800 text-[11px] leading-relaxed'>
                    To keep trades 100% genuine on Solana Devnet, the agent
                    broker needs a fraction of a cent of Devnet SOL to pay
                    blockchain transaction fees.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {statusMessage && (
          <div className='mt-3 p-2.5 rounded-xl bg-zinc-100 border border-zinc-200 font-pixel text-[11px] text-zinc-700'>
            {statusMessage}
          </div>
        )}

        <div className='mt-5 space-y-2'>
          <div className='flex flex-col sm:flex-row gap-2'>
            <a
              href={`https://faucet.solana.com`}
              target='_blank'
              rel='noopener noreferrer'
              className='flex-1 flex items-center justify-center gap-2 rounded-2xl bg-black hover:bg-zinc-800 text-white py-3 px-4 font-pixel text-xs font-bold shadow-md transition'
            >
              <span>Get 1 SOL at Faucet.solana.com</span>
              <ExternalLink className='h-3.5 w-3.5' />
            </a>

            <button
              type='button'
              onClick={handleAirdrop}
              disabled={isAirdropping}
              className='flex items-center justify-center gap-1.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 py-3 px-4 font-pixel text-xs text-zinc-800 transition disabled:opacity-50'
            >
              <Droplets
                className={`h-3.5 w-3.5 text-blue-600 ${isAirdropping ? 'animate-pulse' : ''}`}
              />
              <span>{isAirdropping ? 'Requesting...' : 'Auto-Airdrop'}</span>
            </button>
          </div>

          <p className='font-pixel text-[11px] text-zinc-400 text-center pt-1'>
            Tip: Copy the agent address above, paste into faucet.solana.com, and
            click confirm.
          </p>
        </div>

        <div className='mt-5 pt-4 border-t border-zinc-100'>
          <h3 className='font-hand text-lg text-zinc-800'>
            Why didn&apos;t my browser open Phantom?
          </h3>
          <p className='mt-1 font-pixel text-[11px] text-zinc-500 leading-relaxed'>
            Preflight eliminates crypto onboarding friction. You don&apos;t need
            Phantom, seed phrases, or wallet approvals. You reply to emails or
            tap Confirm, and the Preflight Broker Agent signs and settles the
            order directly on Solana.
          </p>
        </div>
      </div>
    </div>
  )
}
