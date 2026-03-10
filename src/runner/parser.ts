// src/runner/parser.ts
import { parse as parseYaml } from 'yaml'
import type { Task, TaskStatus, Priority, Bucket, TodoFrontmatter } from '../shared/types.js'

// --- Regex patterns ---
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/
const CATEGORY_RE = /^##\s+(.+)$/
const TASK_HEADING_RE = /^###\s+(\d+)\.\s+(?:([^\x00-\x7F]\S*)\s+)?(.+)$/
const META_RE = /\*\*Priority:\*\*\s*(\S+)\s+\w+\s*\|\s*\*\*Time:\*\*\s*(.+?)\s*\|\s*\*\*Status:\*\*\s*(.+)/
const PLAN_RE = /\*\*Plan:\*\*\s*(?:`([^`]+)`|\[\[([^\]]+)\]\])/
const AFFECTS_RE = /\*\*Affects:\*\*\s*(.+)/i
const DEPENDS_RE = /\*\*Depends:\*\*\s*(.+)/i

// --- Priority mapping ---
const PRIORITY_MAP: Record<string, Priority> = {
  '🔴': 'HIGH',
  '🟡': 'MEDIUM',
  '🟢': 'LOW',
}

// --- Status mapping ---
export function parseStatus(raw: string): TaskStatus {
  const s = raw.trim()
  if (s.startsWith('📝')) return 'needs-planning'
  if (s.startsWith('👁️')) return 'plan-review'
  if (s.startsWith('🤖')) return 'in-progress'
  if (s.startsWith('🔍')) return 'in-review'
  if (s.startsWith('⏸️')) return 'blocked'
  if (s.startsWith('🖐️')) return 'manual'
  if (s.startsWith('🏁')) return 'done'
  // ✅ — check label text for Done vs Ready
  if (s.includes('Done')) return 'done'
  if (s.startsWith('✅')) return 'ready'
  // Backward compat: 📋 Planned → ready (plan-ready was merged into ready)
  if (s.startsWith('📋')) return 'ready'
  // Fallback: treat 🔧 (in-progress work) as ready
  if (s.startsWith('🔧')) return 'ready'
  return 'ready'
}

// --- Time parsing ---
export function parseTimeMinutes(raw: string): number {
  // "2-3 hrs" → 120, "30-45 min" → 30, "30 min" → 30, "1 hr" → 60
  const rangeHrs = raw.match(/(\d+)(?:\s*-\s*\d+)?\s*hrs?/i)
  if (rangeHrs) return parseInt(rangeHrs[1], 10) * 60

  const rangeMins = raw.match(/(\d+)(?:\s*-\s*\d+)?\s*min/i)
  if (rangeMins) return parseInt(rangeMins[1], 10)

  return 30 // default fallback
}

// --- Bucket derivation ---
export function deriveTaskBucket(status: TaskStatus, _timeMinutes: number): Bucket {
  switch (status) {
    case 'in-progress': return 'running'
    case 'plan-review':
    case 'in-review': return 'review'
    case 'ready': return 'ready'
    case 'needs-planning': return 'needs-planning'
    case 'blocked': return 'blocked'
    case 'manual': return 'manual'
    case 'done': return 'done'
  }
}

// --- Main parser ---
export interface ParsedTodo {
  frontmatter: TodoFrontmatter
  tasks: Task[]
}

export function parseTodoFile(content: string): ParsedTodo {
  // Extract frontmatter
  const fmMatch = content.match(FRONTMATTER_RE)
  const frontmatter: TodoFrontmatter = fmMatch
    ? parseYaml(fmMatch[1])
    : { project: 'unknown', description: '', 'default-cwd': '', 'claude-md': '' }

  const projectId = frontmatter.project
  const lines = content.split('\n')
  const tasks: Task[] = []
  let currentCategory = ''
  let currentTask: Partial<Task> | null = null
  let descriptionLines: string[] = []

  for (const line of lines) {
    // Track category from ## headings
    const catMatch = line.match(CATEGORY_RE)
    if (catMatch) {
      if (currentTask) {
        finishTask(currentTask, descriptionLines, projectId, tasks)
        currentTask = null
      }
      // Strip emoji and parenthetical from category
      currentCategory = catMatch[1]
        .replace(/^[\p{Emoji}\p{Emoji_Presentation}\s]+/u, '')
        .replace(/\s*\(.*\)\s*$/, '')
        .trim()
      continue
    }

    // Parse task heading: "### 1. 📦 API Key & Token Rotation"
    const headingMatch = line.match(TASK_HEADING_RE)
    if (headingMatch) {
      if (currentTask) {
        finishTask(currentTask, descriptionLines, projectId, tasks)
      }
      currentTask = {
        id: parseInt(headingMatch[1], 10),
        emoji: headingMatch[2] ?? '',
        name: headingMatch[3].trim(),
        category: currentCategory,
        affects: [],
        depends: [],
        planLink: null,
      }
      descriptionLines = []
      continue
    }

    if (!currentTask) continue

    // Parse metadata line
    const metaMatch = line.match(META_RE)
    if (metaMatch) {
      currentTask.priority = PRIORITY_MAP[metaMatch[1]] || 'MEDIUM'
      currentTask.timeEstimate = metaMatch[2].trim()
      currentTask.timeMinutes = parseTimeMinutes(currentTask.timeEstimate)
      const rawStatus = metaMatch[3].trim()
      currentTask.status = parseStatus(rawStatus)
      continue
    }

    // Parse plan link
    const planMatch = line.match(PLAN_RE)
    if (planMatch) {
      currentTask.planLink = planMatch[1] || planMatch[2]
      continue
    }

    // Parse affects
    const affectsMatch = line.match(AFFECTS_RE)
    if (affectsMatch) {
      currentTask.affects = affectsMatch[1].split(',').map(s => s.trim().toLowerCase())
      continue
    }

    // Parse depends
    const dependsMatch = line.match(DEPENDS_RE)
    if (dependsMatch) {
      currentTask.depends = dependsMatch[1]
        .split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n))
      continue
    }

    // Collect description (skip empty lines, ---, metadata lines, table rows)
    if (line.trim() && line.trim() !== '---' && !line.startsWith('**') && !line.startsWith('|') && !line.startsWith('#')) {
      descriptionLines.push(line.trim())
    }
  }

  // Finish last task
  if (currentTask) {
    finishTask(currentTask, descriptionLines, projectId, tasks)
  }

  return { frontmatter, tasks }
}

function finishTask(partial: Partial<Task>, descLines: string[], projectId: string, tasks: Task[]) {
  if (partial.id === undefined || !partial.name) return

  const status = (partial.status as TaskStatus) || 'ready'
  const timeMinutes = partial.timeMinutes || 30
  const bucket = deriveTaskBucket(status, timeMinutes)

  tasks.push({
    id: partial.id,
    projectId,
    name: partial.name,
    emoji: partial.emoji || '',
    category: partial.category || 'Uncategorized',
    priority: (partial.priority as Priority) || 'MEDIUM',
    timeEstimate: partial.timeEstimate || '',
    timeMinutes,
    status,
    description: descLines.join(' '),
    planLink: partial.planLink || null,
    affects: partial.affects || [],
    depends: partial.depends || [],
    bucket,
  })
}
