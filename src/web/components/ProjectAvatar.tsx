// src/web/components/ProjectAvatar.tsx
interface Props {
  name: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'w-5 h-5 text-[10px]',
  md: 'w-7 h-7 text-xs',
  lg: 'w-9 h-9 text-sm',
}

export default function ProjectAvatar({ name, size = 'sm' }: Props) {
  const letter = name.charAt(0).toUpperCase()
  return (
    <span className={`inline-flex items-center justify-center bg-gray-700 rounded font-heading font-medium text-gray-200 flex-shrink-0 ${SIZES[size]}`}>
      {letter}
    </span>
  )
}
