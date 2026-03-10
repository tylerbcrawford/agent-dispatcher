// src/web/components/PromptsPage.tsx
import { useState, useEffect, useRef } from 'react'
import type { PromptTemplateContent, ClientMessage, RunMode } from '@shared/types'

const MODE_CHIPS: { mode: RunMode; label: string }[] = [
  { mode: 'plan', label: 'Plan' },
  { mode: 'implement', label: 'Implement' },
  { mode: 'audit', label: 'Audit' },
  { mode: 'fix', label: 'Fix' },
]

interface PromptsPageProps {
  templates: PromptTemplateContent[]
  requestTemplates: () => void
  send: (msg: ClientMessage) => void
}

export default function PromptsPage({ templates, requestTemplates, send }: PromptsPageProps) {
  const [selectedMode, setSelectedMode] = useState<RunMode>('plan')
  const [editContent, setEditContent] = useState('')
  const [loadedContent, setLoadedContent] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [pendingModeSwitch, setPendingModeSwitch] = useState<RunMode | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Request templates on mount
  useEffect(() => {
    requestTemplates()
  }, [requestTemplates])

  // Sync editor when templates arrive or selected mode changes
  const currentTemplate = templates.find(t => t.mode === selectedMode)
  useEffect(() => {
    if (currentTemplate) {
      setEditContent(currentTemplate.content)
      setLoadedContent(currentTemplate.content)
    }
  }, [currentTemplate?.content, selectedMode])

  const isDirty = editContent !== loadedContent

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
    send({ type: 'save_prompt_template', mode: selectedMode, content: editContent })
    setLoadedContent(editContent)
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

      {/* Template metadata bar */}
      {currentTemplate && (
        <div className="flex items-center justify-center gap-4 mb-4 text-xs text-gray-500">
          <span>Model: <span className="text-gray-400">{currentTemplate.defaultModel}</span></span>
          <span>Time: <span className="text-gray-400">{currentTemplate.defaultTime}m</span></span>
          <span>Profile: <span className="text-gray-400">{currentTemplate.defaultProfile}</span></span>
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
            Available variables: <code className="text-gray-500">${'${name}'}</code> <code className="text-gray-500">${'${description}'}</code> <code className="text-gray-500">${'${projectName}'}</code> <code className="text-gray-500">${'${projectDescription}'}</code> <code className="text-gray-500">${'${projectFolder}'}</code> <code className="text-gray-500">${'${taskSlug}'}</code> <code className="text-gray-500">${'${planContent}'}</code>
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
