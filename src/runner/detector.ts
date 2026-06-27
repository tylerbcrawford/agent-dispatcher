// src/runner/detector.ts

import type { VerificationReport, VerificationCheck } from '../shared/types.js'

export interface CompletionSignal {
  type: 'completed' | 'plan_ready' | 'needs_help' | 'partial' | 'verified'
  reason?: string
  summary?: string
}

const COMPLETED_RE = /\[COMPLETED\]/
const VERIFIED_RE = /\[VERIFIED\]/
const PLAN_READY_RE = /\[PLAN_READY\]/
const NEEDS_HELP_RE = /\[NEEDS_HELP:\s*(.+?)\]/
const PARTIAL_RE = /\[PARTIAL:\s*(.+?)\]/

export function detectSignal(output: string): CompletionSignal | null {
  // Only check extracted assistant text from stream-json, not raw output.
  // Raw output includes echoed prompts (--verbose mode) which contain
  // signal markers like [COMPLETED] in the task description — false positives.
  const text = extractTextFromStreamJson(output)
  if (!text) return null
  const combined = text

  const helpMatch = combined.match(NEEDS_HELP_RE)
  if (helpMatch) return { type: 'needs_help', reason: helpMatch[1] }

  const partialMatch = combined.match(PARTIAL_RE)
  if (partialMatch) return { type: 'partial', summary: partialMatch[1] }

  if (PLAN_READY_RE.test(combined)) return { type: 'plan_ready' }
  // [VERIFIED] takes priority over [COMPLETED] when both present
  if (VERIFIED_RE.test(combined)) return { type: 'verified' }
  if (COMPLETED_RE.test(combined)) return { type: 'completed' }

  return null
}

/**
 * Parse a verification report from agent output.
 * Expects a markdown checklist format:
 *   - [x] Unit tests: 132 pass
 *   - [ ] Lint: 2 errors
 *   - [SKIP] Docker: not applicable
 *   - [WARN] Performance: 200ms response time
 *
 * Also looks for a ## Summary section after the checklist.
 */
export function parseVerificationReport(output: string): VerificationReport | null {
  const text = extractTextFromStreamJson(output) || output
  // Match checklist items: - [x], - [ ], - [SKIP], - [WARN]
  const checkPattern = /^[\s]*[-*]\s*\[(x|X| |SKIP|WARN)\]\s*(.+)$/gm
  const checks: VerificationCheck[] = []

  for (const match of text.matchAll(checkPattern)) {
    const marker = match[1].trim().toUpperCase()
    const rest = match[2].trim()
    // Split on first colon for name: detail
    const colonIdx = rest.indexOf(':')
    const name = colonIdx > 0 ? rest.slice(0, colonIdx).trim() : rest
    const detail = colonIdx > 0 ? rest.slice(colonIdx + 1).trim() : ''

    let status: VerificationCheck['status']
    if (marker === 'X') status = 'pass'
    else if (marker === '') status = 'fail'
    else if (marker === 'SKIP') status = 'skip'
    else status = 'warn'

    checks.push({ name, status, detail })
  }

  if (checks.length === 0) return null

  // Extract summary: look for ## Summary section or text after the checklist
  const summaryMatch = text.match(/##\s*Summary\s*\n([\s\S]*?)(?:\n##|\[VERIFIED\]|$)/)
  const summary = summaryMatch ? summaryMatch[1].trim() : ''

  return { checks, summary, timestamp: Date.now() }
}

// Heuristic question detection — looks for question marks preceded by
// common question starters. Not perfect, but catches obvious cases.
const QUESTION_PATTERNS = [
  /\bshould\s+I\b.*\?/i,
  /\bwhich\b.*\?/i,
  /\bdo\s+you\s+want\b.*\?/i,
  /\bwould\s+you\s+(like|prefer)\b.*\?/i,
  /\bcan\s+you\s+(confirm|clarify)\b.*\?/i,
  /\bplease\s+(choose|select|confirm)\b/i,
]

// Known system prompt patterns that produce false-positive questions.
// These appear when Claudesidian's skill system streams its graphviz
// diagrams and flow descriptions through the agent output.
const QUESTION_BLOCKLIST = [
  /Might any skill apply/i,
  /digraph|graphviz/i,
  /claudesidian/i,
  /skill.*apply.*to/i,
]

export function detectQuestion(output: string): boolean {
  // Extract text content from stream-json before matching
  const text = extractTextFromStreamJson(output)
  // Skip if the text matches known system prompt patterns
  if (QUESTION_BLOCKLIST.some(re => re.test(text))) return false
  return QUESTION_PATTERNS.some(re => re.test(text))
}

/**
 * Extract readable text from stream-json output.
 * Claude Code emits JSON lines like: {"type":"assistant","content":[{"type":"text","text":"..."}],...}
 * We only want to match question patterns against the actual assistant text, not system prompts or tool calls.
 */
export function extractStreamJsonText(raw: string): string {
  return extractTextFromStreamJson(raw)
}

function extractTextFromStreamJson(raw: string): string {
  const texts: string[] = []

  // Method 0: Codex --json format (JSON-RPC notifications)
  // {"method":"item/agentMessage/delta","params":{"itemId":"...","delta":"text"}}
  for (const line of raw.split('\n')) {
    try {
      const parsed = JSON.parse(line.trim())
      if (parsed.method === 'item/agentMessage/delta' && typeof parsed.params?.delta === 'string') {
        texts.push(parsed.params.delta)
      }
    } catch { /* not JSON, skip */ }
  }
  if (texts.length > 0) return texts.join('')

  // Method 1: Gemini stream-json — {"type":"message","role":"assistant","content":"..."}
  // Content is a flat string (simpler than Claude's nested content blocks)
  const geminiPattern = /\{[^{}]*"type"\s*:\s*"message"[^{}]*\}/g
  for (const match of raw.matchAll(geminiPattern)) {
    try {
      const parsed = JSON.parse(match[0])
      if (parsed.type === 'message' && parsed.role === 'assistant' && typeof parsed.content === 'string') {
        texts.push(parsed.content)
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  // Method 2: Claude stream-json — {"type":"text","text":"..."}
  const claudePattern = /\{[^{}]*"type"\s*:\s*"(?:assistant|text)"[^{}]*\}/g
  for (const match of raw.matchAll(claudePattern)) {
    try {
      const parsed = JSON.parse(match[0])
      if (parsed.type === 'text' && typeof parsed.text === 'string') {
        texts.push(parsed.text)
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  // Method 3: If methods 1+2 fail, extract "text":"..." values directly.
  // This handles nested JSON where the simple regex can't match the full object.
  if (texts.length === 0) {
    const textValuePattern = /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g
    for (const match of raw.matchAll(textValuePattern)) {
      try {
        const unescaped = JSON.parse(`"${match[1]}"`)
        // Threshold of 10 catches signal blocks like "[PLAN_READY]" (12 chars)
        if (unescaped.length > 10) texts.push(unescaped)
      } catch {
        // Not valid JSON string, skip
      }
    }
  }

  // If we extracted text from JSON, use it; otherwise fall back to raw
  // but only if the raw output doesn't look like JSON (plain terminal output)
  if (texts.length > 0) return texts.join(' ')
  if (raw.includes('"type":"') || raw.includes('"session_id"')) return '' // JSON but no text — skip
  return raw
}

// Parse session ID from stream-json handshake
// Claude: {"type":"system","session_id":"uuid",...}
// Gemini: {"type":"init","session_id":"uuid","model":"..."}
export function parseStreamJsonSessionId(line: string): string | null {
  try {
    const parsed = JSON.parse(line)
    if ((parsed.type === 'system' || parsed.type === 'init') && parsed.session_id) {
      return parsed.session_id
    }
    // Codex: {"method":"thread/started","params":{"thread":{"id":"thr_123"}}}
    if (parsed.method === 'thread/started' && parsed.params?.thread?.id) {
      return parsed.params.thread.id
    }
  } catch {
    // Not JSON, skip
  }
  return null
}

/**
 * True if an output chunk contains a permission-profile tool denial — i.e. the
 * agent attempted a tool blocked by `--disallowedTools`. Claude emits a
 * `tool_result` like `<tool_use_error>Error: No such tool available: Write.
 * Write exists but is not enabled in this context...</tool_use_error>`. The
 * substring "is not enabled in this context" is specific to a disallowed-tool
 * denial, so it won't false-trip on a benign tool error (e.g. a missing file).
 * (Captured empirically 2026-06-20.)
 */
export function isPermissionDenial(chunk: string): boolean {
  return chunk.includes('is not enabled in this context')
}

/**
 * Track consecutive profile-denials across stream chunks for the token-burn
 * watchdog: +1 on a denial, reset to 0 when a tool actually succeeds
 * (`"is_error":false` — real progress), unchanged on neutral text/thinking
 * (a flailing agent narrates between denials, so text must NOT reset the count).
 */
export function updateDenialCount(prev: number, chunk: string): number {
  if (isPermissionDenial(chunk)) return prev + 1
  if (/"is_error"\s*:\s*false/.test(chunk)) return 0
  return prev
}
