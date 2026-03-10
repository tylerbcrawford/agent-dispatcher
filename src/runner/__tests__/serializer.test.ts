// src/runner/__tests__/serializer.test.ts
import { describe, it, expect } from 'vitest'
import { serializeTodoFile, serializeTask, extractCategoryOrder, extractTrailingContent } from '../serializer'
import { parseTodoFile } from '../parser'
import type { Task, TodoFrontmatter } from '../../shared/types'

const SAMPLE_TODO = `---
project: mediaserver
description: Ubuntu media server - 47 Docker services
default-cwd: /home/user/projects/my-vault
claude-md: /home/user/projects/my-vault/CLAUDE.md
---

# Todo — Media Server

**Last Updated:** February 19, 2026 (migrated to standardized v3 format)
**Purpose:** Concise running to-do list for all media server projects
**Status:** Active tracking document

---

## System

### 1. ⚡ Comprehensive Log File Cleaning
**Priority:** 🔴 HIGH | **Time:** 1-2 hrs | **Status:** 📝 Needs Planning

System-wide log cleaning strategy and automation.

---

### 2. ⚡ System Backup Implementation
**Priority:** 🔴 HIGH | **Time:** 2-3 hrs | **Status:** ⏸️ Blocked
**Plan:** [[system-backup/implementation-plan]]

Create bootable system backup with weekly automation.

---

### 3. 📊 API Key & Token Rotation
**Priority:** 🟡 MEDIUM | **Time:** 30-45 min | **Status:** ✅ Ready

Rotate all API keys and tokens.

---

## Automation

### 5. ⚡ Indexer Statistics
**Priority:** 🔴 HIGH | **Time:** 1-2 hrs | **Status:** ✅ Ready
**Plan:** [[04_Archive/prowlarr-indexer-stats]]
**Affects:** prowlarr

Phase 2: Automate stats script.

---

### 6. 📊 Tdarr Workflow
**Priority:** 🟡 MEDIUM | **Time:** 30-60 min | **Status:** 📝 Needs Planning
**Affects:** tdarr, plex

Automated 4K to 1080p workflow.

---

## Recently Completed

- ✅ **Task A** (Feb 5) - Description A
- ✅ **Task B** (Feb 4) - Description B

---

## Project Stats

- **Active Tasks:** 5
- **Completed Tasks:** 10

---

**Next Review:** February 27, 2026
`

const SAMPLE_FRONTMATTER: TodoFrontmatter = {
  project: 'mediaserver',
  description: 'Ubuntu media server - 47 Docker services',
  'default-cwd': '/home/user/projects/my-vault',
  'claude-md': '/home/user/projects/my-vault/CLAUDE.md',
}

describe('extractCategoryOrder', () => {
  it('extracts category names in document order', () => {
    const categories = extractCategoryOrder(SAMPLE_TODO)
    expect(categories).toEqual(['System', 'Automation'])
  })

  it('excludes headings without tasks (Recently Completed, Project Stats)', () => {
    const categories = extractCategoryOrder(SAMPLE_TODO)
    expect(categories).not.toContain('Recently Completed')
    expect(categories).not.toContain('Project Stats')
  })
})

describe('extractTrailingContent', () => {
  it('extracts Recently Completed and everything after', () => {
    const trailing = extractTrailingContent(SAMPLE_TODO)
    expect(trailing).toContain('## Recently Completed')
    expect(trailing).toContain('Task A')
    expect(trailing).toContain('## Project Stats')
    expect(trailing).toContain('Next Review')
  })
})

describe('serializeTask', () => {
  const baseTask: Task = {
    id: 1,
    projectId: 'mediaserver',
    name: 'Test Task',
    emoji: '⚡',
    category: 'System',
    priority: 'HIGH',
    timeEstimate: '1-2 hrs',
    timeMinutes: 60,
    status: 'needs-planning',
    description: 'A test description.',
    planLink: null,
    affects: [],
    depends: [],
    bucket: 'needs-planning',
  }

  it('serializes each status correctly', () => {
    const statuses: Array<[Task['status'], string]> = [
      ['needs-planning', '📝 Needs Planning'],
      ['plan-review', '👁️ Plan Review'],
      ['ready', '✅ Ready'],
      ['in-progress', '🤖 In Progress'],
      ['in-review', '🔍 In Review'],
      ['done', '🏁 Done'],
      ['blocked', '⏸️ Blocked'],
    ]

    for (const [status, label] of statuses) {
      const result = serializeTask({ ...baseTask, status })
      expect(result).toContain(`**Status:** ${label}`)
    }
  })

  it('serializes priority with correct emoji', () => {
    expect(serializeTask({ ...baseTask, priority: 'HIGH' })).toContain('🔴 HIGH')
    expect(serializeTask({ ...baseTask, priority: 'MEDIUM' })).toContain('🟡 MEDIUM')
    expect(serializeTask({ ...baseTask, priority: 'LOW' })).toContain('🟢 LOW')
  })

  it('includes plan link when present', () => {
    const result = serializeTask({ ...baseTask, planLink: 'my-plan' })
    expect(result).toContain('**Plan:** [[my-plan]]')
  })

  it('omits plan link when null', () => {
    const result = serializeTask({ ...baseTask, planLink: null })
    expect(result).not.toContain('**Plan:**')
  })

  it('includes affects when present', () => {
    const result = serializeTask({ ...baseTask, affects: ['sonarr', 'radarr'] })
    expect(result).toContain('**Affects:** sonarr, radarr')
  })

  it('omits affects when empty', () => {
    const result = serializeTask({ ...baseTask, affects: [] })
    expect(result).not.toContain('**Affects:**')
  })

  it('includes depends when present', () => {
    const result = serializeTask({ ...baseTask, depends: [1, 3] })
    expect(result).toContain('**Depends:** 1, 3')
  })

  it('omits depends when empty', () => {
    const result = serializeTask({ ...baseTask, depends: [] })
    expect(result).not.toContain('**Depends:**')
  })
})

describe('serializeTodoFile', () => {
  it('round-trips: parse → serialize → re-parse produces matching tasks', () => {
    const parsed1 = parseTodoFile(SAMPLE_TODO)
    const serialized = serializeTodoFile(SAMPLE_TODO, parsed1.tasks, parsed1.frontmatter)
    const parsed2 = parseTodoFile(serialized)

    expect(parsed2.tasks.length).toBe(parsed1.tasks.length)

    for (let i = 0; i < parsed1.tasks.length; i++) {
      const t1 = parsed1.tasks[i]
      const t2 = parsed2.tasks[i]
      expect(t2.id).toBe(t1.id)
      expect(t2.name).toBe(t1.name)
      expect(t2.emoji).toBe(t1.emoji)
      expect(t2.category).toBe(t1.category)
      expect(t2.priority).toBe(t1.priority)
      expect(t2.timeEstimate).toBe(t1.timeEstimate)
      expect(t2.status).toBe(t1.status)
      expect(t2.planLink).toBe(t1.planLink)
      expect(t2.affects).toEqual(t1.affects)
      expect(t2.depends).toEqual(t1.depends)
      expect(t2.bucket).toBe(t1.bucket)
    }
  })

  it('preserves frontmatter verbatim', () => {
    const parsed = parseTodoFile(SAMPLE_TODO)
    const serialized = serializeTodoFile(SAMPLE_TODO, parsed.tasks, parsed.frontmatter)

    expect(serialized).toContain('---\nproject: mediaserver')
    expect(serialized).toContain('description: Ubuntu media server - 47 Docker services')
    expect(serialized).toContain('default-cwd: /home/user/projects/my-vault')
  })

  it('preserves trailing content (Recently Completed, Project Stats)', () => {
    const parsed = parseTodoFile(SAMPLE_TODO)
    const serialized = serializeTodoFile(SAMPLE_TODO, parsed.tasks, parsed.frontmatter)

    expect(serialized).toContain('## Recently Completed')
    expect(serialized).toContain('Task A')
    expect(serialized).toContain('Task B')
    expect(serialized).toContain('## Project Stats')
    expect(serialized).toContain('Next Review')
  })

  it('reflects new task in correct category after serialize → re-parse', () => {
    const parsed = parseTodoFile(SAMPLE_TODO)
    const newTask: Task = {
      id: 10,
      projectId: 'mediaserver',
      name: 'New Test Task',
      emoji: '🆕',
      category: 'System',
      priority: 'LOW',
      timeEstimate: '15 min',
      timeMinutes: 15,
      status: 'ready',
      description: 'A brand new task.',
      planLink: null,
      affects: [],
      depends: [],
      bucket: 'ready',
    }

    const allTasks = [...parsed.tasks, newTask]
    const serialized = serializeTodoFile(SAMPLE_TODO, allTasks, parsed.frontmatter)
    const reparsed = parseTodoFile(serialized)

    const found = reparsed.tasks.find(t => t.id === 10)
    expect(found).toBeDefined()
    expect(found!.name).toBe('New Test Task')
    expect(found!.category).toBe('System')
    expect(found!.priority).toBe('LOW')
    expect(found!.status).toBe('ready')
  })

  it('reflects deleted task: absent from output, other IDs unchanged', () => {
    const parsed = parseTodoFile(SAMPLE_TODO)
    const remaining = parsed.tasks.filter(t => t.id !== 3)
    const serialized = serializeTodoFile(SAMPLE_TODO, remaining, parsed.frontmatter)
    const reparsed = parseTodoFile(serialized)

    expect(reparsed.tasks.find(t => t.id === 3)).toBeUndefined()
    expect(reparsed.tasks.find(t => t.id === 1)).toBeDefined()
    expect(reparsed.tasks.find(t => t.id === 2)).toBeDefined()
    expect(reparsed.tasks.find(t => t.id === 5)).toBeDefined()
  })

  it('reflects updated fields after serialize → re-parse', () => {
    const parsed = parseTodoFile(SAMPLE_TODO)
    const updated = parsed.tasks.map(t =>
      t.id === 1 ? { ...t, priority: 'LOW' as const, status: 'ready' as const, bucket: 'ready' as const } : t
    )
    const serialized = serializeTodoFile(SAMPLE_TODO, updated, parsed.frontmatter)
    const reparsed = parseTodoFile(serialized)

    const task1 = reparsed.tasks.find(t => t.id === 1)
    expect(task1!.priority).toBe('LOW')
    expect(task1!.status).toBe('ready')
  })

  it('appends new category after existing categories', () => {
    const parsed = parseTodoFile(SAMPLE_TODO)
    const newTask: Task = {
      id: 20,
      projectId: 'mediaserver',
      name: 'Brand New Category Task',
      emoji: '🆕',
      category: 'New Category',
      priority: 'MEDIUM',
      timeEstimate: '1 hr',
      timeMinutes: 60,
      status: 'ready',
      description: 'Task in a new category.',
      planLink: null,
      affects: [],
      depends: [],
      bucket: 'ready',
    }

    const allTasks = [...parsed.tasks, newTask]
    const serialized = serializeTodoFile(SAMPLE_TODO, allTasks, parsed.frontmatter)

    // New category should appear after existing ones but before trailing
    const automationPos = serialized.indexOf('## Automation')
    const newCatPos = serialized.indexOf('## New Category')
    const recentlyPos = serialized.indexOf('## Recently Completed')

    expect(newCatPos).toBeGreaterThan(automationPos)
    expect(newCatPos).toBeLessThan(recentlyPos)
  })

  it('preserves category order from original document', () => {
    const parsed = parseTodoFile(SAMPLE_TODO)
    const serialized = serializeTodoFile(SAMPLE_TODO, parsed.tasks, parsed.frontmatter)

    const systemPos = serialized.indexOf('## System')
    const automationPos = serialized.indexOf('## Automation')

    expect(systemPos).toBeLessThan(automationPos)
  })

  it('handles tasks with all optional fields populated', () => {
    const parsed = parseTodoFile(SAMPLE_TODO)
    const taskWithAll: Task = {
      id: 30,
      projectId: 'mediaserver',
      name: 'Full Featured Task',
      emoji: '🎯',
      category: 'System',
      priority: 'HIGH',
      timeEstimate: '2-3 hrs',
      timeMinutes: 120,
      status: 'ready',
      description: 'A fully featured task with all fields.',
      planLink: 'some/plan-file',
      affects: ['sonarr', 'radarr'],
      depends: [1, 2],
      bucket: 'ready',
    }

    const allTasks = [...parsed.tasks, taskWithAll]
    const serialized = serializeTodoFile(SAMPLE_TODO, allTasks, parsed.frontmatter)
    const reparsed = parseTodoFile(serialized)

    const found = reparsed.tasks.find(t => t.id === 30)
    expect(found).toBeDefined()
    expect(found!.planLink).toBe('some/plan-file')
    expect(found!.affects).toEqual(['sonarr', 'radarr'])
    expect(found!.depends).toEqual([1, 2])
    expect(found!.status).toBe('ready')
  })

  it('handles tasks with no optional fields', () => {
    const parsed = parseTodoFile(SAMPLE_TODO)
    const minimalTask: Task = {
      id: 31,
      projectId: 'mediaserver',
      name: 'Minimal Task',
      emoji: '📌',
      category: 'System',
      priority: 'MEDIUM',
      timeEstimate: '30 min',
      timeMinutes: 30,
      status: 'ready',
      description: 'Just a basic task.',
      planLink: null,
      affects: [],
      depends: [],
      bucket: 'ready',
    }

    const allTasks = [...parsed.tasks, minimalTask]
    const serialized = serializeTodoFile(SAMPLE_TODO, allTasks, parsed.frontmatter)

    // Should NOT contain plan/affects/depends for this task
    const taskSection = serialized.split('### 31.')[1]?.split('###')[0] ?? ''
    expect(taskSection).not.toContain('**Plan:**')
    expect(taskSection).not.toContain('**Affects:**')
    expect(taskSection).not.toContain('**Depends:**')
  })
})
