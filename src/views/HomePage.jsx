'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtDate, fmtInt } from '@/lib/format'
import { hrefProject } from '@/lib/routes'
import { SITE_TAGLINE } from '@/components/Layout'

export default function HomePage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async (refresh) => {
    setLoading(true)
    setError(null)
    try {
      const d = await api.projects(refresh)
      if (d.error) setError(d.error)
      else setData(d)
    } catch (e) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(false)
  }, [])

  const projects = data?.projects || []
  const totalChats = projects.reduce((a, p) => a + (p.agentChats || 0), 0)

  return (
    <>
      <section className="hero" aria-labelledby="home-hero-title">
        <div className="hero-headline">
          <h1 id="home-hero-title">See Detailed Agent Usage Costs</h1>
          <p className="hero-tagline">{SITE_TAGLINE}</p>
        </div>
        <p className="hero-lead">
          Pick a workspace, scan estimated spend from local agent data, and drill down by month, day, and agent chat.
        </p>
      </section>
      <div className="toolbar-home">
        <h2 className="section-title">Projects</h2>
        <button type="button" className="btn-ghost" onClick={() => load(true)} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {error && <p className="lead">Could not load projects: {error}</p>}
      {!error && !loading && projects.length === 0 && (
        <p className="lead">
          No Cursor agent transcripts found under <code>~/.cursor/projects</code>. Run an Agent chat in Cursor, then refresh.
        </p>
      )}
      {data && (
        <div className="summary-strip">
          <div>
            <span>Projects</span>
            <strong>{data.projectCount}</strong>
          </div>
          <div>
            <span>Agent chats</span>
            <strong>{fmtInt(totalChats)}</strong>
          </div>
        </div>
      )}
      <div className="project-grid">
        {projects.map((p) => (
          <a key={p.slug} className="project-card" href={hrefProject(p.slug)}>
            <h3>{p.displayName || p.label || p.slug}</h3>
            <dl className="project-stats">
              <div className="stat-wide">
                <dt>Location</dt>
                {p.folderPath ? <dd className="path-value">{p.folderPath}</dd> : <dd className="muted">Path not resolved</dd>}
              </div>
              <div>
                <dt>Agent chats</dt>
                <dd>{p.agentChats || 0}</dd>
              </div>
              <div className="stat-wide">
                <dt>Last activity</dt>
                <dd>{fmtDate(p.newestMtimeMs)}</dd>
              </div>
            </dl>
            <span className="project-cta">Open usage →</span>
          </a>
        ))}
      </div>
    </>
  )
}
