import { getAgentChatPrompts } from '@server/lib/api.mjs'
import { handle } from '../../../_lib/respond'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const { id } = await params
  const project = request.nextUrl.searchParams.get('project') || null
  return handle(() => getAgentChatPrompts(decodeURIComponent(id), project))
}
