'use client'

import { useEffect, useState } from 'react'
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
            <p className="usage-meta">What you sent in this agent tab (from the transcript). Assistant and tool steps are not shown.</p>
            {prompts.prompts?.length ? (
              <ol className="prompt-list">
                {prompts.prompts.map((p) => (
                  <li key={p.n}>
                    <div className="prompt-n">Prompt {p.n}</div>
                    <p className="prompt-text">{p.text}</p>
                  </li>
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
