// src/web/components/ConversationThread.tsx
import { useState, useRef, useEffect } from 'react'
import type { ConversationEntry } from '@shared/types'

interface Props {
  history: ConversationEntry[]
  onSend: (text: string) => void
  showInput: boolean
  compact?: boolean
}

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

export default function ConversationThread({ history, onSend, showInput, compact }: Props) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [history.length])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 144) + 'px' // 6 rows ~144px
    }
  }, [input])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    onSend(trimmed)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Message history */}
      {history.length > 0 && (
        <div
          ref={scrollRef}
          className={`flex flex-col gap-1.5 overflow-y-auto ${compact ? 'max-h-48' : 'max-h-96'}`}
        >
          {history.map((entry, i) => {
            const isLastAgent = showInput && entry.role === 'agent' && i === history.length - 1
            const borderColor = isLastAgent
              ? 'border-gray-700'
              : entry.role === 'agent'
                ? 'border-gray-600'
                : 'border-blue-500/30'
            const textColor = entry.role === 'agent' ? 'text-gray-300' : 'text-gray-100'
            const label = entry.role === 'agent' ? 'Agent' : 'You'

            return (
              <div key={`${entry.timestamp}-${i}`} className={`border-l-2 ${borderColor} pl-3 py-1`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-medium ${textColor}`}>{label}</span>
                  <span className="text-xs text-gray-500">{timeAgo(entry.timestamp)}</span>
                </div>
                <p className={`text-sm ${textColor} whitespace-pre-wrap`}>{entry.content}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Input area */}
      {showInput && (
        <div className="flex gap-1.5">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type response... (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 text-sm bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-gray-100 resize-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded transition-colors self-end"
          >
            Send
          </button>
        </div>
      )}
    </div>
  )
}
