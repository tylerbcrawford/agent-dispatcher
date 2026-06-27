// src/web/components/SpawnDialog.tsx
import { useState, useMemo } from 'react'
import type { Task, ClientMessage, RunMode, ExecutionMode, ProviderId, PromptLibraryMeta } from '@shared/types'
import { ChevronDownIcon } from './icons'
import { chipClass } from './styles'

interface Props {
  task: Task
  defaultMode: 'plan' | 'implement'
  send: (msg: ClientMessage) => void
  onClose: () => void
  promptLibrary: PromptLibraryMeta | null
}

const RUN_MODES: { id: RunMode; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'implement', label: 'Implement' },
  { id: 'audit', label: 'Audit' },
  { id: 'fix', label: 'Fix' },
]

interface ProviderModelOption {
  id: string        // model ID sent to runner (e.g. 'sonnet', 'gemini-2.5-flash')
  label: string     // display label (e.g. 'Sonnet', 'Flash')
  provider: ProviderId
}

const PROVIDER_GROUPS: { id: ProviderId; label: string; models: ProviderModelOption[] }[] = [
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
const PROVIDER_LABEL_COLORS: Record<ProviderId, string> = {
  claude: 'text-blue-400',
  gemini: 'text-yellow-400',
  codex: 'text-green-400',
}

const PROVIDER_CHIP_ACTIVE: Record<ProviderId, string> = {
  claude: 'border border-blue-500/50 text-blue-300 bg-blue-950/40',
  gemini: 'border border-yellow-500/50 text-yellow-300 bg-yellow-950/40',
  codex: 'border border-green-500/50 text-green-300 bg-green-950/40',
}

const LAUNCH_BUTTON: Record<ProviderId, string> = {
  claude: 'border-blue-500/40 text-blue-300 hover:bg-blue-900/20 hover:border-blue-500/70',
  gemini: 'border-yellow-500/40 text-yellow-300 hover:bg-yellow-900/20 hover:border-yellow-500/70',
  codex: 'border-green-500/40 text-green-300 hover:bg-green-900/20 hover:border-green-500/70',
}

const PROFILES = [
  { id: 'read-only', label: 'Read Only' },
  { id: 'standard', label: 'Standard' },
  { id: 'full-access', label: 'Full Access' },
]

export default function SpawnDialog({ task, defaultMode, send, onClose, promptLibrary }: Props) {
  const isPlanMode = defaultMode === 'plan'

  const [runMode, setRunMode] = useState<RunMode>(defaultMode)
  const [model, setModel] = useState('haiku')
  const [providerId, setProviderId] = useState<ProviderId>('claude')
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('single')
  const [profile, setProfile] = useState(isPlanMode ? 'plan' : 'standard')
  const [timeLimit, setTimeLimit] = useState(isPlanMode ? 20 : 60)
  const [gitBranch, setGitBranch] = useState(!isPlanMode)
  const [customPrompt, setCustomPrompt] = useState('')
  const [promptId, setPromptId] = useState<string | undefined>(undefined)
  const [snippetIds, setSnippetIds] = useState<string[]>([])
  const [useModelHints, setUseModelHints] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const modeTemplates = useMemo(() => {
    if (!promptLibrary) return []
    const templates = promptLibrary.templates.filter(t => t.mode === runMode)
    const taskAffects = new Set(task.affects ?? [])
    return templates.sort((a, b) => {
      if (a.layer === 'base' && b.layer !== 'base') return -1
      if (a.layer !== 'base' && b.layer === 'base') return 1
      const aOverlap = a.tags.filter(t => taskAffects.has(t)).length
      const bOverlap = b.tags.filter(t => taskAffects.has(t)).length
      return bOverlap - aOverlap
    })
  }, [promptLibrary, runMode, task.affects])

  const snippets = promptLibrary?.snippets ?? []
  const currentHint = promptLibrary?.modelHints?.find(h => h.provider === providerId)
  const hasAdvanced = modeTemplates.length > 0 || snippets.length > 0 || !!currentHint

  const handleRunModeChange = (mode: RunMode) => {
    setRunMode(mode)
    setPromptId(undefined)
    const base = promptLibrary?.templates.find(t => t.mode === mode && t.layer === 'base')
    if (base) {
      setModel(base.defaultModel)
      setProfile(base.defaultProfile)
      setTimeLimit(base.defaultTime)
    }
  }

  const handleModelSelect = (modelId: string, provider: ProviderId) => {
    setModel(modelId)
    setProviderId(provider)
  }

  const handlePromptChange = (id: string) => {
    const newId = id || undefined
    setPromptId(newId)
    if (newId && promptLibrary) {
      const template = promptLibrary.templates.find(t => t.id === newId)
      if (template) {
        setModel(template.defaultModel)
        setProfile(template.defaultProfile)
        setTimeLimit(template.defaultTime)
      }
    }
  }

  const toggleSnippet = (id: string) => {
    setSnippetIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const handleLaunch = () => {
    send({
      type: 'spawn_agent',
      taskId: task.id,
      projectId: task.projectId,
      runMode,
      executionMode,
      model,
      providerId,
      profile,
      timeLimit,
      gitBranch,
      promptId,
      snippetIds: snippetIds.length > 0 ? snippetIds : undefined,
      customPrompt: customPrompt.trim() || undefined,
      useModelHints: useModelHints ? undefined : false,
    })
    onClose()
  }

  const chip = chipClass

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md flex flex-col max-h-[90vh] max-md:rounded-none max-md:border-0 max-md:max-w-none max-md:max-h-none max-md:h-full"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col items-center px-5 py-4 border-b border-gray-800 flex-shrink-0">
          <h3 className="text-sm font-medium text-gray-200">
            {isPlanMode ? 'Generate Plan' : 'Launch Agent'}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs text-center">
            #{task.id} · {task.name}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Zone 1: WHAT — Mode + Provider-grouped Model chips */}
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-600 mb-1.5 text-center">Mode</p>
              <div className="flex gap-1.5 flex-wrap justify-center">
              {RUN_MODES.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => handleRunModeChange(mode.id)}
                  className={`px-3 py-1.5 text-xs rounded transition-colors ${chip(runMode === mode.id)}`}
                >
                  {mode.label}
                </button>
              ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1.5 text-center">Model</p>
              <div className="space-y-2">
                {PROVIDER_GROUPS.map(group => (
                  <div key={group.id} className="flex items-center gap-2 justify-center">
                    <span className={`text-xs w-12 text-right shrink-0 ${PROVIDER_LABEL_COLORS[group.id] ?? 'text-gray-500'}`}>{group.label}</span>
                    <div className="flex gap-1.5">
                      {group.models.map(m => {
                        const isActive = model === m.id
                        const cls = isActive
                          ? PROVIDER_CHIP_ACTIVE[m.provider] ?? PROVIDER_CHIP_ACTIVE.claude
                          : 'border border-gray-700 text-gray-300 hover:text-gray-100 hover:border-gray-500'
                        return (
                          <button
                            key={m.id}
                            onClick={() => handleModelSelect(m.id, m.provider)}
                            className={`px-3 py-1.5 text-xs rounded transition-colors ${cls}`}
                          >
                            {m.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Zone 2: HOW — two labeled rows */}
          <div className="space-y-3 text-xs border-t border-gray-800 pt-4">
            {/* Row 1: execution · time · branch */}
            <div className="flex items-start gap-4 justify-center">
              <div className="text-center">
                <p className="text-gray-600 mb-1.5">Execution</p>
                <div className="flex gap-1">
                  <button onClick={() => setExecutionMode('single')} className={`px-2 py-1 rounded transition-colors ${chip(executionMode === 'single')}`}>Single</button>
                  <button onClick={() => setExecutionMode('ralph')} className={`px-2 py-1 rounded transition-colors ${chip(executionMode === 'ralph')}`}>Loop</button>
                </div>
              </div>
              <div className="text-center">
                <p className="text-gray-600 mb-1.5">Time</p>
                <div className="flex items-center gap-0.5 justify-center">
                  <button
                    onClick={() => setTimeLimit(t => Math.max(5, t - 15))}
                    className="text-gray-600 hover:text-gray-300 px-1.5 py-1 transition-colors text-sm leading-none"
                  >−</button>
                  <span className="text-gray-300 text-xs w-14 text-center tabular-nums">{timeLimit} min</span>
                  <button
                    onClick={() => setTimeLimit(t => Math.min(180, t + 15))}
                    className="text-gray-600 hover:text-gray-300 px-1.5 py-1 transition-colors text-sm leading-none"
                  >+</button>
                </div>
              </div>
              <div className="text-center">
                <p className="text-gray-600 mb-1.5">Branch</p>
                <div className="flex gap-1">
                  <button onClick={() => setGitBranch(true)} className={`px-2 py-1 rounded transition-colors ${chip(gitBranch)}`}>On</button>
                  <button onClick={() => setGitBranch(false)} className={`px-2 py-1 rounded transition-colors ${chip(!gitBranch)}`}>Off</button>
                </div>
              </div>
            </div>
            {/* Row 2: profile — full width chips */}
            <div>
              <p className="text-gray-600 mb-1.5 text-center">Profile</p>
              <div className="flex gap-1">
                {PROFILES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setProfile(p.id)}
                    className={`flex-1 py-1 rounded transition-colors ${chip(profile === p.id)}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Zone 3: Advanced — Template + Snippets collapsed */}
          {hasAdvanced && (
            <div className="border-t border-gray-800 pt-3">
              <button
                onClick={() => setShowAdvanced(prev => !prev)}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors mx-auto"
              >
                <ChevronDownIcon className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                Advanced
                {(promptId || snippetIds.length > 0 || !useModelHints) && (
                  <span className="ml-1 text-blue-400">·</span>
                )}
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-4">
                  {modeTemplates.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1.5">Template</p>
                      <select
                        value={promptId ?? ''}
                        onChange={e => handlePromptChange(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-300 outline-none focus:border-gray-600 transition-colors"
                      >
                        <option value="">Default (base)</option>
                        {modeTemplates.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                            {t.layer === 'variant' ? ' ↳' : t.layer === 'task-specific' ? ' ★' : ''}
                          </option>
                        ))}
                      </select>
                      {promptId && (() => {
                        const selected = modeTemplates.find(t => t.id === promptId)
                        return selected?.description ? (
                          <p className="text-xs text-gray-600 mt-1">{selected.description}</p>
                        ) : null
                      })()}
                    </div>
                  )}

                  {snippets.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1.5">Snippets</p>
                      <div className="flex flex-wrap gap-1.5">
                        {snippets.map(s => (
                          <button
                            key={s.id}
                            onClick={() => toggleSnippet(s.id)}
                            title={s.description}
                            className={`px-2.5 py-1 text-xs rounded transition-colors ${
                              snippetIds.includes(s.id)
                                ? 'bg-gray-700 border border-gray-500 text-gray-200'
                                : 'border border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentHint && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400">{currentHint.label}</p>
                        <p className="text-xs text-gray-600">{currentHint.description}</p>
                      </div>
                      <button
                        onClick={() => setUseModelHints(prev => !prev)}
                        className={`px-2.5 py-1 text-xs rounded transition-colors ${
                          useModelHints
                            ? 'bg-gray-700 border border-gray-500 text-gray-200'
                            : 'border border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                        }`}
                      >
                        {useModelHints ? 'On' : 'Off'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Instructions — always visible */}
          <div className="border-t border-gray-800 pt-4">
            <textarea
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder="Notes for the agent..."
              rows={2}
              className="w-full bg-gray-800/50 border border-gray-800 rounded px-3 py-2 text-xs text-gray-300 resize-y placeholder-gray-600 focus:outline-none focus:border-gray-700 transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-2 px-5 py-4 border-t border-gray-800 flex-shrink-0">
          <button
            onClick={handleLaunch}
            className={`flex items-center gap-2 px-6 py-1.5 rounded-full border text-sm transition-colors ${LAUNCH_BUTTON[providerId] ?? LAUNCH_BUTTON.claude}`}
          >
            {isPlanMode ? 'Generate Plan' : 'Launch'}
          </button>
          <button
            onClick={onClose}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
