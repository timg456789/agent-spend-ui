import { getAgentChatPromptStep } from '@server/lib/api.mjs'
import { handle } from '../../../_lib/respond'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const { id } = await params
  const project = request.nextUrl.searchParams.get('project') || null
  const n = Number(request.nextUrl.searchParams.get('n'))
  const step = request.nextUrl.searchParams.get('step')
  return handle(() => getAgentChatPromptStep(decodeURIComponent(id), project, n, step))
}
