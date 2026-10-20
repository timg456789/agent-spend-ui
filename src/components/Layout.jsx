'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { hrefHome, hrefDocs, hrefPricing } from '@/lib/routes'

export const SITE_TAGLINE = 'Track every dollar · Run your AI agents with confidence'

/** Grid tile + four allocation bars. */
export function BrandMark({ size = 56 }) {
  const bw = 8.2
  const gap = 2.15
  const bottom = 50.6
  const heights = [24, 34, 18, 28]
  const total = heights.length * bw + (heights.length - 1) * gap
  const start = (60 - total) / 2
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 60 60" role="img" aria-label="Agent Spend">
      <rect x="1.7" y="1.7" width="56.6" height="56.6" rx="3.5" fill="#fff" stroke="#202C4E" strokeWidth="3.4" />
      <path
        fill="none"
        stroke="#202C4E"
        strokeWidth="1.05"
        opacity="0.18"
        d="M12.27 3.4 V56.6 M21.13 3.4 V56.6 M30 3.4 V56.6 M38.87 3.4 V56.6 M47.73 3.4 V56.6 M3.4 12.27 H56.6 M3.4 21.13 H56.6 M3.4 30 H56.6 M3.4 38.87 H56.6 M3.4 47.73 H56.6"
      />
      {heights.map((h, i) => (
        <rect key={i} x={(start + i * (bw + gap)).toFixed(2)} y={(bottom - h).toFixed(2)} width={bw} height={h} rx="1.5" fill="#047857" />
      ))}
    </svg>
  )
}

const NAV = [
  ['home', hrefHome, 'Projects'],
  ['docs', hrefDocs(), 'Documentation'],
  ['pricing', hrefPricing, 'Pricing'],
]

function activeKey(pathname) {
  if (pathname.startsWith('/docs')) return 'docs'
  if (pathname.startsWith('/pricing')) return 'pricing'
  return 'home' // "/" and every /project/... page
}

function SiteNav({ navClassName = 'site-nav' }) {
  const key = activeKey(usePathname() || '/')
  return (
    <nav className={navClassName} aria-label="Pages">
      {NAV.map(([id, href, label]) => (
        <Link key={id} href={href} className={id === key ? 'active' : undefined} aria-current={id === key ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  )
}

function SiteBrand({ className = 'site-brand' }) {
  return (
    <Link className={className} href={hrefHome} aria-label="Agent Spend home">
      <BrandMark />
      <div className="wordmark" aria-hidden="true">
        <span className="wordmark-agent">Agent</span>
        <span className="wordmark-spend">Spend</span>
      </div>
    </Link>
  )
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <SiteBrand />
      <SiteNav />
    </header>
  )
}

export function EstDocLink({ children = 'Est. spend' }) {
  return (
    <Link className="est-doc-link" href={hrefDocs('estimates')} title="How token and spend estimates work">
      {children}
    </Link>
  )
}
