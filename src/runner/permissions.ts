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
    blockedCommands: parseListItems(body, 'Blocked Commands \\(always denied\\)'),
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
