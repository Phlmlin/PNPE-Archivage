'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Search, 
  Upload, 
  RefreshCw, 
  LogOut, 
  FileText, 
  Database, 
  Shield, 
  LayoutGrid, 
  FileType, 
  Loader2, 
  Bell, 
  Menu, 
  Home, 
  FolderOpen, 
  HelpCircle,
  User
} from 'lucide-react'
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const isDG = initialProfile.service === 'DG'

  // Initialisation directe de l'état
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
      <div className="min-h-screen flex bg-slate-50 dark:bg-[#001229] text-[#181c1e] dark:text-[#e2e8f0]">
        
        {/* Sidebar (Desktop) */}
        <aside className="hidden md:flex bg-primary text-white fixed left-0 top-0 h-full w-64 shadow-lg flex-col z-40 border-r border-primary-container">
          {/* Top Gabon flag stripe in sidebar */}
          <div className="h-1 w-full flex shrink-0">
            <div className="h-full flex-1 bg-gab-green" />
            <div className="h-full flex-1 bg-gab-yellow" />
            <div className="h-full flex-1 bg-gab-blue" />
          </div>

          {/* Insignia & Brand Header */}
          <div className="p-6 border-b border-white/10 flex flex-col items-center shrink-0">
            <div className="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center mb-3 shadow-inner border border-white/10">
              <Database className="h-7 w-7 text-on-primary-container" />
            </div>
            <h1 className="font-semibold text-lg text-white tracking-tight">PNPE Gabon</h1>
            <p className="text-xs text-white/60 uppercase tracking-widest font-bold mt-1">Archivage Numérique</p>
          </div>

          {/* Quick Action Button */}
          <div className="p-4 shrink-0">
            <button
                onClick={() => setIsUploadOpen(true)}
                className="w-full bg-secondary text-white rounded-lg py-3 px-4 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-secondary/90 hover:scale-[1.02] transition-all cursor-pointer shadow-md"
            >
              <Upload className="h-4 w-4" />
              <span>Archiver un PDF</span>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto py-2 px-3">
            <ul className="space-y-1">
              <li>
                <button
                    onClick={() => {
                      if (isDG) setSelectedServiceCode('TOUS')
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all text-sm font-semibold cursor-pointer ${
                        selectedServiceCode === 'TOUS' || selectedServiceCode === 'DG'
                            ? 'bg-primary-container text-white border-l-4 border-gab-yellow shadow-inner'
                            : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <Home className="h-4 w-4 shrink-0" />
                  <span>Tableau de bord</span>
                </button>
              </li>
              <li>
                <div className="px-4 py-2 mt-4 text-[10px] font-bold text-white/40 uppercase tracking-wider">
                  Mon Service
                </div>
                <div className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3">
                  <FolderOpen className="h-4 w-4 text-gab-yellow shrink-0" />
                  <span className="text-xs font-medium text-white/90 truncate">
                    {userServiceDetail.name}
                  </span>
                </div>
              </li>
            </ul>
          </nav>

          {/* Sidebar Footer User Info & Logout */}
          <div className="p-4 border-t border-white/10 bg-black/10 shrink-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-full bg-primary-container border border-white/10 flex items-center justify-center text-white font-bold shrink-0">
                {initialProfile.full_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{initialProfile.full_name}</p>
                <p className="text-[10px] text-white/50 truncate font-semibold uppercase">{initialProfile.service}</p>
              </div>
            </div>
            <button
                onClick={handleLogout}
                className="w-full py-2.5 px-3 border border-white/15 text-white/70 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Se déconnecter</span>
            </button>
          </div>
        </aside>

        {/* Sidebar backdrop for mobile */}
        {isMobileMenuOpen && (
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                onClick={() => setIsMobileMenuOpen(false)}
            />
        )}

        {/* Sidebar Mobile Menu */}
        <aside className={`fixed top-0 bottom-0 left-0 w-64 bg-primary text-white z-50 flex flex-col transition-transform duration-300 md:hidden border-r border-primary-container ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          {/* Header */}
          <div className="p-5 border-b border-white/10 flex flex-col items-center shrink-0">
            <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center mb-3">
              <Database className="h-6 w-6 text-on-primary-container" />
            </div>
            <h1 className="font-semibold text-base text-white">PNPE Gabon</h1>
            <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold mt-1">Archivage Numérique</p>
          </div>

          {/* Quick Action */}
          <div className="p-4 shrink-0">
            <button
                onClick={() => {
                  setIsUploadOpen(true)
                  setIsMobileMenuOpen(false)
                }}
                className="w-full bg-secondary text-white rounded-lg py-2.5 px-4 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-secondary/90 transition-all cursor-pointer shadow-md"
            >
              <Upload className="h-4 w-4" />
              <span>Archiver un PDF</span>
            </button>
          </div>

          {/* Links */}
          <nav className="flex-1 overflow-y-auto py-2 px-3">
            <ul className="space-y-1">
              <li>
                <button
                    onClick={() => {
                      if (isDG) setSelectedServiceCode('TOUS')
                      setIsMobileMenuOpen(false)
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-sm font-semibold ${
                        selectedServiceCode === 'TOUS' || selectedServiceCode === 'DG'
                            ? 'bg-primary-container text-white border-l-4 border-gab-yellow'
                            : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <Home className="h-4 w-4" />
                  <span>Tableau de bord</span>
                </button>
              </li>
              <li>
                <div className="px-4 py-2 mt-4 text-[10px] font-bold text-white/40 uppercase tracking-wider">
                  Mon Service
                </div>
                <div className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3">
                  <FolderOpen className="h-4 w-4 text-gab-yellow shrink-0" />
                  <span className="text-xs font-medium text-white/90 truncate">
                    {userServiceDetail.name}
                  </span>
                </div>
              </li>
            </ul>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-black/10 shrink-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-full bg-primary-container flex items-center justify-center text-white font-bold">
                {initialProfile.full_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{initialProfile.full_name}</p>
                <p className="text-[10px] text-white/50 truncate font-semibold uppercase">{initialProfile.service}</p>
              </div>
            </div>
            <button
                onClick={handleLogout}
                className="w-full py-2 px-3 border border-white/15 text-white/70 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Se déconnecter</span>
            </button>
          </div>
        </aside>

        {/* Main Content Container */}
        <div className="flex-1 flex flex-col md:ml-64 w-full min-h-screen">
          
          {/* Topbar (Desktop) */}
          <header className="hidden md:flex bg-white dark:bg-[#001f3d] border-b border-outline-variant/30 h-16 sticky top-0 z-30 shadow-sm transition-all duration-300">
            {/* Gabon Stripe on top of topbar */}
            <div className="absolute top-0 left-0 right-0 h-[2px] flex">
              <div className="h-full flex-1 bg-gab-green" />
              <div className="h-full flex-1 bg-gab-yellow" />
              <div className="h-full flex-1 bg-gab-blue" />
            </div>

            <div className="flex justify-between items-center w-full px-8 h-full">
              {/* Breadcrumbs */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary dark:text-white tracking-tight text-sm">Portail PNPE</span>
                <span className="text-slate-300 dark:text-slate-700 text-xs">/</span>
                <span className="text-xs text-on-surface-variant font-medium">Tableau de bord</span>
              </div>

              {/* Actions & Search */}
              <div className="flex items-center gap-6">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary dark:text-slate-400" />
                  <input
                      type="text"
                      placeholder="Rechercher un document..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-1.5 bg-surface-container dark:bg-slate-900 border border-outline-variant/30 rounded-full focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-xs text-on-surface w-64 transition-all"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center text-slate-500 dark:text-slate-400">
                    <Bell className="h-4 w-4" />
                  </button>
                  <button className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center text-slate-500 dark:text-slate-400">
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </div>

                <div className="h-6 w-[1px] bg-outline-variant/30" />

                {/* Profile widget */}
                <div className="flex items-center gap-2.5 p-1 pr-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <div className="h-7 w-7 rounded-full bg-gab-blue/10 dark:bg-gab-blue/20 text-gab-blue flex items-center justify-center font-bold text-xs">
                    {initialProfile.full_name.charAt(0)}
                  </div>
                  <span className="text-xs font-semibold text-on-surface">{initialProfile.full_name}</span>
                </div>
              </div>
            </div>
          </header>

          {/* Mobile Header */}
          <header className="md:hidden bg-primary text-white px-4 py-4 flex items-center justify-between shadow-md sticky top-0 z-30">
            {/* Gabon Stripe on top */}
            <div className="absolute top-0 left-0 right-0 h-[2px] flex">
              <div className="h-full flex-1 bg-gab-green" />
              <div className="h-full flex-1 bg-gab-yellow" />
              <div className="h-full flex-1 bg-gab-blue" />
            </div>

            <div className="flex items-center gap-3">
              <button 
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-1 rounded-lg hover:bg-primary-container transition-colors cursor-pointer"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="font-bold text-base">Archivage PNPE</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                  onClick={() => setIsUploadOpen(true)}
                  className="p-1.5 bg-secondary text-white rounded-lg cursor-pointer"
              >
                <Upload className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 p-6 md:p-8 max-w-[1440px] w-full mx-auto space-y-6">
            
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-primary to-primary-container text-white rounded-2xl p-6 shadow-level-2 border border-white/5 relative overflow-hidden">
              <div className="absolute right-0 top-0 h-full w-1/3 opacity-5 flex items-center justify-center pointer-events-none">
                <Database className="h-32 w-32" />
              </div>
              <div className="relative z-10 space-y-2.5">
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-gab-yellow uppercase tracking-wider border border-white/15">
                  <Shield className="h-3 w-3 shrink-0" />
                  Sécurité RLS active
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  Portail d&apos;Archivage Numérique
                </h2>
                <p className="text-white/70 max-w-xl text-xs leading-relaxed">
                  Consultez, téléchargez et classez en toute sécurité les documents officiels. Les règles d&apos;accès garantissent le cloisonnement confidentiel de chaque service.
                </p>
              </div>
            </div>

            {/* Stats Bento Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-level-2 hover:shadow-lg transition-shadow duration-200 flex items-center gap-4">
                <div className="p-3 bg-blue-50 dark:bg-navy-900 text-gab-blue rounded-xl shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Archives Consultables</p>
                  <h3 className="text-lg font-extrabold mt-0.5">{stats.totalDocs}</h3>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-level-2 hover:shadow-lg transition-shadow duration-200 flex items-center gap-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-secondary rounded-xl shrink-0">
                  <FileType className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Volume Total</p>
                  <h3 className="text-lg font-extrabold mt-0.5">{formatBytes(stats.totalSize)}</h3>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-level-2 hover:shadow-lg transition-shadow duration-200 flex items-center gap-4">
                <div className="p-3 bg-gab-yellow/10 text-yellow-600 dark:text-gab-yellow rounded-xl shrink-0">
                  <LayoutGrid className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Votre Direction ({initialProfile.service})</p>
                  <h3 className="text-lg font-extrabold mt-0.5">{stats.currentServiceDocs} doc{stats.currentServiceDocs > 1 ? 's' : ''}</h3>
                </div>
              </div>
            </div>

            {/* Main Area Card */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-level-2 space-y-6">
              
              {/* Controls & Search (Mobile/Tablet view search bar) */}
              <div className="flex md:hidden gap-3 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                      type="text"
                      placeholder="Rechercher par titre..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent text-sm"
                  />
                </div>
                <button
                    onClick={fetchDocuments}
                    className="p-2 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 transition-colors text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              {/* Service Tab Navigation */}
              <div>
                <span className="block text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant mb-4">
                  {isDG ? 'Filtrer par direction (Accès DG Complet)' : 'Votre cloisonnement de service'}
                </span>
                
                <div className="flex gap-4 border-b border-outline-variant/30 overflow-x-auto no-scrollbar pb-1">
                  {isDG && (
                      <button
                          onClick={() => setSelectedServiceCode('TOUS')}
                          className={`pb-3.5 text-xs font-bold whitespace-nowrap px-1 transition-all relative cursor-pointer ${
                              selectedServiceCode === 'TOUS' 
                                  ? 'text-primary dark:text-white border-b-2 border-primary dark:border-white' 
                                  : 'text-on-surface-variant hover:text-on-surface border-b-2 border-transparent'
                          }`}
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
                            className={`pb-3.5 text-xs font-bold whitespace-nowrap px-1 transition-all relative cursor-pointer ${
                                isSelected 
                                    ? 'text-primary dark:text-white border-b-2 border-primary dark:border-white' 
                                    : 'text-on-surface-variant hover:text-on-surface border-b-2 border-transparent'
                            } disabled:opacity-40`}
                        >
                          {s.name} {isMyService && !isDG ? '(Votre Service)' : ''}
                        </button>
                    )
                  })}
                </div>
              </div>

              {/* Documents List */}
              <div className="pt-2">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-4">
                      <Loader2 className="h-9 w-9 animate-spin text-primary dark:text-slate-400" />
                      <p className="text-xs text-on-surface-variant">Chargement de la base d&apos;archives...</p>
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
                    <div className="text-center py-16 border border-dashed border-outline-variant/50 rounded-2xl">
                      <FileText className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                      <h4 className="text-sm font-bold text-on-surface">Aucune archive trouvée</h4>
                      <p className="text-xs text-on-surface-variant mt-1 max-w-xs mx-auto">
                        {searchQuery ? 'Modifiez votre recherche pour trouver d&apos;autres archives.' : 'Commencez par déposer votre premier document PDF pour ce service.'}
                      </p>
                    </div>
                )}
              </div>

            </div>

          </main>
        </div>

        {/* Modal d'Upload */}
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
