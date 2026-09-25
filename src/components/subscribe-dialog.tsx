'use client'

import React, { useState } from 'react'
import { Mail, CheckCircle2, RefreshCw, X } from 'lucide-react'
import { PREFLIGHT_AGENT_EMAIL } from '@/lib/constants'

type SubscribeDialogProps = {
  isOpen: boolean
  onClose: () => void
}

const SECTORS = [
  'AI',
  'Space',
  'Defense',
  'Prediction Markets',
  'Robotics',
  'Fintech',
]

export function SubscribeDialog({ isOpen, onClose }: SubscribeDialogProps) {
  const [email, setEmail] = useState<string>('')
  const [name, setName] = useState<string>('')
  const [maxUsd, setMaxUsd] = useState<string>('500')
  const [selectedSectors, setSelectedSectors] = useState<string[]>([
    'AI',
    'Space',
  ])
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isDone, setIsDone] = useState<boolean>(false)

  if (!isOpen) return null

  function toggleSector(s: string) {
    if (selectedSectors.includes(s)) {
      setSelectedSectors(selectedSectors.filter(x => x !== s))
    } else {
      setSelectedSectors([...selectedSectors, s])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          maxUsd: Number(maxUsd) || 500,
          sectors: selectedSectors,
        }),
      })

      const data = (await res.json()) as { success: boolean; error?: string }
      if (data.success) {
        setIsDone(true)
      } else {
        alert(data.error || 'Subscription failed')
      }
    } catch {
      alert('Subscription request failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs'>
      <div className='relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-zinc-100'>
        <div className='flex items-center justify-between border-b border-zinc-100 pb-3'>
          <div className='flex items-center gap-2'>
            <div className='h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600'>
              <Mail className='h-4 w-4' />
            </div>
            <div>
              <h3 className='font-hand text-2xl text-zinc-900'>
                Join Preflight Dealflow
              </h3>
              <p className='font-pixel text-[11px] text-zinc-400'>
                Personalized Pre-IPO Memos via Email
              </p>
            </div>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded-full bg-zinc-100 p-1.5 text-zinc-400 hover:text-black'
          >
            <X className='h-4 w-4' />
          </button>
        </div>

        {isDone ? (
          <div className='py-8 text-center space-y-2'>
            <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600'>
              <CheckCircle2 className='h-6 w-6' />
            </div>
            <h4 className='font-hand text-3xl tracking-wide text-zinc-900'>
              You&apos;re On The Runway!
            </h4>
            <p className='font-pixel text-xs text-zinc-500 max-w-xs mx-auto'>
              We&apos;ll send institutional-grade deal alerts from{' '}
              <span className='font-mono text-zinc-800'>
                {PREFLIGHT_AGENT_EMAIL}
              </span>{' '}
              directly to {email}. Reply BUY $200 anytime to execute.
            </p>
            <div className='pt-4'>
              <button
                type='button'
                onClick={() => {
                  setIsDone(false)
                  onClose()
                }}
                className='rounded-full bg-black px-6 py-2 font-hand text-base text-white hover:bg-zinc-800'
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className='mt-4 space-y-3.5'>
            <div>
              <label className='block font-pixel text-xs  text-zinc-800'>
                Your Email
              </label>
              <input
                type='email'
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder='investor@example.com'
                className='mt-1 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs font-pixel text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-black'
              />
            </div>

            <div>
              <label className='block font-pixel text-xs text-zinc-800'>
                Your Name (Optional)
              </label>
              <input
                type='text'
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder='Alex'
                className='mt-1 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs font-pixel text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-black'
              />
            </div>

            <div>
              <label className='block font-pixel text-xs text-zinc-800'>
                Max Allocation per Deal ($)
              </label>
              <input
                type='number'
                value={maxUsd}
                onChange={e => setMaxUsd(e.target.value)}
                className='mt-1 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs font-pixel text-zinc-900 focus:outline-none focus:ring-1 focus:ring-black'
              />
            </div>

            <div>
              <label className='block font-pixel text-xs text-zinc-800 mb-1.5'>
                Sectors of Interest
              </label>
              <div className='flex flex-wrap gap-1.5'>
                {SECTORS.map(sec => {
                  const active = selectedSectors.includes(sec)
                  return (
                    <button
                      key={sec}
                      type='button'
                      onClick={() => toggleSector(sec)}
                      className={`rounded-full px-3 py-1 font-pixel text-xs transition ${
                        active
                          ? 'bg-black text-white '
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {sec}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className='mt-6 flex justify-end gap-2 border-t border-zinc-100 pt-3'>
              <button
                type='button'
                onClick={onClose}
                className='rounded-full border border-zinc-200 px-4 py-1.5 font-hand text-base text-zinc-600 hover:text-black'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={isSubmitting}
                className='rounded-full bg-black px-6 py-2 font-hand text-base text-white shadow-lg hover:bg-zinc-800 disabled:opacity-50'
              >
                {isSubmitting ? (
                  <span className='flex items-center gap-1.5 font-pixel text-xs'>
                    <RefreshCw className='h-3.5 w-3.5 animate-spin' />
                    Subscribing...
                  </span>
                ) : (
                  'Subscribe'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
