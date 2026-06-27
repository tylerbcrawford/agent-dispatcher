import { describe, it, expect } from 'vitest'
import { toDisallowedTools, type ParsedProfile } from '../permissions.js'

function profile(name: string, tools: string[]): ParsedProfile {
  return { name, description: '', tools, allowedCommands: [], blockedCommands: [] }
}

describe('toDisallowedTools (enforce permission profiles for Claude)', () => {
  it('denies every mutating/exec/network tool for a read-only profile', () => {
    const d = toDisallowedTools(profile('read-only', ['Read', 'Glob', 'Grep']))
    expect(d).toEqual(
      expect.arrayContaining(['Bash', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'WebFetch', 'WebSearch']),
    )
    // Task/Agent closed: a blocked agent must not delegate writes to a subagent
    expect(d).toContain('Task')
    expect(d).toContain('Agent')
    // never restrict the read tools the profile grants
    expect(d).not.toContain('Read')
    expect(d).not.toContain('Glob')
    expect(d).not.toContain('Grep')
  })

  it('allows Write but still denies Bash/Edit for a plan profile (plan agents save plan files)', () => {
    const d = toDisallowedTools(profile('plan', ['Read', 'Write', 'Glob', 'Grep']))
    expect(d).toContain('Bash')
    expect(d).toContain('Edit')
    expect(d).not.toContain('Write')
  })

  it('does not restrict a write-capable profile (standard)', () => {
    const d = toDisallowedTools(profile('standard', ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep']))
    expect(d).toEqual([])
  })

  it('does not restrict full-access', () => {
    const d = toDisallowedTools(
      profile('full-access', ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch']),
    )
    expect(d).toEqual([])
  })

  it('denies MCP tools and slash commands for restricted profiles', () => {
    // read-only and plan are both restricted → must close the mcp__* and
    // SlashCommand mutation vectors left open by restricted profiles
    const ro = toDisallowedTools(profile('read-only', ['Read', 'Glob', 'Grep']))
    expect(ro).toContain('mcp__*')
    expect(ro).toContain('SlashCommand')

    const plan = toDisallowedTools(profile('plan', ['Read', 'Write', 'Glob', 'Grep']))
    expect(plan).toContain('mcp__*')
    expect(plan).toContain('SlashCommand')
  })

  it('does not deny MCP/slash for write-capable profiles', () => {
    // trusted profiles stay unrestricted (empty disallow list)
    const d = toDisallowedTools(profile('standard', ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep']))
    expect(d).not.toContain('mcp__*')
    expect(d).not.toContain('SlashCommand')
  })
})
