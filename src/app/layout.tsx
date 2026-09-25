import type { Metadata } from 'next'
import { Gochi_Hand } from 'next/font/google'
import { GeistPixelCircle } from 'geist/font/pixel'
import { Toaster } from 'sileo'
import 'sileo/styles.css'
import './globals.css'

const gochiHand = Gochi_Hand({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-gochi-hand',
})

export const metadata: Metadata = {
  title: 'Preflight — Pre-IPO Investing on Solana via Email',
  description:
    'The first time you can invest in pre-IPO companies on Solana without touching a wallet. Email is the interface. The agent is the broker. The chain is the runway.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang='en'
      suppressHydrationWarning
      className={`${gochiHand.variable} ${GeistPixelCircle.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className='min-h-full flex flex-col bg-[#fafafa] text-zinc-900 font-pixel selection:bg-blue-500 selection:text-white'
      >
        <Toaster position='top-right' />
        {children}
      </body>
    </html>
  )
}
