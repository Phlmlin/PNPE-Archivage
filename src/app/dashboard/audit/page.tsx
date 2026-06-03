'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Shield, 
  Search, 
  RefreshCw, 
  Calendar, 
  User, 
  FileText, 
  Key, 
  Clock, 
  Database,
  Lock,
  Download,
  Trash2,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/hooks/useUserRole'
import { RoleBadge } from '@/components/ui/RoleBadge'

interface AuditLog {
  id: string
  action: string
  resource_type: string
  resource_id: string
  resource_label: string
  metadata: any
  created_at: string
  profiles: {
    full_name: string
    role: string
  } | null
}

const ACTION_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  'document.upload': { label: 'Archivage', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400', icon: FileText },
  'document.download': { label: 'Téléchargement', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400', icon: Download },
  'document.delete': { label: 'Suppression', color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/20 dark:text-rose-400', icon: Trash2 },
  'document.submit': { label: 'Soumission', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400', icon: Clock },
  'document.approve': { label: 'Approbation', color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/20 dark:text-teal-400', icon: CheckCircle },
  'document.reject': { label: 'Rejet', color: 'text-red-600 bg-red-50 dark:bg-red-950/20 dark:text-red-400', icon: AlertTriangle },
  'user.update_role': { label: 'Modif. Rôle', color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/20 dark:text-purple-400', icon: Key },
  'user.delegation': { label: 'Délégation', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 dark:text-indigo-400', icon: Shield },
  'user.status': { label: 'Modif. Compte', color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/20 dark:text-cyan-400', icon: User },
}

export default function AuditPage() {
  const router = useRouter()
  const { profile, loading: roleLoading, can } = useUserRole()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const itemsPerPage = 15

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          id,
          action,
          resource_type,
          resource_id,
          resource_label,
          metadata,
          created_at,
          profiles (
            full_name,
            role
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      const formattedLogs: AuditLog[] = (data || []).map((l: any) => {
        const prof = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles
        return {
          id: l.id,
          action: l.action,
          resource_type: l.resource_type,
          resource_id: l.resource_id,
          resource_label: l.resource_label,
          metadata: l.metadata,
          created_at: l.created_at,
          profiles: prof ? { full_name: prof.full_name, role: prof.role } : null
        }
      })

      setLogs(formattedLogs)
    } catch (err) {
      console.error('Erreur lors du chargement des logs d\'audit:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!roleLoading && can.viewAuditLogs) {
      fetchLogs()
    }
  }, [roleLoading, can.viewAuditLogs])

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#001229]">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-xs text-slate-500">Validation des autorisations...</p>
        </div>
      </div>
    )
  }

  if (!can.viewAuditLogs) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#001229] px-4">
        <div className="max-w-md w-full bg-white dark:bg-[#001f3d] border border-outline-variant/30 rounded-2xl p-8 text-center shadow-lg">
          <Lock className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Accès Refusé</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Vous ne disposez pas des privilèges nécessaires pour consulter le journal d&apos;audit de sécurité. Cette zone est réservée à la Direction Générale et aux Auditeurs agréés.
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour au tableau de bord</span>
          </button>
        </div>
      </div>
    )
  }

  // Filtrage et recherche locale
  const filteredLogs = logs.filter(log => {
    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter
    
    const query = searchQuery.toLowerCase().trim()
    if (!query) return matchesAction

    const agentName = log.profiles?.full_name?.toLowerCase() || ''
    const resourceLabel = log.resource_label?.toLowerCase() || ''
    const actionLabel = ACTION_LABELS[log.action]?.label?.toLowerCase() || log.action.toLowerCase()

    return matchesAction && (
      agentName.includes(query) ||
      resourceLabel.includes(query) ||
      actionLabel.includes(query)
    )
  })

  // Pagination
  const totalPages = Math.max(Math.ceil(filteredLogs.length / itemsPerPage), 1)
  const paginatedLogs = filteredLogs.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  const formatMetadata = (log: AuditLog) => {
    if (!log.metadata) return '-'
    if (log.action === 'document.download' && log.metadata.watermarked) {
      return 'Téléchargement filigrané de sécurité'
    }
    if (log.action === 'user.update_role') {
      return `Nouveau rôle : ${log.metadata.new_role || '-'}`
    }
    if (log.action === 'user.delegation') {
      return `Délégation : ${log.metadata.delegated_role || '-'} jusqu'au ${log.metadata.expires_at ? new Date(log.metadata.expires_at).toLocaleDateString() : '-'}`
    }
    return JSON.stringify(log.metadata)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#001229] text-slate-800 dark:text-slate-100 flex flex-col">
      {/* Flag Ribbon */}
      <div className="h-1.5 w-full flex shrink-0">
        <div className="h-full flex-1 bg-gab-green" />
        <div className="h-full flex-1 bg-gab-yellow" />
        <div className="h-full flex-1 bg-gab-blue" />
      </div>

      {/* Main Container */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto p-6 md:p-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary dark:text-white">
              <Shield className="h-6 w-6 text-gab-yellow shrink-0" />
              <h1 className="text-xl md:text-2xl font-extrabold">Journal d&apos;Audit Sécurité</h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Traçabilité complète et immuable des activités documentaires et des habilitations de l&apos;application.
            </p>
          </div>

          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#001f3d] hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour au tableau de bord</span>
          </button>
        </div>

        {/* Controls Grid */}
        <div className="bg-white dark:bg-[#001f3d] border border-outline-variant/30 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par agent, ressource ou action..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className="w-full bg-slate-100 dark:bg-slate-900 border border-outline-variant/30 rounded-xl py-2.5 pl-10 pr-4 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-on-surface font-medium"
            />
          </div>

          {/* Action Filter */}
          <div className="w-full md:w-64">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value)
                setPage(1)
              }}
              className="w-full bg-slate-100 dark:bg-slate-900 border border-outline-variant/30 rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-primary outline-none text-on-surface font-semibold cursor-pointer"
            >
              <option value="ALL">Toutes les actions</option>
              <option value="document.upload">Dépôts (Archivage)</option>
              <option value="document.download">Téléchargements</option>
              <option value="document.delete">Suppressions</option>
              <option value="document.submit">Soumissions</option>
              <option value="document.approve">Approbations</option>
              <option value="document.reject">Rejets</option>
              <option value="user.update_role">Modifications de rôles</option>
              <option value="user.delegation">Délégations temporaires</option>
              <option value="user.status">Modifications de comptes</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2.5 border border-outline-variant/40 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-sm disabled:opacity-50 shrink-0"
            title="Rafraîchir"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Logs Table Section */}
        <div className="bg-white dark:bg-[#001f3d] border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/55 dark:bg-slate-900/40 border-b border-outline-variant/20 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Date & Heure</th>
                  <th className="py-3.5 px-5">Action</th>
                  <th className="py-3.5 px-5">Agent</th>
                  <th className="py-3.5 px-5">Cible / Ressource</th>
                  <th className="py-3.5 px-5">Détails de sécurité</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-700 dark:text-slate-350 divide-y divide-outline-variant/10">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 italic">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                      Chargement du registre...
                    </td>
                  </tr>
                ) : paginatedLogs.length > 0 ? (
                  paginatedLogs.map((log) => {
                    const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-slate-100 text-slate-600', icon: Shield }
                    const ActionIcon = actionInfo.icon

                    return (
                      <tr key={log.id} className="hover:bg-slate-100/35 dark:hover:bg-slate-800/20 transition-all">
                        {/* Timestamp */}
                        <td className="py-3.5 px-5 font-medium whitespace-nowrap text-slate-500">
                          {new Date(log.created_at).toLocaleString('fr-GA', { timeZone: 'Africa/Libreville' })}
                        </td>
                        
                        {/* Action Label */}
                        <td className="py-3.5 px-5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono tracking-tight ${actionInfo.color}`}>
                            <ActionIcon className="h-3.5 w-3.5 shrink-0" />
                            {actionInfo.label}
                          </span>
                        </td>

                        {/* Agent */}
                        <td className="py-3.5 px-5 font-bold">
                          <div className="flex flex-col">
                            <span className="text-slate-900 dark:text-white">
                              {log.profiles?.full_name || 'Agent inconnu'}
                            </span>
                            {log.profiles?.role && (
                              <div className="mt-0.5 transform scale-95 origin-left">
                                <RoleBadge role={log.profiles.role as any} />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Target Resource */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            {log.resource_type === 'document' ? (
                              <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                            ) : (
                              <User className="h-4 w-4 text-slate-400 shrink-0" />
                            )}
                            <span className="font-semibold text-primary dark:text-slate-200 max-w-[220px] truncate" title={log.resource_label}>
                              {log.resource_label || '-'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-450 dark:text-slate-500 block font-mono mt-0.5">
                            {log.resource_id ? log.resource_id.substring(0, 8).toUpperCase() : ''}
                          </span>
                        </td>

                        {/* Safety Metadata Details */}
                        <td className="py-3.5 px-5 font-medium text-slate-500 dark:text-slate-400">
                          {formatMetadata(log)}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-450 italic">
                      Aucun log de sécurité trouvé dans le registre pour les critères sélectionnés.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-outline-variant/20 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/10">
              <span className="text-[11px] text-slate-500 font-semibold">
                Page {page} sur {totalPages} ({filteredLogs.length} événements)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="p-1.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all cursor-pointer text-slate-550"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  className="p-1.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all cursor-pointer text-slate-550"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
