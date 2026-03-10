// src/web/components/SettingsDialog.tsx
import type { RunMode, ProviderId } from '@shared/types'
import type { ModeDefaults } from '../hooks/usePreferences'
import { PROVIDER_GROUPS, PROFILES } from '../lib/providers'
import { CloseIcon } from './icons'

interface Props {
  open: boolean
  onClose: () => void
  defaults: Record<Exclude<RunMode, 'custom'>, ModeDefaults>
  updateDefaults: (mode: Exclude<RunMode, 'custom'>, partial: Partial<ModeDefaults>) => void
}

const MODES: { id: Exclude<RunMode, 'custom'>; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'implement', label: 'Implement' },
  { id: 'audit', label: 'Audit' },
  { id: 'fix', label: 'Fix' },
]

// Build flat model list grouped by provider for the <select>
const MODEL_OPTIONS = PROVIDER_GROUPS.flatMap(group =>
  group.models.map(m => ({ ...m, providerLabel: group.label }))
)

export default function SettingsDialog({ open, onClose, defaults, updateDefaults }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md flex flex-col max-h-[90vh] max-md:rounded-none max-md:border-0 max-md:max-w-none max-md:max-h-none max-md:h-full"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
          <h3 className="text-sm font-medium text-gray-200">Default Preferences</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1">
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {MODES.map(mode => {
            const current = defaults[mode.id]
            return (
              <div key={mode.id} className="space-y-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{mode.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {/* Model dropdown */}
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">Model</label>
                    <select
                      value={`${current.providerId}:${current.model}`}
                      onChange={e => {
                        const [providerId, model] = e.target.value.split(':') as [ProviderId, string]
                        updateDefaults(mode.id, { providerId, model })
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-300 outline-none focus:border-gray-600 transition-colors"
                    >
                      {PROVIDER_GROUPS.map(group => (
                        <optgroup key={group.id} label={group.label}>
                          {group.models.map(m => (
                            <option key={m.id} value={`${m.provider}:${m.id}`}>
                              {m.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Profile dropdown */}
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">Profile</label>
                    <select
                      value={current.profile}
                      onChange={e => updateDefaults(mode.id, { profile: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-300 outline-none focus:border-gray-600 transition-colors"
                    >
                      {PROFILES.map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )
          })}

          <p className="text-xs text-gray-600 text-center pt-2">
            Changes auto-save and apply to Quick Launch buttons and SpawnDialog defaults.
          </p>
        </div>
      </div>
    </div>
  )
}
