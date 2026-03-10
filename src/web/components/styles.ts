// Shared chip styling utilities — blue accent for interactive elements
export const CHIP_ACTIVE = 'border border-blue-500/50 text-blue-300 bg-blue-950/40'
export const CHIP_INACTIVE = 'border border-gray-700 text-gray-300 hover:text-gray-100 hover:border-gray-500'

export function chipClass(active: boolean): string {
  return active ? CHIP_ACTIVE : CHIP_INACTIVE
}
