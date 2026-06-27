// src/runner/task-editor.ts
//
// Surgical, NON-LOSSY edits to a todo file's raw text.
//
// `serializeTodoFile` reconstructs the whole file from the parsed model, which is lossy by
// design: the parser drops every line starting with `**` (so **Source:**, **Result:**,
// **Update:** logs), drops table rows, and flattens multi-paragraph descriptions to one line.
// Writing a task change through that round-trip destroys all of it.
//
// These helpers instead mutate ONLY the specific field lines of a single task (its heading and
// its `**Priority:** … | **Status:** …` meta line, plus existing/added Plan/Affects/Depends
// lines) and pass every other byte through unchanged.
import type { Task, TaskStatus, Priority } from '../shared/types.js'
import { STATUS_LABELS, PRIORITY_EMOJIS, serializeTask } from './serializer.js'

export interface TaskPatch {
  name?: string
  emoji?: string
  priority?: Priority
  timeEstimate?: string
  status?: TaskStatus
  score?: number | null
  planLink?: string | null
  affects?: string[]
  depends?: number[]
}

const ANY_TASK_HEADING_RE = /^###\s+\d+\.\s/
const CATEGORY_RE = /^##\s/
const META_LINE_RE = /^\*\*Priority:\*\*/
const PLAN_LINE_RE = /^\*\*Plan:\*\*/
const AFFECTS_LINE_RE = /^\*\*Affects:\*\*/i
const DEPENDS_LINE_RE = /^\*\*Depends:\*\*/i
const HEADING_PARSE_RE = /^(###\s+\d+\.\s+)(?:([^\x00-\x7F]\S*)\s+)?(.+)$/

function taskHeadingRe(id: number): RegExp {
  return new RegExp(`^###\\s+${id}\\.\\s`)
}

function rewriteHeading(line: string, patch: TaskPatch): string {
  const m = line.match(HEADING_PARSE_RE)
  if (!m) return line
  const prefix = m[1] // "### 3. "
  const emoji = patch.emoji !== undefined ? patch.emoji : (m[2] ?? '')
  const name = patch.name !== undefined ? patch.name : m[3]
  return `${prefix}${emoji ? emoji + ' ' : ''}${name}`
}

// Targeted sub-field substitution on the meta line — preserves the exact spacing of any
// field not being changed.
function rewriteMetaLine(line: string, patch: TaskPatch): string {
  let out = line
  if (patch.priority !== undefined) {
    const emoji = PRIORITY_EMOJIS[patch.priority] || '🟡'
    out = out.replace(/(\*\*Priority:\*\*\s*)(\S+)(\s+)(\w+)/, `$1${emoji}$3${patch.priority}`)
  }
  if (patch.timeEstimate !== undefined) {
    out = out.replace(/(\*\*Time:\*\*\s*)([^|]+?)(\s*(\||$))/, `$1${patch.timeEstimate}$3`)
  }
  if (patch.status !== undefined) {
    const label = STATUS_LABELS[patch.status] || '✅ Ready'
    out = out.replace(/(\*\*Status:\*\*\s*)([^|]*?)(\s*(\||$))/, `$1${label}$3`)
  }
  if (patch.score !== undefined) {
    if (patch.score === null) {
      out = out.replace(/\s*\|\s*\*\*Score:\*\*\s*\d+/, '')
    } else if (/\*\*Score:\*\*/.test(out)) {
      out = out.replace(/(\*\*Score:\*\*\s*)\d+/, `$1${patch.score}`)
    } else {
      out = `${out} | **Score:** ${patch.score}`
    }
  }
  return out
}

/**
 * Apply `patch` to task `taskId` by editing only its field lines in place. Returns the original
 * content unchanged if the task id is not found. Never touches any other task or any prose,
 * table, Source/Result/Update line.
 */
export function updateTaskInContent(content: string, taskId: number, patch: TaskPatch): string {
  const lines = content.split('\n')
  const headRe = taskHeadingRe(taskId)

  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (headRe.test(lines[i])) { start = i; break }
  }
  if (start === -1) return content

  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (ANY_TASK_HEADING_RE.test(lines[i]) || CATEGORY_RE.test(lines[i])) { end = i; break }
  }

  // Work on the task's block only. `null` marks a line for removal.
  const block: (string | null)[] = lines.slice(start, end)
  let metaPos = -1
  let hasPlan = false, hasAffects = false, hasDepends = false

  for (let j = 0; j < block.length; j++) {
    const line = block[j]
    if (line === null) continue
    if (j === 0) {
      if (patch.name !== undefined || patch.emoji !== undefined) block[j] = rewriteHeading(line, patch)
      continue
    }
    if (META_LINE_RE.test(line)) {
      block[j] = rewriteMetaLine(line, patch)
      metaPos = j
      continue
    }
    if (PLAN_LINE_RE.test(line)) {
      hasPlan = true
      if (patch.planLink !== undefined) block[j] = patch.planLink ? `**Plan:** [[${patch.planLink}]]` : null
      continue
    }
    if (AFFECTS_LINE_RE.test(line)) {
      hasAffects = true
      if (patch.affects !== undefined) block[j] = patch.affects.length ? `**Affects:** ${patch.affects.join(', ')}` : null
      continue
    }
    if (DEPENDS_LINE_RE.test(line)) {
      hasDepends = true
      if (patch.depends !== undefined) block[j] = patch.depends.length ? `**Depends:** ${patch.depends.join(', ')}` : null
      continue
    }
  }

  // Insert newly-set Plan/Affects/Depends lines right after the meta line (plan → affects → depends).
  if (metaPos !== -1) {
    const toInsert: string[] = []
    if (patch.planLink !== undefined && !hasPlan && patch.planLink) toInsert.push(`**Plan:** [[${patch.planLink}]]`)
    if (patch.affects !== undefined && !hasAffects && patch.affects.length) toInsert.push(`**Affects:** ${patch.affects.join(', ')}`)
    if (patch.depends !== undefined && !hasDepends && patch.depends.length) toInsert.push(`**Depends:** ${patch.depends.join(', ')}`)
    if (toInsert.length) block.splice(metaPos + 1, 0, ...toInsert)
  }

  const newBlock = block.filter((l): l is string => l !== null)
  return [...lines.slice(0, start), ...newBlock, ...lines.slice(end)].join('\n')
}

function stripCategory(s: string): string {
  return s
    .replace(/^[\p{Emoji}\p{Emoji_Presentation}\s]+/u, '')
    .replace(/\s*\(.*\)\s*$/, '')
    .trim()
}

/** Find [start, end) line range of a task's block (heading through the line before the next
 *  task/category heading, or EOF). Returns null if the task id is not found. */
function findTaskBlock(lines: string[], taskId: number): { start: number; end: number } | null {
  const headRe = taskHeadingRe(taskId)
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (headRe.test(lines[i])) { start = i; break }
  }
  if (start === -1) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (ANY_TASK_HEADING_RE.test(lines[i]) || CATEGORY_RE.test(lines[i])) { end = i; break }
  }
  return { start, end }
}

/** Remove a task's entire block. No-op (returns content unchanged) if the id is not found.
 *  Leaves every other task and all prose/tables byte-intact. */
export function removeTaskFromContent(content: string, taskId: number): string {
  const lines = content.split('\n')
  const block = findTaskBlock(lines, taskId)
  if (!block) return content
  return [...lines.slice(0, block.start), ...lines.slice(block.end)].join('\n')
}

/** Append a new task at the end of its category's task run (or end of the task region if the
 *  category has no existing tasks). The new block is rendered with serializeTask — safe because
 *  a brand-new task has no rich body to lose. Existing tasks are untouched. */
export function insertTaskIntoContent(content: string, task: Task): string {
  const lines = content.split('\n')
  const wantCat = stripCategory(task.category || '')
  let curCat = ''
  let insertAt = -1          // end of last task block whose category matches
  let lastTaskEnd = -1       // end of last task block in the file (any category)

  for (let i = 0; i < lines.length; i++) {
    const cm = lines[i].match(/^##\s+(.+)$/)
    if (cm) { curCat = stripCategory(cm[1]); continue }
    if (ANY_TASK_HEADING_RE.test(lines[i])) {
      let j = i + 1
      while (j < lines.length && !ANY_TASK_HEADING_RE.test(lines[j]) && !CATEGORY_RE.test(lines[j])) j++
      lastTaskEnd = j
      if (curCat === wantCat) insertAt = j
      i = j - 1
    }
  }

  const at = insertAt !== -1 ? insertAt : (lastTaskEnd !== -1 ? lastTaskEnd : lines.length)
  const blockLines = serializeTask(task).split('\n')
  lines.splice(at, 0, '', ...blockLines, '', '---')
  return lines.join('\n')
}
