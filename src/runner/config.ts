// src/runner/config.ts
import { config as loadEnv } from 'dotenv'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, isAbsolute, resolve } from 'path'
import { fileURLToPath } from 'url'
import type { ProjectRegistry } from '../shared/types.js'

loadEnv()

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..', '..')

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback
  if (val === undefined) throw new Error(`Missing env: ${key}`)
  return val
}

function envInt(key: string, fallback: number): number {
  return parseInt(process.env[key] ?? String(fallback), 10)
}

function envFloat(key: string, fallback: number): number {
  const n = parseFloat(process.env[key] ?? String(fallback))
  return Number.isFinite(n) ? n : fallback
}

export const config = {
  maxAgents: envInt('AC_MAX_AGENTS', 3),
  cpuThreshold: envInt('AC_CPU_THRESHOLD', 80),
  ramThreshold: envInt('AC_RAM_THRESHOLD', 85),
  stallThresholdMin: envInt('AC_STALL_THRESHOLD_MIN', 5),
  maxBudgetUsd: envFloat('AC_MAX_BUDGET_USD', 2),
  logRetentionDays: envInt('AC_LOG_RETENTION_DAYS', 30),
  discordChannel: env('AC_DISCORD_CHANNEL', ''),
  discordToken: process.env.AC_DISCORD_TOKEN ?? '',
  vaultPath: env('AC_VAULT_PATH'),
  projectsPath: env('AC_PROJECTS_PATH', resolve(PROJECT_ROOT, 'projects.json')),
  permissionsDir: env('AC_PERMISSIONS_DIR', resolve(PROJECT_ROOT, 'permissions')),
  promptsDir: env('AC_PROMPTS_DIR', resolve(PROJECT_ROOT, 'prompts')),
  sessionsDir: env('AC_SESSIONS_DIR', resolve(PROJECT_ROOT, 'sessions')),
  unixSocket: env('AC_UNIX_SOCKET', '/run/agent-dispatcher/dispatcher.sock'),
  webPort: envInt('AC_WEB_PORT', 3100),
  serverPort: envInt('AC_SERVER_PORT', 3101),
  defaultGitBranch: (process.env.AC_DEFAULT_GIT_BRANCH ?? 'true') === 'true',
  geminiBinary: env('AC_GEMINI_BINARY', 'gemini'),
  codexBinary: env('AC_CODEX_BINARY', 'codex'),
}

/** Resolve the actual projects file: prefer projects.local.json over projects.json */
function resolveProjectsPath(): string {
  const base = config.projectsPath
  const localPath = base.replace(/\.json$/, '.local.json')
  return existsSync(localPath) ? localPath : base
}

export function loadProjectRegistry(): ProjectRegistry {
  const effectivePath = resolveProjectsPath()
  const raw = readFileSync(effectivePath, 'utf-8')
  const registry = JSON.parse(raw) as ProjectRegistry
  const projectsDir = dirname(effectivePath)
  for (const project of registry.projects) {
    if (!isAbsolute(project.todoFile)) {
      project.todoFile = resolve(projectsDir, project.todoFile)
    }
    // Backwards compat: default weight/weightReason for projects missing them
    if (project.weight === undefined) project.weight = 50
    if (project.weightReason === undefined) project.weightReason = ''
  }
  if (!registry.groups) registry.groups = []
  return registry
}

export function saveProjectRegistry(registry: ProjectRegistry): void {
  // Don't force-sort alphabetically — groups control display order on the frontend
  const effectivePath = resolveProjectsPath()
  writeFileSync(effectivePath, JSON.stringify(registry, null, 2) + '\n', 'utf-8')
}
