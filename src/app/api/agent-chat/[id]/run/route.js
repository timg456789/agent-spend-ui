import { inspectAgentChatRun } from '@server/lib/api.mjs'
import { handle } from '../../../_lib/respond'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const { id } = await params
  const runId = request.nextUrl.searchParams.get('runId') || null
  return handle(() => inspectAgentChatRun(decodeURIComponent(id), runId))
}
