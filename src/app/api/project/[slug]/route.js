import { getProjectDetail } from '@server/lib/api.mjs'
import { handle } from '../../_lib/respond'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const { slug } = await params
  const q = request.nextUrl.searchParams
  const listAgentChats = q.get('agentChats') !== '0'
  const attachModels = listAgentChats && q.get('models') !== '0'
  return handle(() => getProjectDetail(decodeURIComponent(slug), { listAgentChats, attachModels }))
}
