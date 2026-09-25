import {
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import crypto from 'crypto'
import bs58 from 'bs58'
import { devnetConnection, getAgentWallet } from './devnet'
import { redis } from '@/lib/db/redis'

export type UserWalletInfo = {
  email: string
  publicKey: string
  balanceSol: number
  isFunded: boolean
  privateKeyBase58?: string
}

export async function getOrCreateUserKeypair(email: string): Promise<Keypair> {
  const normalized = email.toLowerCase().trim()

  if (redis) {
    try {
      const stored = await redis.hget<string>(
        'preflight:user_wallets',
        normalized,
      )
      if (stored) {
        const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored
        if (parsed?.secretKey) {
          const decode =
            (bs58 as unknown as { decode: (s: string) => Uint8Array }).decode ||
            bs58
          const secret = decode(parsed.secretKey)
          return Keypair.fromSecretKey(secret)
        }
      }
    } catch {}
  }

  const seed = crypto
    .createHash('sha256')
    .update(`preflight_user_wallet_${normalized}_seed_v1`)
    .digest()
  const keypair = Keypair.fromSeed(seed)

  const encode =
    (bs58 as unknown as { encode: (s: Uint8Array) => string }).encode ||
    bs58.encode
  const secretKeyStr = encode(keypair.secretKey)

  if (redis) {
    try {
      await redis.hset('preflight:user_wallets', {
        [normalized]: JSON.stringify({
          email: normalized,
          publicKey: keypair.publicKey.toBase58(),
          secretKey: secretKeyStr,
          createdAt: new Date().toISOString(),
        }),
      })
    } catch {}
  }

  return keypair
}

export async function getUserWalletInfo(
  email: string,
  revealPrivateKey: boolean = false,
): Promise<UserWalletInfo> {
  const normalized = email.toLowerCase().trim()
  const keypair = await getOrCreateUserKeypair(normalized)
  const pubkeyStr = keypair.publicKey.toBase58()

  let balanceSol = 0
  try {
    const lamports = await devnetConnection.getBalance(keypair.publicKey)
    balanceSol = lamports / LAMPORTS_PER_SOL
  } catch {
    balanceSol = 0
  }

  const encode =
    (bs58 as unknown as { encode: (s: Uint8Array) => string }).encode ||
    bs58.encode

  return {
    email: normalized,
    publicKey: pubkeyStr,
    balanceSol,
    isFunded: balanceSol > 0.001,
    privateKeyBase58: revealPrivateKey ? encode(keypair.secretKey) : undefined,
  }
}

export async function airdropUserWallet(
  email: string,
): Promise<{ success: boolean; message: string; balanceSol: number }> {
  const normalized = email.toLowerCase().trim()
  const keypair = await getOrCreateUserKeypair(normalized)

  try {
    const sig = await devnetConnection.requestAirdrop(
      keypair.publicKey,
      1 * LAMPORTS_PER_SOL,
    )
    const latest = await devnetConnection.getLatestBlockhash('confirmed')
    await devnetConnection.confirmTransaction({
      signature: sig,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    })

    const lamports = await devnetConnection.getBalance(keypair.publicKey)
    const balanceSol = lamports / LAMPORTS_PER_SOL

    return {
      success: true,
      message: `Airdropped 1 SOL to ${keypair.publicKey.toBase58().slice(0, 4)}...${keypair.publicKey.toBase58().slice(-4)}`,
      balanceSol,
    }
  } catch {
    try {
      const broker = getAgentWallet()
      const brokerBalance = await devnetConnection.getBalance(broker.publicKey)

      if (brokerBalance > 50_000_000) {
        const { blockhash } =
          await devnetConnection.getLatestBlockhash('confirmed')
        const tx = new Transaction({
          feePayer: broker.publicKey,
          recentBlockhash: blockhash,
        }).add(
          SystemProgram.transfer({
            fromPubkey: broker.publicKey,
            toPubkey: keypair.publicKey,
            lamports: 50_000_000,
          }),
        )

        await sendAndConfirmTransaction(devnetConnection, tx, [broker], {
          commitment: 'confirmed',
        })

        const lamports = await devnetConnection.getBalance(keypair.publicKey)
        return {
          success: true,
          message: `Sponsored 0.05 Devnet SOL to ${keypair.publicKey.toBase58().slice(0, 4)}...${keypair.publicKey.toBase58().slice(-4)} from Preflight Master Faucet`,
          balanceSol: lamports / LAMPORTS_PER_SOL,
        }
      }
    } catch {}

    const lamports = await devnetConnection
      .getBalance(keypair.publicKey)
      .catch(() => 0)
    return {
      success: false,
      message:
        'Devnet rate limit reached. Please paste your address into faucet.solana.com',
      balanceSol: lamports / LAMPORTS_PER_SOL,
    }
  }
}
