import { describe, it, expect } from 'vitest'
import { parseTodoFile, parseTimeMinutes, deriveTaskBucket, parseStatus } from '../parser.js'

const SAMPLE_TODO = `---
project: example
description: Ubuntu media server - 47 Docker services
default-cwd: /path/to/vault
claude-md: /path/to/vault/CLAUDE.md
---

# Todo - Example Project

## Infrastructure

### 1. 📦 API Key & Token Rotation
**Priority:** 🔴 HIGH | **Time:** 30 min | **Status:** ✅ Ready

Rotate all API keys and tokens for media server services.

### 2. ⚡ System Backup Implementation
**Priority:** 🟡 MEDIUM | **Time:** 2-3 hrs | **Status:** 📝 Needs Planning
**Plan:** [[system-backup-plan]]
**Affects:** docker

Create bootable system backup with weekly automation.

## Automation

### 3. 📊 PDF Quarantine Notification
**Priority:** 🟢 LOW | **Time:** 15 min | **Status:** ✅ Ready
**Affects:** auth, database
**Depends:** 1

GDrive upload + EPUB sync already running in production.

### 4. 🔧 Log Rotation Cleanup
**Priority:** 🟡 MEDIUM | **Time:** 20 min | **Status:** ⏸️ Blocked

Waiting on disk upgrade to implement log rotation.
`

describe('parseTodoFile', () => {
  it('extracts frontmatter metadata', () => {
    const result = parseTodoFile(SAMPLE_TODO)
    expect(result.frontmatter.project).toBe('example')
    expect(result.frontmatter.description).toContain('47 Docker')
    expect(result.frontmatter['default-cwd']).toBe('/path/to/vault')
  })

  it('parses tasks with sequential numeric IDs', () => {
    const { tasks } = parseTodoFile(SAMPLE_TODO)
    expect(tasks).toHaveLength(4)
    expect(tasks[0].id).toBe(1)
    expect(tasks[1].id).toBe(2)
    expect(tasks[2].id).toBe(3)
    expect(tasks[3].id).toBe(4)
  })

  it('extracts task fields correctly', () => {
    const { tasks } = parseTodoFile(SAMPLE_TODO)
    const t1 = tasks[0]
    expect(t1.name).toBe('API Key & Token Rotation')
    expect(t1.emoji).toBe('📦')
    expect(t1.priority).toBe('HIGH')
    expect(t1.timeEstimate).toBe('30 min')
    expect(t1.status).toBe('ready')
    expect(t1.category).toBe('Infrastructure')
    expect(t1.description).toContain('Rotate all API keys')
  })

  it('extracts plan links', () => {
    const { tasks } = parseTodoFile(SAMPLE_TODO)
    expect(tasks[1].planLink).toBe('system-backup-plan')
    expect(tasks[0].planLink).toBeNull()
  })

  it('extracts affects tags', () => {
    const { tasks } = parseTodoFile(SAMPLE_TODO)
    expect(tasks[1].affects).toEqual(['docker'])
    expect(tasks[2].affects).toEqual(['auth', 'database'])
    expect(tasks[0].affects).toEqual([])
  })

  it('extracts depends references', () => {
    const { tasks } = parseTodoFile(SAMPLE_TODO)
    expect(tasks[2].depends).toEqual([1])
    expect(tasks[0].depends).toEqual([])
  })

  it('maps categories from parent ## headings', () => {
    const { tasks } = parseTodoFile(SAMPLE_TODO)
    expect(tasks[0].category).toBe('Infrastructure')
    expect(tasks[1].category).toBe('Infrastructure')
    expect(tasks[2].category).toBe('Automation')
    expect(tasks[3].category).toBe('Automation')
  })

  it('sets projectId from frontmatter', () => {
    const { tasks } = parseTodoFile(SAMPLE_TODO)
    expect(tasks[0].projectId).toBe('example')
  })
})

describe('parseTimeMinutes', () => {
  it('parses simple minutes', () => {
    expect(parseTimeMinutes('30 min')).toBe(30)
    expect(parseTimeMinutes('15 min')).toBe(15)
  })

  it('parses hour ranges (uses lower bound)', () => {
    expect(parseTimeMinutes('2-3 hrs')).toBe(120)
    expect(parseTimeMinutes('1-2 hrs')).toBe(60)
  })

  it('parses minute ranges (uses lower bound)', () => {
    expect(parseTimeMinutes('30-45 min')).toBe(30)
    expect(parseTimeMinutes('15-20 min')).toBe(15)
  })
})

describe('deriveTaskBucket', () => {
  it('in-progress maps to running bucket', () => {
    expect(deriveTaskBucket('in-progress', 30)).toBe('running')
  })

  it('plan-review and in-review map to review bucket', () => {
    expect(deriveTaskBucket('plan-review', 60)).toBe('review')
    expect(deriveTaskBucket('in-review', 60)).toBe('review')
  })

  it('ready status maps to ready bucket', () => {
    expect(deriveTaskBucket('ready', 15)).toBe('ready')
    expect(deriveTaskBucket('ready', 120)).toBe('ready')
  })

  it('needs-planning maps to needs-planning bucket', () => {
    expect(deriveTaskBucket('needs-planning', 30)).toBe('needs-planning')
  })

  it('blocked status maps to blocked bucket', () => {
    expect(deriveTaskBucket('blocked', 10)).toBe('blocked')
  })

  it('done status maps to done bucket', () => {
    expect(deriveTaskBucket('done', 10)).toBe('done')
    expect(deriveTaskBucket('done', 120)).toBe('done')
  })
})

describe('parseStatus', () => {
  it('maps emoji status strings to TaskStatus', () => {
    expect(parseStatus('📝 Needs Planning')).toBe('needs-planning')
    expect(parseStatus('👁️ Plan Review')).toBe('plan-review')
    expect(parseStatus('✅ Ready')).toBe('ready')
    expect(parseStatus('📋 Planned')).toBe('ready')   // plan-ready merged into ready
    expect(parseStatus('🏁 Done')).toBe('done')
    expect(parseStatus('🤖 In Progress')).toBe('in-progress')
    expect(parseStatus('🔍 In Review')).toBe('in-review')
    expect(parseStatus('✅ Done')).toBe('done')
    expect(parseStatus('⏸️ Blocked')).toBe('blocked')
  })

  it('handles partial matches and extra text', () => {
    expect(parseStatus('✅ Unblocked (prerequisites complete)')).toBe('ready')
    expect(parseStatus('📝 Awaiting 1TB drive')).toBe('needs-planning')
    expect(parseStatus('🔧 Core working — notification remaining')).toBe('ready')
  })

  it('reads the weekly-synthesis "✅ DONE (date)" convention as done (case-insensitive)', () => {
    expect(parseStatus('✅ DONE (May 30)')).toBe('done')
    expect(parseStatus('✅ DONE')).toBe('done')
    expect(parseStatus('✅ done')).toBe('done')
  })
})
