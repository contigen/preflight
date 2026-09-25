'use client'

import React from 'react'
import {
  Mail,
  ShieldCheck,
  Zap,
  ArrowRight,
  Database,
  Activity,
  ExternalLink,
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

export function HowItWorks({ onStartTrading }: HowItWorksProps) {
  const steps = [
    {
      num: '01',
      title: 'Set Your Deal Profile',
      desc: 'Subscribe with your email and specify your target sectors (AI, Space, Defense, Robotics) and maximum allocation per deal ($100 - $1,000).',
      icon: Mail,
      badge: 'Zero Wallet Setup',
    },
    {
      num: '02',
      title: 'Autonomous Surveillance',
      desc: "Preflight's AI engine monitors PreStocks secondary markets 24/7. When prices move > 3% or new liquidity unlocks, you receive an institutional Deal Memo in your inbox.",
      icon: Activity,
      badge: '24/7 Dealflow',
    },
    {
      num: '03',
      title: 'Reply in Plain English',
      desc: "No decentralized apps or browser extensions needed. Simply reply 'BUY $250' or 'CONFIRM' to the broker email. Gemini Flash extracts your intent and locks your quote.",
      icon: BrokerStepIcon,
      badge: 'Email Interface',
    },
    {
      num: '04',
      title: 'On-Chain Settlement',
      desc: 'Your broker agent executes the allocation instantly on Solana Devnet. Every position is backed 1:1 by SPVs holding private company equity.',
      icon: ShieldCheck,
      badge: 'Solana Devnet',
    },
  ]

  const prestocksAssets = [
    { symbol: 'ANDURIL', name: 'Anduril', sector: 'Defense AI' },
    { symbol: 'ANTHROPIC', name: 'Anthropic', sector: 'Claude AI' },
    { symbol: 'FIGUREAI', name: 'Figure AI', sector: 'Humanoid Robots' },
    { symbol: 'KALSHI', name: 'Kalshi', sector: 'Regulated Forecasts' },
    { symbol: 'NEURALINK', name: 'Neuralink', sector: 'Neural Interfaces' },
    { symbol: 'OPENAI', name: 'OpenAI', sector: 'ChatGPT / Frontier AI' },
    { symbol: 'POLYMARKET', name: 'Polymarket', sector: 'Prediction Markets' },
    { symbol: 'SPACEX', name: 'SpaceX', sector: 'Starlink & Launch' },
  ]

  return (
    <div className='w-full max-w-5xl px-4 py-8 mx-auto flex flex-col gap-10'>
      <div className='text-center max-w-2xl mx-auto flex flex-col items-center gap-2'>
        <span className='rounded-full bg-blue-50 px-3 py-1 font-pixel text-xs text-blue-700 border border-blue-200 '>
          Product Architecture &amp; User Guide
        </span>
        <h1 className='font-hand text-5xl sm:text-6xl tracking-wide text-zinc-900'>
          How Preflight Works
        </h1>
        <p className='font-pixel text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-xl'>
          Invest in pre-IPO equity on Solana through email. The inbox is the
          interface. The agent is the broker.
        </p>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        {steps.map(step => {
          const Icon = step.icon
          return (
            <div
              key={step.num}
              className='relative flex flex-col justify-between rounded-3xl bg-white border border-zinc-200/90 p-5 shadow-xs hover:border-zinc-300 transition'
            >
              <div>
                <div className='flex items-center justify-between mb-3'>
                  <span className='font-pixel text-xl  text-blue-600'>
                    {step.num}
                  </span>
                  <span className='rounded-full bg-zinc-100 px-2 py-0.5 font-pixel text-[10px] text-zinc-600 border border-zinc-200'>
                    {step.badge}
                  </span>
                </div>
                <div className='mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600'>
                  <Icon className='h-4 w-4' />
                </div>
                <h3 className='font-hand text-2xl text-zinc-900 mb-1.5'>
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

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch'>
        <div className='rounded-3xl bg-white border border-zinc-200/90 p-6 sm:p-7 shadow-xs flex flex-col justify-between'>
          <div>
            <div className='flex items-center justify-between mb-3'>
              <div className='flex items-center gap-2'>
                <Database className='h-5 w-5 text-zinc-800' />
                <h3 className='font-hand text-3xl text-zinc-900'>
                  PreStocks SPV Architecture
                </h3>
              </div>
              <span className='font-pixel text-[11px] text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 '>
                0% Protocol Fee
              </span>
            </div>
            <p className='font-pixel text-xs text-zinc-600 mb-4 leading-relaxed'>
              Preflight ingests live market data directly from the PreStocks
              API. Each SPL token confers beneficial ownership in a Special
              Purpose Vehicle holding private shares:
            </p>

            <div className='grid grid-cols-2 gap-2 font-pixel text-xs mb-4'>
              {prestocksAssets.map(asset => (
                <div
                  key={asset.symbol}
                  className='p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/70 hover:border-zinc-300 transition'
                >
                  <div className='flex items-center justify-between'>
                    <span className=' text-zinc-900 text-xs'>
                      {asset.symbol}
                    </span>
                    <span className='text-[9px] text-zinc-400'>SPL</span>
                  </div>
                  <div className='text-zinc-500 text-[10px] mt-0.5 truncate'>
                    {asset.sector}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className='pt-4 border-t border-zinc-100 flex items-center justify-between font-pixel text-xs text-zinc-500'>
            <span>Secondary Market Liquidity</span>
            <a
              href='https://prestocks.com'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1 text-blue-600 hover:underline'
            >
              <span>prestocks.com</span>
              <ExternalLink className='h-3 w-3' />
            </a>
          </div>
        </div>

        <div className='rounded-3xl bg-zinc-950 text-white p-6 sm:p-7 shadow-xl flex flex-col justify-between'>
          <div>
            <div className='flex items-center justify-between mb-3'>
              <div className='flex items-center gap-2'>
                <Zap className='h-5 w-5 text-blue-400' />
                <h3 className='font-hand text-3xl text-white'>
                  Conversational Commands
                </h3>
              </div>
              <span className='font-pixel text-[10px] text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-800/60'>
                Gemini 3.6 Flash
              </span>
            </div>
            <p className='font-pixel text-xs text-zinc-400 mb-4 leading-relaxed'>
              Reply to any email alert from{' '}
              <code className='rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200 border border-zinc-800'>
                {PREFLIGHT_AGENT_EMAIL}
              </code>
              . The broker parses your plain English intent:
            </p>

            <div className='space-y-2.5 font-pixel text-xs'>
              <div className='p-3 rounded-xl bg-zinc-900/90 border border-zinc-800/80 flex items-center justify-between'>
                <div>
                  <span className='text-emerald-400 '>BUY $250</span>
                  <span className='text-zinc-400 ml-2'>
                    or &quot;Invest $500 in Anthropic&quot;
                  </span>
                </div>
                <span className='text-[10px] text-zinc-500'>
                  Locks Quote (15m)
                </span>
              </div>

              <div className='p-3 rounded-xl bg-zinc-900/90 border border-zinc-800/80 flex items-center justify-between'>
                <div>
                  <span className='text-blue-400 '>CONFIRM</span>
                  <span className='text-zinc-400 ml-2'>
                    or &quot;Yes, proceed&quot;
                  </span>
                </div>
                <span className='text-[10px] text-zinc-500'>
                  Executes Trade
                </span>
              </div>

              <div className='p-3 rounded-xl bg-zinc-900/90 border border-zinc-800/80 flex items-center justify-between'>
                <div>
                  <span className='text-red-400 '>SELL 50%</span>
                  <span className='text-zinc-400 ml-2'>
                    or &quot;Exit SpaceX&quot;
                  </span>
                </div>
                <span className='text-[10px] text-zinc-500'>
                  Position Reduction
                </span>
              </div>

              <div className='p-3 rounded-xl bg-zinc-900/90 border border-zinc-800/80 flex items-center justify-between'>
                <div>
                  <span className='text-purple-400 '>PORTFOLIO</span>
                  <span className='text-zinc-400 ml-2'>
                    or &quot;What do I hold?&quot;
                  </span>
                </div>
                <span className='text-[10px] text-zinc-500'>
                  P&amp;L Digest
                </span>
              </div>
            </div>
          </div>

          <div className='mt-5 pt-4 border-t border-zinc-800 flex items-center justify-between'>
            <span className='text-xs font-pixel text-zinc-400'>
              Ready to allocate?
            </span>
            <button
              type='button'
              onClick={onStartTrading}
              className='inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 font-hand text-base text-white hover:bg-blue-500 transition shadow-sm'
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
