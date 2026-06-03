'use client'

import { useState } from 'react'
import { FileText, Download, Trash2, User, Calendar, Loader2, ArrowRight } from 'lucide-react'
import { formatBytes, formatDate } from '../lib/utils'
import { getServiceByCode } from '../lib/constants'
import { supabase } from '@/lib/supabaseClient'
import { useUserRole } from '@/hooks/useUserRole'
import { ValidationBadge } from './ui/ValidationBadge'
import { ValidationPanel } from './ValidationPanel'

export interface DocumentType {
  id: string
  title: string
  description?: string | null
  file_path: string
  file_size: number
  file_type: string
  service: string
  direction_id: string
  status: string
  rejection_reason?: string | null
  created_at: string
  uploaded_by: string | null
  profiles?: {
    full_name: string
    service: string
  } | null
}

interface DocumentCardProps {
  document: DocumentType
  currentUserService: string
  onDelete: (id: string, filePath: string) => Promise<void>
  onRefresh?: () => void
}

const serviceAccentColors: Record<string, string> = {
  DG: 'bg-primary',
  DII: 'bg-blue-600',
  DEJ: 'bg-emerald-600',
  DDPAE: 'bg-purple-600',
  DAMG: 'bg-orange-600',
  SRH: 'bg-teal-600',
  SCP: 'bg-pink-600',
  SSA: 'bg-amber-600',
}

export default function DocumentCard({ document, currentUserService, onDelete, onRefresh }: DocumentCardProps) {
  const { profile } = useUserRole()
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  const serviceInfo = getServiceByCode(document.service)
  const accentColor = serviceAccentColors[document.service] || 'bg-slate-400'
  
  const currentUserId = profile?.id
  const canDelete = profile?.role === 'super_admin' || (profile?.role && ['chef_direction', 'agent_archiviste'].includes(profile.role) && document.uploaded_by === currentUserId)
  
  // Soumission pour validation : uniquement par l'auteur d'un document en brouillon ou rejeté
  const canSubmit = currentUserId === document.uploaded_by && ['brouillon', 'rejete'].includes(document.status)

  const handleDownload = async () => {
    try {
      setDownloading(true)
      // Redirection vers la route API de téléchargement avec filigrane
      const url = `/api/download?id=${document.id}&path=${encodeURIComponent(document.file_path)}`
      
      // Crée un lien invisible pour forcer le téléchargement
      const a = window.document.createElement('a')
      a.href = url
      a.download = document.title.endsWith('.pdf') ? document.title : `${document.title}.pdf`
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
    } catch (err) {
      console.error('Erreur lors du téléchargement:', err)
      alert('Impossible de télécharger le document.')
    } finally {
      // Simule un petit délai visuel
      setTimeout(() => setDownloading(false), 1500)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Voulez-vous vraiment supprimer définitivement le document "${document.title}" ?`)) {
      return
    }

    try {
      setDeleting(true)
      await onDelete(document.id, document.file_path)
    } catch (err) {
      console.error('Erreur lors de la suppression:', err)
    } finally {
      setDeleting(false)
    }
  }

  const handleSubmitForValidation = async () => {
    try {
      setSubmitting(true)
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          status: 'approuve',
          submitted_at: new Date().toISOString()
        })
        .eq('id', document.id)

      if (updateError) throw updateError

      const { error: eventError } = await supabase
        .from('workflow_events')
        .insert({
          document_id: document.id,
          actor_id: currentUserId,
          action: 'publish',
          comment: 'Publication directe par l\'archiviste.'
        })

      if (eventError) throw eventError

      // Log audit log
      await supabase.from('audit_logs').insert({
        user_id: currentUserId,
        action: 'document.publish',
        resource_type: 'document',
        resource_id: document.id,
        resource_label: document.title
      })

      if (onRefresh) onRefresh()
    } catch (err) {
      console.error('Erreur lors de la publication:', err)
      alert('Erreur lors de la publication du document.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-level-2 hover:shadow-lg transition-all duration-200 flex flex-col justify-between relative overflow-hidden group">
        {/* Status/Service Accent Strip */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />

        <div className="pl-1">
          {/* Header Badge Service & Status */}
          <div className="flex justify-between items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${serviceInfo.color}`}>
                {serviceInfo.code}
              </span>
              <ValidationBadge status={document.status} />
            </div>
            <span className="text-[10px] text-on-surface-variant font-mono font-semibold">
              {formatBytes(document.file_size)}
            </span>
          </div>

          {/* Title & Description */}
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-slate-100 dark:bg-slate-900 border border-outline-variant/20 rounded-lg text-primary dark:text-slate-300 shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 
                  className="font-bold text-sm text-on-surface group-hover:text-primary dark:group-hover:text-white transition-colors line-clamp-2 leading-snug" 
                  title={document.title}
              >
                {document.title}
              </h3>
              {document.description ? (
                  <p className="text-xs text-on-surface-variant mt-1.5 line-clamp-3 leading-relaxed">
                    {document.description}
                  </p>
              ) : (
                  <p className="text-[11px] italic text-slate-400 dark:text-slate-500 mt-1.5">
                    Aucune description fournie
                  </p>
              )}
              {document.status === 'rejete' && document.rejection_reason && (
                  <div className="mt-3 p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg text-[11px] text-red-750 dark:text-red-300">
                    <span className="font-bold">Motif du rejet :</span> {document.rejection_reason}
                  </div>
              )}
            </div>
          </div>
        </div>

        {/* Metadata & Actions */}
        <div className="border-t border-outline-variant/20 pt-4 mt-4 pl-1">
          <div className="flex flex-col gap-2 text-[11px] text-on-surface-variant mb-4">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>
                Par : <span className="font-semibold text-on-surface">
                  {document.profiles?.full_name || 'Agent PNPE'}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{formatDate(document.created_at)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2.5 w-full">
            <div className="flex gap-2 w-full">
              <button
                  onClick={handleDownload}
                  disabled={downloading || document.status === 'brouillon'}
                  className="flex-1 py-2 px-3 bg-primary hover:bg-primary/95 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                  title={document.status === 'brouillon' ? "Les brouillons ne peuvent pas être téléchargés." : ""}
              >
                {downloading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <Download className="h-3.5 w-3.5" />
                )}
                {downloading ? 'Téléchargement...' : 'Télécharger'}
              </button>

              {canDelete && (
                  <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="py-2 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-lg text-xs flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer animate-none"
                      title="Supprimer définitivement"
                  >
                    {deleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-red-600" />
                    ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
              )}
            </div>

            {/* Bouton de soumission/publication pour l'agent */}
            {canSubmit && (
              <button
                onClick={handleSubmitForValidation}
                disabled={submitting}
                className="w-full py-2 bg-amber-500 hover:bg-amber-600 border border-amber-500 text-amber-900 dark:text-amber-100 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <span>Publier le document</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            )}

            {/* Panneau de validation pour les validateurs */}
            <ValidationPanel 
              document={{
                id: document.id,
                title: document.title,
                status: document.status,
                direction_id: document.direction_id
              }} 
              onUpdated={onRefresh || (() => {})}
            />
          </div>
        </div>
      </div>
  )
}
