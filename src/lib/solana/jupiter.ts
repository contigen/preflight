export const TOKEN_MINTS: Record<string, string> = {
  ANDURIL: 'PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB',
  ANTHROPIC: 'Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw',
  FIGUREAI: 'PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd',
  KALSHI: 'PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua',
  NEURALINK: 'PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S',
  OPENAI: 'PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF',
  POLYMARKET: 'Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP',
  SPACEX: 'PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh',
  'T-OpenAI': 'oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ',
  'T-Kalshi': 'TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ',
  'T-SpaceX': 'TSPXcLV76s6V2zDiZQ18kBfcbnjaE2ZzNT3ga2Pd99v',
}

export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

export type JupiterQuoteResponse = {
  inputMint: string
  inAmount: string
  outputMint: string
  outAmount: string
  priceImpactPct: string
  routePlan: unknown[]
  slippageBps: number
}

export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amountAtomic: number,
): Promise<JupiterQuoteResponse | null> {
  try {
    const url = new URL('https://quote-api.jup.ag/v6/quote')
    url.searchParams.set('inputMint', inputMint)
    url.searchParams.set('outputMint', outputMint)
    url.searchParams.set('amount', Math.floor(amountAtomic).toString())
    url.searchParams.set('slippageBps', '50')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(url.toString(), { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!res.ok) return null
    return (await res.json()) as JupiterQuoteResponse
  } catch {
    return null
  }
}
