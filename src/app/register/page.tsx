'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, Lock, Mail, Loader2, AlertCircle, Shield } from 'lucide-react'
import { createClient } from '../../lib/supabase/client'
import { SERVICES, uiIdToDbService } from '../../lib/constants'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState('00000000-0000-0000-0000-000000000000') // DG par défaut
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const dbService = uiIdToDbService(selectedServiceId)

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            service: dbService,
          },
        },
      })

      if (signUpError) throw signUpError

      if (data.session) {
        // Redirection immédiate si confirmation d'email non requise
        router.push('/')
        router.refresh()
      } else {
        setSuccess(true)
      }
    } catch (err: unknown) {
      console.error(err)
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue lors de la création du compte.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-slate-900">
        <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-4">
          <div className="h-12 w-12 bg-gab-green/10 rounded-full flex items-center justify-center text-gab-green mx-auto">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Demande enregistrée</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Votre compte a été créé avec succès. Si la confirmation par e-mail est activée, veuillez vérifier votre boîte de réception pour activer votre accès.
          </p>
          <div className="pt-4">
            <Link
              href="/login"
              className="inline-block py-2.5 px-5 bg-navy-600 hover:bg-navy-700 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
            >
              Retour à la page de connexion
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 relative overflow-hidden bg-slate-900">
      
      {/* Cercles de fond décoratifs */}
      <div className="absolute top-1/4 left-1/4 h-80 w-80 bg-gab-blue/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-80 w-80 bg-gab-green/10 rounded-full blur-3xl" />
      
      {/* Gabon flag colors stripe */}
      <div className="absolute top-0 inset-x-0 h-2 w-full flex">
        <div className="h-full flex-1 bg-gab-green" />
        <div className="h-full flex-1 bg-gab-yellow" />
        <div className="h-full flex-1 bg-gab-blue" />
      </div>

      <div className="w-full max-w-md z-10 space-y-8 my-8">
        
        {/* Titre */}
        <div className="text-center space-y-2">
          <div className="h-16 w-16 bg-navy-950 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl border border-slate-700 shadow-xl mx-auto">
            PNPE
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Création de Compte Agent
            </h2>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mt-1">
              Portail d&apos;Archivage Gabon
            </p>
          </div>
        </div>

        {/* Carte de formulaire */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
          
          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="p-3.5 bg-red-950/30 border border-red-900/50 rounded-xl text-xs text-red-400 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Nom Complet */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Nom complet
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Jean-Pierre Mba"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Adresse e-mail professionnelle
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="agent@pnpe.ga"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 caractères"
                  minLength={6}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
            </div>

            {/* Sélection du Service */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Direction / Service d&apos;affectation
              </label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 cursor-pointer"
              >
                {SERVICES.map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                    {s.name} {s.code === 'DG' ? '(Défaut)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Bouton d'inscription */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-navy-600 hover:bg-navy-700 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg transition-colors disabled:opacity-50 cursor-pointer mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Création du compte...</span>
                </>
              ) : (
                <span>S&apos;enregistrer</span>
              )}
            </button>

          </form>

          {/* Lien de retour connexion */}
          <div className="mt-6 text-center text-xs text-slate-400 border-t border-slate-850 pt-5">
            Déjà inscrit ?{' '}
            <Link href="/login" className="text-gab-yellow font-semibold hover:underline">
              Se connecter
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
