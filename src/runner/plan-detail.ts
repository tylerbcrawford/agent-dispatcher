// src/runner/plan-detail.ts
// Helpers to extract plan content for plan-review queue items
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { extractStreamJsonText } from './detector.js'

const PLAN_MAX_CHARS = 64000
const TERMINAL_FALLBACK_CHARS = 16000
const RECENT_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutes

/** Recursively collect .md files with "plan" in name */
function collectPlanFiles(dir: string, depth: number, results: { path: string; mtime: number }[]) {
  if (depth > 3) return
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory() && !entry.startsWith('.')) {
          collectPlanFiles(fullPath, depth + 1, results)
        } else if (stat.isFile() && entry.endsWith('.md') && entry.toLowerCase().includes('plan')) {
          results.push({ path: fullPath, mtime: stat.mtimeMs })
        }
      } catch {
        // Skip entries we can't stat
      }
    }
  } catch {
    // Skip dirs we can't read
  }
}

/** Scan a folder (recursively) for .md files with "plan" in name modified recently */
export function findRecentPlanFile(projectFolder: string): string | null {
  try {
    const now = Date.now()
    const candidates: { path: string; mtime: number }[] = []
    collectPlanFiles(projectFolder, 0, candidates)

    // Filter to recent files and pick the most recently modified
    const recent = candidates
      .filter(f => (now - f.mtime) <= RECENT_THRESHOLD_MS)
      .sort((a, b) => b.mtime - a.mtime)

    if (recent.length === 0) return null

    const content = readFileSync(recent[0].path, 'utf-8')
    return content.length > PLAN_MAX_CHARS
      ? content.slice(0, PLAN_MAX_CHARS) + '\n\n[...truncated]'
      : content
  } catch {
    return null
  }
}

/** Build plan detail: try plan file first, fall back to terminal output */
export function buildPlanDetail(session: { lastOutput: string }, projectFolder: string): string {
  const planContent = findRecentPlanFile(projectFolder)
  if (planContent) return planContent

  // Fall back to cleaned terminal output
  const extracted = extractStreamJsonText(session.lastOutput)
  const text = extracted || session.lastOutput
  return text.length > TERMINAL_FALLBACK_CHARS
    ? text.slice(-TERMINAL_FALLBACK_CHARS)
    : text
}
