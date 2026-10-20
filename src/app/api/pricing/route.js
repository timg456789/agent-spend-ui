import { loadPricingPayload } from '@server/lib/pricing.mjs'
import { handle } from '../_lib/respond'

export const dynamic = 'force-dynamic'

export function GET() {
  return handle(() => loadPricingPayload())
}
