import { ApiError } from '@server/lib/api.mjs'

export const noStore = { 'Cache-Control': 'no-store' }

export function json(body, status = 200) {
  return Response.json(body, { status, headers: noStore })
}

/** Run a handler; translate ApiError / unexpected errors into JSON responses. */
export async function handle(fn) {
  try {
    return json(await fn())
  } catch (err) {
    if (err instanceof ApiError) return json({ error: err.message, ...err.extra }, err.status)
    if (typeof err?.status === 'number' && err?.message) {
      return json({ error: err.message }, err.status)
    }
    return json({ error: String(err?.message || err) }, 500)
  }
}
