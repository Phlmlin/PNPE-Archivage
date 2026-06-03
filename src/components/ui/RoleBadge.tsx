import React from 'react'

const ROLE_CONFIG = {
  super_admin:      { label: 'Super Admin',      color: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/30' },
  dg_superviseur:   { label: 'DG Superviseur',   color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/30' },
  chef_direction:   { label: 'Chef de Direction', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900/30' },
  agent_archiviste: { label: 'Agent Archiviste', color: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-900/30' },
  lecteur:          { label: 'Lecteur',           color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-750' },
  auditeur:         { label: 'Auditeur',          color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-900/30' },
}

export function RoleBadge({ role }: { role: string }) {
  const config = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG]
  if (!config) return null
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md ${config.color}`}>
      {config.label}
    </span>
  )
}
