'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { fmtInt, fmtUsd } from '@/lib/format'
import { hrefProject } from '@/lib/routes'
import { EstDocLink } from '@/components/Layout'

export default function ChatPage({ slug, chatId }) {
  const [state, setState] = useState({ loading: true, error: null, tok: null, prompts: null, proj: null })

  useEffect(() => {
    let cancelled = false
    Promise.all([api.chatTokens(chatId, slug), api.chatPrompts(chatId, slug), api.project(slug)])
      .then(([tok, prompts, proj]) => {
        if (cancelled) return
        if (tok.error || prompts.error) setState({ loading: false, error: tok.error || prompts.error, tok, prompts, proj })
        else setState({ loading: false, error: null, tok, prompts, proj })
      })
      .catch((e) => !cancelled && setState({ loading: false, error: String(e?.message || e) }))
    return () => {
      cancelled = true
    }
  }, [slug, chatId])

  const { loading, error, tok, prompts, proj } = state
  const projectName = proj?.displayName || proj?.label || slug
  const chatName = tok?.name || prompts?.name || proj?.agentChatNames?.[chatId] || null

  useEffect(() => {
    if (chatName) document.title = `${chatName} · Agent Spend`
  }, [chatName])

  return (
    <>
      <div className="toolbar">
        <a className="btn-back" href={hrefProject(slug)}>
          ← {projectName}
        </a>
      </div>
      {loading && <p className="meta">Loading agent chat…</p>}
      {!loading && error && <p className="meta">Could not load this agent chat ({error}).</p>}
      {!loading && !error && (
        <>
          <h1 className="project-page-title">{chatName || 'Untitled chat'}</h1>
          <p className="usage-meta">Whole conversation · {fmtInt(tok.runCount)} steps</p>
          <div className="statgrid statgrid-cols-4">
            <div>
              Input tokens<strong>{fmtInt(tok.tokens?.input)}</strong>
            </div>
            <div>
              Output tokens<strong>{fmtInt(tok.tokens?.output)}</strong>
            </div>
            <div>
              <EstDocLink />
              <strong>{fmtUsd(tok.cost?.usd ?? 0)}</strong>
            </div>
            <div>
              User prompts<strong>{fmtInt(prompts.promptCount)}</strong>
            </div>
          </div>
          {tok.cost?.byModel?.length > 1 && (
            <div className="panel">
              <h3>Models in this chat</h3>
              <table>
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Tokens in</th>
                    <th>Tokens out</th>
                    <th>
                      <EstDocLink />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tok.cost.byModel.map((m) => (
                    <tr key={m.model}>
                      <td>
                        <code>{m.model}</code>
                      </td>
                      <td>{fmtInt(m.inputTokens)}</td>
                      <td>{fmtInt(m.outputTokens)}</td>
                      <td>{m.priced ? fmtUsd(m.usd) : <span className="pill-missing">No price</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="panel">
            <h3>User prompts</h3>
            <p className="usage-meta">
              What you sent in this agent tab. Output stays collapsed. Expand a prompt to see the reply, thinking, and tool payloads behind
              its output tokens — the same stored text the estimate counts when Cursor did not save a token count.
            </p>
            {prompts.prompts?.length ? (
              <ol className="prompt-list">
                {prompts.prompts.map((p) => (
                  <PromptItem key={p.n} prompt={p} slug={slug} chatId={chatId} />
                ))}
              </ol>
            ) : (
              <p className="usage-meta">No user prompts found in the transcript.</p>
            )}
          </div>
        </>
      )}
    </>
  )
}

function PromptItem({ prompt, slug, chatId }) {
  const hasOutput = prompt.outputTokens != null
  const [sort, setSort] = useState({ key: 'step', dir: 'asc' })
  const ordered = (prompt.steps || [])
    .map((step, index) => ({ step, n: index + 1 }))
    .sort((a, b) => {
      const primary = sort.key === 'output' ? a.step.outputTokens - b.step.outputTokens : a.n - b.n
      const signed = sort.dir === 'asc' ? primary : -primary
      return signed || a.n - b.n
    })

  function sortBy(key) {
    setSort((current) => {
      if (current.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
      return { key, dir: key === 'output' ? 'desc' : 'asc' }
    })
  }

  return (
    <li>
      <div className="prompt-head">
        <div className="prompt-n">
          Prompt {prompt.n}
          {prompt.model ? <code className="prompt-model">{prompt.model}</code> : null}
        </div>
        {hasOutput && (
          <div className="prompt-head-tokens">
            {fmtInt(prompt.inputTokens)} prompt tokens · {fmtInt(prompt.outputTokens)} output tokens
          </div>
        )}
      </div>
      <p className="prompt-text">{prompt.text}</p>
      {hasOutput && prompt.stepCount > 0 ? (
        <details className="prompt-output">
          <summary>
            {fmtInt(prompt.outputTokens)} output tokens · {fmtInt(prompt.stepCount)} steps
          </summary>
          <div className="prompt-steps">
            <table className="prompt-step-table">
              <thead>
                <tr>
                  <th className="col-expand" aria-label="Expand"></th>
                  <th className="col-step" aria-sort={sort.key === 'step' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className={'prompt-step-sort' + (sort.key === 'step' ? ' is-sorted' : '')} onClick={() => sortBy('step')}>
                      Step{sort.key === 'step' ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                  </th>
                  <th className="col-desc">Description</th>
                  <th className="col-tokens" aria-sort={sort.key === 'output' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className={'prompt-step-sort num' + (sort.key === 'output' ? ' is-sorted' : '')} onClick={() => sortBy('output')}>
                      Output tokens{sort.key === 'output' ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ordered.map(({ step, n: stepNumber }) => (
                  <PromptStep key={step.id} step={step} index={stepNumber} slug={slug} chatId={chatId} n={prompt.n} />
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : (
        hasOutput && <p className="usage-meta prompt-output-empty">No output stored before the next prompt.</p>
      )}
    </li>
  )
}

function ExpandIcon({ open }) {
  return (
    <svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true">
      <path
        d={open ? 'M3.25 6.25 8 11l4.75-4.75' : 'M6.25 3.25 11 8l-4.75 4.75'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PromptStep({ step, index, slug, chatId, n }) {
  const [open, setOpen] = useState(false)
  const [pieces, setPieces] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const started = useRef(false)

  function toggle() {
    const next = !open
    setOpen(next)
    if (!next || started.current) return
    started.current = true
    setLoading(true)
    setError(null)
    api
      .chatPromptStep(chatId, slug, n, step.id)
      .then((data) => {
        if (data.error) {
          started.current = false
          setError(data.error)
        } else setPieces(data.step?.pieces || [])
      })
      .catch((err) => {
        started.current = false
        setError(String(err?.message || err))
      })
      .finally(() => setLoading(false))
  }

  const description = step.kind === 'tool' ? <code>{step.label}</code> : step.label

  return (
    <>
      <tr className={'prompt-step-main' + (open ? ' is-open' : '')} onClick={toggle}>
        <td className="col-expand">
          <button
            type="button"
            className="prompt-step-toggle"
            aria-expanded={open}
            aria-label={(open ? 'Collapse' : 'Expand') + ' step ' + index}
            onClick={(event) => {
              event.stopPropagation()
              toggle()
            }}
          >
            <ExpandIcon open={open} />
          </button>
        </td>
        <td className="col-step">{index}</td>
        <td className="col-desc">{description}</td>
        <td className="col-tokens">
          {fmtInt(step.outputTokens)}
          {step.source === 'cursor' ? <span className="prompt-step-cursor"> Cursor count</span> : null}
        </td>
      </tr>
      {open && (
        <tr className="prompt-step-detail">
          <td colSpan={4}>
            {loading && <p className="usage-meta">Loading stored output…</p>}
            {error && <p className="usage-meta">Could not load this step ({error}).</p>}
            {pieces && pieces.length === 0 && <p className="usage-meta">No text stored on this step.</p>}
            {pieces?.map((piece, pieceIndex) => (
              <div className="prompt-piece" key={piece.label + pieceIndex}>
                <div className="prompt-piece-label">
                  {piece.label} · {fmtInt(piece.chars)} characters
                </div>
                {piece.countedTwice && (
                  <p className="prompt-piece-note">
                    Cursor stored these arguments twice. Both copies are included in this step&apos;s token count.
                  </p>
                )}
                {step.source === 'cursor' && pieceIndex === 0 && (
                  <p className="prompt-piece-note">Token count is Cursor&apos;s stored tokenCount, not the length of this text.</p>
                )}
                {piece.truncated && (
                  <p className="prompt-piece-note">Showing the first 100,000 characters. The token count uses the full stored text.</p>
                )}
                <pre>{piece.text}</pre>
              </div>
            ))}
          </td>
        </tr>
      )}
    </>
  )
}
