'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock, Mail, Loader2, AlertCircle, Database } from 'lucide-react'
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
      <div className="min-h-screen flex flex-col justify-center items-center px-4 relative overflow-hidden bg-primary text-white">
        
        {/* Decorative Blurred Circles */}
        <div className="absolute top-1/4 left-1/4 h-80 w-80 bg-secondary/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 bg-on-primary-container/15 rounded-full blur-[100px] pointer-events-none" />
        
        {/* Gabon flag colors stripe */}
        <div className="absolute top-0 inset-x-0 h-1.5 w-full flex">
          <div className="h-full flex-1 bg-gab-green" />
          <div className="h-full flex-1 bg-gab-yellow" />
          <div className="h-full flex-1 bg-gab-blue" />
        </div>

        <div className="w-full max-w-md z-10 space-y-6">
          
          {/* Brand header */}
          <div className="text-center space-y-2">
            <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl mx-auto overflow-hidden p-2">
              <img src="/pnpe-emblem.svg" alt="PNPE Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Portail d&apos;Archivage Gabon
              </h2>
              <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold mt-1">
                Programme National de Promotion de l&apos;Emploi
              </p>
            </div>
          </div>

          {/* Form Card (Glassmorphism) */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
            <h3 className="text-base font-bold text-white mb-6">Connexion Agent</h3>
            
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                  <div className="p-3.5 bg-red-950/30 border border-red-900/50 rounded-xl text-xs text-red-400 flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-white/60 mb-1.5">
                  Adresse e-mail professionnelle
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="agent@pnpe.ga"
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 focus:border-white/30 rounded-xl text-white placeholder-white/30 text-xs focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-white/60 mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 focus:border-white/30 rounded-xl text-white placeholder-white/30 text-xs focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                  />
                </div>
              </div>

              {/* Submit button */}
              <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-secondary hover:bg-secondary/95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01] transition-all disabled:opacity-50 cursor-pointer mt-6"
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

            {/* Registration link */}
            <div className="mt-6 text-center text-xs text-white/50 border-t border-white/10 pt-5">
              Pas encore de compte ?{' '}
              <Link href="/register" className="text-gab-yellow font-bold hover:underline">
                Demander un accès
              </Link>
            </div>
          </div>

          {/* Footer security message */}
          <p className="text-center text-[10px] text-white/30">
            Système protégé. L&apos;accès non autorisé est passible de sanctions pénales.
          </p>

        </div>
      </div>
  )
}
