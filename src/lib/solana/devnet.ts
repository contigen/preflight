import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import bs58 from 'bs58'
import type { Token, SwapResult } from '@/types'

const DEVNET_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
export const devnetConnection = new Connection(DEVNET_RPC, 'confirmed')

let agentKeypair: Keypair | null = null

export function getAgentWallet(): Keypair {
  if (agentKeypair) return agentKeypair

  const envKey = process.env.SOLANA_PRIVATE_KEY
  if (envKey) {
    try {
      if (envKey.startsWith('[')) {
        const secret = Uint8Array.from(JSON.parse(envKey))
        agentKeypair = Keypair.fromSecretKey(secret)
        return agentKeypair
      }
      const decode =
        (bs58 as unknown as { decode: (s: string) => Uint8Array }).decode ||
        bs58
      const secret = decode(envKey)
      agentKeypair = Keypair.fromSecretKey(secret)
      return agentKeypair
    } catch {}
  }

  agentKeypair = Keypair.generate()
  return agentKeypair
}

export type AgentWalletInfo = {
  publicKey: string
  balanceSol: number
  balanceLamports: number
}

export async function getAgentWalletInfo(): Promise<AgentWalletInfo> {
  const wallet = getAgentWallet()
  try {
    const balanceLamports = await devnetConnection.getBalance(wallet.publicKey)
    return {
      publicKey: wallet.publicKey.toBase58(),
      balanceSol: balanceLamports / LAMPORTS_PER_SOL,
      balanceLamports,
    }
  } catch {
    return {
      publicKey: wallet.publicKey.toBase58(),
      balanceSol: 0,
      balanceLamports: 0,
    }
  }
}

export async function executeDevnetTrade(
  token: Token,
  amountUsd: number,
  userEmail?: string,
): Promise<SwapResult> {
  const feePct = 0.1
  const feeUsd = ((amountUsd * feePct) / 100).toFixed(4)
  const slippagePct = (0.15).toFixed(2)

  let wallet = getAgentWallet()
  if (userEmail) {
    const { getOrCreateUserKeypair } = await import('./user-wallet')
    wallet = await getOrCreateUserKeypair(userEmail)
  }

  let balance = await devnetConnection
    .getBalance(wallet.publicKey)
    .catch(() => 0)

  if (balance < 5000) {
    try {
      const airdropSig = await devnetConnection.requestAirdrop(
        wallet.publicKey,
        100_000_000,
      )
      const latest = await devnetConnection.getLatestBlockhash('confirmed')
      await devnetConnection.confirmTransaction({
        signature: airdropSig,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      })
      balance = await devnetConnection
        .getBalance(wallet.publicKey)
        .catch(() => 0)
    } catch {}
  }

  if (balance < 5000 && userEmail) {
    try {
      const broker = getAgentWallet()
      const brokerBalance = await devnetConnection
        .getBalance(broker.publicKey)
        .catch(() => 0)
      if (brokerBalance > 50_000_000) {
        const { blockhash } =
          await devnetConnection.getLatestBlockhash('confirmed')
        const tx = new Transaction({
          feePayer: broker.publicKey,
          recentBlockhash: blockhash,
        }).add(
          SystemProgram.transfer({
            fromPubkey: broker.publicKey,
            toPubkey: wallet.publicKey,
            lamports: 50_000_000,
          }),
        )
        await sendAndConfirmTransaction(devnetConnection, tx, [broker], {
          commitment: 'confirmed',
        })
        balance = await devnetConnection
          .getBalance(wallet.publicKey)
          .catch(() => 0)
      }
    } catch {}
  }

  if (balance < 5000) {
    const isUser = Boolean(userEmail)
    throw new Error(
      isUser
        ? `Your User Wallet (${wallet.publicKey.toBase58()}) has 0 Devnet SOL for gas. Please click Fund Wallet or paste into faucet.solana.com.`
        : `Agent Broker Wallet (${wallet.publicKey.toBase58()}) has 0 Devnet SOL for gas. Please airdrop test SOL at faucet.solana.com.`,
    )
  }

  const { blockhash } = await devnetConnection.getLatestBlockhash('confirmed')
  const tx = new Transaction({
    feePayer: wallet.publicKey,
    recentBlockhash: blockhash,
  }).add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: wallet.publicKey,
      lamports: 1000,
    }),
  )

  const txHash = await sendAndConfirmTransaction(
    devnetConnection,
    tx,
    [wallet],
    {
      commitment: 'confirmed',
    },
  )

  return {
    txHash,
    feePct: feePct.toFixed(2),
    feeUsd,
    slippagePct,
    network: 'devnet',
    explorerUrl: `https://explorer.solana.com/tx/${txHash}?cluster=devnet`,
  }
}

export function calculateTradeQuote(
  token: Token,
  amountUsd: number,
): SwapResult {
  const feePct = '0.10'
  const feeUsd = ((amountUsd * parseFloat(feePct)) / 100).toFixed(4)
  const slippagePct = '0.15'
  return {
    txHash: '',
    feePct,
    feeUsd,
    slippagePct,
    network: 'devnet',
    explorerUrl: '',
  }
}
