import { describe, it, expect } from 'vitest'
import { buildSpawnArgs, buildDisplayName } from '../spawner.js'
import type { Task } from '../../shared/types.js'

const mockTask: Task = {
  id: 1,
  projectId: 'mediaserver',
  name: 'API Key Rotation',
  emoji: '📦',
  category: 'Infrastructure',
  priority: 'HIGH',
  timeEstimate: '30 min',
  timeMinutes: 30,
  status: 'ready',
  description: 'Rotate all API keys.',
  planLink: null,
  affects: ['sonarr'],
  depends: [],
  bucket: 'ready',
}

describe('buildSpawnArgs (claude)', () => {
  it('builds correct claude CLI args for implement mode', () => {
    const args = buildSpawnArgs({
      prompt: 'You are working on task...',
      model: 'sonnet',
      allowedTools: 'Bash,Read,Write,Edit,Glob,Grep',
    })
    expect(args).toContain('--print')
    expect(args).toContain('--output-format')
    expect(args).toContain('stream-json')
    expect(args).toContain('--model')
    expect(args).toContain('sonnet')
  })

  it('includes allowed tools when provided', () => {
    const args = buildSpawnArgs({
      prompt: 'test',
      model: 'opus',
      allowedTools: 'Read,Glob,Grep',
    })
    expect(args).toContain('--allowedTools=Read,Glob,Grep')
  })

  it('includes resume flags when resuming', () => {
    const args = buildSpawnArgs({
      prompt: 'continue working',
      model: 'sonnet',
      resumeId: 'abc-123',
    })
    expect(args).toContain('--resume')
    expect(args).toContain('abc-123')
  })

  it('includes fork flag when forking', () => {
    const args = buildSpawnArgs({
      prompt: 'try again',
      model: 'sonnet',
      resumeId: 'abc-123',
      forkSession: true,
    })
    expect(args).toContain('--resume')
    expect(args).toContain('--fork-session')
  })

  it('puts prompt as last argument', () => {
    const args = buildSpawnArgs({
      prompt: 'You are working on task...',
      model: 'sonnet',
    })
    expect(args[args.length - 1]).toBe('You are working on task...')
  })
})

describe('buildSpawnArgs (gemini)', () => {
  it('builds correct gemini CLI args', () => {
    const args = buildSpawnArgs({
      prompt: 'Audit the codebase',
      model: 'gemini-2.5-flash',
      providerId: 'gemini',
    })
    expect(args).toContain('-o')
    expect(args).toContain('stream-json')
    expect(args).toContain('-m')
    expect(args).toContain('gemini-2.5-flash')
    expect(args).toContain('-p')
    expect(args).toContain('Audit the codebase')
  })

  it('maps read-only profile to plan approval mode', () => {
    const args = buildSpawnArgs({
      prompt: 'test',
      model: 'gemini-2.5-flash',
      providerId: 'gemini',
      permissionProfile: 'read-only',
    })
    expect(args).toContain('--approval-mode')
    expect(args).toContain('plan')
  })

  it('maps full-access profile to yolo approval mode', () => {
    const args = buildSpawnArgs({
      prompt: 'test',
      model: 'gemini-2.5-flash',
      providerId: 'gemini',
      permissionProfile: 'full-access',
    })
    expect(args).toContain('--approval-mode')
    expect(args).toContain('yolo')
  })

  it('maps standard profile to auto_edit approval mode', () => {
    const args = buildSpawnArgs({
      prompt: 'test',
      model: 'gemini-2.5-pro',
      providerId: 'gemini',
      permissionProfile: 'standard',
    })
    expect(args).toContain('--approval-mode')
    expect(args).toContain('auto_edit')
  })

  it('includes resume flag for gemini', () => {
    const args = buildSpawnArgs({
      prompt: 'continue',
      model: 'gemini-2.5-flash',
      providerId: 'gemini',
      resumeId: 'session-456',
    })
    expect(args).toContain('--resume')
    expect(args).toContain('session-456')
  })

  it('does not include --fork-session for gemini', () => {
    const args = buildSpawnArgs({
      prompt: 'try again',
      model: 'gemini-2.5-flash',
      providerId: 'gemini',
      resumeId: 'session-456',
      forkSession: true,
    })
    expect(args).not.toContain('--fork-session')
  })
})

describe('buildSpawnArgs (codex)', () => {
  it('builds correct codex CLI args', () => {
    const args = buildSpawnArgs({
      prompt: 'Fix the tests',
      model: 'o4-mini',
      providerId: 'codex',
    })
    expect(args).toContain('exec')
    expect(args).toContain('--json')
    expect(args).toContain('-m')
    expect(args).toContain('o4-mini')
    expect(args).toContain('-s')
    expect(args[args.length - 1]).toBe('Fix the tests')
  })

  it('builds codex resume args with session ID', () => {
    const args = buildSpawnArgs({
      prompt: 'continue',
      model: 'o3',
      providerId: 'codex',
      resumeId: 'thr_abc123',
    })
    expect(args[0]).toBe('exec')
    expect(args[1]).toBe('resume')
    expect(args).toContain('thr_abc123')
    expect(args).toContain('continue')
  })
})

describe('buildDisplayName', () => {
  it('generates descriptive session names', () => {
    const name = buildDisplayName(mockTask, 'implement', 0)
    expect(name).toBe('1-api-key-rotation-implement-01')
  })

  it('increments for resumes', () => {
    const name = buildDisplayName(mockTask, 'plan', 2)
    expect(name).toBe('1-api-key-rotation-plan-03')
  })
})
