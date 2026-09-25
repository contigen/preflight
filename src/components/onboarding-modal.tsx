'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Check,
  Copy,
  Mail,
  Zap,
  Droplets,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Wallet,
  Key,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Facehash } from 'facehash'
import { sileo } from 'sileo'
import type { UserWalletInfo } from '@/lib/solana/user-wallet'
import { PREFLIGHT_AGENT_EMAIL } from '@/lib/constants'

type OnboardingModalProps = {
  isOpen: boolean
  onClose: () => void
  userEmail: string | null
  onEmailUpdated: (email: string) => void
}

export function OnboardingModal({
  isOpen,
  onClose,
  userEmail,
  onEmailUpdated,
}: OnboardingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [emailInput, setEmailInput] = useState<string>(userEmail || '')
  const [walletInfo, setWalletInfo] = useState<UserWalletInfo | null>(null)
  const [isLoadingWallet, setIsLoadingWallet] = useState<boolean>(false)
  const [isAirdropping, setIsAirdropping] = useState<boolean>(false)
  const [copiedWallet, setCopiedWallet] = useState<boolean>(false)
  const [copiedEmail, setCopiedEmail] = useState<boolean>(false)
  const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false)
  const [copiedPrivateKey, setCopiedPrivateKey] = useState<boolean>(false)

  useEffect(() => {
    if (userEmail) {
      setEmailInput(userEmail)
      fetchUserWallet(userEmail)
    }
  }, [userEmail])

  if (!isOpen) return null

  async function fetchUserWallet(email: string) {
    if (!email) return
    setIsLoadingWallet(true)
    try {
      const res = await fetch(
        `/api/user/wallet?email=${encodeURIComponent(email)}`,
      )
      const data = (await res.json()) as {
        success: boolean
        wallet?: UserWalletInfo
      }
      if (data.success && data.wallet) {
        setWalletInfo(data.wallet)
      }
    } catch {
    } finally {
      setIsLoadingWallet(false)
    }
  }

  async function handleAirdrop() {
    const targetEmail = userEmail || emailInput
    if (!targetEmail) return

    setIsAirdropping(true)
    try {
      const res = await fetch('/api/user/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      })
      const data = (await res.json()) as {
        success: boolean
        message?: string
        balanceSol?: number
      }

      if (data.success) {
        sileo.success({
          title: 'Wallet Funded',
          description: 'Received 1 Devnet SOL for on-chain settlement gas.',
        })
        if (typeof data.balanceSol === 'number' && walletInfo) {
          setWalletInfo({
            ...walletInfo,
            balanceSol: data.balanceSol,
            isFunded: data.balanceSol > 0.001,
          })
        }
      } else {
        sileo.warning({
          title: 'Airdrop Limit',
          description: data.message || 'Please fund using faucet.solana.com',
        })
      }
    } catch {
      sileo.error({
        title: 'Airdrop Failed',
        description: 'RPC network busy. Try faucet.solana.com',
      })
    } finally {
      setIsAirdropping(false)
    }
  }

  function handleSaveEmail(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const clean = emailInput.trim().toLowerCase()
    if (!clean || !clean.includes('@')) {
      sileo.error({
        title: 'Invalid Email',
        description: 'Please enter a valid email address.',
      })
      return
    }

    onEmailUpdated(clean)
    fetchUserWallet(clean)
    setStep(2)
  }

  async function handleTogglePrivateKey() {
    if (showPrivateKey) {
      setShowPrivateKey(false)
      return
    }
    const targetEmail = userEmail || emailInput
    if (!targetEmail) return
    try {
      const res = await fetch(
        `/api/user/wallet?email=${encodeURIComponent(targetEmail)}&reveal=true`,
      )
      const data = (await res.json()) as {
        success: boolean
        wallet?: UserWalletInfo
      }
      if (data.wallet) {
        setWalletInfo(data.wallet)
        setShowPrivateKey(true)
      }
    } catch {}
  }

  async function copyToClipboard(
    text: string,
    type: 'wallet' | 'email' | 'privateKey',
  ) {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'wallet') {
        setCopiedWallet(true)
        setTimeout(() => setCopiedWallet(false), 2000)
        sileo.success({
          title: 'Wallet Address Copied',
          description: 'Paste at faucet.solana.com or in your notes.',
        })
      } else if (type === 'privateKey') {
        setCopiedPrivateKey(true)
        setTimeout(() => setCopiedPrivateKey(false), 2000)
        sileo.warning({
          title: 'Private Key Copied',
          description: 'Keep your secret key safe and never share it publicly.',
        })
      } else {
        setCopiedEmail(true)
        setTimeout(() => setCopiedEmail(false), 2000)
        sileo.success({
          title: 'Agent Email Copied',
          description: `Save ${PREFLIGHT_AGENT_EMAIL} in your email VIP contacts.`,
        })
      }
    } catch {}
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200'>
      <div className='relative w-full max-w-xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-zinc-200 flex flex-col max-h-[92vh] overflow-y-auto'>
        <button
          type='button'
          onClick={onClose}
          className='absolute top-6 right-6 p-1.5 rounded-full text-zinc-400 hover:text-black hover:bg-zinc-100 transition'
        >
          <X className='h-5 w-5' />
        </button>

        <div className='flex items-center gap-2 mb-6'>
          <span className='rounded-full bg-blue-50 px-2.5 py-0.5 font-pixel text-[11px] text-blue-700 font-bold border border-blue-200'>
            Step {step} of 4
          </span>
          <div className='flex gap-1.5'>
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={`h-1.5 w-6 rounded-full transition ${
                  step >= s ? 'bg-blue-600' : 'bg-zinc-200'
                }`}
              />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className='flex flex-col gap-5'>
            <div>
              <h2 className='font-hand text-4xl sm:text-5xl text-zinc-900 leading-none'>
                Directive: How Preflight Works
              </h2>
              <p className='mt-2 font-pixel text-xs sm:text-sm text-zinc-600 leading-relaxed'>
                Preflight is the first autonomous pre-IPO broker on Solana where{' '}
                <span className='font-bold text-zinc-900'>
                  email is your trading interface
                </span>
                .
              </p>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 font-pixel text-xs'>
              <div className='p-4 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col justify-between'>
                <div>
                  <div className='h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-2 font-bold'>
                    01
                  </div>
                  <h4 className='font-bold text-zinc-900'>Zero Phantom</h4>
                  <p className='text-zinc-500 text-[11px] mt-1 leading-snug'>
                    No browser extensions, seed phrases, or wallet approval
                    popups.
                  </p>
                </div>
              </div>

              <div className='p-4 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col justify-between'>
                <div>
                  <div className='h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-2 font-bold'>
                    02
                  </div>
                  <h4 className='font-bold text-zinc-900'>Email Terminal</h4>
                  <p className='text-zinc-500 text-[11px] mt-1 leading-snug'>
                    Deal memos arrive in your inbox. Reply in plain English to
                    execute.
                  </p>
                </div>
              </div>

              <div className='p-4 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col justify-between'>
                <div>
                  <div className='h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-2 font-bold'>
                    03
                  </div>
                  <h4 className='font-bold text-zinc-900'>Solana Devnet</h4>
                  <p className='text-zinc-500 text-[11px] mt-1 leading-snug'>
                    Trades settle on-chain in 400ms with Chainlink 1:1
                    Proof-of-Reserve.
                  </p>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleSaveEmail}
              className='mt-2 flex flex-col gap-3'
            >
              <label className='font-pixel text-xs font-bold text-zinc-800'>
                Enter your email to generate your investor account &amp; wallet:
              </label>
              <div className='flex gap-2'>
                <input
                  type='email'
                  required
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder='investor@example.com'
                  className='flex-1 rounded-2xl bg-zinc-50 border border-zinc-200 px-4 py-2.5 font-pixel text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-black'
                />
                <button
                  type='submit'
                  className='rounded-2xl bg-black px-6 py-2.5 font-hand text-lg text-white hover:bg-zinc-800 transition flex items-center gap-1.5 shrink-0'
                >
                  <span>Continue</span>
                  <ArrowRight className='h-4 w-4' />
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 2 && (
          <div className='flex flex-col gap-5'>
            <div>
              <h2 className='font-hand text-4xl sm:text-5xl text-zinc-900 leading-none'>
                Fund Your Generated Wallet
              </h2>
              <p className='mt-2 font-pixel text-xs sm:text-sm text-zinc-600 leading-relaxed'>
                Preflight generated a dedicated Solana Devnet wallet for{' '}
                <span className='font-bold text-zinc-900'>
                  {userEmail || emailInput}
                </span>
                . Fund it with free Devnet SOL to power on-chain gas settlement.
              </p>
            </div>

            <div className='rounded-2xl bg-zinc-50 p-4 border border-zinc-200 space-y-3'>
              <div className='flex items-center justify-between'>
                <span className='font-pixel text-[11px] uppercase tracking-wider text-zinc-400 font-bold'>
                  Your Dedicated Solana Address
                </span>
                <span className='font-pixel text-[10px] text-zinc-500 bg-white px-2 py-0.5 rounded-full border border-zinc-200'>
                  Devnet
                </span>
              </div>

              {isLoadingWallet ? (
                <div className='py-4 flex items-center justify-center gap-2 text-xs font-pixel text-zinc-400'>
                  <RefreshCw className='h-4 w-4 animate-spin text-blue-600' />
                  Generating your wallet...
                </div>
              ) : (
                <div className='flex items-center justify-between gap-2 bg-white rounded-xl p-3 border border-zinc-200'>
                  <div className='flex items-center gap-2 overflow-hidden'>
                    <div className='rounded-full overflow-hidden border border-zinc-200 shrink-0'>
                      <Facehash
                        name={walletInfo?.publicKey || 'Investor Wallet'}
                        size={20}
                        interactive={false}
                        showInitial={false}
                      />
                    </div>
                    <code className='font-pixel text-xs text-zinc-800 break-all select-all'>
                      {walletInfo?.publicKey}
                    </code>
                  </div>
                  <button
                    type='button'
                    onClick={() =>
                      copyToClipboard(walletInfo?.publicKey || '', 'wallet')
                    }
                    className='flex-shrink-0 flex items-center gap-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 text-xs font-pixel text-zinc-700 transition'
                  >
                    {copiedWallet ? (
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
              )}

              <div className='flex items-center justify-between pt-1 font-pixel text-xs'>
                <div className='flex items-center gap-2'>
                  <span className='text-zinc-500'>Balance:</span>
                  <span className='font-bold text-zinc-900 text-sm'>
                    {walletInfo?.balanceSol?.toFixed(3) || '0.000'} SOL
                  </span>
                </div>
                {walletInfo?.isFunded ? (
                  <span className='inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] text-emerald-700 border border-emerald-200 font-bold'>
                    <ShieldCheck className='h-3 w-3' />
                    Funded &amp; Ready
                  </span>
                ) : (
                  <span className='rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] text-amber-700 border border-amber-200 font-bold'>
                    Needs Gas
                  </span>
                )}
              </div>

              <div className='pt-2 border-t border-zinc-200/60'>
                <button
                  type='button'
                  onClick={handleTogglePrivateKey}
                  className='flex items-center gap-1.5 font-pixel text-[11px] text-zinc-500 hover:text-black transition'
                >
                  <Key className='h-3 w-3 text-amber-600' />
                  <span>
                    {showPrivateKey
                      ? 'Hide Private Key'
                      : 'Export / View Private Key'}
                  </span>
                  {showPrivateKey ? (
                    <EyeOff className='h-3 w-3 text-zinc-400' />
                  ) : (
                    <Eye className='h-3 w-3 text-zinc-400' />
                  )}
                </button>

                {showPrivateKey && walletInfo?.privateKeyBase58 && (
                  <div className='mt-2 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200'>
                    <div className='flex items-center justify-between gap-2'>
                      <code className='font-pixel text-[10px] text-amber-950 break-all select-all font-mono'>
                        {walletInfo.privateKeyBase58}
                      </code>
                      <button
                        type='button'
                        onClick={() =>
                          copyToClipboard(
                            walletInfo.privateKeyBase58!,
                            'privateKey',
                          )
                        }
                        className='flex-shrink-0 flex items-center gap-1 rounded bg-amber-100 hover:bg-amber-200 px-2 py-1 text-[10px] font-pixel text-amber-900 transition'
                      >
                        {copiedPrivateKey ? (
                          <Check className='h-3 w-3 text-emerald-700' />
                        ) : (
                          <Copy className='h-3 w-3' />
                        )}
                        <span>{copiedPrivateKey ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <p className='mt-1 text-[10px] font-pixel text-amber-800'>
                      Genuine Solana Keypair secret. You can import this into
                      Phantom or Solflare anytime.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className='flex flex-col sm:flex-row gap-2.5'>
              <button
                type='button'
                onClick={handleAirdrop}
                disabled={isAirdropping}
                className='flex-1 flex items-center justify-center gap-2 rounded-2xl bg-black hover:bg-zinc-800 text-white py-3 px-4 font-pixel text-xs font-bold shadow-md transition disabled:opacity-50'
              >
                <Droplets
                  className={`h-4 w-4 text-blue-400 ${isAirdropping ? 'animate-pulse' : ''}`}
                />
                <span>
                  {isAirdropping
                    ? 'Airdropping 1 SOL...'
                    : '1-Click Airdrop (1 SOL)'}
                </span>
              </button>

              <a
                href='https://faucet.solana.com'
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center justify-center gap-1.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 py-3 px-4 font-pixel text-xs text-zinc-800 transition'
              >
                <span>faucet.solana.com</span>
                <ExternalLink className='h-3.5 w-3.5' />
              </a>
            </div>

            <div className='flex items-center justify-between pt-2 border-t border-zinc-100'>
              <button
                type='button'
                onClick={() => setStep(1)}
                className='inline-flex items-center gap-1 font-hand text-base text-zinc-500 hover:text-black'
              >
                <ArrowLeft className='h-4 w-4' />
                <span>Back</span>
              </button>
              <button
                type='button'
                onClick={() => setStep(3)}
                className='inline-flex items-center gap-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 font-hand text-lg shadow-md transition'
              >
                <span>Next: Agent Email</span>
                <ArrowRight className='h-4 w-4' />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className='flex flex-col gap-5'>
            <div>
              <h2 className='font-hand text-4xl sm:text-5xl text-zinc-900 leading-none'>
                Copy The Agent Mail
              </h2>
              <p className='mt-2 font-pixel text-xs sm:text-sm text-zinc-600 leading-relaxed'>
                Preflight is powered by an autonomous broker agent. Save this
                email address in your contacts or whitelist so deal memos land
                in your primary inbox.
              </p>
            </div>

            <div className='rounded-2xl bg-blue-50/70 p-5 border border-blue-200 space-y-4'>
              <div className='flex items-center justify-between'>
                <span className='font-pixel text-[11px] uppercase tracking-wider text-blue-700 font-bold'>
                  Preflight Broker Agent Email
                </span>
                <span className='font-pixel text-[10px] text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200'>
                  AgentMail.to
                </span>
              </div>

              <div className='flex items-center justify-between gap-3 bg-white rounded-xl p-3.5 border border-blue-200 shadow-2xs'>
                <div className='flex items-center gap-2.5 overflow-hidden'>
                  <div className='rounded-full overflow-hidden border border-blue-200 shrink-0'>
                    <Facehash
                      name={PREFLIGHT_AGENT_EMAIL}
                      size={24}
                      interactive={false}
                      showInitial={false}
                    />
                  </div>
                  <code className='font-mono text-xs sm:text-sm text-blue-950 font-bold select-all'>
                    {PREFLIGHT_AGENT_EMAIL}
                  </code>
                </div>

                <button
                  type='button'
                  onClick={() =>
                    copyToClipboard(PREFLIGHT_AGENT_EMAIL, 'email')
                  }
                  className='flex-shrink-0 flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 text-xs font-pixel text-white font-bold transition shadow-xs'
                >
                  {copiedEmail ? (
                    <>
                      <Check className='h-3.5 w-3.5' />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className='h-3.5 w-3.5' />
                      <span>Copy Email</span>
                    </>
                  )}
                </button>
              </div>

              <div className='flex flex-col sm:flex-row gap-2 pt-1 font-pixel text-xs text-blue-800'>
                <a
                  href={`mailto:${PREFLIGHT_AGENT_EMAIL}?subject=Hello%20Preflight&body=Hello%20Broker%2C%20I%20am%20ready%20for%20pre-IPO%20dealflow.`}
                  className='inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-blue-100/50 border border-blue-200 px-3 py-2 transition'
                >
                  <Mail className='h-3.5 w-3.5 text-blue-600' />
                  <span>Send Test Email</span>
                </a>
                <span className='text-[11px] text-blue-700 self-center'>
                  Tip: Whitelist this address to never miss an allocation memo.
                </span>
              </div>
            </div>

            <div className='flex items-center justify-between pt-2 border-t border-zinc-100'>
              <button
                type='button'
                onClick={() => setStep(2)}
                className='inline-flex items-center gap-1 font-hand text-base text-zinc-500 hover:text-black'
              >
                <ArrowLeft className='h-4 w-4' />
                <span>Back</span>
              </button>
              <button
                type='button'
                onClick={() => setStep(4)}
                className='inline-flex items-center gap-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 font-hand text-lg shadow-md transition'
              >
                <span>Next: The User Story</span>
                <ArrowRight className='h-4 w-4' />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className='flex flex-col gap-5'>
            <div>
              <h2 className='font-hand text-4xl sm:text-5xl text-zinc-900 leading-none'>
                The User Story: Executing Deals
              </h2>
              <p className='mt-2 font-pixel text-xs sm:text-sm text-zinc-600 leading-relaxed'>
                Here is what your ongoing investment experience looks like every
                day:
              </p>
            </div>

            <div className='space-y-2.5 font-pixel text-xs'>
              <div className='p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-start gap-3'>
                <div className='h-6 w-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]'>
                  1
                </div>
                <div>
                  <span className='font-bold text-zinc-900'>
                    Institutional Deal Memo Dispatched
                  </span>
                  <p className='text-zinc-500 text-[11px] mt-0.5'>
                    When secondary market spreads move &gt; 3% on PreStocks or
                    Tessera, the agent emails you a detailed valuation memo with
                    share price and implied cap.
                  </p>
                </div>
              </div>

              <div className='p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-start gap-3'>
                <div className='h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0 text-[11px]'>
                  2
                </div>
                <div>
                  <span className='font-bold text-zinc-900'>
                    Reply In Plain English
                  </span>
                  <p className='text-zinc-500 text-[11px] mt-0.5'>
                    Simply hit Reply and type{' '}
                    <span className='font-mono text-zinc-800 font-bold'>
                      BUY $250
                    </span>
                    ,{' '}
                    <span className='font-mono text-zinc-800 font-bold'>
                      CONFIRM
                    </span>
                    , or{' '}
                    <span className='font-mono text-zinc-800 font-bold'>
                      PORTFOLIO
                    </span>
                    .
                  </p>
                </div>
              </div>

              <div className='p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-start gap-3'>
                <div className='h-6 w-6 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center shrink-0 text-[11px]'>
                  3
                </div>
                <div>
                  <span className='font-bold text-zinc-900'>
                    Autonomous Solana Devnet Settlement
                  </span>
                  <p className='text-zinc-500 text-[11px] mt-0.5'>
                    The agent broker locks your allocation quote and executes
                    on-chain. You receive a Solscan receipt and your holdings
                    update in real-time.
                  </p>
                </div>
              </div>
            </div>

            <div className='flex items-center justify-between pt-3 border-t border-zinc-100'>
              <button
                type='button'
                onClick={() => setStep(3)}
                className='inline-flex items-center gap-1 font-hand text-base text-zinc-500 hover:text-black'
              >
                <ArrowLeft className='h-4 w-4' />
                <span>Back</span>
              </button>
              <button
                type='button'
                onClick={() => {
                  try {
                    localStorage.setItem('preflight_onboarded', 'true')
                  } catch {}
                  onClose()
                  sileo.success({
                    title: 'Ready for Dealflow!',
                    description:
                      "You're all set. Browse deals or reply via email anytime.",
                  })
                }}
                className='inline-flex items-center gap-2 rounded-full bg-black hover:bg-zinc-800 text-white px-7 py-3 font-hand text-xl shadow-xl transition transform hover:scale-[1.02]'
              >
                <span>Start Allocating</span>
                <Sparkles className='h-4 w-4 text-blue-400' />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
