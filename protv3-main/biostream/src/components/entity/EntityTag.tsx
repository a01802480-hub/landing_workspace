/**
 * EntityTag — Color-coded badge for entity types.
 */
import { EntityType } from '../../store/entityStore'

const TYPE_STYLES: Record<EntityType, { bg: string; text: string; border: string; label: string }> = {
  'sequence': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Sequence' },
  'alignment': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Alignment' },
  'worksheet-row': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Worksheet' },
  'api-result': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: 'API Result' },
  'notebook-entry': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Notebook' },
  'workspace': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', label: 'Workspace' },
}

interface EntityTagProps {
  type: EntityType
  size?: 'sm' | 'md'
}

export function EntityTag({ type, size = 'sm' }: EntityTagProps) {
  const style = TYPE_STYLES[type] || TYPE_STYLES['sequence']
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'

  return (
    <span className={`inline-block ${sizeClass} rounded border font-medium ${style.bg} ${style.text} ${style.border}`}>
      {style.label}
    </span>
  )
}
