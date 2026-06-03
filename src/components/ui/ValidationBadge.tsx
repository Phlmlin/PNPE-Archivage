import React from 'react'

const STATUS_CONFIG = {
  brouillon:          { label: 'Brouillon',          emoji: '📝', classes: 'bg-gray-100 text-gray-700 border border-gray-200' },
  en_attente_chef:    { label: 'Attente Chef',        emoji: '⏳', classes: 'bg-amber-100 text-amber-800 border border-amber-200' },
  en_attente_dg:      { label: 'Attente DG',          emoji: '🔄', classes: 'bg-blue-100 text-blue-800 border border-blue-200' },
  approuve:           { label: 'Approuvé',            emoji: '✅', classes: 'bg-green-100 text-green-800 border border-green-200' },
  rejete:             { label: 'Rejeté',              emoji: '❌', classes: 'bg-red-100 text-red-800 border border-red-200' },
  archive:            { label: 'Archivé',             emoji: '📦', classes: 'bg-purple-100 text-purple-800 border border-purple-200' },
}

export function ValidationBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
  if (!config) return null
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${config.classes}`}>
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  )
}
