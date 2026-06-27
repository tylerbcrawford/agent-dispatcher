// src/web/components/SettingsModal.tsx
// Full-screen settings overlay hosting Prompts + Priorities pages behind a tab switcher.
// Mirrors the FullscreenPlanReview overlay pattern. Mounted in App.tsx.

import { useState, useEffect } from 'react'
import type { ClientMessage, ProjectConfig, PromptTemplateContent } from '@shared/types'
import { CloseIcon } from './icons'
import PromptsPage from './PromptsPage'
import PrioritiesPage from './PrioritiesPage'

interface Props {
  open: boolean
  onClose: () => void
  // Prompts page
  templates: PromptTemplateContent[]
  requestTemplates: () => void
  // Priorities page
  projects: ProjectConfig[]
  scoring: boolean
  // shared
  send: (msg: ClientMessage) => void
}

export default function SettingsModal({
  open,
  onClose,
  templates,
  requestTemplates,
  projects,
  scoring,
  send,
}: Props) {
  const [tab, setTab] = useState<'prompts' | 'priorities'>('prompts')

  // Escape-to-close — same pattern as FullscreenPlanReview
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, open])

  // Self-guard: App can render unconditionally
  if (!open) return null

  // Static class lookup — no template literals (JIT-safe)
  const tabClass = {
    active: 'text-blue-400 border-b-2 border-blue-500',
    inactive: 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent',
  }

  return (
    <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-800">
        {/* Heading */}
        <h2 className="text-base font-heading font-semibold text-gray-100 mr-2">Settings</h2>

        {/* Tab switcher */}
        <button
          onClick={() => setTab('prompts')}
          className={`text-sm pb-0.5 transition-colors ${tab === 'prompts' ? tabClass.active : tabClass.inactive}`}
        >
          Prompts
        </button>
        <button
          onClick={() => setTab('priorities')}
          className={`text-sm pb-0.5 transition-colors ${tab === 'priorities' ? tabClass.active : tabClass.inactive}`}
        >
          Priorities
        </button>

        {/* Close button (pushed right) */}
        <button
          onClick={onClose}
          className="ml-auto text-gray-500 hover:text-gray-300 transition-colors"
          aria-label="Close settings"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {tab === 'prompts' && (
          <PromptsPage
            templates={templates}
            requestTemplates={requestTemplates}
            send={send}
          />
        )}
        {tab === 'priorities' && (
          <PrioritiesPage
            projects={projects}
            send={send}
            scoring={scoring}
          />
        )}
      </div>
    </div>
  )
}
