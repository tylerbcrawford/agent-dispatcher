// src/web/components/Terminal.tsx
import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface Props {
  agentId: string
  output: string
  onInput: (input: string) => void
}

export default function TerminalView({ agentId, onInput, output }: Props) {
  const termRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const writtenLength = useRef(0)

  useEffect(() => {
    if (!termRef.current) return

    const xterm = new XTerm({
      theme: {
        background: '#000000',
        foreground: '#F5F5F5',
        cursor: '#00A9E0',
        selectionBackground: '#00A9E040',
      },
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      cursorBlink: true,
    })

    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)
    xterm.open(termRef.current)
    fitAddon.fit()

    xterm.onData((data) => onInput(data))

    const resizeObserver = new ResizeObserver(() => fitAddon.fit())
    resizeObserver.observe(termRef.current)

    xtermRef.current = xterm
    writtenLength.current = 0

    return () => {
      resizeObserver.disconnect()
      xterm.dispose()
    }
  }, [agentId])

  // Write only new output to terminal (incremental)
  useEffect(() => {
    if (xtermRef.current && output.length > writtenLength.current) {
      xtermRef.current.write(output.slice(writtenLength.current))
      writtenLength.current = output.length
    }
  }, [output])

  return <div ref={termRef} className="h-full w-full" />
}
