export const PREFLIGHT_AGENT_EMAIL =
  process.env.AGENTMAIL_INBOX ||
  process.env.NEXT_PUBLIC_AGENT_EMAIL ||
  'use-preflight@agentmail.to'

export const PREFLIGHT_AGENT_NAME = 'Preflight Broker'

export const PREFLIGHT_DEFAULT_SECTORS = [
  'AI',
  'Defense',
  'Space',
  'Robotics',
  'Prediction Markets',
]
