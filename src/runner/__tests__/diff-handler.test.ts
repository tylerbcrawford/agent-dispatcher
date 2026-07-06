import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { handleRequestDiff } from '../handlers/data-handlers.js'
import { captureBaseCommit } from '../git.js'
import type { HandlerContext } from '../handler-context.js'
import type { ServerMessage } from '../../shared/types.js'

const ID = ['-c', 'user.email=t@t.t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false']
const git = (cwd: string, ...a: string[]) =>
  execFileSync('git', ['-C', cwd, ...ID, ...a], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })

// Minimal ctx: handleRequestDiff only touches agents, projectFrontmatters, unicast.
function makeCtx(agent: unknown, cwd: string, sent: ServerMessage[]): HandlerContext {
  return {
    agents: new Map([['a1', agent]]),
    projectFrontmatters: new Map([['proj', { 'default-cwd': cwd }]]),
    unicast: (m: ServerMessage) => sent.push(m),
  } as unknown as HandlerContext
}

describe('handleRequestDiff (end-to-end against a real repo)', () => {
  let repo: string
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'ad-diffh-'))
    git(repo, 'init', '-q', '-b', 'main')
    writeFileSync(join(repo, 'app.ts'), 'const x = 1\n')
    git(repo, 'add', '.'); git(repo, 'commit', '-q', '-m', 'base')
  })
  afterEach(() => rmSync(repo, { recursive: true, force: true }))

  it('returns the diff of an agent run anchored to its base commit', () => {
    const base = captureBaseCommit(repo)!
    // agent "changes" the repo after the base was captured
    writeFileSync(join(repo, 'app.ts'), 'const x = 1\nconst y = 2\n')
    const agent = { session: { gitBranch: 'agent/1-x', gitBaseCommit: base, projectId: 'proj' } }
    const sent: ServerMessage[] = []
    handleRequestDiff(makeCtx(agent, repo, sent), { type: 'request_diff', agentId: 'a1' })

    expect(sent).toHaveLength(1)
    const m = sent[0]
    expect(m.type).toBe('diff_data')
    if (m.type !== 'diff_data') return
    expect(m.diff.error).toBeUndefined()
    expect(m.diff.files.map(f => f.path)).toContain('app.ts')
    expect(m.diff.totalAdditions).toBeGreaterThan(0)
    expect(m.diff.baseBranch).toBe(base.slice(0, 7))
  })

  it('reports a clear error when the run captured no base commit', () => {
    const agent = { session: { gitBranch: 'agent/1-x', gitBaseCommit: null, projectId: 'proj' } }
    const sent: ServerMessage[] = []
    handleRequestDiff(makeCtx(agent, repo, sent), { type: 'request_diff', agentId: 'a1' })

    const m = sent[0]
    expect(m.type).toBe('diff_data')
    if (m.type !== 'diff_data') return
    expect(m.diff.error).toMatch(/no diff available/i)
    expect(m.diff.files).toHaveLength(0)
  })
})
