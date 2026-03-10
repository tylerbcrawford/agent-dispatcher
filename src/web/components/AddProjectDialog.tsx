// src/web/components/AddProjectDialog.tsx
import { useState } from 'react'
import type { ProjectDraft } from '@shared/types'

interface Props {
  open: boolean
  onClose: () => void
  onCreate: (project: ProjectDraft) => void
}

function toKebabCase(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function AddProjectDialog({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [description, setDescription] = useState('')

  if (!open) return null

  const id = toKebabCase(name)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onCreate({
      name: name.trim(),
      icon: icon || '',
      description: description.trim() || undefined,
    })
    setName('')
    setIcon('')
    setDescription('')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-96 space-y-5 max-md:rounded-none max-md:w-full max-md:h-full"
      >
        <h2 className="text-lg font-bold">New Project</h2>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">Project Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. LOUD"
            autoFocus
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          {id && <div className="text-xs text-gray-500 mt-1">ID: {id}</div>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">Description <span className="text-gray-600">(optional)</span></label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="One-line project description"
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-500/80 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  )
}
