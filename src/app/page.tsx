import { fetchAllTokens } from '@/lib/tokens/aggregator'
import { db } from '@/lib/db/store'
import { PreflightView } from '@/components/preflight-view'

export default async function Page() {
  const tokens = await fetchAllTokens()
  db.setSnapshot(tokens)
  const activity = db.getActivityLog()

  return (
    <PreflightView
      initialTokens={tokens}
      initialPortfolio={{}}
      initialActivity={activity}
    />
  )
}
