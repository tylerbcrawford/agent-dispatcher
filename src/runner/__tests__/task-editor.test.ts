import { describe, it, expect } from 'vitest'
import { updateTaskInContent, removeTaskFromContent, insertTaskIntoContent } from '../task-editor.js'
import { parseTodoFile } from '../parser.js'
import type { Task } from '../../shared/types.js'

// A task block carrying exactly the kinds of content the lossy serializer drops:
// a **Source:** line, a **Result:** block, a multi-paragraph description, and a table.
const RICH = `---
project: example
description: test
default-cwd: /x
claude-md: /x
---

# Todo — Weekly

> Some prelude note.

---

## Deep Work

### 3. 🚀 Implement Rate Limiter
**Priority:** 🟡 MEDIUM | **Time:** ~30–45 min | **Status:** ✅ Ready | **Score:** 72
**Source:** [[notes/design-doc|doc]]

Add sliding-window rate limiter to all API routes. Use Redis for distributed counting across instances.

**Result (2024-01-15):** All acceptance criteria met. Sliding window confirmed across both instances.

| Instance | Window |
|---|---|
| api-01 | 60s |
| api-02 | 60s |

---

### 4. 🔧 Cache Warming Job
**Priority:** 🟡 MEDIUM | **Time:** ~20–30 min | **Status:** ✅ Ready

Pre-populate the read cache on service startup. Run the warm-up script and verify the cache hit rate metric.

---
`

describe('updateTaskInContent — surgical, non-lossy', () => {
  it('changes ONLY the status token, preserving Source/Result/table/description and other tasks', () => {
    const result = updateTaskInContent(RICH, 3, { status: 'done' })
    const expected = RICH.replace(
      '**Priority:** 🟡 MEDIUM | **Time:** ~30–45 min | **Status:** ✅ Ready | **Score:** 72',
      '**Priority:** 🟡 MEDIUM | **Time:** ~30–45 min | **Status:** 🏁 Done | **Score:** 72',
    )
    expect(result).toBe(expected)
  })

  it('updates a meta line that has no Score field, leaving the rest byte-identical', () => {
    const result = updateTaskInContent(RICH, 4, { status: 'done' })
    const expected = RICH.replace(
      '**Priority:** 🟡 MEDIUM | **Time:** ~20–30 min | **Status:** ✅ Ready',
      '**Priority:** 🟡 MEDIUM | **Time:** ~20–30 min | **Status:** 🏁 Done',
    )
    expect(result).toBe(expected)
  })

  it('updates score in place without touching status or body', () => {
    const result = updateTaskInContent(RICH, 3, { score: 90 })
    const expected = RICH.replace('**Status:** ✅ Ready | **Score:** 72', '**Status:** ✅ Ready | **Score:** 90')
    expect(result).toBe(expected)
  })

  it('returns content unchanged when the task id is not found', () => {
    expect(updateTaskInContent(RICH, 999, { status: 'done' })).toBe(RICH)
  })

  it('does not corrupt task 4 when editing task 3 (no bleed across block boundary)', () => {
    const result = updateTaskInContent(RICH, 3, { status: 'done' })
    expect(result).toContain('### 4. 🔧 Cache Warming Job\n**Priority:** 🟡 MEDIUM | **Time:** ~20–30 min | **Status:** ✅ Ready')
  })

  it('changes only the priority token (emoji + word), body intact', () => {
    const result = updateTaskInContent(RICH, 3, { priority: 'HIGH' })
    const expected = RICH.replace(
      '**Priority:** 🟡 MEDIUM | **Time:** ~30–45 min | **Status:** ✅ Ready | **Score:** 72',
      '**Priority:** 🔴 HIGH | **Time:** ~30–45 min | **Status:** ✅ Ready | **Score:** 72',
    )
    expect(result).toBe(expected)
  })

  it('rewrites the heading name + emoji while preserving the body', () => {
    const result = updateTaskInContent(RICH, 3, { name: 'Rate Limiter (DONE)', emoji: '🔧' })
    const expected = RICH.replace(
      '### 3. 🚀 Implement Rate Limiter',
      '### 3. 🔧 Rate Limiter (DONE)',
    )
    expect(result).toBe(expected)
  })

  it('inserts a Plan line right after the meta line when none exists', () => {
    const result = updateTaskInContent(RICH, 3, { planLink: 'example-service/implementation-plan' })
    const expected = RICH.replace(
      '**Priority:** 🟡 MEDIUM | **Time:** ~30–45 min | **Status:** ✅ Ready | **Score:** 72',
      '**Priority:** 🟡 MEDIUM | **Time:** ~30–45 min | **Status:** ✅ Ready | **Score:** 72\n**Plan:** [[example-service/implementation-plan]]',
    )
    expect(result).toBe(expected)
  })
})

describe('removeTaskFromContent — surgical', () => {
  it('removes the whole task block, leaving siblings and rich content byte-intact', () => {
    const result = removeTaskFromContent(RICH, 3)
    const expected = RICH.slice(0, RICH.indexOf('### 3.')) + RICH.slice(RICH.indexOf('### 4.'))
    expect(result).toBe(expected)
  })

  it('is a no-op for an unknown id', () => {
    expect(removeTaskFromContent(RICH, 999)).toBe(RICH)
  })
})

describe('insertTaskIntoContent — surgical', () => {
  const newTask: Task = {
    id: 5, projectId: 'example', name: 'New Task', emoji: '🆕', category: 'Deep Work',
    priority: 'MEDIUM', timeEstimate: '30 min', timeMinutes: 30, status: 'ready',
    description: 'Do the thing.', planLink: null, affects: [], depends: [], bucket: 'ready', score: null,
  }

  it('appends a new task without disturbing existing tasks or their rich content', () => {
    const result = insertTaskIntoContent(RICH, newTask)
    // Existing rich content (which the old serializer would have destroyed) is preserved:
    expect(result).toContain('**Source:** [[notes/design-doc|doc]]')
    expect(result).toContain('**Result (2024-01-15):** All acceptance criteria met.')
    expect(result).toContain('| api-01 | 60s |')
    expect(result).toContain('### 4. 🔧 Cache Warming Job')
    // New task is present and round-trips through the parser with the right fields/category:
    expect(result).toContain('### 5. 🆕 New Task')
    const reparsed = parseTodoFile(result).tasks.find(t => t.id === 5)
    expect(reparsed?.name).toBe('New Task')
    expect(reparsed?.status).toBe('ready')
    expect(reparsed?.category).toBe('Deep Work')
  })
})
