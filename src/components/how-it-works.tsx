'use client'

import React from 'react'
import {
  Mail,
  ShieldCheck,
  Zap,
  ArrowRight,
  Database,
  Activity,
  RefreshCw,
} from 'lucide-react'
import { Facehash } from 'facehash'
import { PREFLIGHT_AGENT_EMAIL } from '@/lib/constants'

type HowItWorksProps = {
  onStartTrading: () => void
  onOpenSubscribe: () => void
}

function BrokerStepIcon() {
  return (
    <div className='rounded-full overflow-hidden shrink-0 border border-zinc-200'>
      <Facehash
        name='Preflight Broker'
        size={24}
        interactive={false}
        showInitial={false}
      />
    </div>
  )
}

export function HowItWorks({
  onStartTrading,
  onOpenSubscribe,
}: HowItWorksProps) {
  const steps = [
    {
      num: '01',
      title: 'Set Your Deal Profile',
      desc: 'Subscribe with your email and specify your target sectors (AI, Space, Defense) and maximum allocation per deal ($100 - $1,000).',
      icon: Mail,
      badge: 'No Wallet Setup',
    },
    {
      num: '02',
      title: 'Autonomous Market Scanning',
      desc: "Preflight's AI engine monitors PreStocks and Tessera secondary markets 24/7. When prices move > 3% or new liquidity unlocks, you receive an institutional Deal Memo in your inbox.",
      icon: Activity,
      badge: '24/7 Dealflow',
    },
    {
      num: '03',
      title: 'Reply in Plain English',
      desc: `No decentralized apps or browser extensions needed. Simply reply 'BUY $250' or 'CONFIRM' to ${PREFLIGHT_AGENT_EMAIL}. Gemini Flash extracts your intent, checks liquidity, and locks your quote.`,
      icon: BrokerStepIcon,
      badge: 'Zero Friction',
    },
    {
      num: '04',
      title: 'On-Chain Settlement',
      desc: 'Your broker agent executes the allocation instantly on Solana Devnet. Every position is backed 1:1 on-chain and auditable via Chainlink Proof of Reserve.',
      icon: ShieldCheck,
      badge: 'Solana Devnet',
    },
  ]

  return (
    <div className='w-full max-w-5xl px-4 py-8 mx-auto flex flex-col gap-12'>
      <div className='text-center max-w-2xl mx-auto flex flex-col items-center gap-3'>
        <span className='rounded-full bg-blue-50 px-3 py-1 font-pixel text-xs text-blue-700 border border-blue-200 font-bold'>
          Product Architecture &amp; User Guide
        </span>
        <h1 className='font-hand text-5xl sm:text-6xl tracking-wide text-zinc-900'>
          How Preflight Works
        </h1>
        <p className='font-pixel text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-xl'>
          The first time you can invest in pre-IPO companies on Solana without
          touching a wallet. Email is the interface. The agent is the broker.
          The chain is the runway.
        </p>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        {steps.map(step => {
          const Icon = step.icon
          return (
            <div
              key={step.num}
              className='relative flex flex-col justify-between rounded-2xl bg-white border border-zinc-200/80 p-6 shadow-xs hover:shadow-md transition'
            >
              <div>
                <div className='flex items-center justify-between mb-4'>
                  <span className='font-pixel text-2xl font-bold text-blue-600'>
                    {step.num}
                  </span>
                  <span className='rounded-full bg-zinc-100 px-2 py-0.5 font-pixel text-[10px] text-zinc-600 border border-zinc-200'>
                    {step.badge}
                  </span>
                </div>
                <div className='mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600'>
                  <Icon className='h-5 w-5' />
                </div>
                <h3 className='font-hand text-2xl text-zinc-900 mb-2'>
                  {step.title}
                </h3>
                <p className='font-pixel text-xs text-zinc-600 leading-relaxed'>
                  {step.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
        <div className='rounded-2xl bg-white border border-zinc-200/80 p-6 shadow-xs flex flex-col justify-between'>
          <div>
            <div className='flex items-center gap-2 mb-3'>
              <Database className='h-5 w-5 text-zinc-800' />
              <h3 className='font-hand text-3xl text-zinc-900'>
                Supported Asset Classes
              </h3>
            </div>
            <p className='font-pixel text-xs text-zinc-600 mb-5 leading-relaxed'>
              Preflight ingests real secondary liquidity feeds from two Solana
              pre-IPO market makers:
            </p>

            <div className='flex flex-col gap-4 font-pixel text-xs'>
              <div className='p-4 rounded-xl bg-zinc-50 border border-zinc-200'>
                <div className='flex items-center justify-between mb-1'>
                  <span className='font-hand text-xl text-zinc-900'>
                    PreStocks (8 Assets)
                  </span>
                  <span className='font-pixel text-[11px] text-emerald-600 font-bold'>
                    0% Protocol Fee
                  </span>
                </div>
                <p className='text-zinc-500 mb-2'>
                  Special Purpose Vehicle (SPV) equity shares wrapped as
                  standard Solana SPL tokens.
                </p>
                <div className='flex flex-wrap gap-1 font-pixel text-[10px]'>
                  <span className='bg-white px-2 py-0.5 rounded border border-zinc-200'>
                    ANDURIL
                  </span>
                  <span className='bg-white px-2 py-0.5 rounded border border-zinc-200'>
                    ANTHROPIC
                  </span>
                  <span className='bg-white px-2 py-0.5 rounded border border-zinc-200'>
                    FIGUREAI
                  </span>
                  <span className='bg-white px-2 py-0.5 rounded border border-zinc-200'>
                    KALSHI
                  </span>
                  <span className='bg-white px-2 py-0.5 rounded border border-zinc-200'>
                    OPENAI
                  </span>
                  <span className='bg-white px-2 py-0.5 rounded border border-zinc-200'>
                    SPACEX
                  </span>
                </div>
              </div>

              <div className='p-4 rounded-xl bg-zinc-50 border border-zinc-200'>
                <div className='flex items-center justify-between mb-1'>
                  <span className='font-hand text-xl text-zinc-900'>
                    Tessera T-Tokens (3 Assets)
                  </span>
                  <span className='font-pixel text-[11px] text-blue-600 font-bold'>
                    0.20% Transfer Fee (Token-2022)
                  </span>
                </div>
                <p className='text-zinc-500 mb-2'>
                  Token-2022 standard with programmatic transfer fees, audited
                  custodians, and Chainlink 1:1 Proof-of-Reserve.
                </p>
                <div className='flex flex-wrap gap-1 font-pixel text-[10px]'>
                  <span className='bg-white px-2 py-0.5 rounded border border-zinc-200'>
                    T-OpenAI
                  </span>
                  <span className='bg-white px-2 py-0.5 rounded border border-zinc-200'>
                    T-Kalshi
                  </span>
                  <span className='bg-white px-2 py-0.5 rounded border border-zinc-200'>
                    T-SpaceX
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='rounded-2xl bg-zinc-900 text-white p-6 shadow-xl flex flex-col justify-between'>
          <div>
            <div className='flex items-center gap-2 mb-3'>
              <Zap className='h-5 w-5 text-blue-400' />
              <h3 className='font-hand text-3xl text-white'>
                Conversational Email Syntax
              </h3>
            </div>
            <p className='font-pixel text-xs text-zinc-400 mb-4 leading-relaxed'>
              When an alert hits your inbox from{' '}
              <span className='font-mono text-zinc-200'>
                {PREFLIGHT_AGENT_EMAIL}
              </span>
              , reply in plain English. The Gemini Flash parser recognizes all
              standard financial commands:
            </p>

            <div className='space-y-3 font-pixel text-xs'>
              <div className='p-3 rounded-lg bg-zinc-800/80 border border-zinc-700 flex items-center justify-between'>
                <div>
                  <span className='text-emerald-400 font-bold'>BUY $250</span>
                  <span className='text-zinc-400 ml-2'>
                    or &quot;Invest $500 in Anthropic&quot;
                  </span>
                </div>
                <span className='text-[10px] font-pixel text-zinc-400'>
                  Creates Pending Intent
                </span>
              </div>

              <div className='p-3 rounded-lg bg-zinc-800/80 border border-zinc-700 flex items-center justify-between'>
                <div>
                  <span className='text-blue-400 font-bold'>CONFIRM</span>
                  <span className='text-zinc-400 ml-2'>
                    or &quot;Yes, execute trade&quot;
                  </span>
                </div>
                <span className='text-[10px] font-pixel text-zinc-400'>
                  Executes on Solana Devnet
                </span>
              </div>

              <div className='p-3 rounded-lg bg-zinc-800/80 border border-zinc-700 flex items-center justify-between'>
                <div>
                  <span className='text-red-400 font-bold'>SELL 50%</span>
                  <span className='text-zinc-400 ml-2'>
                    or &quot;Liquidate all SpaceX&quot;
                  </span>
                </div>
                <span className='text-[10px] font-pixel text-zinc-400'>
                  Position Reduction
                </span>
              </div>

              <div className='p-3 rounded-lg bg-zinc-800/80 border border-zinc-700 flex items-center justify-between'>
                <div>
                  <span className='text-purple-400 font-bold'>PORTFOLIO</span>
                  <span className='text-zinc-400 ml-2'>
                    or &quot;What do I hold?&quot;
                  </span>
                </div>
                <span className='text-[10px] font-pixel text-zinc-400'>
                  Digest + Unrealized P&amp;L
                </span>
              </div>
            </div>
          </div>

          <div className='mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between'>
            <span className='text-xs font-pixel text-zinc-400'>
              Ready to try it live?
            </span>
            <button
              type='button'
              onClick={onStartTrading}
              className='inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-6 py-2 font-hand text-lg text-white hover:bg-blue-500 transition'
            >
              <span>Allocate Now</span>
              <ArrowRight className='h-4 w-4' />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
