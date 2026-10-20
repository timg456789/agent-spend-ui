'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, readUsageSummaryCache, writeUsageSummaryCache, usageSummaryFromScan } from '@/lib/api'
import { fmtDate, fmtInt, fmtUsd, maxUsd } from '@/lib/format'
import { hrefHome, openChatPage } from '@/lib/routes'
import { EstDocLink } from '@/components/Layout'
import BarRows from '@/components/BarRows'
import { ChatNameCell } from '@/components/ChatLink'

/* ---------- scan status text ---------- */

function formatScanStatus(msg) {
  const n = msg.agentChatsDone || 0
  const total = msg.totalAgentChats || '?'
  const id = msg.composerId ? msg.composerId.slice(0, 8) + '…' : ''
  if (msg.working) {
    const stepTotal = msg.composerStepTotal || 0
    const stepPart = stepTotal > 0 ? ` · ${fmtInt(msg.composerStepDone)} / ${fmtInt(stepTotal)} steps` : ' · reading…'
    return `Scanning agent chats · ${n} / ${total}${stepPart}${id ? ' · ' + id : ''}`
  }
  return `Scanning agent chats · ${n} / ${total} · ${fmtInt(msg.runningInput)} tokens in · ${fmtInt(msg.runningOutput)} tokens out${id ? ' · ' + id : ''}`
}

function runningSummaryFromProgress(msg) {
  return {
    input: msg.runningInput || 0,
    output: msg.runningOutput || 0,
    agentChatsScanned: msg.agentChatsDone || 0,
    costUsd: msg.runningCostUsd ?? 0,
    inputCostUsd: msg.runningInputCostUsd ?? 0,
    outputCostUsd: msg.runningOutputCostUsd ?? 0,
    missingPricingModels: 0,
    savedAt: null,
  }
}

/* ---------- SSE scan hook ---------- */

function useUsageScan(slug) {
  const [scan, setScan] = useState({ scanning: false, statusLine: null, startedAt: 0, running: null, data: null, error: null })
  const [now, setNow] = useState(Date.now())
  const esRef = useRef(null)

  useEffect(() => {
    if (!scan.scanning) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [scan.scanning])

  useEffect(() => () => esRef.current?.close(), [])

  const start = useCallback(() => {
    esRef.current?.close()
    const es = new EventSource(api.usageStreamUrl(slug))
    esRef.current = es
    setNow(Date.now())
    setScan({ scanning: true, statusLine: 'Starting usage scan…', startedAt: Date.now(), running: null, data: null, error: null })

    es.onmessage = (ev) => {
      let msg
      try {
        msg = JSON.parse(ev.data)
      } catch {
        return
      }
      if (msg.event === 'progress') {
        if (msg.phase === 'agentChat') {
          setScan((s) => ({ ...s, statusLine: formatScanStatus(msg), running: runningSummaryFromProgress(msg) }))
        } else if (msg.message) {
          setScan((s) => ({ ...s, statusLine: msg.message }))
        }
        return
      }
      if (msg.event === 'done') {
        es.close()
        esRef.current = null
        if (msg.error) {
          setScan((s) => ({ ...s, scanning: false, statusLine: null, error: msg.error }))
          return
        }
        writeUsageSummaryCache(slug, usageSummaryFromScan(msg))
        setScan((s) => ({ ...s, scanning: false, statusLine: null, data: msg }))
      }
    }
    es.onerror = () => {
      es.close()
      esRef.current = null
      setScan((s) => ({
        ...s,
        scanning: false,
        statusLine: null,
        error: 'Stream failed (server stopped or connection lost). Click Refresh to retry.',
      }))
    }
  }, [slug])

  const elapsedSec = scan.scanning && scan.startedAt ? Math.max(0, Math.round((now - scan.startedAt) / 1000)) : 0
  return { ...scan, elapsedSec, start }
}

/* ---------- page ---------- */

export default function ProjectPage({ slug }) {
  const [meta, setMeta] = useState(null)
  const [metaError, setMetaError] = useState(null)
  const scan = useUsageScan(slug)
  // Read localStorage only after mount so the server render and the first client render match.
  const [cached, setCached] = useState(null)
  useEffect(() => {
    setCached(readUsageSummaryCache(slug))
  }, [slug, scan.data])

  const loadMeta = useCallback(async () => {
    const d = await api.project(slug)
    if (d.error) {
      setMetaError(d.error)
      return false
    }
    setMeta(d)
    return true
  }, [slug])

  useEffect(() => {
    let cancelled = false
    loadMeta().then((ok) => {
      if (ok && !cancelled) scan.start()
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  useEffect(() => {
    const name = meta?.displayName || meta?.label
    if (name) document.title = `${name} · Agent Spend`
  }, [meta])

  const onRefresh = async () => {
    if (await loadMeta()) scan.start()
  }

  const displayName = meta?.displayName || meta?.label || slug
  const m = meta?.meta || {}

  // What the stat grid shows right now.
  let summary = null
  let kicker = null
  if (scan.scanning) {
    summary = scan.running || cached || { input: 0, output: 0, agentChatsScanned: 0, costUsd: 0 }
    kicker = `${scan.statusLine || 'Scanning…'} · ${scan.elapsedSec}s elapsed`
  } else if (scan.data) {
    summary = usageSummaryFromScan(scan.data)
    kicker = `Usage from scan · ${fmtDate(summary.savedAt)}`
  } else if (cached) {
    summary = cached
    kicker = `Cached usage · ${fmtDate(cached.savedAt)}`
  }

  const nameById = useMemo(
    () => new Map([...Object.entries(meta?.agentChatNames || {}), ...Object.entries(scan.data?.agentChatNames || {})]),
    [meta, scan.data]
  )

  return (
    <>
      <div className="toolbar">
        <a className="btn-back" href={hrefHome}>
          ← Projects
        </a>
        <button type="button" className="btn-primary" onClick={onRefresh} disabled={scan.scanning}>
          {scan.scanning ? 'Scanning…' : 'Refresh'}
        </button>
      </div>
      <h1 className="project-page-title">{metaError ? 'Not found' : displayName}</h1>
      {meta?.folderPath && <p className="project-page-path">{meta.folderPath}</p>}
      {kicker && <p className="usage-stat-kicker">{kicker}</p>}
      {meta && (
        <div className="statgrid statgrid-cols-3">
          <div>
            Agent chats<strong>{meta.agentChatCount ?? '—'}</strong>
          </div>
          <div>
            First seen<strong>{fmtDate(m.oldestMtimeMs)}</strong>
          </div>
          <div>
            Last activity<strong>{fmtDate(m.newestMtimeMs)}</strong>
          </div>
        </div>
      )}
      {summary && <UsageStatGrid summary={summary} />}
      {scan.error && <p className="usage-meta">{scan.error}</p>}
      {scan.data && <UsagePanels key={scan.data.scannedAt} slug={slug} data={scan.data} nameById={nameById} />}
    </>
  )
}

function UsageStatGrid({ summary }) {
  const spend = summary.costUsd ?? (summary.inputCostUsd ?? 0) + (summary.outputCostUsd ?? 0)
  return (
    <div className="statgrid statgrid-cols-3">
      <div>
        Input tokens<strong>{fmtInt(summary.input)}</strong>
      </div>
      <div>
        Output tokens<strong>{fmtInt(summary.output)}</strong>
      </div>
      <div>
        <EstDocLink />
        <strong>{fmtUsd(spend)}</strong>
      </div>
      {summary.missingPricingModels > 0 && (
        <div>
          Missing pricing<strong>{summary.missingPricingModels} models</strong>
        </div>
      )}
    </div>
  )
}

/* ---------- usage panels ---------- */

function bucketTokenTotals(row) {
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

function chatTokenCounts(c) {
  let inputTokens = c.inputTokens ?? c.input
  let outputTokens = c.outputTokens ?? c.output
  if (!(inputTokens || outputTokens) && c.byModel?.length) {
    inputTokens = 0
    outputTokens = 0
    for (const m of c.byModel) {
      inputTokens += m.inputTokens || 0
      outputTokens += m.outputTokens || 0
    }
  }
  return { inputTokens: inputTokens || 0, outputTokens: outputTokens || 0 }
}

function UsagePanels({ slug, data, nameById }) {
  const [selMonth, setSelMonth] = useState(null)
  const [selDay, setSelDay] = useState(null)

  const tl = data.timeline || { months: [], days: [] }
  const months = tl.months || []
  const monthMeta = selMonth ? months.find((x) => x.key === selMonth) : null
  const dayRows = selMonth ? (tl.days || []).filter((d) => d.monthKey === selMonth) : []
  const dayDetail = selDay ? (tl.days || []).find((d) => d.key === selDay) : null
  const chatRollup = data.agentChatRollup || []
  const pricedModels = (data.byModel || []).filter((x) => x.priced !== false && (x.usd || 0) > 0)
  const nameFor = (c) => (c.name || nameById.get(c.composerId || c.id) || '').trim()

  const dayChats = useMemo(() => {
    if (!dayDetail) return []
    const fromIndex = data.dayAgentChats?.[dayDetail.key]
    const rows = (fromIndex?.length ? fromIndex : dayDetail.agentChats) || []
    return rows.map((c) => ({ ...c, composerId: c.composerId || c.id, ...chatTokenCounts(c) }))
  }, [data, dayDetail])

  const daySums = dayChats.reduce(
    (a, c) => ({ usd: a.usd + (c.costUsd || 0), input: a.input + c.inputTokens, output: a.output + c.outputTokens }),
    { usd: 0, input: 0, output: 0 }
  )
  const dayUsd = dayDetail?.costUsd || 0
  const dayMismatch = Math.abs(Math.round(daySums.usd * 100) - Math.round(dayUsd * 100)) > 1

  return (
    <>
      <div className="panel">
        <h3>
          <EstDocLink>Estimated spend</EstDocLink>
        </h3>
        <div className="hero-cost">
          {fmtUsd(data.costUsd)}
          <small>{data.pricingCurrency || 'USD'}</small>
        </div>
      </div>

      <MissingPricingPanel data={data} />

      <div className="panel">
        <h3>Token Usage in Dollars by Model</h3>
        {pricedModels.length ? (
          <BarRows rows={pricedModels} field="usd" />
        ) : (
          <p className="usage-meta">No priced model usage in this scan — add the missing models to server/pricing.json.</p>
        )}
      </div>

      {chatRollup.length > 0 && (
        <div className="panel">
          <h3>Token Usage in Dollars by Chat</h3>
          <p className="usage-meta">Whole conversation totals across all days. Sorted by est. spend.</p>
          <div className="chat-list-scroll">
            <table>
              <thead>
                <tr>
                  <th>Chat</th>
                  <th>Tokens in</th>
                  <th>Tokens out</th>
                  <th>
                    <EstDocLink />
                  </th>
                  <th>Steps</th>
                </tr>
              </thead>
              <tbody>
                {chatRollup.map((r) => (
                  <tr key={r.id} className="chat-row-clickable" onClick={() => openChatPage(slug, r.id)}>
                    <ChatNameCell slug={slug} chatId={r.id} name={nameFor(r)} />
                    <td>{fmtInt(r.input)}</td>
                    <td>{fmtInt(r.output)}</td>
                    <td>{fmtUsd(r.costUsd)}</td>
                    <td>{fmtInt(r.runCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel">
        <h3>By month</h3>
        {months.length ? (
          <div className="month-grid">
            {months.map((mo) => {
              const mt = bucketTokenTotals(mo)
              return (
                <button
                  key={mo.key}
                  type="button"
                  className={'month-card' + (selMonth === mo.key ? ' active' : '')}
                  onClick={() => {
                    setSelMonth(mo.key)
                    setSelDay(null)
                  }}
                >
                  <strong className="month-card-title">{mo.label}</strong>
                  <div className="month-card-stats">
                    <span className="month-card-spend">{fmtUsd(mo.costUsd)}</span>
                    <span className="month-card-meta">{fmtInt(mt.input)} tokens in</span>
                    <span className="month-card-meta">{fmtInt(mt.output)} tokens out</span>
                    <span className="month-card-meta">{mo.agentChatCount} agent chats</span>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <span className="usage-meta">No dated transcripts.</span>
        )}
      </div>

      {selMonth && (
        <div className="panel">
          <div className="crumb">
            <button
              type="button"
              onClick={() => {
                setSelMonth(null)
                setSelDay(null)
              }}
            >
              All months
            </button>{' '}
            · {monthMeta?.label || selMonth}
          </div>
          {monthMeta && (
            <p className="month-period-totals">
              {fmtUsd(monthMeta.costUsd)} · {fmtInt(bucketTokenTotals(monthMeta).input)} tokens in ·{' '}
              {fmtInt(bucketTokenTotals(monthMeta).output)} tokens out
            </p>
          )}
          <h3>By day — click a day</h3>
          {dayRows.length ? (
            <BarRows
              rows={dayRows}
              field="costUsd"
              max={maxUsd(dayRows)}
              alt
              showTokens
              onSelect={(r) => setSelDay(r.key)}
              selectedKey={selDay}
            />
          ) : (
            <p className="usage-meta">No usage dated in this month.</p>
          )}
          {monthMeta?.byModel?.length > 0 && (
            <>
              <h3>Models this month</h3>
              <BarRows rows={monthMeta.byModel} field="usd" showTokens />
            </>
          )}
        </div>
      )}

      {dayDetail && (
        <div className="panel">
          <div className="crumb">
            <button type="button" onClick={() => setSelDay(null)}>
              All days in month
            </button>{' '}
            · {dayDetail.label}
          </div>
          <h3>Agent chats this day</h3>
          <p className="usage-meta">Spend for this calendar day only (from step timestamps). The whole-chat table above is separate.</p>
          <table>
            <thead>
              <tr>
                <th>Chat</th>
                <th>Tokens in</th>
                <th>Tokens out</th>
                <th>
                  <EstDocLink />
                </th>
              </tr>
            </thead>
            <tbody>
              {dayChats.length ? (
                dayChats.map((c) => (
                  <tr key={c.composerId} className="chat-row-clickable" onClick={() => openChatPage(slug, c.composerId)}>
                    <ChatNameCell slug={slug} chatId={c.composerId} name={nameFor(c)} />
                    <td>{fmtInt(c.inputTokens)}</td>
                    <td>{fmtInt(c.outputTokens)}</td>
                    <td>{fmtUsd(c.costUsd)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>None</td>
                </tr>
              )}
            </tbody>
            {dayChats.length > 0 && (
              <tfoot>
                <tr className="table-totals-row">
                  <td>Totals</td>
                  <td>{fmtInt(daySums.input)}</td>
                  <td>{fmtInt(daySums.output)}</td>
                  <td>{fmtUsd(daySums.usd)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          {dayMismatch && (
            <p className="usage-meta">
              Day chart shows {fmtUsd(dayUsd)}; table totals may differ when step timestamps span days.
            </p>
          )}
        </div>
      )}
    </>
  )
}

function MissingPricingPanel({ data }) {
  const rows = data.modelsMissingPricing || (data.byModel || []).filter((x) => x.priced === false && (x.tokenTotal || 0) > 0)
  if (!rows.length) return null
  const total = rows.reduce((a, x) => a + (x.tokenTotal || 0), 0)
  return (
    <div className="panel pricing-gap-panel" role="alert">
      <h3>Models missing from pricing.json</h3>
      <p>
        These model ids appear in your chats but have <strong>no $/1M rate</strong> in <a href="/pricing">pricing.json</a>. Their tokens are
        counted but add <strong>$0</strong> to estimated spend ({fmtInt(total)} tokens in this scan).
      </p>
      <table>
        <thead>
          <tr>
            <th>Model id</th>
            <th>Input tokens</th>
            <th>Output tokens</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.model}>
              <td>
                <span className="pill-missing">No price</span> <code>{x.model || 'unknown'}</code>
              </td>
              <td>{fmtInt(x.inputTokens)}</td>
              <td>{fmtInt(x.outputTokens)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}