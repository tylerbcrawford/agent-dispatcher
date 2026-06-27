// src/runner/watcher.ts
// File watcher for todo files — detects new projects and reloads on changes.
// Watches the projects directory (depth 3) and filters for todo-*.md files.
// Chokidar v5 doesn't support glob patterns — we use directory watching + ignored filter.

import { watch, type FSWatcher } from 'chokidar'
import { readFileSync } from 'fs'
import { basename } from 'path'
import type { ProjectRegistry } from '../shared/types.js'
import { saveProjectRegistry } from './config.js'

let watcher: FSWatcher | null = null

interface WatcherOptions {
  vaultPath: string
  registry: ProjectRegistry
  onTasksChanged: (filePath: string) => void
  onProjectAdded: (registry: ProjectRegistry) => void
}

export function startWatcher(opts: WatcherOptions) {
  const projectsDir = `${opts.vaultPath}/projects`

  watcher = watch(projectsDir, {
    persistent: true,
    ignoreInitial: false,
    depth: 3,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    ignored: (path: string, stats) => {
      // Allow directories (needed for traversal)
      if (!stats || stats.isDirectory()) return false
      // Only pass through todo-*.md files, skip example files
      const name = basename(path)
      if (name === 'todo-example.md') return true
      return !name.startsWith('todo-') || !name.endsWith('.md')
    },
  })

  watcher.on('add', (filePath: string) => {
    const projectId = extractProjectId(filePath)
    if (!projectId) return
    const exists = opts.registry.projects.some(p => p.id === projectId)
    if (!exists) {
      autoRegister(filePath, projectId, opts)
    }
  })

  watcher.on('change', (filePath: string) => {
    opts.onTasksChanged(filePath)
  })

  console.log(`Watching todo files in: ${projectsDir}`)
}

function extractProjectId(filePath: string): string | null {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const match = content.match(/^---\n[\s\S]*?^project:\s*(.+)$/m)
    const id = match?.[1]?.trim() ?? null
    // Skip template placeholders
    if (!id || id === 'project-id') return null
    return id
  } catch { return null }
}

function autoRegister(filePath: string, projectId: string, opts: WatcherOptions) {
  // Derive display name from project ID
  const words = projectId.split('-')
  // Short single-word IDs (e.g. api, web, docs) are likely abbreviations — use all-caps
  const name = words.length === 1 && words[0].length <= 5
    ? words[0].toUpperCase()
    : words.map(w => w[0].toUpperCase() + w.slice(1)).join(' ')

  opts.registry.projects.push({
    id: projectId,
    name,
    todoFile: filePath,
    icon: '📋',
    active: true,
    weight: 50,
    weightReason: '',
  })

  saveProjectRegistry(opts.registry)
  opts.onProjectAdded(opts.registry)
  console.log(`Auto-registered project: ${projectId} (${filePath})`)
}

export function stopWatcher() {
  if (watcher) { watcher.close(); watcher = null }
}
