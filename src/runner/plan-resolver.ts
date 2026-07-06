// src/runner/plan-resolver.ts
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, basename, resolve, relative, isAbsolute } from 'path'

/**
 * True when `target` resolves inside `root`. A plan link comes over the wire, so a
 * value like `../../etc/passwd` would otherwise let `join(root, link)` escape the
 * vault. Rejects `..`-escapes and absolute paths outside root.
 */
function isWithin(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** Read a candidate file only if it is contained within `root`. */
function readIfContained(root: string, filePath: string): string | null {
  if (!isWithin(root, filePath)) return null
  return existsSync(filePath) ? readFileSync(filePath, 'utf-8') : null
}

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
  const direct = readIfContained(vaultPath, join(vaultPath, `${link}.md`))
  if (direct !== null) return direct

  if (projectFolder) {
    const scoped = readIfContained(projectFolder, join(projectFolder, `${link}.md`))
    if (scoped !== null) return scoped
  }

  // Recursive search keys on the basename only (path components in `link` are
  // dropped by basename), so matches are always real files found under vaultPath.
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
