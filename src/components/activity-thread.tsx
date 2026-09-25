'use client'

import React from 'react'
import { ArrowDownLeft, ArrowUpRight, ExternalLink } from 'lucide-react'
import { Facehash } from 'facehash'
import type { PortfolioPosition, Token } from '@/types'
import type { ActivityEvent } from '@/lib/db/store'
import { PREFLIGHT_AGENT_EMAIL } from '@/lib/constants'

type ActivityThreadProps = {
  positions: Record<string, PortfolioPosition>
  tokens: Token[]
  activity: ActivityEvent[]
  onBack: () => void
  onNewAllocation: () => void
}

export function ActivityThread({
  positions,
  tokens,
  activity,
  onBack,
  onNewAllocation,
}: ActivityThreadProps) {
  let totalValue = 0
  for (const pos of Object.values(positions)) {
    const t = tokens.find(
      tok =>
        tok.symbol === pos.symbol ||
        tok.symbol === pos.symbol.replace('T-', ''),
    )
    const price = t?.tokenPrice || pos.avgPrice
    totalValue += pos.qty * price
  }

  return (
    <div className='relative mx-auto max-w-md w-full px-4 py-8 flex flex-col min-h-[620px]'>
      <div className='flex items-center justify-between pb-6 border-b border-zinc-100'>
        <div>
          <div className='font-hand text-2xl text-zinc-500'>Your Balance</div>
          <div className='font-pixel text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 mt-0.5'>
            $
            {totalValue.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>

        <button
          type='button'
          onClick={onBack}
          className='rounded-full border border-zinc-200 px-4 py-1 text-base font-hand text-zinc-600 hover:text-black hover:border-zinc-400 transition'
        >
          Back
        </button>
      </div>

      <div className='flex-1 py-6 space-y-4 overflow-y-auto'>
        {activity.length === 0 ? (
          <div className='py-16 text-center text-xs font-pixel text-zinc-400'>
            No transaction records yet.
          </div>
        ) : (
          activity.map(item => {
            const isOutgoing =
              item.type === 'TRADE_EXECUTED' || item.type === 'TRADE_SOLD'

            if (isOutgoing) {
              const amount =
                (item.details?.amountUsd as number) ||
                (item.details?.proceedsUsd as number) ||
                250
              return (
                <div key={item.id} className='flex justify-end'>
                  <div className='bg-black text-white rounded-3xl rounded-tr-sm p-4 max-w-[280px] shadow-sm'>
                    <div className='flex items-center gap-1 font-pixel text-xs text-zinc-300 font-bold'>
                      <ArrowUpRight className='h-3 w-3 text-blue-400' />
                      <span>
                        {item.type === 'TRADE_EXECUTED' ? 'Bought' : 'Sold'}{' '}
                        {item.symbol || 'Asset'}
                      </span>
                    </div>

                    <div className='font-pixel text-2xl font-bold text-white mt-1'>
                      ${Number(amount).toFixed(2)}
                    </div>

                    <div className='mt-2 text-[10px] font-pixel text-zinc-400 flex items-center justify-between gap-2 border-t border-zinc-800 pt-1.5'>
                      <span>Devnet Confirmed</span>
                      {item.txHash && (
                        <a
                          href={`https://explorer.solana.com/tx/${item.txHash}?cluster=devnet`}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-blue-400 hover:underline flex items-center gap-0.5'
                        >
                          Tx <ExternalLink className='h-2.5 w-2.5' />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div key={item.id} className='flex items-start gap-2.5'>
                <div className='h-7 w-7 rounded-full overflow-hidden border border-zinc-200 shrink-0 mt-1'>
                  <Facehash
                    name={PREFLIGHT_AGENT_EMAIL}
                    size={26}
                    interactive={false}
                    showInitial={false}
                  />
                </div>
                <div className='bg-zinc-100 text-zinc-900 rounded-3xl rounded-tl-sm p-4 max-w-[280px] border border-zinc-200/60 shadow-xs'>
                  <div className='flex items-center gap-1 font-pixel text-xs text-zinc-600 font-bold'>
                    <ArrowDownLeft className='h-3 w-3 text-blue-600' />
                    <span>
                      {item.type === 'DEAL_ALERT'
                        ? 'Deal Memo Dispatched'
                        : item.summary}
                    </span>
                  </div>

                  {item.symbol && (
                    <div className='font-pixel text-xl font-bold text-blue-600 mt-1'>
                      {item.symbol}
                    </div>
                  )}

                  <div className='mt-2 text-[10px] font-pixel text-zinc-400'>
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    • Completed
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className='pt-4 border-t border-zinc-100 flex justify-center'>
        <button
          type='button'
          onClick={onNewAllocation}
          className='w-full max-w-xs rounded-full bg-black py-3 px-8 text-2xl font-hand text-white shadow-xl hover:bg-zinc-800 transition transform hover:scale-[1.02] active:scale-[0.98]'
        >
          New Allocation
        </button>
      </div>
    </div>
  )
}
