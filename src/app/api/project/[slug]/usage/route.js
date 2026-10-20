import { scanProjectUsage, ApiError } from '@server/lib/api.mjs'
import { handle } from '../../../_lib/respond'

export const dynamic = 'force-dynamic'

const encoder = new TextEncoder()
const yieldEventLoop = () => new Promise((resolve) => setImmediate(resolve))

/**
 * GET /api/project/:slug/usage           → JSON payload when the scan finishes
 * GET /api/project/:slug/usage?stream=1  → Server-Sent Events: progress…, then `done`
 */
export async function GET(request, { params }) {
  const { slug: raw } = await params
  const slug = decodeURIComponent(raw)
  const stream = request.nextUrl.searchParams.get('stream') === '1'

  if (!stream) return handle(() => scanProjectUsage(slug))

  const body = new ReadableStream({
    async start(controller) {
      let closed = false
      const send = async (payload) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        } catch {
          closed = true // client went away
          return
        }
        // Working (in-chat) progress is high-volume — skip yield so scan stays fast.
        if (!payload.working) await yieldEventLoop()
      }
      request.signal?.addEventListener('abort', () => {
        closed = true
      })

      controller.enqueue(encoder.encode(': connected\n\n'))
      try {
        const payload = await scanProjectUsage(slug, { onProgress: send })
        await send({ event: 'done', ...payload })
      } catch (err) {
        const message = err instanceof ApiError ? err.message : String(err?.message || err)
        await send({ event: 'done', error: message })
      } finally {
        if (!closed) {
          try {
            controller.close()
          } catch {
            /* already closed */
          }
        }
      }
    },
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
