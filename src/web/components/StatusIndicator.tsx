// src/web/components/StatusIndicator.tsx
interface Props {
  color: string      // Tailwind text color class e.g. 'text-green-400'
  shape?: 'circle' | 'diamond' | 'triangle'
  size?: 'sm' | 'md'
  pulse?: boolean
}

export default function StatusIndicator({ color, shape = 'circle', size = 'sm', pulse = false }: Props) {
  const px = size === 'sm' ? 8 : 12

  if (pulse) {
    return (
      <span className="relative flex flex-shrink-0" style={{ width: px, height: px }}>
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color.replace('text-', 'bg-')} opacity-75`} />
        <span className={`relative inline-flex rounded-full h-full w-full ${color.replace('text-', 'bg-')}`} />
      </span>
    )
  }

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 8 8"
      className={`flex-shrink-0 ${color}`}
      fill="currentColor"
    >
      {shape === 'circle' && <circle cx="4" cy="4" r="3.5" />}
      {shape === 'diamond' && <rect x="1" y="1" width="5.5" height="5.5" rx="0.5" transform="rotate(45 4 4)" />}
      {shape === 'triangle' && <polygon points="4,0.5 7.5,7 0.5,7" />}
    </svg>
  )
}
