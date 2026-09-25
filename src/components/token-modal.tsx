'use client'

import React from 'react'
import { ShieldCheck, ExternalLink, X } from 'lucide-react'
import type { Token } from '@/types'

type TokenModalProps = {
  token: Token | null
  onClose: () => void
  onTrade: (symbol: string) => void
}

export function TokenModal({ token, onClose, onTrade }: TokenModalProps) {
  if (!token) return null

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs'>
      <div className='relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-zinc-100'>
        <div className='flex items-center justify-between border-b border-zinc-100 pb-4'>
          <div>
            <h3 className='font-hand text-3xl text-zinc-900'>
              {token.name} ({token.symbol})
            </h3>
            <p className='font-pixel text-xs text-zinc-400'>
              {token.source} • {token.legalStructure}
            </p>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded-full bg-zinc-100 p-1.5 text-zinc-400 hover:text-black'
          >
            <X className='h-4 w-4' />
          </button>
        </div>

        <div className='mt-4 space-y-4'>
          <p className='text-xs text-zinc-600 font-pixel leading-relaxed'>
            {token.description}
          </p>

          <div className='rounded-2xl bg-zinc-50 p-4 space-y-2.5 font-pixel text-xs border border-zinc-200/60'>
            <div className='flex justify-between'>
              <span className='text-zinc-500'>Price:</span>
              <span className='text-blue-600 font-bold'>
                ${token.tokenPrice.toFixed(2)}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-zinc-500'>Implied Valuation:</span>
              <span className='text-zinc-800 font-bold'>
                {token.markValuation
                  ? `$${(token.markValuation / 1e9).toFixed(1)}B`
                  : 'N/A'}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-zinc-500'>Transfer Fee:</span>
              <span className='text-zinc-800'>
                {token.transferFeePct > 0
                  ? '0.20% (Token-2022 standard)'
                  : '0.00% (No fee)'}
              </span>
            </div>
            {token.contractAddress && (
              <div className='flex justify-between items-center'>
                <span className='text-zinc-500'>Contract:</span>
                <a
                  href={
                    token.solscan ||
                    `https://solscan.io/token/${token.contractAddress}`
                  }
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-blue-600 hover:underline flex items-center gap-1 font-pixel text-[11px]'
                >
                  <span className='truncate max-w-[140px]'>
                    {token.contractAddress}
                  </span>
                  <ExternalLink className='h-3 w-3' />
                </a>
              </div>
            )}
          </div>

          {token.porFeed && (
            <div className='rounded-2xl border border-blue-200 bg-blue-50/50 p-3.5'>
              <div className='flex items-center gap-1.5 font-hand text-blue-900 text-lg'>
                <ShieldCheck className='h-4 w-4 text-blue-600' />
                <span>Chainlink Proof of Reserve (1:1 Verified Backing)</span>
              </div>
              <p className='mt-1 text-[11px] font-pixel text-blue-800/80'>
                Private shares custody verified monthly by independent auditors.
                Oracle updates stream continuously to Solana.
              </p>
            </div>
          )}
        </div>

        <div className='mt-6 flex justify-end gap-2 border-t border-zinc-100 pt-4'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-full border border-zinc-200 px-5 py-2 font-hand text-base text-zinc-600 hover:text-black'
          >
            Close
          </button>
          <button
            type='button'
            onClick={() => {
              const sym = token.symbol
              onClose()
              onTrade(sym)
            }}
            className='rounded-full bg-black px-6 py-2 font-hand text-base text-white hover:bg-zinc-800'
          >
            Invest in {token.symbol}
          </button>
        </div>
      </div>
    </div>
  )
}
