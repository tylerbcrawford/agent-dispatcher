// src/runner/git.ts
// Per-run diff support. Rather than switching the working tree onto an agent
// branch (which would disrupt a shared checkout — e.g. a vault synced by another
// process), each run is anchored to the commit that was HEAD when it started.
// The diff is then base-commit -> current working tree, capturing everything the
// agent changed (committed or not) without ever moving the user's branch.
//
// All git calls use execFileSync with an argv array (never a shell string), so
// nothing is interpolated into a shell.
import { execFileSync } from 'child_process'

export function isGitRepo(cwd: string): boolean {
  try {
    execFileSync('git', ['-C', cwd, 'rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/** The commit HEAD points at right now, or null if `cwd` is not a git work tree. */
export function captureBaseCommit(cwd: string): string | null {
  try {
    const sha = execFileSync('git', ['-C', cwd, 'rev-parse', 'HEAD'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return sha || null
  } catch {
    return null
  }
}

/** Short (7-char) form of a commit sha for display. */
export function shortSha(sha: string): string {
  return sha.slice(0, 7)
}

/**
 * Unified diff of everything changed since `baseCommit` — `git diff <base>`
 * compares the base commit against the current working tree, so it includes both
 * the agent's commits and any uncommitted edits to tracked files. Throws on a bad
 * base or a non-repo; callers surface that as a diff error.
 */
export function runDiff(cwd: string, baseCommit: string): string {
  return execFileSync('git', ['-C', cwd, 'diff', baseCommit], {
    encoding: 'utf-8',
    timeout: 10_000,
    maxBuffer: 5 * 1024 * 1024,
  })
}
