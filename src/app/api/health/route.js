import { json } from '../_lib/respond'

export const dynamic = 'force-dynamic'

export function GET() {
  return json({ ok: true, api: 'agent-spend', schema: 'agentChats-bubbles' })
}
