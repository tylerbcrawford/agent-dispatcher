// src/web/components/DiffViewer.tsx
import { useState } from 'react'
import type { DiffData } from '@shared/types'

interface Props {
  diff: DiffData | null
  onRequest: () => void
}

export default function DiffViewer({ diff, onRequest }: Props) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  // No diff loaded yet — show request button
  if (!diff) {
    return (
      <button
        onClick={onRequest}
        className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded transition-colors"
      >
        View Diff
      </button>
    )
  }

  // Error case
  if (diff.error) {
    return (
      <div className="mt-3 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded p-3">
        Failed to load diff: {diff.error}
      </div>
    )
  }

  // No changes
  if (diff.files.length === 0) {
    return (
      <div className="mt-3 text-sm text-gray-500">
        No file changes on branch <code className="font-mono text-gray-400">{diff.branch}</code>
      </div>
    )
  }

  // Auto-expand first file if <= 3 files total
  if (expandedFiles.size === 0 && diff.files.length <= 3) {
    // Use a one-time effect via state initialization isn't possible here,
    // so we just render first file as expanded by default
    const firstFile = diff.files[0].path
    if (!expandedFiles.has(firstFile)) {
      // Schedule expansion for next render to avoid state update during render
      setTimeout(() => setExpandedFiles(new Set([firstFile])), 0)
    }
  }

  const toggleFile = (path: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  return (
    <div className="mt-3">
      {/* Summary header */}
      <div className="flex items-center gap-3 text-sm mb-2">
        <span className="font-mono text-gray-400">{diff.branch}</span>
        <span className="text-green-400">+{diff.totalAdditions}</span>
        <span className="text-red-400">-{diff.totalDeletions}</span>
        <span className="text-gray-500">{diff.files.length} file{diff.files.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Per-file sections */}
      <div className="border border-gray-700 rounded-lg overflow-hidden">
        {diff.files.map(file => (
          <div key={file.path} className="border-b border-gray-700 last:border-b-0">
            {/* File header — clickable */}
            <button
              onClick={() => toggleFile(file.path)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-900 hover:bg-gray-800 transition-colors text-left"
            >
              <span className="font-mono text-xs text-gray-300 truncate">{file.path}</span>
              <div className="flex items-center gap-2 text-xs shrink-0 ml-2">
                {file.additions > 0 && <span className="text-green-400">+{file.additions}</span>}
                {file.deletions > 0 && <span className="text-red-400">-{file.deletions}</span>}
                <span className="text-gray-500">{expandedFiles.has(file.path) ? '▼' : '▶'}</span>
              </div>
            </button>

            {/* Hunks — expanded view */}
            {expandedFiles.has(file.path) && (
              <div className="bg-gray-950 overflow-x-auto">
                {file.hunks.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500 italic">Binary file</div>
                ) : (
                  file.hunks.map((hunk, hi) => (
                    <div key={hi}>
                      <div className="px-3 py-1 text-xs text-gray-500 bg-gray-900/50 font-mono">
                        {hunk.header}
                      </div>
                      <pre className="text-xs font-mono leading-5">
                        {hunk.lines.map((line, li) => {
                          const bgClass = line.type === 'add'
                            ? 'bg-green-900/20 text-green-300'
                            : line.type === 'delete'
                              ? 'bg-red-900/20 text-red-300'
                              : 'text-gray-500'
                          const prefix = line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '
                          return (
                            <div key={li} className={`px-3 ${bgClass}`}>
                              <span className="select-none opacity-50">{prefix}</span>
                              {line.content}
                            </div>
                          )
                        })}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
