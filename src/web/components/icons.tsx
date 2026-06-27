// src/web/components/icons.tsx
// Inline SVG geometric icons — 20x20, stroke-based, currentColor

interface IconProps {
  className?: string
}

export function TasksIcon({ className = '' }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <rect x="2" y="2" width="7" height="7" rx="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function AgentsIcon({ className = '' }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <circle cx="10" cy="10" r="8" />
      <polygon points="8,5.5 15,10 8,14.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function QueueIcon({ className = '' }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className}>
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="13" y2="15" />
    </svg>
  )
}

export function TerminalIcon({ className = '' }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <rect x="2" y="3" width="16" height="14" rx="2" />
      <polyline points="6,8 9,11 6,14" />
      <line x1="11" y1="14" x2="14" y2="14" />
    </svg>
  )
}

export function CloseIcon({ className = '' }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className}>
      <line x1="5" y1="5" x2="15" y2="15" />
      <line x1="15" y1="5" x2="5" y2="15" />
    </svg>
  )
}

export function EditIcon({ className = '' }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 2.5l3 3L6 17H3v-3L14.5 2.5z" />
    </svg>
  )
}

export function SearchIcon({ className = '' }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className}>
      <circle cx="9" cy="9" r="6" />
      <line x1="13.5" y1="13.5" x2="17" y2="17" />
    </svg>
  )
}

export function FilterIcon({ className = '' }: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className}>
      <path d="M2 4h16M5 10h10M8 16h4" />
    </svg>
  )
}

export function HamburgerIcon({ className = '' }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className}>
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="17" y2="15" />
    </svg>
  )
}

export function PauseIcon({ className = '' }: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className={className}>
      <rect x="3" y="2" width="3" height="10" rx="0.5" />
      <rect x="8" y="2" width="3" height="10" rx="0.5" />
    </svg>
  )
}

export function PlayIcon({ className = '' }: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className={className}>
      <polygon points="3,1 12,7 3,13" />
    </svg>
  )
}

export function TrashIcon({ className = '' }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h14M8 6V4a1 1 0 011-1h2a1 1 0 011 1v2M5 6v11a2 2 0 002 2h6a2 2 0 002-2V6" />
    </svg>
  )
}

export function ChevronDownIcon({ className = '' }: IconProps) {
  return (
    <svg className={className || 'w-3.5 h-3.5'} fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
    </svg>
  )
}

export function PlusIcon({ className = '' }: IconProps) {
  return (
    <svg className={className || 'w-4 h-4'} fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" d="M10 4v12M4 10h12" />
    </svg>
  )
}

export function CheckIcon({ className = '' }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="4,11 8,15 16,5" />
    </svg>
  )
}

export function RestoreIcon({ className = '' }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 7H3v4" />
      <path d="M3 11a7 7 0 1 0 2.2-5.1L3 7" />
    </svg>
  )
}

export function ExpandIcon({ className = '' }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="14,2 18,2 18,6" />
      <line x1="12" y1="8" x2="18" y2="2" />
      <polyline points="6,18 2,18 2,14" />
      <line x1="8" y1="12" x2="2" y2="18" />
    </svg>
  )
}

export function CopyIcon({ className = '' }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="8" y="2" width="10" height="12" rx="1.5" />
      <path d="M4 8H3.5A1.5 1.5 0 002 9.5v7A1.5 1.5 0 003.5 18h7a1.5 1.5 0 001.5-1.5V17" />
    </svg>
  )
}

export function StarIcon({ className = '' }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className={className}>
      <path d="M10 2l2.4 5.2L18 8l-4 3.8 1 5.7L10 14.6 4.9 17.5l1-5.7L2 8l5.6-.8L10 2z" />
    </svg>
  )
}

export function StarFilledIcon({ className = '' }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className={className}>
      <path d="M10 2l2.4 5.2L18 8l-4 3.8 1 5.7L10 14.6 4.9 17.5l1-5.7L2 8l5.6-.8L10 2z" />
    </svg>
  )
}

export function GearIcon({ className = '' }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
