'use client'

import { fmtInt, fmtUsd, maxUsd } from '@/lib/format'

function tokenTotals(row) {
  if (row.inputTokens != null || row.outputTokens != null) {
    return { input: row.inputTokens || 0, output: row.outputTokens || 0 }
  }
  let input = 0
  let output = 0
  for (const c of row.agentChats || []) {
    input += c.inputTokens || 0
    output += c.outputTokens || 0
  }
  return { input, output }
}

/**
 * Horizontal $ bars. `rows` need `{ label|model, [field] }` and optionally `key`.
 */
export default function BarRows({ rows, field = 'usd', max, alt = false, onSelect, selectedKey, showTokens = false }) {
  const top = max ?? maxUsd(rows, field)
  const chartCls = ['chart', showTokens && 'chart-with-tokens', showTokens && 'chart-token-cols'].filter(Boolean).join(' ')
  return (
    <div className={chartCls}>
      {showTokens && (
        <div className="chart-row chart-head" aria-hidden="true">
          <span className="chart-label" />
          <span className="bar-track" />
          <span className="chart-amt chart-col-usd">Spend</span>
          <span className="chart-tok chart-col-in">Tokens in</span>
          <span className="chart-tok chart-col-out">Tokens out</span>
        </div>
      )}
      {rows.map((r, i) => {
        const amt = r[field] ?? r.costUsd ?? 0
        const pct = Math.min(100, (amt / top) * 100)
        const label = r.label || r.model
        const clickable = !!onSelect
        const cls = ['chart-row', clickable && 'clickable', selectedKey && r.key === selectedKey && 'selected'].filter(Boolean).join(' ')
        const tok = showTokens ? tokenTotals(r) : null
        return (
          <div key={r.key ?? label ?? i} className={cls} onClick={clickable ? () => onSelect(r) : undefined}>
            <span className="chart-label" title={label}>
              {label}
            </span>
            <div className="bar-track">
              <div className={'bar-fill' + (alt ? ' alt' : '')} style={{ width: pct + '%' }} />
            </div>
            <span className="chart-amt chart-col-usd">{fmtUsd(amt)}</span>
            {showTokens && (
              <>
                <span className="chart-tok chart-col-in">{fmtInt(tok.input)}</span>
                <span className="chart-tok chart-col-out">{fmtInt(tok.output)}</span>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
