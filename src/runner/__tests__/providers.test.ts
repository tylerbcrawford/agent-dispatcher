import { describe, it, expect } from 'vitest'
import { getProvider, getAllProviders, getModelLabel, buildSpawnCommand } from '../providers.js'

describe('getProvider', () => {
  it('returns claude provider', () => {
    const p = getProvider('claude')
    expect(p.id).toBe('claude')
    expect(p.label).toBe('Claude')
    expect(p.binary).toBe('claude')
    expect(p.models.length).toBeGreaterThanOrEqual(3)
  })

  it('returns gemini provider', () => {
    const p = getProvider('gemini')
    expect(p.id).toBe('gemini')
    expect(p.label).toBe('Gemini')
    expect(p.models.length).toBeGreaterThanOrEqual(2)
  })

  it('returns codex provider', () => {
    const p = getProvider('codex')
    expect(p.id).toBe('codex')
    expect(p.label).toBe('Codex')
    expect(p.models.length).toBeGreaterThanOrEqual(3)
  })

  it('throws for unknown provider', () => {
    expect(() => getProvider('unknown' as any)).toThrow('Unknown provider: unknown')
  })
})

describe('getAllProviders', () => {
  it('returns claude, gemini, and codex', () => {
    const providers = getAllProviders()
    const ids = providers.map(p => p.id)
    expect(ids).toContain('claude')
    expect(ids).toContain('gemini')
    expect(ids).toContain('codex')
    expect(providers).toHaveLength(3)
  })
})

describe('getModelLabel', () => {
  it('returns friendly label for known claude model', () => {
    expect(getModelLabel('claude', 'sonnet')).toBe('Claude Sonnet')
    expect(getModelLabel('claude', 'opus')).toBe('Claude Opus')
  })

  it('returns friendly label for known gemini model', () => {
    expect(getModelLabel('gemini', 'gemini-2.5-flash')).toBe('Gemini Flash')
    expect(getModelLabel('gemini', 'gemini-2.5-pro')).toBe('Gemini Pro')
  })

  it('falls back to raw ID for unknown model', () => {
    expect(getModelLabel('claude', 'unknown-model')).toBe('Claude unknown-model')
  })
})

describe('buildSpawnCommand', () => {
  it('returns claude binary and args for claude provider', () => {
    const cmd = buildSpawnCommand({
      prompt: 'test prompt',
      model: 'sonnet',
      providerId: 'claude',
    })
    expect(cmd.binary).toBe('claude')
    expect(cmd.args).toContain('--print')
    expect(cmd.args).toContain('--verbose')
    expect(cmd.args).toContain('sonnet')
  })

  it('returns gemini binary and args for gemini provider', () => {
    const cmd = buildSpawnCommand({
      prompt: 'test prompt',
      model: 'gemini-2.5-flash',
      providerId: 'gemini',
    })
    expect(cmd.binary).toBeTruthy()
    expect(cmd.args).toContain('-o')
    expect(cmd.args).toContain('stream-json')
    expect(cmd.args).toContain('-m')
    expect(cmd.args).toContain('gemini-2.5-flash')
    expect(cmd.args).toContain('-p')
    expect(cmd.args).toContain('test prompt')
  })

  it('maps permission profiles to gemini approval modes', () => {
    const planCmd = buildSpawnCommand({
      prompt: 'test', model: 'gemini-2.5-flash', providerId: 'gemini',
      permissionProfile: 'plan',
    })
    expect(planCmd.args).toContain('plan')

    const fullCmd = buildSpawnCommand({
      prompt: 'test', model: 'gemini-2.5-flash', providerId: 'gemini',
      permissionProfile: 'full-access',
    })
    expect(fullCmd.args).toContain('yolo')
  })

  it('returns codex binary and args for codex provider', () => {
    const cmd = buildSpawnCommand({
      prompt: 'test prompt',
      model: 'o4-mini',
      providerId: 'codex',
    })
    expect(cmd.binary).toBeTruthy()
    expect(cmd.args).toContain('exec')
    expect(cmd.args).toContain('--json')
    expect(cmd.args).toContain('-m')
    expect(cmd.args).toContain('o4-mini')
    expect(cmd.args).toContain('-s')
    expect(cmd.args).toContain('workspace-write')
    expect(cmd.args[cmd.args.length - 1]).toBe('test prompt')
  })

  it('maps permission profiles to codex sandbox modes', () => {
    const planCmd = buildSpawnCommand({
      prompt: 'test', model: 'o4-mini', providerId: 'codex',
      permissionProfile: 'plan',
    })
    expect(planCmd.args).toContain('read-only')

    const fullCmd = buildSpawnCommand({
      prompt: 'test', model: 'o4-mini', providerId: 'codex',
      permissionProfile: 'full-access',
    })
    expect(fullCmd.args).toContain('danger-full-access')

    const mediaCmd = buildSpawnCommand({
      prompt: 'test', model: 'o4-mini', providerId: 'codex',
      permissionProfile: 'standard',
    })
    expect(mediaCmd.args).toContain('workspace-write')
  })

  it('builds codex resume args with session ID', () => {
    const cmd = buildSpawnCommand({
      prompt: 'continue working',
      model: 'o3',
      providerId: 'codex',
      resumeId: 'thr_abc123',
    })
    expect(cmd.args[0]).toBe('exec')
    expect(cmd.args[1]).toBe('resume')
    expect(cmd.args).toContain('thr_abc123')
    expect(cmd.args).toContain('--json')
    expect(cmd.args).toContain('continue working')
  })

  it('returns codex model label', () => {
    expect(getModelLabel('codex', 'o4-mini')).toBe('Codex o4-mini')
    expect(getModelLabel('codex', 'gpt-4.1')).toBe('Codex GPT-4.1')
  })
})
