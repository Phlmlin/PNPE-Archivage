'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  Folder, 
  FolderOpen, 
  ChevronRight, 
  CheckCircle, 
  Info, 
  Plus, 
  Settings, 
  HelpCircle, 
  HardDrive,
  Clock, 
  Tag, 
  Calendar, 
  AlertTriangle, 
  ArrowRight, 
  User
} from 'lucide-react'
import { createClient } from '../lib/supabase/client'
import { SERVICES, getServiceByCode } from '../lib/constants'
import { formatBytes, formatDate } from '../lib/utils'
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
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // Navigation active : 'dashboard' (Vue d'ensemble) ou 'archives' (Explorateur)
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'archives'>('dashboard')
  
  const [documents, setDocuments] = useState<DocumentType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const isDG = initialProfile.service === 'DG'

  // Initialisation directe de l'état
  const [selectedServiceCode, setSelectedServiceCode] = useState<string>(() => {
    return isDG ? 'TOUS' : initialProfile.service
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

  // Raccourci de recherche : redirige vers archives et focus l'input
  const handleQuickSearchClick = () => {
    setCurrentPage('archives')
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus()
      }
    }, 100)
  }

  // Calcul du stockage (Max: 50 Mo pour la démo visuelle)
  const storageLimit = 50 * 1024 * 1024 // 50 MB
  const storagePercent = Math.min(Math.round((stats.totalSize / storageLimit) * 100), 100)
  const totalSizeInMB = (stats.totalSize / (1024 * 1024)).toFixed(2)

  // Activités récentes basées sur la base de données
  const recentActivities = documents.slice(0, 3).map((doc, idx) => {
    const colors = [
      { bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-secondary' },
      { bg: 'bg-blue-100 dark:bg-navy-900', text: 'text-gab-blue' },
      { bg: 'bg-purple-100 dark:bg-purple-950/40', text: 'text-purple-600' }
    ]
    const color = colors[idx % colors.length]
    return {
      id: doc.id,
      title: 'Nouveau document archivé',
      description: `Le document "${doc.title}" a été déposé pour le service ${doc.service} par ${doc.profiles?.full_name || 'un agent'}.`,
      time: formatDate(doc.created_at),
      color
    }
  })

  // Documents critiques / urgences (ceux du service de l'utilisateur ou récents)
  const criticalDocuments = documents.slice(0, 3)

  const userServiceDetail = getServiceByCode(initialProfile.service)

  return (
      <div className="min-h-screen flex bg-slate-50 dark:bg-[#001229] text-[#181c1e] dark:text-[#e2e8f0]">
        
        {/* Sidebar (Desktop) */}
        <aside className="hidden md:flex bg-primary text-white fixed left-0 top-0 h-full w-64 shadow-lg flex-col z-40 border-r border-primary-container">
          {/* Top Gabon flag stripe in sidebar */}
          <div className="h-1.5 w-full flex shrink-0">
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
            <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold mt-1">Archivage Numérique</p>
          </div>

          {/* Quick Action Button */}
          <div className="p-4 shrink-0">
            <button
                onClick={() => setIsUploadOpen(true)}
                className="w-full bg-secondary text-white rounded-lg py-3 px-4 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-secondary/90 hover:scale-[1.02] transition-all cursor-pointer shadow-md"
            >
              <Plus className="h-4.5 w-4.5" />
              <span>Archiver un PDF</span>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-4">
            <ul className="space-y-1">
              <li>
                <button
                    onClick={() => setCurrentPage('dashboard')}
                    className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all text-sm font-semibold cursor-pointer ${
                        currentPage === 'dashboard'
                            ? 'bg-primary-container text-white border-l-4 border-gab-yellow shadow-inner'
                            : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <Home className="h-4 w-4 shrink-0" />
                  <span>Tableau de bord</span>
                </button>
              </li>
              <li>
                <button
                    onClick={() => {
                      setCurrentPage('archives')
                      if (isDG) setSelectedServiceCode('TOUS')
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all text-sm font-semibold cursor-pointer ${
                        currentPage === 'archives'
                            ? 'bg-primary-container text-white border-l-4 border-gab-yellow shadow-inner'
                            : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span>Archives & Explorateur</span>
                </button>
              </li>
            </ul>

            <div className="h-[1px] bg-white/10" />

            <div>
              <div className="px-4 py-2 text-[10px] font-bold text-white/40 uppercase tracking-wider">
                Mon Affectation
              </div>
              <div className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3">
                <Tag className="h-4 w-4 text-gab-yellow shrink-0" />
                <span className="text-xs font-semibold text-white/90 truncate">
                  {userServiceDetail.name}
                </span>
              </div>
            </div>
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
              <Plus className="h-4 w-4" />
              <span>Archiver un PDF</span>
            </button>
          </div>

          {/* Links */}
          <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-4">
            <ul className="space-y-1">
              <li>
                <button
                    onClick={() => {
                      setCurrentPage('dashboard')
                      setIsMobileMenuOpen(false)
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-sm font-semibold ${
                        currentPage === 'dashboard'
                            ? 'bg-primary-container text-white border-l-4 border-gab-yellow'
                            : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <Home className="h-4 w-4" />
                  <span>Tableau de bord</span>
                </button>
              </li>
              <li>
                <button
                    onClick={() => {
                      setCurrentPage('archives')
                      if (isDG) setSelectedServiceCode('TOUS')
                      setIsMobileMenuOpen(false)
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-sm font-semibold ${
                        currentPage === 'archives'
                            ? 'bg-primary-container text-white border-l-4 border-gab-yellow'
                            : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <FolderOpen className="h-4 w-4" />
                  <span>Archives & Explorateur</span>
                </button>
              </li>
            </ul>

            <div className="h-[1px] bg-white/10" />

            <div>
              <div className="px-4 py-2 text-[10px] font-bold text-white/40 uppercase tracking-wider">
                Mon Affectation
              </div>
              <div className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3">
                <Tag className="h-4 w-4 text-gab-yellow shrink-0" />
                <span className="text-xs font-semibold text-white/90 truncate">
                  {userServiceDetail.name}
                </span>
              </div>
            </div>
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

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col md:ml-64 w-full min-h-screen overflow-x-hidden">
          
          {/* Topbar (Desktop) */}
          <header className="hidden md:flex bg-white dark:bg-[#001f3d] border-b border-outline-variant/30 h-16 sticky top-0 z-30 shadow-sm transition-all duration-300 shrink-0">
            {/* Gabon Stripe on top of topbar */}
            <div className="absolute top-0 left-0 right-0 h-[2px] flex">
              <div className="h-full flex-1 bg-gab-green" />
              <div className="h-full flex-1 bg-gab-yellow" />
              <div className="h-full flex-1 bg-gab-blue" />
            </div>

            <div className="flex justify-between items-center w-full px-8 h-full">
              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="text-primary dark:text-white font-bold">Portail PNPE</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-700" />
                <span className="text-on-surface-variant">
                  {currentPage === 'dashboard' ? 'Vue d&apos;ensemble' : 'Archives & Explorateur'}
                </span>
              </div>

              {/* Actions & Search */}
              <div className="flex items-center gap-6">
                {/* Search Bar (Navigates to archives on typing) */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary dark:text-slate-400" />
                  <input
                      type="text"
                      placeholder="Rechercher un document..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        if (currentPage !== 'archives') {
                          setCurrentPage('archives')
                        }
                      }}
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
          <header className="md:hidden bg-primary text-white px-4 py-4 flex items-center justify-between shadow-md sticky top-0 z-30 shrink-0">
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

          {/* Conditional Views Render */}
          {currentPage === 'dashboard' ? (
              /* ================== VUE TABLEAU DE BORD (OVERVIEW) ================== */
              <main className="flex-1 p-6 md:p-8 max-w-[1440px] w-full mx-auto space-y-6">
                
                {/* Header Section */}
                <div className="space-y-1">
                  <h2 className="text-xl md:text-2xl font-extrabold text-on-background">Vue d&apos;ensemble</h2>
                  <p className="text-xs text-on-surface-variant font-medium">Bienvenue. Voici l&apos;état actuel de votre circuit documentaire.</p>
                </div>

                {/* KPI Bento Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {/* KPI 1: Total Documents */}
                  <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-level-2 hover:shadow-lg transition-all duration-200 relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/5 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div className="p-2.5 bg-slate-100 dark:bg-slate-900 border border-outline-variant/15 text-primary dark:text-white rounded-lg">
                        <FileText className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wider mb-1">Total Documents</h3>
                      <p className="text-3xl font-extrabold text-primary dark:text-white">{stats.totalDocs}</p>
                    </div>
                  </div>

                  {/* KPI 2: Critical Approvals */}
                  <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-level-2 hover:shadow-lg transition-all duration-200 relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-red-600/5 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div className="p-2.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-lg">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wider mb-1">Actifs / Révisions</h3>
                      <p className="text-3xl font-extrabold text-on-surface">{stats.currentServiceDocs}</p>
                    </div>
                  </div>

                  {/* KPI 3: Incoming Mail (Dynamic Uploads) */}
                  <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-level-2 hover:shadow-lg transition-all duration-200 relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-600/5 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 text-secondary border border-emerald-200 dark:border-emerald-900/40 rounded-lg">
                        <Clock className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wider mb-1">Dépôts Récents</h3>
                      <p className="text-3xl font-extrabold text-on-surface">{documents.slice(0, 5).length}</p>
                    </div>
                  </div>
                </div>

                {/* Main Dashboard Layout Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column (Urgency Table & Recent Activities) */}
                  <div className="lg:col-span-8 space-y-6">
                    
                    {/* Urgences & Délais Section */}
                    <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-level-2 overflow-hidden">
                      <div className="px-5 py-4 border-b border-outline-variant/20 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                        <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
                          <AlertTriangle className="h-4.5 w-4.5 text-red-600" />
                          Archives du Service ({initialProfile.service})
                        </h3>
                        <button 
                            onClick={() => setCurrentPage('archives')}
                            className="text-xs font-bold text-primary hover:underline cursor-pointer"
                        >
                          Explorer les archives
                        </button>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-outline-variant/20 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                              <th className="py-3 px-5">Réf.</th>
                              <th className="py-3 px-5">Objet / Titre</th>
                              <th className="py-3 px-5">Date dépôt</th>
                              <th className="py-3 px-5">Statut</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs text-on-surface divide-y divide-outline-variant/10">
                            {criticalDocuments.length > 0 ? (
                                criticalDocuments.map((doc) => (
                                    <tr 
                                        key={doc.id}
                                        onClick={() => setCurrentPage('archives')}
                                        className="hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                                    >
                                      <td className="py-3 px-5 font-mono text-[10px] text-slate-500 font-bold">
                                        {doc.id.substring(0, 8).toUpperCase()}
                                      </td>
                                      <td className="py-3 px-5 font-bold text-primary dark:text-white truncate max-w-[200px]">
                                        {doc.title}
                                      </td>
                                      <td className="py-3 px-5 text-on-surface-variant font-medium">
                                        {formatDate(doc.created_at)}
                                      </td>
                                      <td className="py-3 px-5">
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-secondary border border-emerald-200 dark:border-emerald-900/40">
                                          <span className="w-1 h-1 rounded-full bg-secondary"></span>
                                          Traitant
                                        </span>
                                      </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                  <td colSpan={4} className="py-6 px-5 text-center text-xs text-slate-400 italic">
                                    Aucun document archivé pour le moment
                                  </td>
                                </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    {/* Activités Récentes Timeline */}
                    <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-level-2">
                      <h3 className="font-bold text-sm text-on-surface mb-6 flex items-center gap-2">
                        <Clock className="h-4.5 w-4.5 text-primary" />
                        Activités Récentes
                      </h3>

                      {recentActivities.length > 0 ? (
                          <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-4.5 before:w-0.5 before:bg-outline-variant/30">
                            {recentActivities.map((act) => (
                                <div key={act.id} className="relative flex gap-4 items-start group">
                                  {/* Timeline node */}
                                  <div className="flex items-center justify-center w-9 h-9 rounded-full border-4 border-surface-container-lowest bg-primary-container text-white shrink-0 shadow-sm z-10">
                                    <CheckCircle className="h-4.5 w-4.5 text-gab-yellow" />
                                  </div>
                                  
                                  {/* Content card */}
                                  <div className="flex-1 p-4 rounded-xl border border-outline-variant/20 bg-slate-50/50 dark:bg-slate-900/20 shadow-sm group-hover:border-primary transition-colors">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-[11px] font-bold text-primary dark:text-white">
                                        {act.title}
                                      </span>
                                      <span className="text-[10px] text-on-surface-variant font-medium">
                                        {act.time}
                                      </span>
                                    </div>
                                    <p className="text-xs text-on-surface-variant leading-relaxed">
                                      {act.description}
                                    </p>
                                  </div>
                                </div>
                            ))}
                          </div>
                      ) : (
                          <div className="text-center py-6 text-xs text-slate-400 italic">
                            Aucune activité récente enregistrée
                          </div>
                      )}
                    </section>

                  </div>

                  {/* Right Column (Shortcuts & Storage) */}
                  <div className="lg:col-span-4 space-y-6">
                    
                    {/* Shortcuts Section */}
                    <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-level-2">
                      <h3 className="font-bold text-sm text-on-surface mb-4">Raccourcis</h3>
                      
                      <div className="grid grid-cols-1 gap-3">
                        {/* Shortcut 1: Quick Scan/Upload */}
                        <button 
                            onClick={() => setIsUploadOpen(true)}
                            className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 border border-outline-variant/20 hover:border-primary hover:bg-primary/5 transition-all text-left group cursor-pointer"
                        >
                          <div className="p-2.5 bg-primary-container text-white rounded-lg group-hover:bg-primary transition-colors shrink-0">
                            <Upload className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="block font-bold text-xs text-on-surface">Numérisation Rapide</span>
                            <span className="block text-[10px] text-on-surface-variant mt-0.5 leading-tight">Archiver un nouveau document</span>
                          </div>
                        </button>

                        {/* Shortcut 2: Advanced Search */}
                        <button 
                            onClick={handleQuickSearchClick}
                            className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 border border-outline-variant/20 hover:border-secondary hover:bg-secondary/5 transition-all text-left group cursor-pointer"
                        >
                          <div className="p-2.5 bg-secondary-container text-on-secondary-container rounded-lg group-hover:bg-secondary group-hover:text-white transition-colors shrink-0">
                            <Search className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="block font-bold text-xs text-on-surface">Recherche Avancée</span>
                            <span className="block text-[10px] text-on-surface-variant mt-0.5 leading-tight">Explorer le coffre d&apos;archives</span>
                          </div>
                        </button>
                      </div>

                      {/* Storage indicator */}
                      <div className="mt-6 pt-6 border-t border-outline-variant/20">
                        <div className="flex justify-between items-end mb-2 text-[10px] font-bold">
                          <span className="text-on-surface-variant uppercase tracking-wider">Espace Stockage</span>
                          <span className="text-on-surface">{storagePercent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-2 overflow-hidden border border-outline-variant/10">
                          <div 
                              className="bg-primary dark:bg-gab-blue h-full rounded-full transition-all duration-500" 
                              style={{ width: `${storagePercent}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-on-surface-variant mt-2 text-right font-medium">
                          {totalSizeInMB} MB / 50.00 MB utilisés
                        </p>
                      </div>

                    </section>

                  </div>

                </div>

              </main>
          ) : (
              /* ================== VUE ARCHIVES & EXPLORATEUR ================== */
              <div className="flex-1 flex overflow-hidden">
                
                {/* Left Side: Arborescence tree panel */}
                <aside className="w-72 bg-surface-container-lowest border-r border-outline-variant/30 flex flex-col shrink-0 hidden lg:flex elevation-1 transition-all duration-300">
                  <div className="p-4 border-b border-outline-variant/20 bg-slate-50/30">
                    <h2 className="font-bold text-sm text-primary dark:text-white">Arborescence</h2>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 p-1.5 text-xs text-on-surface-variant font-bold">
                        <ChevronRight className="h-4 w-4 shrink-0 rotate-90 text-slate-400" />
                        <Folder className="h-4 w-4 shrink-0 text-gab-blue" />
                        <span>PNPE Gabon</span>
                      </div>
                      
                      <ul className="pl-6 mt-1 space-y-1">
                        {isDG && (
                            <li>
                              <button
                                  onClick={() => setSelectedServiceCode('TOUS')}
                                  className={`w-full flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-left text-xs font-semibold cursor-pointer ${
                                      selectedServiceCode === 'TOUS' ? 'text-primary dark:text-white bg-slate-100/80 dark:bg-slate-800/80' : 'text-on-surface-variant'
                                  }`}
                              >
                                <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                <span className="truncate">Tous les services</span>
                              </button>
                            </li>
                        )}
                        
                        {SERVICES.map((s) => {
                          const isSelected = selectedServiceCode === s.code
                          const isMyService = s.code === initialProfile.service
                          
                          // Restreindre si non DG et pas son service
                          if (!isDG && !isMyService) return null

                          return (
                              <li key={s.code}>
                                <button
                                    onClick={() => setSelectedServiceCode(s.code)}
                                    className={`w-full flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-left text-xs font-semibold cursor-pointer ${
                                        isSelected ? 'text-primary dark:text-white bg-slate-100/80 dark:bg-slate-800/80' : 'text-on-surface-variant'
                                    }`}
                                >
                                  <Folder className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-gab-yellow' : 'text-slate-400'}`} />
                                  <span className="truncate">{s.code} - {s.name}</span>
                                </button>
                              </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>
                </aside>

                {/* Central Panel: Search, tabs, and documents list */}
                <main className="flex-1 flex flex-col bg-[#FDFBF7] dark:bg-[#001229] overflow-hidden">
                  
                  {/* Action bar and breadcrumb */}
                  <div className="bg-surface-container-lowest border-b border-outline-variant/30 p-6 shrink-0 elevation-1 transition-all duration-300">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                      <div className="space-y-1">
                        <h2 className="text-lg md:text-xl font-extrabold text-primary dark:text-white">Explorateur d&apos;Archives</h2>
                        <p className="text-xs text-on-surface-variant font-medium">Consultez et gérez vos documents administratifs classés.</p>
                      </div>

                      {/* Desktop Search & Controls */}
                      <div className="flex flex-1 w-full lg:w-auto max-w-lg gap-2 justify-end">
                        <div className="relative flex-1">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input
                              ref={searchInputRef}
                              type="text"
                              placeholder="Rechercher par titre ou notes..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full bg-slate-100 dark:bg-slate-900 border border-outline-variant/30 rounded-xl py-2 pl-10 pr-4 font-medium text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                          />
                        </div>
                        <button 
                            onClick={fetchDocuments}
                            className="inline-flex items-center justify-center p-2.5 border border-outline-variant/40 dark:border-slate-800 rounded-xl text-on-surface bg-surface-container-lowest hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Actualiser la liste"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Service Tabs Navigation (only for DG on Explorateur page) */}
                    {isDG && (
                        <div className="mt-5 border-t border-outline-variant/10 pt-4">
                          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
                            <button
                                onClick={() => setSelectedServiceCode('TOUS')}
                                className={`pb-3 text-xs font-bold whitespace-nowrap px-1 transition-all relative cursor-pointer ${
                                    selectedServiceCode === 'TOUS' 
                                        ? 'text-primary dark:text-white border-b-2 border-primary dark:border-white' 
                                        : 'text-on-surface-variant hover:text-on-surface border-b-2 border-transparent'
                                }`}
                            >
                              TOUS LES SERVICES
                            </button>

                            {SERVICES.map((s) => (
                                <button
                                    key={s.code}
                                    onClick={() => setSelectedServiceCode(s.code)}
                                    className={`pb-3 text-xs font-bold whitespace-nowrap px-1 transition-all relative cursor-pointer ${
                                        selectedServiceCode === s.code 
                                            ? 'text-primary dark:text-white border-b-2 border-primary dark:border-white' 
                                            : 'text-on-surface-variant hover:text-on-surface border-b-2 border-transparent'
                                    }`}
                                >
                                  {s.name}
                                </button>
                            ))}
                          </div>
                        </div>
                    )}
                  </div>

                  {/* Scrollable list/grid of documents */}
                  <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-4">
                          <Loader2 className="h-9 w-9 animate-spin text-primary" />
                          <p className="text-xs text-on-surface-variant">Chargement des documents...</p>
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
                        <div className="text-center py-16 border border-dashed border-outline-variant/40 rounded-2xl bg-white dark:bg-transparent">
                          <FileText className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                          <h4 className="text-sm font-bold text-on-surface">Aucun document dans ce dossier</h4>
                          <p className="text-xs text-on-surface-variant mt-1 max-w-xs mx-auto">
                            {searchQuery ? 'Modifiez votre recherche pour trouver d&apos;autres archives.' : 'Vous pouvez y ajouter votre premier document PDF en cliquant sur le bouton d&apos;archivage.'}
                          </p>
                        </div>
                    )}
                  </div>

                </main>
              </div>
          )}

        </div>

        {/* Modal d&apos;Upload */}
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
