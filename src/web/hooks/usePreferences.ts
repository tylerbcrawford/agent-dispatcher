// src/web/hooks/usePreferences.ts
import { useState, useCallback } from 'react'
import type { ProviderId, RunMode } from '@shared/types'

export interface ModeDefaults {
  model: string
  providerId: ProviderId
  profile: string
}

// RunMode without 'custom' — preferences only apply to the 4 standard modes
type StandardRunMode = Exclude<RunMode, 'custom'>

const STORAGE_KEY = 'ac_modeDefaults'

const FALLBACK_DEFAULTS: Record<StandardRunMode, ModeDefaults> = {
  plan:      { model: 'haiku',  providerId: 'claude', profile: 'read-only' },
  implement: { model: 'haiku',  providerId: 'claude', profile: 'standard' },
  audit:     { model: 'haiku',  providerId: 'claude', profile: 'read-only' },
  fix:       { model: 'haiku',  providerId: 'claude', profile: 'standard' },
}

function loadStored(): Partial<Record<StandardRunMode, Partial<ModeDefaults>>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function mergeDefaults(stored: Partial<Record<StandardRunMode, Partial<ModeDefaults>>>): Record<StandardRunMode, ModeDefaults> {
  const result = {} as Record<StandardRunMode, ModeDefaults>
  for (const mode of Object.keys(FALLBACK_DEFAULTS) as StandardRunMode[]) {
    result[mode] = { ...FALLBACK_DEFAULTS[mode], ...stored[mode] }
  }
  return result
}

export function usePreferences() {
  const [defaults, setDefaults] = useState<Record<StandardRunMode, ModeDefaults>>(() =>
    mergeDefaults(loadStored())
  )

  const updateDefaults = useCallback((mode: StandardRunMode, partial: Partial<ModeDefaults>) => {
    setDefaults(prev => {
      const updated = { ...prev, [mode]: { ...prev[mode], ...partial } }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch { /* quota exceeded — ignore */ }
      return updated
    })
  }, [])

  return { defaults, updateDefaults }
}
