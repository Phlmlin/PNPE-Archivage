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

export default function DocumentCard({ document, currentUserService, onDelete }: DocumentCardProps) {
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const serviceInfo = getServiceByCode(document.service)
  const isDG = currentUserService === 'DG'

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
    <div className="bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      <div>
        {/* En-tête : Badge Service & Type */}
        <div className="flex justify-between items-start gap-2 mb-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${serviceInfo.color}`}>
            {serviceInfo.code}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {formatBytes(document.file_size)}
          </span>
        </div>

        {/* Titre & Description */}
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-navy-50 dark:bg-navy-950 rounded-lg text-navy-500 dark:text-navy-300 shrink-0">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 line-clamp-2" title={document.title}>
              {document.title}
            </h3>
            {document.description ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-3">
                {document.description}
              </p>
            ) : (
              <p className="text-xs italic text-slate-400 dark:text-slate-500 mt-1">
                Aucune description fournie
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Méta-informations & Actions */}
      <div className="border-t border-[var(--border)] pt-4 mt-4">
        <div className="flex flex-col gap-2 text-xs text-slate-500 dark:text-slate-400 mb-4">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            <span>
              Par : <span className="font-semibold text-slate-700 dark:text-slate-300">
                {document.profiles?.full_name || 'Agent PNPE'}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatDate(document.created_at)}</span>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex gap-2 w-full">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 py-2 px-3 bg-navy-600 hover:bg-navy-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {downloading ? 'Téléchargement...' : 'Télécharger'}
          </button>

          {isDG && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="py-2 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg text-sm flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
              title="Supprimer définitivement (Direction Générale uniquement)"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin text-red-600" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
