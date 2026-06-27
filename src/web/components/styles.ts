// Static Tailwind color maps — JIT-safe (no dynamic class construction)
export const GROUP_COLORS: Record<string, { dot: string; heading: string; border: string }> = {
  blue:   { dot: 'bg-blue-500',   heading: 'text-blue-400',   border: 'border-l-blue-500' },
  green:  { dot: 'bg-green-500',  heading: 'text-green-400',  border: 'border-l-green-500' },
  yellow: { dot: 'bg-yellow-500', heading: 'text-yellow-400', border: 'border-l-yellow-500' },
  red:    { dot: 'bg-red-500',    heading: 'text-red-400',    border: 'border-l-red-500' },
  purple: { dot: 'bg-purple-500', heading: 'text-purple-400', border: 'border-l-purple-500' },
  gray:   { dot: 'bg-gray-500',   heading: 'text-gray-400',   border: 'border-l-gray-500' },
}

// Shared chip styling utilities — blue accent for interactive elements
export const CHIP_ACTIVE = 'border border-blue-500/50 text-blue-300 bg-blue-950/40'
export const CHIP_INACTIVE = 'border border-gray-700 text-gray-300 hover:text-gray-100 hover:border-gray-500'

export function chipClass(active: boolean): string {
  return active ? CHIP_ACTIVE : CHIP_INACTIVE
}
