// src/web/lib/providers.ts
// Shared provider/model/profile constants used by SpawnDialog and SettingsDialog
import type { ProviderId } from '@shared/types'

export interface ProviderModelOption {
  id: string        // model ID sent to runner (e.g. 'sonnet', 'gemini-2.5-flash')
  label: string     // display label (e.g. 'Sonnet', 'Flash')
  provider: ProviderId
}

export const PROVIDER_GROUPS: { id: ProviderId; label: string; models: ProviderModelOption[] }[] = [
  {
    id: 'claude',
    label: 'Claude',
    models: [
      { id: 'haiku', label: 'Haiku', provider: 'claude' },
      { id: 'sonnet', label: 'Sonnet', provider: 'claude' },
      { id: 'opus', label: 'Opus', provider: 'claude' },
    ],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    models: [
      { id: 'gemini-2.5-flash', label: 'Flash', provider: 'gemini' },
      { id: 'gemini-2.5-pro', label: 'Pro', provider: 'gemini' },
    ],
  },
  {
    id: 'codex' as ProviderId,
    label: 'Codex',
    models: [
      { id: 'o4-mini', label: 'o4-mini', provider: 'codex' as ProviderId },
      { id: 'o3', label: 'o3', provider: 'codex' as ProviderId },
      { id: 'gpt-4.1', label: 'GPT-4.1', provider: 'codex' as ProviderId },
    ],
  },
]

// Provider-specific colors — static maps for Tailwind JIT safety
export const PROVIDER_LABEL_COLORS: Record<ProviderId, string> = {
  claude: 'text-blue-400',
  gemini: 'text-yellow-400',
  codex: 'text-green-400',
}

export const PROVIDER_CHIP_ACTIVE: Record<ProviderId, string> = {
  claude: 'border border-blue-500/50 text-blue-300 bg-blue-950/40',
  gemini: 'border border-yellow-500/50 text-yellow-300 bg-yellow-950/40',
  codex: 'border border-green-500/50 text-green-300 bg-green-950/40',
}

export const LAUNCH_BUTTON: Record<ProviderId, string> = {
  claude: 'border-blue-500/40 text-blue-300 hover:bg-blue-900/20 hover:border-blue-500/70',
  gemini: 'border-yellow-500/40 text-yellow-300 hover:bg-yellow-900/20 hover:border-yellow-500/70',
  codex: 'border-green-500/40 text-green-300 hover:bg-green-900/20 hover:border-green-500/70',
}

export const PROFILES = [
  { id: 'read-only', label: 'Read Only' },
  { id: 'standard', label: 'Standard' },
  { id: 'full-access', label: 'Full Access' },
]

// Helper: find the display label for a model ID
export function getModelLabel(modelId: string): string {
  for (const group of PROVIDER_GROUPS) {
    const found = group.models.find(m => m.id === modelId)
    if (found) return found.label
  }
  return modelId
}

// Helper: find provider label for a provider ID
export function getProviderLabel(providerId: ProviderId): string {
  const group = PROVIDER_GROUPS.find(g => g.id === providerId)
  return group?.label ?? providerId
}
