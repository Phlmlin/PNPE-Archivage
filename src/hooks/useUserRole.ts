import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export type UserRole =
  | 'super_admin'
  | 'dg_superviseur'
  | 'chef_direction'
  | 'agent_archiviste'
  | 'lecteur'
  | 'auditeur'

export interface UserProfile {
  id: string
  full_name: string
  role: UserRole
  direction_id: string
  direction_code: string
  direction_label: string
  is_active: boolean
  delegated_role?: UserRole
  delegation_expires_at?: string
}

export function useUserRole() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const { data, error } = await supabase
          .from('profiles')
          .select(`*, directions(code, label, color)`)
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching user profile:', error)
        }

        if (data) {
          // Vérifier si une délégation temporaire est active
          const effectiveRole = data.delegated_role &&
            data.delegation_expires_at &&
            new Date(data.delegation_expires_at) > new Date()
            ? data.delegated_role
            : data.role

          setProfile({
            ...data,
            role: effectiveRole,
            direction_code: data.directions?.code,
            direction_label: data.directions?.label,
          })
        }
      } catch (err) {
        console.error('Error in useUserRole hook:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const can = {
    uploadDocuments: profile?.role && ['super_admin', 'chef_direction', 'agent_archiviste'].includes(profile.role),
    validateDocuments: profile?.role && ['super_admin', 'dg_superviseur', 'chef_direction'].includes(profile.role),
    manageUsers: profile?.role && ['super_admin', 'chef_direction'].includes(profile.role),
    viewAllDirections: profile?.role && ['super_admin', 'dg_superviseur', 'auditeur'].includes(profile.role),
    viewAuditLogs: profile?.role && ['super_admin', 'dg_superviseur', 'auditeur'].includes(profile.role),
    deleteDocuments: profile?.role && ['super_admin', 'chef_direction', 'agent_archiviste'].includes(profile.role),
    exportReports: profile?.role && ['super_admin', 'dg_superviseur', 'chef_direction', 'auditeur'].includes(profile.role),
    configureSystem: profile?.role === 'super_admin',
  }

  return { profile, loading, can }
}
