/**
 * Service layer: everything the HTTP layer (Next.js route handlers) needs,
 * with no knowledge of Request/Response. Pure async functions over the libs.
 */
import {
  cursorPaths,
  loadWorkspaceFolders,
  scanProjectsIndex,
  scanTranscriptFiles,
  listUserPromptsFromTranscript,
  openGlobalStateDb,
  tokensFromComposerDb,
  tokensFromComposerDbBatch,
  buildProjectUsagePayload,
  assembleScanTiming,
  inspectComposerRun,
  composerModelsBatchAsync,
  composerDisplayNamesBatchAsync,
  composerDisplayNameFromDb,
} from 'agent-spend-cursor-data-access'
import { loadPricingTable, resolvePricingFile } from './pricing.mjs'

export class ApiError extends Error {
  constructor(status, message, extra = {}) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

const workspaceFilter = () => process.env.AGENT_SPEND_FILTER || process.env.CURSOR_LITE_FILTER || null
const sseEvery = () => Math.max(1, Number(process.env.AGENT_SPEND_SSE_EVERY) || 8)

/** Comma-separated slugs hidden from every API (list, project, usage, chat). */
function excludedProjectSlugs() {
  const raw = process.env.AGENT_SPEND_EXCLUDE_SLUGS
  if (!raw?.trim()) return new Set()
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
}

function assertProjectAllowed(slug) {
  if (excludedProjectSlugs().has(slug)) throw new ApiError(404, 'not found')
}

/* ---------- projects ---------- */

const CACHE_MS = 30_000
let projectsCache = { at: 0, projects: [], workspaces: {} }

export async function getProjectsIndex(force = false) {
  const now = Date.now()
  if (!force && now - projectsCache.at < CACHE_MS && projectsCache.projects.length) return projectsCache
  const { projectsDir, workspaceStorage } = cursorPaths()
  const workspaces = loadWorkspaceFolders(workspaceStorage)
  const hidden = excludedProjectSlugs()
  let projects = scanProjectsIndex(projectsDir, { workspaceFilter: workspaceFilter(), workspaceStorageDir: workspaceStorage })
  if (hidden.size) projects = projects.filter((p) => !hidden.has(p.slug))
  projectsCache = { at: now, projects, workspaces: Object.fromEntries(workspaces) }
  return projectsCache
}

export async function listProjects(force = false) {
  const t0 = performance.now()
  const { projects, workspaces } = await getProjectsIndex(force)
  return {
    scannedMs: Math.round(performance.now() - t0),
    projectCount: projects.length,
    workspaces,
    projects,
    storageNote: 'Cursor stores agent chats under ~/.cursor/projects/<slug>/agent-transcripts/ (one folder per workspace).',
  }
}

async function chatsForProject(slug) {
  assertProjectAllowed(slug)
  const { projectsDir, workspaceStorage } = cursorPaths()
  return scanTranscriptFiles(projectsDir, { workspaceFilter: workspaceFilter(), projectSlug: slug, workspaceStorageDir: workspaceStorage })
}

export async function getProjectDetail(slug, { listAgentChats = true, attachModels = true } = {}) {
  assertProjectAllowed(slug)
  const t0 = performance.now()
  const { projects, workspaces } = await getProjectsIndex()
  const meta = projects.find((p) => p.slug === slug)
  const agentChats = await chatsForProject(slug)
  if (!meta && !agentChats.length) throw new ApiError(404, 'not found')

  let namesLookupMs = 0
  let agentChatNames = {}
  if (agentChats.length) {
    const t = performance.now()
    const { db, close } = openGlobalStateDb()
    if (db) {
      try {
        agentChatNames = await composerDisplayNamesBatchAsync(db, agentChats)
      } finally {
        close()
      }
    }
    namesLookupMs = Math.round(performance.now() - t)
  }

  let modelLookupMs = 0
  let composerModelsFound = 0
  const modelByComposerId = new Map()
  if (listAgentChats && attachModels && agentChats.length) {
    const t = performance.now()
    const { db, close } = openGlobalStateDb()
    if (db) {
      try {
        const batch = await composerModelsBatchAsync(db, agentChats.slice(0, 400).map((s) => s.id))
        for (const [id, model] of batch) {
          modelByComposerId.set(id, model)
          if (model) composerModelsFound += 1
        }
      } finally {
        close()
      }
    }
    modelLookupMs = Math.round(performance.now() - t)
  }

  const displayName = meta?.displayName || agentChats[0]?.projectDisplayName || agentChats[0]?.projectLabel || slug
  return {
    scannedMs: Math.round(performance.now() - t0),
    namesLookupMs,
    modelLookupMs,
    composerModelsFound,
    slug,
    displayName,
    folderPath: meta?.folderPath ?? agentChats[0]?.projectFolderPath ?? null,
    label: displayName,
    meta: meta || null,
    workspaces,
    agentChatCount: agentChats.length,
    agentChatNames,
    agentChats: listAgentChats
      ? agentChats.map(({ path: _p, ...rest }) => ({ ...rest, agentChatDefaultModel: modelByComposerId.get(rest.id) ?? null }))
      : [],
  }
}

/* ---------- usage scan ---------- */

export async function scanProjectUsage(slug, { onProgress } = {}) {
  assertProjectAllowed(slug)
  // Host injects pricing (override → server/pricing.json → loadDefaultPricingTable()).
  const pricingTable = loadPricingTable()
  const t0 = performance.now()
  const emit = onProgress ? (ev) => onProgress({ event: 'progress', ...ev }) : async () => {}

  await emit({ phase: 'transcripts', message: 'Scanning agent chat transcripts on disk…' })
  const tDisk = performance.now()
  const agentChats = await chatsForProject(slug)
  const diskScanMs = Math.round(performance.now() - tDisk)
  if (!agentChats.length) throw new ApiError(404, 'project not found or no transcripts')

  const composerIds = agentChats.map((s) => s.id)
  const tDb = performance.now()
  const { db, close } = openGlobalStateDb()
  const dbOpenMs = Math.round(performance.now() - tDb)
  if (!db) throw new ApiError(500, 'global state.vscdb not readable')

  await emit({
    phase: 'database',
    message: 'Reading usage from Cursor’s local database · ' + composerIds.length.toLocaleString() + ' agent chats…',
    totalAgentChats: composerIds.length,
  })

  let tokenRollup
  try {
    tokenRollup = await tokensFromComposerDbBatch(db, composerIds, {
      pricingTable,
      progressEvery: onProgress ? sseEvery() : 1,
      yieldProgress: false,
      onProgress: onProgress ? (ev) => emit(ev) : undefined,
    })
  } finally {
    close()
  }

  const payload = buildProjectUsagePayload(slug, agentChats, tokenRollup, { pricingTable, diskScanMs, dbOpenMs })
  const tEmit = performance.now()
  JSON.stringify(payload)
  const responseDoneEmitMs = Math.round(performance.now() - tEmit)
  const st = payload.scanTiming || {}
  const scanTiming = assembleScanTiming({
    diskScanMs,
    dbOpenMs,
    batchTiming: tokenRollup.timing,
    payloadBuildMs: st.payloadBuildMs,
    timelineBuildMs: st.timelineBuildMs,
    responseDoneEmitMs,
  })
  scanTiming.wallMs = Math.round(performance.now() - t0)
  scanTiming.unaccountedMs = scanTiming.wallMs - scanTiming.totalMs
  return { ...payload, scannedMs: scanTiming.totalMs, scanTiming, pricingPath: resolvePricingFile().path }
}

/* ---------- single chat ---------- */

export function getAgentChatTokens(composerId, projectSlug = null) {
  if (projectSlug) assertProjectAllowed(projectSlug)
  const pricingTable = loadPricingTable()
  const t0 = performance.now()
  const { db, close } = openGlobalStateDb()
  if (!db) throw new ApiError(500, 'global state.vscdb not readable')
  try {
    const tok = tokensFromComposerDb(db, composerId, { pricingTable })
    return { composerId, scannedMs: Math.round(performance.now() - t0), method: 'all-bubbles-in-agent-chat', ...tok }
  } finally {
    close()
  }
}

export async function getAgentChatPrompts(composerId, projectSlug = null) {
  if (projectSlug) assertProjectAllowed(projectSlug)
  const { projectsDir, workspaceStorage } = cursorPaths()
  const agentChats = await scanTranscriptFiles(projectsDir, {
    workspaceFilter: workspaceFilter(),
    projectSlug,
    workspaceStorageDir: workspaceStorage,
  })
  const row = agentChats.find((s) => s.id === composerId)
  if (!row) throw new ApiError(404, 'not found')
  assertProjectAllowed(row.projectSlug)
  const t0 = performance.now()
  const prompts = await listUserPromptsFromTranscript(row.path)
  let name = null
  const { db, close } = openGlobalStateDb()
  if (db) {
    try {
      name = composerDisplayNameFromDb(db, composerId) ?? null
    } finally {
      close()
    }
  }
  return { composerId, projectSlug: row.projectSlug, name, promptCount: prompts.length, prompts, scannedMs: Math.round(performance.now() - t0) }
}

export function inspectAgentChatRun(composerId, runId = null) {
  const { db, close } = openGlobalStateDb()
  if (!db) throw new ApiError(500, 'global state.vscdb not readable')
  try {
    return inspectComposerRun(db, composerId, runId)
  } finally {
    close()
  }
}

export { cursorPaths }
