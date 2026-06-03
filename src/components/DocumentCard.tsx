'use client'

import { useState } from 'react'
import { FileText, Download, Trash2, User, Calendar, Loader2 } from 'lucide-react'
import { formatBytes, formatDate } from '../lib/utils'
import { getServiceByCode } from '../lib/constants'
import { createClient } from '../lib/supabase/client'

export interface DocumentType {
  id: string
  title: string
  description?: string | null
  file_path: string
  file_size: number
  file_type: string
  service: string
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
}

const serviceAccentColors: Record<string, string> = {
  DG: 'bg-primary',
  DII: 'bg-blue-600',
  DEJ: 'bg-secondary',
  DDPAE: 'bg-purple-600',
  DAMG: 'bg-orange-600',
  SRH: 'bg-teal-600',
  SCP: 'bg-pink-600',
  SSA: 'bg-amber-600',
}

export default function DocumentCard({ document, currentUserService, onDelete }: DocumentCardProps) {
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const serviceInfo = getServiceByCode(document.service)
  const isDG = currentUserService === 'DG'
  const accentColor = serviceAccentColors[document.service] || 'bg-slate-400'

  const handleDownload = async () => {
    try {
      setDownloading(true)
      const supabase = createClient()
      
      const { data, error } = await supabase.storage
          .from('archives-pnpe')
          .download(document.file_path)

      if (error) throw error

      // Création du lien de téléchargement
      const blob = new Blob([data], { type: document.file_type })
      const url = window.URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = document.title.endsWith('.pdf') ? document.title : `${document.title}.pdf`
      window.document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      window.document.body.removeChild(a)
    } catch (err) {
      console.error('Erreur lors du téléchargement:', err)
      alert('Impossible de télécharger le document. Vérifiez vos autorisations.')
    } finally {
      setDownloading(false)
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

  return (
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-level-2 hover:shadow-lg transition-all duration-200 flex flex-col justify-between relative overflow-hidden group">
        {/* Status/Service Accent Strip */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />

        <div className="pl-1">
          {/* Header Badge Service & Type */}
          <div className="flex justify-between items-start gap-2 mb-4">
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${serviceInfo.color}`}>
              {serviceInfo.code}
            </span>
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
          <div className="flex gap-2 w-full">
            <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex-1 py-2 px-3 bg-primary hover:bg-primary/95 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {downloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                  <Download className="h-3.5 w-3.5" />
              )}
              {downloading ? 'Téléchargement...' : 'Télécharger'}
            </button>

            {isDG && (
                <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="py-2 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-lg text-xs flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
                    title="Supprimer définitivement (Direction Générale uniquement)"
                >
                  {deleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-red-600" />
                  ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
            )}
          </div>
        </div>
      </div>
  )
}
