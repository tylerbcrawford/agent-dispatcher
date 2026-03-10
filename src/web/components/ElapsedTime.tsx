// src/web/components/ElapsedTime.tsx
import { useState, useEffect } from 'react'

interface Props {
  startedAt: number       // Unix timestamp ms
  timeSpent: number       // minutes (server-reported, used as fallback)
  timeLimit: number       // minutes
  isRunning: boolean      // whether to tick live
}

export default function ElapsedTime({ startedAt, timeSpent, timeLimit, isRunning }: Props) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isRunning])

  const elapsedMs = isRunning ? now - startedAt : timeSpent * 60_000
  const totalSec = Math.max(0, Math.floor(elapsedMs / 1000))
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60

  if (isRunning) {
    return (
      <span className="tabular-nums">
        {mins}m {String(secs).padStart(2, '0')}s / {timeLimit}m
      </span>
    )
  }

  return <span className="tabular-nums">{timeSpent}m / {timeLimit}m</span>
}
