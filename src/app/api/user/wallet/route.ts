import { NextResponse } from 'next/server'
import { getUserWalletInfo, airdropUserWallet } from '@/lib/solana/user-wallet'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')
    const reveal = searchParams.get('reveal') === 'true'

    if (!email) {
      return NextResponse.json(
        { error: 'Missing email parameter' },
        { status: 400 },
      )
    }

    const wallet = await getUserWalletInfo(email, reveal)
    return NextResponse.json({ success: true, wallet })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string }
    const email = body?.email

    if (!email) {
      return NextResponse.json(
        { error: 'Missing email in request body' },
        { status: 400 },
      )
    }

    const result = await airdropUserWallet(email)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
