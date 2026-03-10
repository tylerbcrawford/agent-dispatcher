// src/web/components/VerificationViewer.tsx
import { useState } from 'react'
import type { VerificationReport } from '@shared/types'
import StatusIndicator from './StatusIndicator'

interface Props {
  report: VerificationReport
  onApprove: (notes?: string) => void
  onReject: (feedback: string) => void
}

const STATUS_DISPLAY: Record<string, { color: string; shape: 'circle' | 'diamond' | 'triangle' }> = {
  pass: { color: 'text-green-400', shape: 'circle' },
  fail: { color: 'text-red-400', shape: 'triangle' },
  skip: { color: 'text-gray-500', shape: 'diamond' },
  warn: { color: 'text-yellow-400', shape: 'triangle' },
}

export default function VerificationViewer({ report, onApprove, onReject }: Props) {
  const [feedback, setFeedback] = useState('')

  const passCount = report.checks.filter(c => c.status === 'pass').length
  const failCount = report.checks.filter(c => c.status === 'fail').length

  return (
    <div className="mt-3">
      <div className="bg-gray-950 border border-gray-700 rounded-lg p-3 space-y-1.5">
        {report.checks.map((check, i) => {
          const display = STATUS_DISPLAY[check.status] ?? STATUS_DISPLAY.warn
          return (
            <div key={i} className="flex items-start gap-2 text-sm">
              <StatusIndicator color={display.color} shape={display.shape} />
              <span className={`font-medium ${display.color}`}>{check.name}</span>
              {check.detail && (
                <span className="text-gray-400">{check.detail}</span>
              )}
            </div>
          )
        })}
      </div>

      {report.summary && (
        <p className="text-sm text-gray-300 mt-2">{report.summary}</p>
      )}

      <div className="text-xs text-gray-500 mt-2">
        {passCount} passed, {failCount} failed, {report.checks.length - passCount - failCount} other
      </div>

      <textarea
        value={feedback}
        onChange={e => setFeedback(e.target.value)}
        placeholder="Notes or feedback (optional for approve, required for reject)..."
        rows={2}
        className="w-full mt-2 text-sm bg-gray-800 border border-gray-600 rounded px-3 py-2 text-gray-100 resize-none"
      />

      <div className="flex gap-2 mt-2">
        <button
          onClick={() => onApprove(feedback.trim() || undefined)}
          className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded transition-colors"
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
