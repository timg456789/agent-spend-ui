'use client'

import { SiteHeader } from '@/components/Layout'

export function AppShell({ children }) {
  return (
    <>
      <div className="site-top">
        <div className="site-top-inner">
          <SiteHeader />
        </div>
      </div>
      <div className="site-shell">{children}</div>
    </>
  )
}
