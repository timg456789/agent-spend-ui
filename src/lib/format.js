export function fmtBytes(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' KB'
  return (n || 0) + ' B'
}

const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
})

function toEpochMs(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Date.parse(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

/** Local date/time with time zone (e.g. Oct 19, 2026, 9:35 PM EDT). */
export function fmtDate(value) {
  const ms = toEpochMs(value)
  if (ms == null) return '—'
  return dateTimeFmt.format(new Date(ms))
}

const dateOnlyFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

/** pricing.json `lastUpdated` — calendar date (YYYY-MM-DD) or full instant. */
export function fmtLastUpdated(value) {
  if (value == null || value === '') return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return dateOnlyFmt.format(new Date(y, m - 1, d))
  }
  return fmtDate(value)
}

export function fmtInt(n) {
  return Number(n || 0).toLocaleString()
}

/** Sub-cent: show the actual fraction (no $0.00 squash). Otherwise nearest cent. */
export function fmtUsd(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '$0.00'
  const sign = x < 0 ? '-' : ''
  const ax = Math.abs(x)
  if (ax === 0) return '$0.00'
  if (ax < 0.01) {
    let s = ax.toFixed(8).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
    if (s === '0') s = ax.toExponential(2)
    return sign + '$' + s
  }
  return sign + '$' + (Math.round(ax * 100) / 100).toFixed(2)
}

export function maxUsd(rows, field = 'costUsd') {
  return Math.max(0.01, ...(rows || []).map((r) => r[field] ?? r.usd ?? 0))
}
