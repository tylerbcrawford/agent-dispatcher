// src/runner/providers.ts
// Provider registry and command builder for multi-model CLI support
import type { ProviderId, ProviderConfig, ProviderModel, RunMode } from '../shared/types.js'
import { config } from './config.js'

// --- Static provider configs ---

const ALL_RUN_MODES: RunMode[] = ['plan', 'implement', 'audit', 'fix', 'custom']

const CLAUDE_MODELS: ProviderModel[] = [
  { id: 'haiku', label: 'Haiku', provider: 'claude' },
  { id: 'sonnet', label: 'Sonnet', provider: 'claude' },
  { id: 'opus', label: 'Opus', provider: 'claude' },
]

const GEMINI_MODELS: ProviderModel[] = [
  { id: 'gemini-2.5-flash', label: 'Flash', provider: 'gemini' },
  { id: 'gemini-2.5-pro', label: 'Pro', provider: 'gemini' },
]

const CODEX_MODELS: ProviderModel[] = [
  { id: 'o4-mini', label: 'o4-mini', provider: 'codex' },
  { id: 'o3', label: 'o3', provider: 'codex' },
  { id: 'gpt-4.1', label: 'GPT-4.1', provider: 'codex' },
]

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'claude',
    label: 'Claude',
    binary: 'claude',
    models: CLAUDE_MODELS,
    supportedRunModes: ALL_RUN_MODES,
  },
  {
    id: 'gemini',
    label: 'Gemini',
    binary: config.geminiBinary,
    models: GEMINI_MODELS,
    supportedRunModes: ALL_RUN_MODES,
  },
  {
    id: 'codex',
    label: 'Codex',
    binary: config.codexBinary,
    models: CODEX_MODELS,
    supportedRunModes: ALL_RUN_MODES,
  },
]

export function getProvider(id: ProviderId): ProviderConfig {
  const provider = PROVIDERS.find(p => p.id === id)
  if (!provider) throw new Error(`Unknown provider: ${id}`)
  return provider
}

export function getAllProviders(): ProviderConfig[] {
  return PROVIDERS
}

export function getModelLabel(providerId: ProviderId, modelId: string): string {
  const provider = getProvider(providerId)
  const model = provider.models.find(m => m.id === modelId)
  return model ? `${provider.label} ${model.label}` : `${provider.label} ${modelId}`
}

// --- Command builder ---

export interface SpawnCommandArgs {
  prompt: string
  model: string
  providerId: ProviderId
  allowedTools?: string       // Claude: CSV of tool names
  permissionProfile?: string  // Used by Gemini for approval-mode mapping
  resumeId?: string
  forkSession?: boolean
}

/** Map a permission profile name to Gemini --approval-mode flag */
function geminiApprovalMode(profile?: string): string {
  switch (profile) {
    case 'read-only':
    case 'plan':
      return 'plan'
    case 'standard':
      return 'auto_edit'
    case 'full-access':
      return 'yolo'
    default:
      return 'auto_edit'
  }
}

export interface SpawnCommand {
  binary: string
  args: string[]
}

export function buildSpawnCommand(args: SpawnCommandArgs): SpawnCommand {
  const provider = getProvider(args.providerId)

  switch (args.providerId) {
    case 'claude':
      return { binary: provider.binary, args: buildClaudeArgs(args) }
    case 'gemini':
      return { binary: provider.binary, args: buildGeminiArgs(args, provider) }
    case 'codex':
      return { binary: provider.binary, args: buildCodexArgs(args) }
  }
}

function buildClaudeArgs(args: SpawnCommandArgs): string[] {
  const cliArgs = ['--print', '--verbose', '--output-format', 'stream-json', '--model', args.model]

  if (args.allowedTools) {
    cliArgs.push(`--allowedTools=${args.allowedTools}`)
  }

  if (args.resumeId) {
    cliArgs.push('--resume', args.resumeId)
    if (args.forkSession) {
      cliArgs.push('--fork-session')
    }
  }

  cliArgs.push(args.prompt)
  return cliArgs
}

function buildGeminiArgs(args: SpawnCommandArgs, _provider: ProviderConfig): string[] {
  const cliArgs = ['-o', 'stream-json', '-m', args.model]

  cliArgs.push('--approval-mode', geminiApprovalMode(args.permissionProfile))

  if (args.resumeId) {
    cliArgs.push('--resume', args.resumeId)
  }

  // Gemini uses -p for non-interactive prompt
  cliArgs.push('-p', args.prompt)
  return cliArgs
}

/** Map permission profile to Codex --sandbox flag */
function codexSandboxMode(profile?: string): string {
  switch (profile) {
    case 'read-only':
    case 'plan':
      return 'read-only'
    case 'full-access':
      return 'danger-full-access'
    default: // standard and others
      return 'workspace-write'
  }
}

function buildCodexArgs(args: SpawnCommandArgs): string[] {
  // Resume: codex exec resume <sessionId> "prompt" --json -m model -s sandbox
  // Note: Codex resume takes session ID positionally, not via --last.
  // Fork is not supported by Codex CLI.
  if (args.resumeId) {
    return [
      'exec', 'resume', args.resumeId,
      args.prompt,
      '--json',
      '-m', args.model,
      '-s', codexSandboxMode(args.permissionProfile),
    ]
  }

  return [
    'exec',
    '--json',
    '-m', args.model,
    '-s', codexSandboxMode(args.permissionProfile),
    args.prompt,
  ]
}
