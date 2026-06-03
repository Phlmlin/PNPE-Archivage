'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Upload, RefreshCw, LogOut, FileText, Database, Shield, LayoutGrid, FileType, Loader2 } from 'lucide-react'
import { createClient } from '../lib/supabase/client'
import { SERVICES, getServiceByCode } from '../lib/constants'
import { formatBytes } from '../lib/utils'
import DocumentCard, { DocumentType } from './DocumentCard'
import UploadModal from './UploadModal'

interface DashboardProps {
  initialProfile: {
    id: string
    full_name: string
    service: string
  }
}

export default function Dashboard({ initialProfile }: DashboardProps) {
  const router = useRouter()
  const [documents, setDocuments] = useState<DocumentType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const isDG = initialProfile.service === 'DG'

  // Initialisation directe de l'état sans passer par un useEffect
  const [selectedServiceCode, setSelectedServiceCode] = useState<string>(() => {
    return isDG ? 'DG' : initialProfile.service
  })
  
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [stats, setStats] = useState({ totalDocs: 0, totalSize: 0, currentServiceDocs: 0 })

  const fetchDocuments = useCallback(async () => {
    try {
      await Promise.resolve() // Évite les cascades de rendu synchrones pour ESLint
      setLoading(true)
      const supabase = createClient()
      
      let query = supabase
        .from('documents')
        .select(`
          id,
          title,
          description,
          file_path,
          file_size,
          file_type,
          service,
          created_at,
          uploaded_by,
          profiles (
            full_name,
            service
          )
        `)
        .order('created_at', { ascending: false })

      // Cloisonnement de la requête selon les rôles
      if (isDG) {
        if (selectedServiceCode && selectedServiceCode !== 'TOUS') {
          query = query.eq('service', selectedServiceCode)
        }
      } else {
        query = query.eq('service', initialProfile.service)
      }

      const { data, error } = await query

      if (error) throw error

      const docs = data as unknown as DocumentType[]
      setDocuments(docs)

      const totalDocs = docs.length
      const totalSize = docs.reduce((acc, doc) => acc + Number(doc.file_size), 0)
      const currentServiceDocs = docs.filter(d => d.service === initialProfile.service).length
      
      setStats({ totalDocs, totalSize, currentServiceDocs })
    } catch (err) {
      console.error('Erreur lors du chargement des documents:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedServiceCode, isDG, initialProfile.service])

  useEffect(() => {
    let active = true
    if (selectedServiceCode && active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchDocuments()
    }
    return () => {
      active = false
    }
  }, [selectedServiceCode, fetchDocuments])

  const handleDeleteDocument = async (id: string, filePath: string) => {
    try {
      const supabase = createClient()
      
      // 1. Supprimer le fichier du stockage Supabase
      const { error: storageError } = await supabase.storage
        .from('archives-pnpe')
        .remove([filePath])

      if (storageError) throw storageError

      // 2. Supprimer l'enregistrement de la base
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)

      if (dbError) throw dbError

      // Recharger les documents
      fetchDocuments()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue lors de la suppression.'
      alert(`Erreur lors de la suppression : ${errorMessage}`)
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  const filteredDocuments = documents.filter(doc => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true
    return (
      doc.title.toLowerCase().includes(query) ||
      (doc.description && doc.description.toLowerCase().includes(query))
    )
  })

  const userServiceDetail = getServiceByCode(initialProfile.service)

  return (
    <div className="min-height-screen pb-12">
      {/* Barre supérieure Gabon PNPE */}
      <div className="h-1.5 w-full flex">
        <div className="h-full flex-1 bg-gab-green" />
        <div className="h-full flex-1 bg-gab-yellow" />
        <div className="h-full flex-1 bg-gab-blue" />
      </div>

      {/* Header */}
      <header className="glass border-b border-[var(--border)] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-navy-900 rounded-lg flex items-center justify-center text-white font-bold text-lg border border-slate-700 shadow-inner">
              PNPE
            </div>
            <div>
              <h1 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base tracking-tight leading-tight">
                Archivage Numérique
              </h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                République Gabonaise
              </p>
            </div>
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {initialProfile.full_name}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Service : {userServiceDetail.name}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
            <button
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
              title="Se déconnecter"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        
        {/* Banner Welcome */}
        <div className="bg-gradient-to-r from-navy-900 to-navy-950 text-white rounded-2xl p-6 sm:p-8 shadow-lg border border-slate-800 relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-1/3 opacity-10 flex items-center justify-center pointer-events-none">
            <Database className="h-40 w-40" />
          </div>
          <div className="relative z-10 space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-700">
              <Shield className="h-3.5 w-3.5 text-gab-yellow" />
              Accès Sécurisé par Service (RLS Actif)
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Bienvenue sur le Portail d&apos;Archivage PNPE
            </h2>
            <p className="text-slate-300 max-w-xl text-sm leading-relaxed">
              Consultez, téléchargez et classez en toute sécurité les documents officiels. Les règles d&apos;accès garantissent le cloisonnement confidentiel de chaque service.
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Documents consultables</p>
              <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{stats.totalDocs}</h3>
            </div>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <FileType className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Volume Total</p>
              <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{formatBytes(stats.totalSize)}</h3>
            </div>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-gab-yellow/10 text-yellow-600 dark:text-gab-yellow rounded-xl">
              <LayoutGrid className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Votre Service ({initialProfile.service})</p>
              <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{stats.currentServiceDocs} doc{stats.currentServiceDocs > 1 ? 's' : ''}</h3>
            </div>
          </div>
        </div>

        {/* Section de gestion principale */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-6">
          
          {/* Actions & Recherche */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par titre ou description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={fetchDocuments}
                className="p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-slate-600 dark:text-slate-300 cursor-pointer"
                title="Actualiser la liste"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="flex-1 md:flex-none bg-navy-600 hover:bg-navy-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>Archiver un PDF</span>
              </button>
            </div>
          </div>

          {/* Onglets de service */}
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              {isDG ? 'Filtrer par direction (Accès DG complet)' : 'Votre cloisonnement de service'}
            </span>
            
            <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/60 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
              {isDG && (
                <button
                  onClick={() => setSelectedServiceCode('TOUS')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedServiceCode === 'TOUS' ? 'bg-white dark:bg-navy-800 text-navy-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
                >
                  TOUS LES SERVICES
                </button>
              )}

              {SERVICES.map((s) => {
                const isSelected = selectedServiceCode === s.code
                const isMyService = s.code === initialProfile.service
                
                const isDisabled = !isDG && !isMyService

                if (isDisabled) return null 

                return (
                  <button
                    key={s.code}
                    disabled={isDisabled}
                    onClick={() => setSelectedServiceCode(s.code)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${isSelected ? 'bg-white dark:bg-navy-800 text-navy-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'} disabled:opacity-40`}
                  >
                    {s.name} {isMyService && !isDG ? '(Votre Service)' : ''}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Liste des Documents */}
          <div className="pt-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-navy-500" />
                <p className="text-sm text-slate-400">Chargement de la base d&apos;archives...</p>
              </div>
            ) : filteredDocuments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDocuments.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    currentUserService={initialProfile.service}
                    onDelete={handleDeleteDocument}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-2xl">
                <FileText className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Aucune archive trouvée</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  {searchQuery ? 'Modifiez votre recherche pour trouver d&apos;autres archives.' : 'Commencez par déposer votre premier document PDF pour ce service.'}
                </p>
              </div>
            )}
          </div>

        </div>

      </main>

      {/* Modale d'Upload avec réinitialisation automatique par key */}
      <UploadModal
        key={String(isUploadOpen)}
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={fetchDocuments}
        currentUserService={initialProfile.service}
        currentUserId={initialProfile.id}
      />
    </div>
  )
}
