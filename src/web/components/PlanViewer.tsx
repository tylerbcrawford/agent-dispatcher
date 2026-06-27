// src/web/components/PlanViewer.tsx
import { useState } from 'react'

interface Props {
  content: string
  onApprove: (notes?: string) => void
  onReject: (feedback: string) => void
}

export default function PlanViewer({ content, onApprove, onReject }: Props) {
  const [feedback, setFeedback] = useState('')

  return (
    <div className="mt-3">
      {/* Plan content */}
      <pre className="whitespace-pre-wrap font-mono text-xs text-gray-300 bg-gray-950 p-4 max-h-96 overflow-y-auto border border-gray-700 rounded-lg">
        {content}
      </pre>

      {/* Feedback — always visible, used by both Approve and Reject */}
      <textarea
        value={feedback}
        onChange={e => setFeedback(e.target.value)}
        placeholder="Notes or feedback (optional for approve, required for reject)..."
        rows={2}
        className="w-full mt-2 text-sm bg-gray-800 border border-gray-600 rounded px-3 py-2 text-gray-100 resize-none"
      />

      {/* Actions */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => onApprove(feedback.trim() || undefined)}
          className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors"
        >
          Approve
        </button>
        <button
          onClick={() => { if (feedback.trim()) onReject(feedback.trim()) }}
          disabled={!feedback.trim()}
          className="text-xs bg-red-900/60 hover:bg-red-800/60 text-red-300 px-3 py-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Reject
        </button>
      </div>
    </div>
  )
}
