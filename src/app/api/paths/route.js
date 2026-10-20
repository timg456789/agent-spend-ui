import { cursorPaths } from '@server/lib/api.mjs'
import { handle } from '../_lib/respond'

export const dynamic = 'force-dynamic'

export function GET() {
  return handle(() => cursorPaths())
}
