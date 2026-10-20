import { listProjects } from '@server/lib/api.mjs'
import { handle } from '../_lib/respond'

export const dynamic = 'force-dynamic'

export function GET(request) {
  const force = request.nextUrl.searchParams.get('refresh') === '1'
  return handle(() => listProjects(force))
}
