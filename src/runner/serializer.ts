// src/runner/serializer.ts
// Serializes in-memory Task[] back to todo-mediaserver.md format.
// Inverse of parser.ts — must produce output that round-trips through parseTodoFile().
import type { Task, TaskStatus, Priority, TodoFrontmatter } from '../shared/types.js'
import { deriveTaskBucket, parseTimeMinutes } from './parser.js'

// --- Status serialization (reverse of parser.ts:parseStatus) ---
const STATUS_LABELS: Record<TaskStatus, string> = {
  'needs-planning': '📝 Needs Planning',
  'plan-review': '👁️ Plan Review',
  'ready': '✅ Ready',
  'in-progress': '🤖 In Progress',
  'in-review': '🔍 In Review',
  'done': '🏁 Done',
  'blocked': '⏸️ Blocked',
  'manual': '🖐️ Manual',
}

// --- Priority serialization ---
const PRIORITY_EMOJIS: Record<Priority, string> = {
  HIGH: '🔴',
  MEDIUM: '🟡',
  LOW: '🟢',
}

// --- Extract category order from original content ---
// Returns ## headings that contain ### task headings (i.e., real task categories)
export function extractCategoryOrder(content: string): string[] {
  const categories: string[] = []
  const lines = content.split('\n')
  const CATEGORY_RE = /^##\s+(.+)$/
  const TASK_HEADING_RE = /^###\s+\d+\.\s+.+$/

  let currentCategory = ''
  let categoryHasTasks = false

  for (const line of lines) {
    const catMatch = line.match(CATEGORY_RE)
    if (catMatch) {
      // Save previous category if it had tasks
      if (currentCategory && categoryHasTasks && !categories.includes(currentCategory)) {
        categories.push(currentCategory)
      }
      // Strip emoji and parenthetical to match parser behavior
      currentCategory = catMatch[1]
        .replace(/^[\p{Emoji}\p{Emoji_Presentation}\s]+/u, '')
        .replace(/\s*\(.*\)\s*$/, '')
        .trim()
      categoryHasTasks = false
      continue
    }

    if (line.match(TASK_HEADING_RE)) {
      categoryHasTasks = true
    }
  }

  // Save last category
  if (currentCategory && categoryHasTasks && !categories.includes(currentCategory)) {
    categories.push(currentCategory)
  }

  return categories
}

// --- Extract trailing content (Recently Completed, Project Stats, etc.) ---
// Everything from the first ## heading after the last ### task heading
export function extractTrailingContent(content: string): string {
  const lines = content.split('\n')
  let lastTaskLine = -1
  const TASK_HEADING_RE = /^###\s+\d+\.\s+.+$/

  // Find last task heading line
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(TASK_HEADING_RE)) {
      lastTaskLine = i
    }
  }

  if (lastTaskLine === -1) return ''

  // Find next ## heading after the last task
  const CATEGORY_RE = /^##\s+/
  for (let i = lastTaskLine + 1; i < lines.length; i++) {
    if (lines[i].match(CATEGORY_RE)) {
      // Include the --- separator before if present
      let startLine = i
      if (startLine > 0 && lines[startLine - 1].trim() === '---') {
        startLine--
      }
      // Also include blank line before --- if present
      if (startLine > 0 && lines[startLine - 1].trim() === '') {
        startLine--
      }
      return '\n' + lines.slice(startLine).join('\n')
    }
  }

  return ''
}

// --- Extract prelude (everything before first task category ## heading) ---
function extractPrelude(content: string): string {
  const lines = content.split('\n')
  const CATEGORY_RE = /^##\s+(.+)$/
  const TASK_HEADING_RE = /^###\s+\d+\.\s+.+$/

  // Find the first ## heading that is followed (eventually) by a ### task heading
  // We need to find category headings that contain tasks
  const categoryLines: number[] = []
  const taskLines: number[] = []

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(CATEGORY_RE)) categoryLines.push(i)
    if (lines[i].match(TASK_HEADING_RE)) taskLines.push(i)
  }

  // First category that precedes a task heading
  for (const catLine of categoryLines) {
    if (taskLines.some(tl => tl > catLine)) {
      return lines.slice(0, catLine).join('\n')
    }
  }

  return content
}

// --- Serialize a single task to markdown ---
export function serializeTask(task: Task): string {
  const lines: string[] = []

  // Heading
  const emojiPrefix = task.emoji ? `${task.emoji} ` : ''
  lines.push(`### ${task.id}. ${emojiPrefix}${task.name}`)

  // Metadata line
  const priorityEmoji = PRIORITY_EMOJIS[task.priority] || '🟡'
  const statusLabel = STATUS_LABELS[task.status] || '✅ Ready'
  lines.push(`**Priority:** ${priorityEmoji} ${task.priority} | **Time:** ${task.timeEstimate} | **Status:** ${statusLabel}`)

  // Optional plan link
  if (task.planLink) {
    lines.push(`**Plan:** [[${task.planLink}]]`)
  }

  // Optional affects
  if (task.affects && task.affects.length > 0) {
    lines.push(`**Affects:** ${task.affects.join(', ')}`)
  }

  // Optional depends
  if (task.depends && task.depends.length > 0) {
    lines.push(`**Depends:** ${task.depends.join(', ')}`)
  }

  // Description
  if (task.description) {
    lines.push('')
    lines.push(task.description)
  }

  return lines.join('\n')
}

// --- Main serializer: reconstruct full file from tasks ---
export function serializeTodoFile(
  originalContent: string,
  tasks: Task[],
  _frontmatter: TodoFrontmatter
): string {
  const prelude = extractPrelude(originalContent)
  const trailing = extractTrailingContent(originalContent)
  const categoryOrder = extractCategoryOrder(originalContent)

  // Group tasks by category, preserving original order
  const tasksByCategory = new Map<string, Task[]>()
  for (const cat of categoryOrder) {
    tasksByCategory.set(cat, [])
  }

  for (const task of tasks) {
    const cat = task.category || 'Uncategorized'
    if (!tasksByCategory.has(cat)) {
      // New category — append after existing ones
      tasksByCategory.set(cat, [])
    }
    tasksByCategory.get(cat)!.push(task)
  }

  // Build task sections
  const sections: string[] = []
  for (const [category, categoryTasks] of tasksByCategory) {
    if (categoryTasks.length === 0) continue

    // Sort tasks by ID within category
    categoryTasks.sort((a, b) => a.id - b.id)

    sections.push(`## ${category}`)
    sections.push('')

    for (let i = 0; i < categoryTasks.length; i++) {
      sections.push(serializeTask(categoryTasks[i]))
      sections.push('')
      sections.push('---')
      sections.push('')
    }
  }

  // Assemble: prelude + task sections + trailing
  let result = prelude
  if (!result.endsWith('\n')) result += '\n'
  result += sections.join('\n')
  result += trailing

  // Ensure file ends with newline
  if (!result.endsWith('\n')) result += '\n'

  return result
}
