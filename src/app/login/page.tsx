'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '../../lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      router.push('/')
      router.refresh()
    } catch (err: unknown) {
      console.error(err)
      const errorMessage = err instanceof Error ? err.message : 'Identifiants invalides ou erreur de connexion.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
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

      <div className="w-full max-w-md z-10 space-y-8">
        
        {/* Titre */}
        <div className="text-center space-y-2">
          <div className="h-16 w-16 bg-navy-950 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl border border-slate-700 shadow-xl mx-auto">
            PNPE
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Portail d&apos;Archivage Gabon
            </h2>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mt-1">
              Programme National de Promotion de l&apos;Emploi
            </p>
          </div>
        </div>

        {/* Carte de formulaire */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
          <h3 className="text-lg font-bold text-white mb-6">Connexion Agent</h3>
          
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3.5 bg-red-950/30 border border-red-900/50 rounded-xl text-xs text-red-400 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

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
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
              </div>
            </div>

            {/* Bouton de soumission */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-navy-600 hover:bg-navy-700 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg transition-colors disabled:opacity-50 cursor-pointer mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <span>Accéder aux archives</span>
              )}
            </button>
          </form>

          {/* Lien d'inscription */}
          <div className="mt-6 text-center text-xs text-slate-400 border-t border-slate-850 pt-5">
            Pas encore de compte ?{' '}
            <Link href="/register" className="text-gab-yellow font-semibold hover:underline">
              Demander un accès (S&apos;enregistrer)
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-500">
          Système protégé. L&apos;accès non autorisé est passible de sanctions pénales.
        </p>

      </div>
    </div>
  )
}
