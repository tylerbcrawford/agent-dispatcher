// src/runner/permissions.ts
// Parse markdown permission profiles into --allowedTools CLI flags
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { parse as parseYaml } from 'yaml'

export interface ParsedProfile {
  name: string
  description: string
  tools: string[]
  allowedCommands: string[]
  blockedCommands: string[]
}

function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: content }
  return { meta: parseYaml(match[1]) ?? {}, body: match[2] }
}

function parseListItems(body: string, heading: string): string[] {
  const regex = new RegExp(`## ${heading}[\\s\\S]*?(?=\\n## |$)`)
  const section = body.match(regex)
  if (!section) return []
  return [...section[0].matchAll(/^- `(.+?)`/gm)].map(m => m[1])
}

function parseToolsList(body: string): string[] {
  const section = body.match(/## Tools[\s\S]*?(?=\n## |$)/)
  if (!section) return []
  const toolLine = section[0].match(/^- (.+)$/m)
  if (!toolLine) return []
  return toolLine[1].split(',').map(t => t.trim())
}

export function parseProfile(content: string): ParsedProfile {
  const { meta, body } = parseFrontmatter(content)
  return {
    name: meta.name ?? 'unknown',
    description: meta.description ?? '',
    tools: parseToolsList(body),
    allowedCommands: parseListItems(body, 'Bash Commands \\(auto-approved\\)'),
    blockedCommands: parseListItems(body, 'Blocked Commands \\(best-effort deny\\)'),
  }
}

export function loadProfiles(dir: string): Map<string, ParsedProfile> {
  const profiles = new Map<string, ParsedProfile>()
  for (const file of readdirSync(dir).filter(f => f.endsWith('.md'))) {
    const content = readFileSync(join(dir, file), 'utf-8')
    const profile = parseProfile(content)
    profiles.set(profile.name, profile)
  }
  return profiles
}

/** Convert a profile's tools list to Claude Code --allowedTools flag value */
export function toAllowedTools(profile: ParsedProfile): string[] {
  return profile.tools
}

/**
 * Tools that can mutate the filesystem, run shell commands, or reach the
 * network. `--allowedTools` only auto-approves; it does NOT deny unlisted tools
 * (and the spawned agent inherits broad `permissions.allow` from the user's
 * settings.json), so a read-only allowlist alone never contained the agent.
 * Claude enforces a real restriction only via `--disallowedTools`, where deny
 * rules override inherited allow rules.
 */
// `Task`/`Agent` are included because a blocked agent will otherwise try to spawn
// a subagent "with file-creation capability" to write on its behalf (observed in
// dry-run testing). `mcp__*` (a deny glob matching every MCP tool on any server)
// and `SlashCommand` (programmatic slash-command execution) close the two residual
// mutation vectors left open. Deny rules override inherited
// settings.json allows, so these are hard-denied even if the user's config allows them.
const RESTRICTABLE_TOOLS = ['Bash', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'WebFetch', 'WebSearch', 'Task', 'Agent', 'mcp__*', 'SlashCommand']

/**
 * Best-effort deny rules for a profile's `blockedCommands`. Emitted for EVERY
 * profile, including write-capable ones — a write-capable profile grants an
 * unscoped Bash allow, so without these the "Blocked Commands" list is decorative
 * and the command runs auto-approved.
 *
 * IMPORTANT — this is defense-in-depth, not a sandbox. Claude Code's argument-level
 * Bash matching is deliberately fragile: `Bash(rm -rf /:*)` is bypassable via extra
 * spaces (`rm  -rf /`), shell variables (`R=/ && rm -rf $R`), or quoting. It stops
 * the naive invocation and nothing more. The real containment boundaries are (a) the
 * read-only / plan profiles, which deny Bash wholesale, and (b) running the dashboard
 * behind authentication on localhost. See the security notes in SECURITY.md.
 */
function blockedCommandDenials(profile: ParsedProfile): string[] {
  // Two forms per command: exact (`Bash(cmd)`) and prefix-with-args (`Bash(cmd:*)`).
  return profile.blockedCommands.flatMap(cmd => [`Bash(${cmd})`, `Bash(${cmd}:*)`])
}

/**
 * Tools to pass to Claude's `--disallowedTools` for a profile. A profile that
 * grants both Bash and Write is treated as write-capable (standard,
 * full-access): its restrictable-tool allowlist is left unrestricted, but its
 * `blockedCommands` are still denied (best-effort — see above). Any more
 * restrictive profile (read-only, plan) additionally denies every restrictable
 * tool it does not explicitly grant — so read-only denies all of them, while
 * plan keeps Write (to save plan files) but still denies Bash/Edit/etc.
 */
export function toDisallowedTools(profile: ParsedProfile): string[] {
  const writeCapable = profile.tools.includes('Bash') && profile.tools.includes('Write')
  const toolDenials = writeCapable
    ? []
    : RESTRICTABLE_TOOLS.filter(tool => !profile.tools.includes(tool))
  return [...toolDenials, ...blockedCommandDenials(profile)]
}
