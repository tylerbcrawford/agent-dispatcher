// src/runner/plan-resolver.ts
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, basename } from 'path'

/**
 * Resolve an Obsidian wiki-link target to file content.
 * Resolution order:
 * 1. Direct: ${vaultPath}/${link}.md
 * 2. Project-scoped: ${projectFolder}/${link}.md
 * 3. Recursive search in vault, preferring matches under projectFolder
 */
export function resolvePlanLink(
  link: string,
  vaultPath: string,
  projectFolder: string,
): string | null {
  const directPath = join(vaultPath, `${link}.md`)
  if (existsSync(directPath)) return readFileSync(directPath, 'utf-8')

  if (projectFolder) {
    const projectPath = join(projectFolder, `${link}.md`)
    if (existsSync(projectPath)) return readFileSync(projectPath, 'utf-8')
  }

  const target = `${basename(link)}.md`
  const matches = findFilesRecursive(vaultPath, target)
  if (matches.length === 0) return null

  if (projectFolder) {
    const projectMatch = matches.find(m => m.startsWith(projectFolder))
    if (projectMatch) return readFileSync(projectMatch, 'utf-8')
  }

  return readFileSync(matches[0], 'utf-8')
}

/**
 * Cheap existence check for a task's plan file — direct existsSync only, no recursive walk.
 * Mirrors resolvePlanLink's direct paths PLUS the conventional `plans/` subfolder
 * (projects/<project>/plans/<name>-plan.md).
 * Returns false when the task has no explicit **Plan:** link (planLink === null).
 */
export function planExists(planLink: string | null, vaultPath: string, projectFolder: string): boolean {
  if (!planLink) return false
  const candidates = [
    join(vaultPath, `${planLink}.md`),
    projectFolder ? join(projectFolder, `${planLink}.md`) : null,
    projectFolder ? join(projectFolder, 'plans', `${planLink}.md`) : null,
    join(vaultPath, 'plans', `${planLink}.md`),
  ].filter((p): p is string => p !== null)
  return candidates.some(p => existsSync(p))
}

function findFilesRecursive(dir: string, targetName: string): string[] {
  const results: string[] = []
  const walk = (current: string) => {
    let entries: string[]
    try { entries = readdirSync(current) } catch { return }
    for (const entry of entries) {
      if (entry.startsWith('.')) continue
      const fullPath = join(current, entry)
      try {
        if (statSync(fullPath).isDirectory()) walk(fullPath)
        else if (entry === targetName) results.push(fullPath)
      } catch { /* broken symlink or race */ }
    }
  }
  walk(dir)
  return results
}
