// src/web/components/FullscreenPlanReview.tsx
// Fullscreen overlay for reviewing agent plans on mobile. Three-zone layout:
// fixed header (with approve/reject icons), optional inline feedback strip,
// scrollable rendered markdown body.

import { useState, useEffect } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import { CloseIcon, CheckIcon } from './icons'

interface Props {
  content: string
  taskName: string
  projectName?: string
  readOnly?: boolean
  onApprove: (notes?: string) => void
  onReject: (feedback: string) => void
  onClose: () => void
}

export default function FullscreenPlanReview({
  content,
  taskName,
  projectName,
  readOnly = false,
  onApprove,
  onReject,
  onClose,
}: Props) {
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)

  // Escape key closes the overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleApprove = () => {
    onApprove()
  }

  const handleReject = () => {
    if (feedback.trim()) {
      onReject(feedback.trim())
    }
  }

  const handleDismissFeedback = () => {
    setShowFeedback(false)
    setFeedback('')
  }

  return (
    <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col">
      {/* ── Header ──────────────────────────────── */}
      <div className="flex items-center gap-3 h-12 px-4 border-b border-gray-800 shrink-0">
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 transition-colors p-1 -ml-1"
          aria-label="Close fullscreen plan review"
        >
          <CloseIcon />
        </button>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-gray-200 truncate block">
            Plan Review{projectName ? `: ${projectName}` : ''}
          </span>
          <span className="text-xs text-gray-500 truncate block">{taskName}</span>
        </div>
        {/* Reject / Approve icons — hidden in read-only mode */}
        {!readOnly && (
          <>
            <button
              onClick={() => setShowFeedback(true)}
              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
              aria-label="Reject plan"
            >
              <CloseIcon />
            </button>
            <button
              onClick={handleApprove}
              className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-900/20 rounded transition-colors"
              aria-label="Approve plan"
            >
              <CheckIcon />
            </button>
          </>
        )}
      </div>

      {/* ── Inline feedback strip (shown when rejecting, never in read-only) ── */}
      {showFeedback && !readOnly && (
        <div className="border-b border-gray-800 bg-gray-950 px-4 py-2.5 shrink-0 flex gap-2 items-start">
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Rejection reason..."
            rows={2}
            autoFocus
            className="flex-1 text-sm bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 resize-none focus:outline-none focus:border-gray-500"
          />
          <div className="flex flex-col gap-1 pt-0.5">
            {/* Confirm rejection */}
            <button
              onClick={handleReject}
              disabled={!feedback.trim()}
              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Confirm rejection"
            >
              <CheckIcon />
            </button>
            {/* Cancel rejection */}
            <button
              onClick={handleDismissFeedback}
              className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors"
              aria-label="Cancel rejection"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      )}

      {/* ── Scrollable content ──────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-prose mx-auto px-5 py-6 sm:px-8">
          <MarkdownRenderer content={content} />
        </div>
      </div>
    </div>
  )
}
