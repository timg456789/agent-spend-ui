'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { fmtLastUpdated, fmtUsd } from '@/lib/format'

export default function PricingPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.pricing()
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(String(e?.message || e)))
  }, [])

  const models = Object.entries(data?.models || {}).sort((a, b) => a[0].localeCompare(b[0]))
  const lastUpdated = data?.lastUpdated ?? data?.updatedAt

  return (
    <>
      <h1 className="page-title">Pricing</h1>
      {error && <p className="lead">Could not load pricing.json from the server: {error}</p>}
      {!data && !error && <p className="lead">Loading rates…</p>}
      {data && (
        <>
          {lastUpdated && (
            <p className="pricing-last-updated">
              Last updated <strong>{fmtLastUpdated(lastUpdated)}</strong>
            </p>
          )}
          <div className="panel" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Model id</th>
                  <th>Input / 1M</th>
                  <th>Output / 1M</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {models.map(([id, row]) => (
                  <tr key={id}>
                    <td>
                      <code>{id}</code>
                    </td>
                    <td>{fmtUsd(row.input)}</td>
                    <td>{fmtUsd(row.output)}</td>
                    <td>{row.note || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
