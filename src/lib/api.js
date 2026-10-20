async function getJson(url) {
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok && !data.error) data.error = `HTTP ${res.status}`
  return data
}

export const api = {
  projects: (refresh = false) => getJson('/api/projects' + (refresh ? '?refresh=1' : '')),
  project: (slug) => getJson('/api/project/' + encodeURIComponent(slug) + '?agentChats=0&models=0'),
  pricing: () => getJson('/api/pricing'),
  chatTokens: (chatId, slug) => {
    const q = slug ? '?project=' + encodeURIComponent(slug) : ''
    return getJson('/api/agent-chat/' + encodeURIComponent(chatId) + '/tokens' + q)
  },
  chatPrompts: (chatId, slug) =>
    getJson('/api/agent-chat/' + encodeURIComponent(chatId) + '/prompts?project=' + encodeURIComponent(slug)),
  usageStreamUrl: (slug) => '/api/project/' + encodeURIComponent(slug) + '/usage?stream=1',
}

const USAGE_SUMMARY_KEY = 'agent-spend-usage-summary:v2:'

export function readUsageSummaryCache(slug) {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(USAGE_SUMMARY_KEY + slug)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeUsageSummaryCache(slug, summary) {
  try {
    localStorage.setItem(USAGE_SUMMARY_KEY + slug, JSON.stringify(summary))
  } catch {
    /* storage full */
  }
}

/** Compact summary of a finished scan for the stat grid + localStorage. */
export function usageSummaryFromScan(data) {
  const t = data?.tokens || {}
  return {
    input: t.input || 0,
    output: t.output || 0,
    total: t.total || 0,
    measured: t.measured || 0,
    estimated: t.estimated || 0,
    bubblesTotal: data.bubblesTotal ?? 0,
    bubblesLoaded: data.bubblesLoaded ?? data.bubblesTotal ?? 0,
    bubblesMissing: data.bubblesMissing ?? 0,
    emptyBubbles: data.emptyBubbles ?? t.emptyBubbles ?? 0,
    agentChatsScanned: data.agentChatCount || 0,
    costUsd: data.costUsd ?? 0,
    inputCostUsd: data.inputCostUsd ?? 0,
    outputCostUsd: data.outputCostUsd ?? 0,
    unpricedTokens: data.unpricedTokens || 0,
    missingPricingModels: (data.modelsMissingPricing || []).length,
    scannedMs: data.scannedMs || 0,
    savedAt: data.scannedAt || new Date().toISOString(),
  }
}
