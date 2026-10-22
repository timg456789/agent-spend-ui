/**
 * User prompts and the assistant output that follows each one, from Cursor's
 * bubble store (state.vscdb). Token totals use tokensFromBubbleRaw — the same
 * function as the chat rollup — so prompt output tokens add up to the chat's
 * output total.
 *
 * A "prompt" is a user bubble that is actually a query: it contains <user_query>,
 * or it is user text that is not a system_notification / task wrapper. Assistant
 * bubbles until the next prompt are that prompt's output. System-notification
 * user bubbles are not listed; any output tokens on them still roll into the
 * surrounding prompt so the chat total is preserved.
 */
import { readComposerData, readBubbles, tokensFromBubbleRaw } from 'agent-spend-cursor-data-access'

const PIECE_CAP = 100_000

function countedText(part) {
  if (part == null) return ''
  if (typeof part === 'string') return part
  try {
    return JSON.stringify(part)
  } catch {
    return ''
  }
}

function displayText(part, counted) {
  if (typeof part === 'string') {
    const trimmed = part.trim()
    if (trimmed.length <= 80_000 && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2)
      } catch {
        return part
      }
    }
    return part
  }
  if (counted.length <= 80_000) {
    try {
      return JSON.stringify(part, null, 2)
    } catch {
      return counted
    }
  }
  return counted
}

function makePiece(label, part, extra = {}) {
  const counted = countedText(part)
  if (!counted) return null
  const shown = displayText(part, counted)
  const truncated = shown.length > PIECE_CAP
  return {
    label,
    chars: counted.length,
    truncated,
    text: truncated ? shown.slice(0, PIECE_CAP) : shown,
    ...extra,
  }
}

export function promptTextFromBubble(raw) {
  const text = raw?.text || ''
  const query = text.match(/<user_query>([\s\S]*?)<\/user_query>/i)
  return (query ? query[1] : text)
    .replace(/<timestamp>[\s\S]*?<\/timestamp>\s*/gi, '')
    .replace(/<\/?user_query>/gi, '')
    .trim()
}

/** User bubble that represents something the user (or a parent agent) sent. */
export function isUserPromptBubble(raw) {
  if (raw?.type !== 1) return false
  const text = raw.text || ''
  if (!text.trim()) return false
  if (/<user_query>/i.test(text)) return true
  if (/<system_notification>/i.test(text)) return false
  return true
}

function mergeSource(current, next) {
  if (!next || next === 'none') return current
  if (!current || current === 'none') return next
  if (current === next) return current
  return 'mixed'
}

function recordedModel(raw) {
  const name = raw?.modelInfo?.modelName
  return typeof name === 'string' && name.trim() ? name.trim() : null
}

function composerModel(composer) {
  const name = composer?.modelConfig?.modelName || composer?.model
  return typeof name === 'string' && name.trim() ? name.trim() : null
}

function assistantStep(raw, id) {
  const tokens = tokensFromBubbleRaw(raw)
  if (tokens.output === 0 && tokens.input === 0) return null
  const toolName = raw?.toolFormerData?.name || raw?.toolFormerData?.toolName || ''
  const text = (raw?.text || '').trim()
  const thinking = (raw?.thinking?.text || '').trim()
  const hasCode = (raw?.codeBlocks || []).some((block) => block?.content)
  let label = 'Reply'
  let kind = 'reply'
  if (toolName) {
    label = toolName
    kind = 'tool'
  } else if (!text && thinking) {
    label = 'Thinking'
    kind = 'reply'
  } else if (!text && hasCode) {
    label = 'Code'
    kind = 'reply'
  }
  return {
    id,
    label,
    kind,
    outputTokens: tokens.output,
    inputTokens: tokens.input,
    source: tokens.source,
  }
}

function addOutput(prompt, tokens) {
  if (!tokens?.output) return
  prompt.outputTokens += tokens.output
  prompt.outputSource = mergeSource(prompt.outputSource, tokens.source)
}

function absorbLead(prompt, leadSteps, leadOutput) {
  if (!leadSteps.length && !leadOutput) return
  prompt.steps = leadSteps
  prompt.outputTokens += leadOutput
  for (const step of leadSteps) {
    prompt.outputTokens += step.outputTokens
    if (step.outputTokens > 0) prompt.outputSource = mergeSource(prompt.outputSource, step.source)
  }
}

function finishPrompt(prompt, index, defaultModel) {
  const tools = new Map()
  for (const step of prompt.steps) {
    const name = step.label
    const row = tools.get(name) || {
      name,
      kind: step.kind,
      calls: 0,
      outputTokens: 0,
    }
    row.calls += 1
    row.outputTokens += step.outputTokens
    tools.set(name, row)
  }
  return {
    n: index + 1,
    text: prompt.text || 'No user prompt was stored before this output.',
    model: prompt.model || defaultModel || null,
    inputTokens: prompt.inputTokens,
    outputTokens: prompt.outputTokens,
    stepCount: prompt.steps.length,
    outputSource: prompt.outputSource || 'none',
    tools: [...tools.values()].sort((a, b) => b.outputTokens - a.outputTokens || b.calls - a.calls),
    steps: prompt.steps.map((step) => ({
      id: step.id,
      label: step.label,
      kind: step.kind,
      outputTokens: step.outputTokens,
      inputTokens: step.inputTokens,
      source: step.source,
    })),
  }
}

export function groupPromptTurns(headers, bubbles, defaultModel = null) {
  const prompts = []
  let current = null
  let leadSteps = []
  let leadOutput = 0
  let leadSource = null

  for (const header of headers) {
    const raw = bubbles.get(header.bubbleId)
    if (!raw) continue
    if (raw.type === 1) {
      const text = promptTextFromBubble(raw)
      if (isUserPromptBubble(raw) && text) {
        const at = raw.createdAt || header.createdAt || null
        // Cursor sometimes appends a second copy of an earlier prompt (same text, same timestamp).
        if (at && prompts.some((prompt) => prompt.text === text && prompt.at === at)) {
          const tokens = tokensFromBubbleRaw(raw)
          if (current) addOutput(current, tokens)
          else if (tokens.output) {
            leadOutput += tokens.output
            leadSource = mergeSource(leadSource, tokens.source)
          }
          continue
        }
        const tokens = tokensFromBubbleRaw(raw)
        const prompt = {
          text,
          at,
          model: recordedModel(raw),
          inputTokens: tokens.input,
          outputTokens: tokens.output || 0,
          outputSource: tokens.output > 0 ? tokens.source : null,
          steps: [],
        }
        if (prompts.length === 0) {
          absorbLead(prompt, leadSteps, leadOutput)
          prompt.outputSource = mergeSource(prompt.outputSource, leadSource)
          leadSteps = []
          leadOutput = 0
          leadSource = null
        }
        current = prompt
        prompts.push(prompt)
        continue
      }
      const tokens = tokensFromBubbleRaw(raw)
      if (current) addOutput(current, tokens)
      else if (tokens.output) {
        leadOutput += tokens.output
        leadSource = mergeSource(leadSource, tokens.source)
      }
      continue
    }
    const step = assistantStep(raw, header.bubbleId)
    if (!step) continue
    if (!current) leadSteps.push(step)
    else {
      current.steps.push(step)
      current.outputTokens += step.outputTokens
      if (step.outputTokens > 0) current.outputSource = mergeSource(current.outputSource, step.source)
    }
  }

  if (!prompts.length && (leadSteps.length || leadOutput)) {
    const prompt = {
      text: '',
      model: null,
      inputTokens: 0,
      outputTokens: leadOutput,
      outputSource: leadSource,
      steps: [],
    }
    absorbLead(prompt, leadSteps, 0)
    prompts.push(prompt)
  }

  return prompts.map((prompt, index) => finishPrompt(prompt, index, defaultModel))
}

function loadConversation(db, composerId) {
  const composer = readComposerData(db, composerId)
  if (!composer) return null
  const headers = composer.fullConversationHeadersOnly || []
  const bubbles = readBubbles(
    db,
    composerId,
    headers.map((header) => header.bubbleId).filter(Boolean)
  )
  return { headers, bubbles, defaultModel: composerModel(composer) }
}

export function summarizePromptTurns(db, composerId) {
  const loaded = loadConversation(db, composerId)
  if (!loaded) return null
  const prompts = groupPromptTurns(loaded.headers, loaded.bubbles, loaded.defaultModel)
  return {
    prompts,
    outputTokens: prompts.reduce((sum, prompt) => sum + prompt.outputTokens, 0),
  }
}

function toolPieces(raw) {
  const tool = raw?.toolFormerData
  if (!tool) return []
  const pieces = []
  const args = countedText(tool.rawArgs)
  const params = countedText(tool.params)
  if (args && params && args === params) {
    const piece = makePiece('Arguments', tool.rawArgs, { countedTwice: true })
    if (piece) pieces.push(piece)
  } else {
    if (args) {
      const piece = makePiece('Arguments', tool.rawArgs)
      if (piece) pieces.push(piece)
    } else if (params) {
      const piece = makePiece('Arguments', tool.params)
      if (piece) pieces.push(piece)
    }
    if (args && params) {
      const piece = makePiece('Params', tool.params)
      if (piece) pieces.push(piece)
    }
  }
  const result = makePiece('Result', tool.result)
  if (result) pieces.push(result)
  pieces.push(...additionalPieces(tool.additionalData))
  return pieces
}

function additionalPieces(data) {
  if (data == null) return []
  if (typeof data !== 'object' || Array.isArray(data)) {
    const piece = makePiece('Extra', data)
    return piece && piece.chars >= 80 ? [piece] : []
  }
  const pieces = []
  for (const [key, value] of Object.entries(data)) {
    const label = key === 'precomputedDiff' ? 'Diff' : key
    const piece = makePiece(label, value)
    if (piece && piece.chars >= 80) pieces.push(piece)
  }
  return pieces
}

export function piecesFromBubble(raw) {
  if (!raw) return []
  const pieces = []
  const reply = makePiece('Reply', raw.text)
  if (reply) pieces.push(reply)
  const thinking = makePiece('Thinking', raw.thinking?.text)
  if (thinking) pieces.push(thinking)
  for (const block of raw.codeBlocks || []) {
    const code = makePiece('Code', block?.content)
    if (code) pieces.push(code)
  }
  pieces.push(...toolPieces(raw))
  return pieces
}

/** Full stored text for one output step. `n` is the 1-based prompt index. */
export function promptTurnStep(db, composerId, n, stepId) {
  const loaded = loadConversation(db, composerId)
  if (!loaded) return null
  const prompts = groupPromptTurns(loaded.headers, loaded.bubbles, loaded.defaultModel)
  const prompt = prompts[n - 1]
  if (!prompt) return null
  const step = prompt.steps.find((item) => item.id === stepId)
  if (!step) return null
  return {
    n,
    step: {
      ...step,
      pieces: piecesFromBubble(loaded.bubbles.get(stepId)),
    },
  }
}
