import { NextResponse } from 'next/server'
import { getAgentWalletInfo, getAgentWallet } from '@/lib/solana/devnet'
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js'

export async function GET() {
  try {
    const info = await getAgentWalletInfo()
    return NextResponse.json({
      success: true,
      publicKey: info.publicKey,
      balanceSol: info.balanceSol,
      balanceLamports: info.balanceLamports,
      network: 'devnet',
      faucetUrl: 'https://faucet.solana.com',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const wallet = getAgentWallet()
    const conn = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed',
    )
    let airdropSuccess = false
    let message = ''

    try {
      const sig = await conn.requestAirdrop(
        wallet.publicKey,
        1 * LAMPORTS_PER_SOL,
      )
      await conn.confirmTransaction(sig, 'confirmed')
      airdropSuccess = true
      message = 'Airdrop of 1 SOL confirmed on Solana Devnet'
    } catch (airdropErr: unknown) {
      const errStr =
        airdropErr instanceof Error ? airdropErr.message : String(airdropErr)
      message = errStr.includes('429')
        ? 'Devnet faucet RPC is currently rate limited. Please use faucet.solana.com or send Devnet SOL manually.'
        : errStr
    }

    const balanceLamports = await conn
      .getBalance(wallet.publicKey)
      .catch(() => 0)
    return NextResponse.json({
      success: airdropSuccess,
      message,
      publicKey: wallet.publicKey.toBase58(),
      balanceSol: balanceLamports / LAMPORTS_PER_SOL,
      balanceLamports,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
