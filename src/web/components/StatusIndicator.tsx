// src/web/components/StatusIndicator.tsx
interface Props {
  color: string      // Tailwind text color class e.g. 'text-green-400'
  shape?: 'circle' | 'diamond' | 'triangle'
  size?: 'sm' | 'md'
  pulse?: boolean
}

// Static text->bg map. The pulse dot needs a `bg-*` class, but deriving it at
// runtime (`color.replace('text-','bg-')`) hides the class from Tailwind's JIT
// scanner, so it never gets generated and the dot renders invisible. Every value
// here is a literal string the scanner can see. Add an entry when a new `color`
// is passed with `pulse`.
const TEXT_TO_BG: Record<string, string> = {
  'text-red-400': 'bg-red-400',
  'text-blue-400': 'bg-blue-400',
  'text-green-400': 'bg-green-400',
  'text-yellow-400': 'bg-yellow-400',
  'text-gray-400': 'bg-gray-400',
  'text-gray-600': 'bg-gray-600',
}

export default function StatusIndicator({ color, shape = 'circle', size = 'sm', pulse = false }: Props) {
  const px = size === 'sm' ? 8 : 12

  if (pulse) {
    const bg = TEXT_TO_BG[color] ?? 'bg-gray-400'
    return (
      <span className="relative flex flex-shrink-0" style={{ width: px, height: px }}>
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${bg} opacity-75`} />
        <span className={`relative inline-flex rounded-full h-full w-full ${bg}`} />
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
