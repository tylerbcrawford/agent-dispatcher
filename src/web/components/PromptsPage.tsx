// src/web/components/PromptsPage.tsx
import { useState, useEffect, useRef } from 'react'
import type { PromptTemplateContent, ClientMessage, RunMode } from '@shared/types'

const MODE_CHIPS: { mode: RunMode; label: string }[] = [
  { mode: 'plan', label: 'Plan' },
  { mode: 'implement', label: 'Implement' },
  { mode: 'audit', label: 'Audit' },
  { mode: 'fix', label: 'Fix' },
]

// Canonical model options, grouped by provider (mirrors SpawnDialog's PROVIDER_GROUPS)
const MODEL_GROUPS: { label: string; models: { id: string; label: string }[] }[] = [
  { label: 'Claude', models: [
    { id: 'haiku', label: 'Haiku' },
    { id: 'sonnet', label: 'Sonnet' },
    { id: 'opus', label: 'Opus' },
  ] },
  { label: 'Gemini', models: [
    { id: 'gemini-2.5-flash', label: 'Flash' },
    { id: 'gemini-2.5-pro', label: 'Pro' },
  ] },
  { label: 'Codex', models: [
    { id: 'o4-mini', label: 'o4-mini' },
    { id: 'o3', label: 'o3' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
  ] },
]

// Permission profiles (one .md each in permissions/)
const PROFILE_OPTIONS = ['plan', 'read-only', 'standard', 'full-access']

interface PromptsPageProps {
  templates: PromptTemplateContent[]
  requestTemplates: () => void
  send: (msg: ClientMessage) => void
}

export default function PromptsPage({ templates, requestTemplates, send }: PromptsPageProps) {
  const [selectedMode, setSelectedMode] = useState<RunMode>('plan')
  const [editContent, setEditContent] = useState('')
  const [loadedContent, setLoadedContent] = useState('')
  // Per-stage defaults (model/time/profile) — editable, with loaded baselines for dirty-tracking
  const [editModel, setEditModel] = useState('')
  const [loadedModel, setLoadedModel] = useState('')
  const [editTime, setEditTime] = useState(0)
  const [loadedTime, setLoadedTime] = useState(0)
  const [editProfile, setEditProfile] = useState('')
  const [loadedProfile, setLoadedProfile] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [pendingModeSwitch, setPendingModeSwitch] = useState<RunMode | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Request templates on mount
  useEffect(() => {
    requestTemplates()
  }, [requestTemplates])

  // Sync editor + stage defaults when templates arrive or selected mode changes
  const currentTemplate = templates.find(t => t.mode === selectedMode)
  useEffect(() => {
    if (currentTemplate) {
      setEditContent(currentTemplate.content)
      setLoadedContent(currentTemplate.content)
      setEditModel(currentTemplate.defaultModel)
      setLoadedModel(currentTemplate.defaultModel)
      setEditTime(currentTemplate.defaultTime)
      setLoadedTime(currentTemplate.defaultTime)
      setEditProfile(currentTemplate.defaultProfile)
      setLoadedProfile(currentTemplate.defaultProfile)
    }
  }, [currentTemplate?.content, currentTemplate?.defaultModel, currentTemplate?.defaultTime, currentTemplate?.defaultProfile, selectedMode])

  const isDirty = editContent !== loadedContent
    || editModel !== loadedModel
    || editTime !== loadedTime
    || editProfile !== loadedProfile

  function switchMode(mode: RunMode) {
    if (isDirty) {
      setPendingModeSwitch(mode)
      return
    }
    setSelectedMode(mode)
  }

  function confirmDiscard() {
    if (pendingModeSwitch) {
      setSelectedMode(pendingModeSwitch)
      setPendingModeSwitch(null)
    }
  }

  function cancelDiscard() {
    setPendingModeSwitch(null)
  }

  function handleSave() {
    send({ type: 'save_prompt_template', mode: selectedMode, content: editContent, model: editModel, time: editTime, profile: editProfile })
    setLoadedContent(editContent)
    setLoadedModel(editModel)
    setLoadedTime(editTime)
    setLoadedProfile(editProfile)
    showToast('Saved')
  }

  function handleReset() {
    send({ type: 'reset_prompt_template', mode: selectedMode })
    showToast('Reset to default')
  }

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2000)
  }

  return (
    <div>
      {/* Header */}
      <h2 className="text-sm font-sans font-bold text-gray-400 uppercase tracking-wide mb-4 text-center">
        Prompt Templates
      </h2>

      {/* Mode chips */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {MODE_CHIPS.map(({ mode, label }) => {
          const active = selectedMode === mode
          const tmpl = templates.find(t => t.mode === mode)
          return (
            <button
              key={mode}
              onClick={() => switchMode(mode)}
              className={`text-xs border rounded px-2.5 py-1 transition-colors flex items-center gap-1.5 ${
                active
                  ? 'border-blue-500/50 text-blue-300 bg-blue-950/40'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
              {tmpl?.hasCustomOverride && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" title="Custom override active" />
              )}
            </button>
          )
        })}
      </div>

      {/* Template defaults bar — editable per stage (model / time / profile) */}
      {currentTemplate && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-4 text-xs text-gray-500">
          <label className="flex items-center gap-1.5">
            Model:
            <select
              value={editModel}
              onChange={e => setEditModel(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-gray-500 transition-colors"
            >
              {MODEL_GROUPS.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </optgroup>
              ))}
              {/* Preserve an unrecognized saved model so the value never silently blanks */}
              {!MODEL_GROUPS.some(g => g.models.some(m => m.id === editModel)) && editModel && (
                <option value={editModel}>{editModel}</option>
              )}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            Time:
            <input
              type="number"
              min={5}
              max={180}
              step={5}
              value={editTime}
              onChange={e => setEditTime(Math.max(5, Math.min(180, Number(e.target.value) || 5)))}
              className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-gray-500 transition-colors"
            />
            m
          </label>
          <label className="flex items-center gap-1.5">
            Profile:
            <select
              value={editProfile}
              onChange={e => setEditProfile(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-gray-500 transition-colors"
            >
              {PROFILE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              {!PROFILE_OPTIONS.includes(editProfile) && editProfile && (
                <option value={editProfile}>{editProfile}</option>
              )}
            </select>
          </label>
          {currentTemplate.hasCustomOverride && (
            <span className="text-blue-400">Custom</span>
          )}
        </div>
      )}

      {/* Editor */}
      {currentTemplate ? (
        <>
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm text-gray-200 font-mono leading-relaxed resize-y focus:outline-none focus:border-gray-500 transition-colors"
            rows={20}
            spellCheck={false}
          />

          {/* Variable help */}
          <p className="text-xs text-gray-600 mt-2">
            Available variables: <code className="text-gray-500">{'${name}'}</code> <code className="text-gray-500">{'${description}'}</code> <code className="text-gray-500">{'${projectName}'}</code> <code className="text-gray-500">{'${projectDescription}'}</code> <code className="text-gray-500">{'${projectFolder}'}</code> <code className="text-gray-500">{'${taskSlug}'}</code> <code className="text-gray-500">{'${planContent}'}</code>
          </p>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              onClick={handleReset}
              disabled={!currentTemplate.hasCustomOverride}
              className={`text-xs px-3 py-1.5 rounded transition-colors ${
                currentTemplate.hasCustomOverride
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                  : 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
              }`}
            >
              Reset to Default
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className={`text-xs px-3 py-1.5 rounded transition-colors ${
                isDirty
                  ? 'bg-blue-500 hover:bg-blue-500/80 text-white'
                  : 'bg-blue-500/30 text-blue-300/50 cursor-not-allowed'
              }`}
            >
              Save
            </button>
          </div>
        </>
      ) : (
        <p className="text-gray-500 text-center py-12">Loading templates...</p>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-gray-800 border border-gray-600 text-gray-200 px-4 py-2 rounded-lg text-sm">
          {toast}
        </div>
      )}

      {/* Unsaved changes dialog */}
      {pendingModeSwitch && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-sm mx-4">
            <p className="text-sm text-gray-200 mb-4">You have unsaved changes. Discard them?</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={cancelDiscard}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDiscard}
                className="text-xs bg-red-900/60 hover:bg-red-800/60 text-red-300 px-3 py-1.5 rounded transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
