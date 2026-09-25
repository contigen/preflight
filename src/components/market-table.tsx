'use client'

import React, { useState } from 'react'
import {
  Search,
  ExternalLink,
  ShieldCheck,
  Info,
  ArrowRight,
} from 'lucide-react'
import type { Token } from '@/types'

type MarketTableProps = {
  tokens: Token[]
  onSelectTokenForTrade: (symbol: string) => void
  onOpenDossier: (token: Token) => void
}

export function MarketTable({
  tokens,
  onSelectTokenForTrade,
  onOpenDossier,
}: MarketTableProps) {
  const [filter, setFilter] = useState<'ALL' | 'PRESTOCKS' | 'TESSERA'>('ALL')
  const [search, setSearch] = useState<string>('')

  const filtered = tokens.filter(t => {
    if (filter === 'PRESTOCKS' && t.source !== 'PreStocks') return false
    if (filter === 'TESSERA' && t.source !== 'Tessera') return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        t.name.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        t.sector.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className='relative mx-auto max-w-4xl w-full px-4 py-8'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-zinc-100'>
        <div>
          <h2 className='font-hand text-3xl text-zinc-900'>
            Pre-IPO Secondary Markets
          </h2>
          <p className='font-pixel text-xs text-zinc-400 mt-0.5'>
            11 private equity tokens on Solana • PreStocks &amp; Tessera
          </p>
        </div>

        <div className='flex items-center gap-2'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400' />
            <input
              type='text'
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder='Search asset...'
              className='rounded-full border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs font-pixel text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-black'
            />
          </div>

          <div className='flex items-center rounded-full bg-zinc-100 p-1 text-xs font-pixel'>
            <button
              type='button'
              onClick={() => setFilter('ALL')}
              className={`rounded-full px-3 py-1 transition ${
                filter === 'ALL'
                  ? 'bg-white text-black shadow-xs font-bold'
                  : 'text-zinc-500'
              }`}
            >
              All (11)
            </button>
            <button
              type='button'
              onClick={() => setFilter('PRESTOCKS')}
              className={`rounded-full px-3 py-1 transition ${
                filter === 'PRESTOCKS'
                  ? 'bg-white text-black shadow-xs font-bold'
                  : 'text-zinc-500'
              }`}
            >
              PreStocks
            </button>
            <button
              type='button'
              onClick={() => setFilter('TESSERA')}
              className={`rounded-full px-3 py-1 transition ${
                filter === 'TESSERA'
                  ? 'bg-white text-black shadow-xs font-bold'
                  : 'text-zinc-500'
              }`}
            >
              Tessera
            </button>
          </div>
        </div>
      </div>

      <div className='mt-6 space-y-2.5'>
        {filtered.map(token => (
          <div
            key={token.symbol}
            className='flex items-center justify-between rounded-2xl bg-white border border-zinc-200/80 p-4 transition hover:border-zinc-300 shadow-xs'
          >
            <div className='flex items-center gap-3'>
              <div className='flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 font-pixel text-xs font-bold text-zinc-700'>
                {token.symbol.slice(0, 3)}
              </div>
              <div>
                <div className='flex items-center gap-2'>
                  <span className='font-hand text-2xl text-zinc-900'>
                    {token.name}
                  </span>
                  <span className='font-pixel text-xs text-zinc-400 font-bold'>
                    {token.symbol}
                  </span>
                  <span className='rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-pixel text-zinc-500 border border-zinc-200'>
                    {token.source === 'Tessera' ? 'Token-2022' : 'SPV'}
                  </span>
                </div>
                <div className='mt-0.5 text-[11px] font-pixel text-zinc-400'>
                  Valuation:{' '}
                  {token.markValuation
                    ? `$${(token.markValuation / 1e9).toFixed(1)}B`
                    : 'N/A'}{' '}
                  • Fee: {token.transferFeePct}%
                </div>
              </div>
            </div>

            <div className='flex items-center gap-4'>
              <div className='text-right'>
                <div className='font-pixel text-lg sm:text-xl font-bold text-blue-600'>
                  ${token.tokenPrice.toFixed(2)}
                </div>
                {token.porFeed ? (
                  <a
                    href={`https://data.chain.link/streams/${token.porFeed}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-0.5 text-[10px] font-pixel text-cyan-700 hover:underline'
                  >
                    <ShieldCheck className='h-3 w-3' />
                    <span>Chainlink PoR</span>
                  </a>
                ) : (
                  <span className='text-[10px] font-pixel text-zinc-400'>
                    Audited SPV
                  </span>
                )}
              </div>

              <div className='flex items-center gap-1.5'>
                <button
                  type='button'
                  onClick={() => onOpenDossier(token)}
                  className='rounded-full border border-zinc-200 p-2 text-zinc-500 hover:text-black hover:border-zinc-300'
                  title='View Dossier'
                >
                  <Info className='h-3.5 w-3.5' />
                </button>
                <button
                  type='button'
                  onClick={() => onSelectTokenForTrade(token.symbol)}
                  className='rounded-full bg-black px-4 py-1.5 font-hand text-base text-white hover:bg-zinc-800 transition'
                >
                  Invest
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
