import { redirect } from 'next/navigation'
import { createClient } from '../lib/supabase/server'
import Dashboard from '../components/Dashboard'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Récupérer le profil utilisateur avec son service associé
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, service')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    console.error('Profil non trouvé pour l\'utilisateur:', user.id, error)
    // Sécurité : Déconnexion et redirection si le profil n'a pas été généré par le trigger
    await supabase.auth.signOut()
    redirect('/login')
  }

  return <Dashboard initialProfile={profile} />
}
