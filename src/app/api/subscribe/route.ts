import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/store'
import { handleSubscribe } from '@/lib/email/handler'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, sectors, maxUsd, name } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email is required' },
        { status: 400 },
      )
    }

    const sub = db.addSubscriber(email, {
      sectors: Array.isArray(sectors) ? sectors : ['AI', 'Space'],
      maxUsd: Number(maxUsd) || 500,
      name: name || null,
      notifyOnNew: true,
      notifyOnMove: true,
    })

    handleSubscribe(
      email,
      `I am interested in ${(sub.sectors || []).join(', ')}. Max $${sub.maxUsd} per allocation.`,
      'New Subscription from Web App',
    ).catch(() => {})

    return NextResponse.json({
      success: true,
      subscriber: sub,
      message: `Subscribed ${email} to Preflight dealflow`,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
