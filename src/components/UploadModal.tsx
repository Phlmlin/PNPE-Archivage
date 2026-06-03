'use client'

import { useState } from 'react'
import { X, Upload, FileText, Loader2, AlertCircle } from 'lucide-react'
import { SERVICES, uiIdToDbService, dbServiceToUiId, ServiceCode } from '../lib/constants'
import { createClient } from '../lib/supabase/client'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadSuccess: () => void
  currentUserService: string // Code service de la base (ex: 'DG', 'DII')
  currentUserId: string
}

export default function UploadModal({ isOpen, onClose, onUploadSuccess, currentUserService, currentUserId }: UploadModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  
  // Initialisation dynamique directe de l'état pour éviter useEffect
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => {
    if (currentUserService === 'DG') {
      return '00000000-0000-0000-0000-000000000000'
    }
    return dbServiceToUiId(currentUserService as ServiceCode)
  })
  
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    setError(null)

    if (!selectedFile) return

    // Vérifier que c'est un PDF
    if (selectedFile.type !== 'application/pdf') {
      setError('Seuls les fichiers PDF sont acceptés.')
      setFile(null)
      return
    }

    // Limite de taille (ex: 20Mo)
    const maxSize = 20 * 1024 * 1024
    if (selectedFile.size > maxSize) {
      setError('La taille du fichier ne doit pas dépasser 20 Mo.')
      setFile(null)
      return
    }

    setFile(selectedFile)
    
    // Auto-remplissage du titre si vide
    if (!title) {
      const nameWithoutExtension = selectedFile.name.replace(/\.[^/.]+$/, "")
      setTitle(nameWithoutExtension)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!file) {
      setError('Veuillez sélectionner un fichier PDF.')
      return
    }

    if (!title.trim()) {
      setError('Veuillez spécifier un titre pour le document.')
      return
    }

    try {
      setUploading(true)
      const supabase = createClient()
      
      const dbService = uiIdToDbService(selectedServiceId)
      const fileExtension = 'pdf'
      const uniqueId = crypto.randomUUID()
      const folder = dbService.toLowerCase()
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9]/g, '_')
      const storagePath = `${folder}/${uniqueId}_${sanitizedFileName}.${fileExtension}`

      // 1. Upload du fichier physique dans Supabase Storage (bucket 'archives-pnpe')
      const { error: uploadError } = await supabase.storage
        .from('archives-pnpe')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Détails erreur upload:', uploadError)
        throw new Error(`Erreur lors du dépôt du fichier: ${uploadError.message}`)
      }

      // 2. Insertion des métadonnées dans la table 'documents'
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          file_path: storagePath,
          file_size: file.size,
          file_type: file.type,
          service: dbService,
          uploaded_by: currentUserId,
          status: 'actif'
        })

      if (dbError) {
        // En cas d'erreur de base de données, tenter de nettoyer le stockage
        await supabase.storage.from('archives-pnpe').remove([storagePath])
        console.error('Détails erreur DB:', dbError)
        throw new Error(`Erreur lors de l'enregistrement en base: ${dbError.message}`)
      }

      // Succès
      onUploadSuccess()
      onClose()
    } catch (err: unknown) {
      console.error(err)
      const errorMessage = err instanceof Error ? err.message : 'Une erreur inconnue est survenue.'
      setError(errorMessage)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Background flouté noir */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Boîte Modale */}
      <div className="relative w-full max-w-lg bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden z-10 transition-all duration-300">
        
        {/* En-tête */}
        <div className="flex justify-between items-center p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gab-blue/10 rounded-lg text-gab-blue">
              <Upload className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Archiver un document PDF
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corps */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Glisser-déposer / Sélecteur fichier */}
          <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${file ? 'border-gab-green/50 bg-gab-green/5 dark:bg-gab-green/5' : 'border-slate-300 hover:border-gab-blue dark:border-slate-700 dark:hover:border-gab-blue'}`}>
            <input
              type="file"
              id="file-upload"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="file-upload" className="cursor-pointer block w-full">
              {file ? (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <FileText className="h-12 w-12 text-gab-green" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200 block text-sm line-clamp-1">
                    {file.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    Cliquez pour changer de fichier
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <Upload className="h-12 w-12 text-slate-400" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200 block text-sm">
                    Cliquez ou glissez un fichier PDF ici
                  </span>
                  <span className="text-xs text-slate-400">
                    Format requis : PDF uniquement (Max. 20 Mo)
                  </span>
                </div>
              )}
            </label>
          </div>

          {/* Titre du document */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Titre du document *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Rapport d'activité trimestriel"
              className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Description / Notes (Optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Ce document résume les activités du service pour le Q1..."
              rows={3}
              className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 resize-none"
            />
          </div>

          {/* Sélection du Service */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Service de classement *
            </label>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              disabled={currentUserService !== 'DG'} // Bloqué pour les non-DG
              className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-[var(--card)] text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 disabled:bg-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer"
            >
              {SERVICES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.code === 'DG' ? '(Défaut)' : ''}
                </option>
              ))}
            </select>
            {currentUserService !== 'DG' && (
              <span className="text-[10px] text-slate-400 mt-1 block">
                Votre service est bloqué conformément à vos droits d&apos;accès.
              </span>
            )}
          </div>

          {/* Bouton validation */}
          <div className="pt-4 border-t border-[var(--border)] flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={uploading || !file || !title.trim()}
              className="px-5 py-2 bg-navy-600 hover:bg-navy-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Envoi en cours...</span>
                </>
              ) : (
                <>
                  <span>Valider l&apos;archivage</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
