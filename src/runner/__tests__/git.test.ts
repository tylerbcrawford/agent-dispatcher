import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { isGitRepo, captureBaseCommit, runDiff, shortSha } from '../git.js'

// Run every git command with a throwaway identity so commits work in CI, where
// no global user.name/email is configured.
const ID = ['-c', 'user.email=t@t.t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false']
function git(cwd: string, ...args: string[]) {
  return execFileSync('git', ['-C', cwd, ...ID, ...args], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
}

describe('git per-run diff helpers', () => {
  let repo: string
  let nonRepo: string

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'ad-git-'))
    nonRepo = mkdtempSync(join(tmpdir(), 'ad-plain-'))
    git(repo, 'init', '-q', '-b', 'main')
    writeFileSync(join(repo, 'a.txt'), 'one\n')
    git(repo, 'add', 'a.txt')
    git(repo, 'commit', '-q', '-m', 'base')
  })

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
    rmSync(nonRepo, { recursive: true, force: true })
  })

  it('detects repos and non-repos', () => {
    expect(isGitRepo(repo)).toBe(true)
    expect(isGitRepo(nonRepo)).toBe(false)
    expect(isGitRepo(join(repo, 'does-not-exist'))).toBe(false)
  })

  it('captures the current HEAD, and null outside a repo', () => {
    const base = captureBaseCommit(repo)
    expect(base).toMatch(/^[0-9a-f]{40}$/)
    expect(captureBaseCommit(nonRepo)).toBeNull()
    expect(shortSha(base!)).toHaveLength(7)
  })

  it('diffs uncommitted edits against the captured base', () => {
    const base = captureBaseCommit(repo)!
    writeFileSync(join(repo, 'a.txt'), 'one\ntwo\n') // edit, do NOT commit
    const raw = runDiff(repo, base)
    expect(raw).toContain('a.txt')
    expect(raw).toContain('+two')
  })

  it('spans commits made after the base (base -> working tree)', () => {
    const base = captureBaseCommit(repo)!
    writeFileSync(join(repo, 'b.txt'), 'new file\n')
    git(repo, 'add', 'b.txt')
    git(repo, 'commit', '-q', '-m', 'agent commit')
    writeFileSync(join(repo, 'a.txt'), 'one\nedited\n') // + an uncommitted edit
    const raw = runDiff(repo, base)
    // committed new file AND the later uncommitted edit both show
    expect(raw).toContain('b.txt')
    expect(raw).toContain('+edited')
  })

  it('throws on an unknown base commit (surfaced as a diff error by the caller)', () => {
    expect(() => runDiff(repo, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef')).toThrow()
  })
})
