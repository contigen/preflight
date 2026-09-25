import { NextResponse } from 'next/server'
import { syncInboundInbox } from '@/lib/email/inbox-sync'

export const dynamic = 'force-dynamic'

export async function GET() {
  const summary = await syncInboundInbox()
  return NextResponse.json({ success: true, summary })
}

export async function POST() {
  const summary = await syncInboundInbox()
  return NextResponse.json({ success: true, summary })
}
