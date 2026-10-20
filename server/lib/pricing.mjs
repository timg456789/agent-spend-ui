/**
 * Agent Spend: choose a pricing table, then inject it into agent-spend-cursor-data-access scan APIs.
 * Default file lives in the dependency; this module never runs inside the library.
 */
import fs from 'node:fs'
import path from 'node:path'

export {
  resolveModelPricing,
  estimateUsd,
  applyPricingToByModel,
} from 'agent-spend-cursor-data-access/pricing'

import { defaultPricingPath, loadDefaultPricingTable } from 'agent-spend-cursor-data-access'

export { defaultPricingPath, loadDefaultPricingTable }

const localPricingPath = path.join(process.cwd(), 'server', 'pricing.json')

/** @typedef {'override' | 'local' | 'default'} PricingSource */

/**
 * Which pricing.json supplies rates (always resolves to a table for scans).
 * 1. AGENT_SPEND_PRICING
 * 2. server/pricing.json in the app cwd, if present
 * 3. package default pricing.json
 */
export function resolvePricingFile() {
  const override = process.env.AGENT_SPEND_PRICING?.trim()
  if (override) {
    return { path: path.resolve(override), source: /** @type {PricingSource} */ ('override') }
  }

  try {
    fs.accessSync(localPricingPath, fs.constants.R_OK)
    return { path: localPricingPath, source: 'local' }
  } catch {
    return { path: defaultPricingPath, source: 'default' }
  }
}

let cache = { key: '', table: null }

function cacheKey(resolved) {
  if (resolved.source === 'default') return 'default'
  let mtimeMs = 0
  try {
    mtimeMs = fs.statSync(/*turbopackIgnore: true*/ resolved.path).mtimeMs
  } catch {
    return `${resolved.path}:missing`
  }
  return `${resolved.path}:${mtimeMs}`
}

/** Re-reads override/local files when mtime changes; package default is cached in the dependency. */
export function loadPricingTable() {
  const resolved = resolvePricingFile()
  const key = cacheKey(resolved)
  if (cache.table && cache.key === key) return cache.table

  const table =
    resolved.source === 'default'
      ? loadDefaultPricingTable()
      : JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ resolved.path, 'utf8'))
  cache = { key, table }
  return table
}

/** Table plus path/source (for /api/pricing). */
export function loadPricingPayload() {
  const resolved = resolvePricingFile()
  const table = loadPricingTable()
  return {
    ...table,
    pricingPath: resolved.path,
    pricingSource: resolved.source,
  }
}
