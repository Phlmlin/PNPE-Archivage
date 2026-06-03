'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Users, 
  Search, 
  RefreshCw, 
  UserPlus, 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  Lock, 
  UserCheck, 
  UserX, 
  CheckCircle,
  Calendar,
  X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUserRole, UserRole } from '@/hooks/useUserRole'
import { RoleBadge } from '@/components/ui/RoleBadge'
import { SERVICES } from '@/lib/constants'

interface UserProfile {
  id: string
  full_name: string
  role: UserRole
  direction_id: string
  is_active: boolean
  delegated_role?: UserRole
  delegation_expires_at?: string
  directions: {
    code: string
    label: string
  } | null
}

const ROLES_LIST: { value: UserRole; label: string; desc: string }[] = [
  { value: 'lecteur', label: 'Lecteur', desc: 'Accès en lecture seule aux archives validées de sa direction.' },
  { value: 'agent_archiviste', label: 'Agent Archiviste', desc: 'Dépôt de documents (brouillon) et soumission.' },
  { value: 'chef_direction', label: 'Chef de Direction', desc: 'Validation niveau 1 pour sa direction et gestion des agents.' },
  { value: 'dg_superviseur', label: 'DG Superviseur', desc: 'Validation niveau 2, accès global à toutes les directions.' },
  { value: 'auditeur', label: 'Auditeur de Sécurité', desc: 'Accès en lecture globale et consultation du journal d\'audit.' },
  { value: 'super_admin', label: 'Super Administrateur', desc: 'Contrôle total sur l\'ensemble du système et des rôles.' }
]

export default function UsersAdminPage() {
  const router = useRouter()
  const { profile: currentProfile, loading: roleLoading, can } = useUserRole()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [directionFilter, setDirectionFilter] = useState('ALL')
  
  // Modal Edit States
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [newRole, setNewRole] = useState<UserRole>('lecteur')
  const [isDelegationActive, setIsDelegationActive] = useState(false)
  const [delegatedRole, setDelegatedRole] = useState<UserRole>('lecteur')
  const [delegationExpiry, setDelegationExpiry] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      
      let query = supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          role,
          direction_id,
          is_active,
          delegated_role,
          delegation_expires_at,
          directions (
            code,
            label
          )
        `)
        .order('full_name', { ascending: true })

      const { data, error } = await query

      if (error) throw error
      
      const formattedUsers: UserProfile[] = (data || []).map((u: any) => {
        const dir = Array.isArray(u.directions) ? u.directions[0] : u.directions
        return {
          id: u.id,
          full_name: u.full_name,
          role: u.role,
          direction_id: u.direction_id,
          is_active: u.is_active,
          delegated_role: u.delegated_role,
          delegation_expires_at: u.delegation_expires_at,
          directions: dir ? { code: dir.code, label: dir.label } : null
        }
      })

      setUsers(formattedUsers)
    } catch (err) {
      console.error('Erreur lors du chargement des profils:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!roleLoading && can.manageUsers) {
      fetchUsers()
    }
  }, [roleLoading, can.manageUsers])

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#001229]">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-xs text-slate-500">Validation des autorisations...</p>
        </div>
      </div>
    )
  }

  if (!can.manageUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#001229] px-4">
        <div className="max-w-md w-full bg-white dark:bg-[#001f3d] border border-outline-variant/30 rounded-2xl p-8 text-center shadow-lg">
          <Lock className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Accès Refusé</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Vous ne disposez pas des privilèges nécessaires pour accéder à la gestion des utilisateurs.
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour au tableau de bord</span>
          </button>
        </div>
      </div>
    )
  }

  const handleToggleStatus = async (user: UserProfile) => {
    const actionText = user.is_active ? 'désactiver' : 'activer'
    if (!window.confirm(`Êtes-vous sûr de vouloir ${actionText} le compte de ${user.full_name} ?`)) {
      return
    }

    try {
      const supabase = createClient()
      const newStatus = !user.is_active
      
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus })
        .eq('id', user.id)

      if (error) throw error

      // Log Audit Event
      await supabase.from('audit_logs').insert({
        user_id: currentProfile?.id,
        action: 'user.status',
        resource_type: 'user',
        resource_id: user.id,
        resource_label: user.full_name,
        metadata: { new_status: newStatus ? 'active' : 'inactive' }
      })

      setUsers(users.map(u => u.id === user.id ? { ...u, is_active: newStatus } : u))
    } catch (err: any) {
      console.error(err)
      alert(`Erreur lors du changement de statut: ${err.message}`)
    }
  }

  const openEditModal = (user: UserProfile) => {
    setSelectedUser(user)
    setNewRole(user.role)
    if (user.delegated_role && user.delegation_expires_at) {
      setIsDelegationActive(true)
      setDelegatedRole(user.delegated_role)
      // Format Date for datetime-local (YYYY-MM-DDTHH:MM)
      const date = new Date(user.delegation_expires_at)
      const formattedDate = date.toISOString().slice(0, 16)
      setDelegationExpiry(formattedDate)
    } else {
      setIsDelegationActive(false)
      setDelegatedRole('lecteur')
      setDelegationExpiry('')
    }
  }

  const handleSaveUserPermissions = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    try {
      setSubmitting(true)
      const supabase = createClient()

      const updatePayload: Record<string, any> = {
        role: newRole
      }

      if (isDelegationActive && delegatedRole && delegationExpiry) {
        updatePayload.delegated_role = delegatedRole
        updatePayload.delegation_expires_at = new Date(delegationExpiry).toISOString()
      } else {
        updatePayload.delegated_role = null
        updatePayload.delegation_expires_at = null
      }

      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', selectedUser.id)

      if (error) throw error

      // Log Audit Events
      if (newRole !== selectedUser.role) {
        await supabase.from('audit_logs').insert({
          user_id: currentProfile?.id,
          action: 'user.update_role',
          resource_type: 'user',
          resource_id: selectedUser.id,
          resource_label: selectedUser.full_name,
          metadata: { old_role: selectedUser.role, new_role: newRole }
        })
      }

      if (isDelegationActive && (delegatedRole !== selectedUser.delegated_role || new Date(delegationExpiry).toISOString() !== selectedUser.delegation_expires_at)) {
        await supabase.from('audit_logs').insert({
          user_id: currentProfile?.id,
          action: 'user.delegation',
          resource_type: 'user',
          resource_id: selectedUser.id,
          resource_label: selectedUser.full_name,
          metadata: { delegated_role: delegatedRole, expires_at: delegationExpiry }
        })
      } else if (!isDelegationActive && selectedUser.delegated_role) {
        await supabase.from('audit_logs').insert({
          user_id: currentProfile?.id,
          action: 'user.delegation_cancel',
          resource_type: 'user',
          resource_id: selectedUser.id,
          resource_label: selectedUser.full_name,
          metadata: {}
        })
      }

      // Close and Refresh
      setSelectedUser(null)
      fetchUsers()
    } catch (err: any) {
      console.error(err)
      alert(`Erreur lors de la mise à jour des habilitations: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  // Filtrage selon le rôle du connecteur
  const visibleUsers = users.filter(user => {
    // Si c'est un chef de direction, il ne peut voir que sa direction
    if (currentProfile?.role === 'chef_direction') {
      return user.direction_id === currentProfile.direction_id
    }
    return true
  })

  // Recherche & Filtres UI
  const filteredUsers = visibleUsers.filter(user => {
    const matchesDirection = directionFilter === 'ALL' || user.direction_id === directionFilter
    
    const query = searchQuery.toLowerCase().trim()
    if (!query) return matchesDirection

    const name = user.full_name?.toLowerCase() || ''
    const serviceCode = user.directions?.code?.toLowerCase() || ''

    return matchesDirection && (
      name.includes(query) ||
      serviceCode.includes(query)
    )
  })

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#001229] text-slate-800 dark:text-slate-100 flex flex-col">
      {/* Gabon Stripe */}
      <div className="h-1.5 w-full flex shrink-0">
        <div className="h-full flex-1 bg-gab-green" />
        <div className="h-full flex-1 bg-gab-yellow" />
        <div className="h-full flex-1 bg-gab-blue" />
      </div>

      <div className="flex-1 max-w-[1440px] w-full mx-auto p-6 md:p-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary dark:text-white">
              <Users className="h-6 w-6 text-gab-yellow shrink-0" />
              <h1 className="text-xl md:text-2xl font-extrabold">Gestion des Habilitations</h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {currentProfile?.role === 'super_admin' 
                ? 'Administration générale des rôles, de l\'activité des comptes et des délégations temporaires de signature.'
                : `Gestion des agents de votre direction administrative (${currentProfile?.direction_code}).`
              }
            </p>
          </div>

          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#001f3d] hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour au tableau de bord</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-[#001f3d] border border-outline-variant/30 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un agent par nom ou service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-900 border border-outline-variant/30 rounded-xl py-2.5 pl-10 pr-4 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-on-surface font-medium"
            />
          </div>

          {/* Direction Filter (only visible to Super Admin) */}
          {currentProfile?.role === 'super_admin' && (
            <div className="w-full sm:w-64">
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-900 border border-outline-variant/30 rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-primary outline-none text-on-surface font-semibold cursor-pointer"
              >
                <option value="ALL">Toutes les directions</option>
                {SERVICES.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2.5 border border-outline-variant/40 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-sm disabled:opacity-50 shrink-0"
            title="Actualiser la liste"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-[#001f3d] border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/55 dark:bg-slate-900/40 border-b border-outline-variant/20 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Agent</th>
                  <th className="py-3.5 px-5">Direction / Service</th>
                  <th className="py-3.5 px-5">Rôle principal</th>
                  <th className="py-3.5 px-5">Délégation de Rôle</th>
                  <th className="py-3.5 px-5">Statut Compte</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-750 dark:text-slate-300 divide-y divide-outline-variant/10">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-450 italic">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                      Chargement des profils d&apos;agents...
                    </td>
                  </tr>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => {
                    const isSelf = user.id === currentProfile?.id
                    const isDelegationActiveNow = user.delegated_role && user.delegation_expires_at && new Date(user.delegation_expires_at) > new Date()

                    return (
                      <tr key={user.id} className="hover:bg-slate-100/35 dark:hover:bg-slate-800/20 transition-all">
                        {/* Agent Name */}
                        <td className="py-4 px-5 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-850 flex items-center justify-center font-bold text-xs text-primary dark:text-slate-300">
                              {user.full_name ? user.full_name.charAt(0) : '?'}
                            </div>
                            <div className="flex flex-col">
                              <span>{user.full_name}</span>
                              {isSelf && <span className="text-[9px] text-primary font-bold">(Vous)</span>}
                            </div>
                          </div>
                        </td>

                        {/* Direction / Service */}
                        <td className="py-4 px-5 font-semibold text-slate-650 dark:text-slate-400">
                          {user.directions?.label || 'Non affecté'} ({user.directions?.code || '-'})
                        </td>

                        {/* Rôle Principal */}
                        <td className="py-4 px-5">
                          <RoleBadge role={user.role} />
                        </td>

                        {/* Delegation Info */}
                        <td className="py-4 px-5">
                          {isDelegationActiveNow ? (
                            <div className="flex flex-col gap-1">
                              <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                                <Clock className="h-3.5 w-3.5 shrink-0" />
                                Rôle : {user.delegated_role}
                              </span>
                              <span className="text-[9px] text-slate-450 dark:text-slate-500 font-mono">
                                Expire le : {new Date(user.delegation_expires_at!).toLocaleDateString('fr-GA')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Aucune délégation active</span>
                          )}
                        </td>

                        {/* Account Status */}
                        <td className="py-4 px-5">
                          {user.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20">
                              Actif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/20">
                              Désactivé
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => openEditModal(user)}
                              disabled={isSelf}
                              className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#001f3d] hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              Habilitations
                            </button>

                            <button
                              onClick={() => handleToggleStatus(user)}
                              disabled={isSelf}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                                user.is_active
                                  ? 'border-rose-200 hover:bg-rose-50 text-rose-600 dark:border-rose-900/30 dark:hover:bg-rose-950/20'
                                  : 'border-emerald-250 hover:bg-emerald-50 text-emerald-600 dark:border-emerald-900/30 dark:hover:bg-emerald-950/20'
                              }`}
                              title={user.is_active ? 'Désactiver le compte' : 'Activer le compte'}
                            >
                              {user.is_active ? (
                                <UserX className="h-4.5 w-4.5" />
                              ) : (
                                <UserCheck className="h-4.5 w-4.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-450 italic">
                      Aucun profil trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Permissions / Delegations Edit Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />

          <div className="relative w-full max-w-lg bg-white dark:bg-[#001f3d] border border-outline-variant/30 rounded-2xl shadow-2xl overflow-hidden z-10">
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-outline-variant/20 bg-slate-50 dark:bg-slate-900/30">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-gab-yellow" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Habilitations : {selectedUser.full_name}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedUser(null)} 
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveUserPermissions} className="p-5 space-y-4">
              
              {/* Main Role Selection */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5">
                  Rôle principal de l&apos;agent
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900 border border-outline-variant/30 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-semibold cursor-pointer"
                >
                  {ROLES_LIST.map((r) => {
                    // Les chefs de direction ne peuvent pas créer des super_admins, dg_superviseurs ou auditeurs
                    if (currentProfile?.role === 'chef_direction' && ['super_admin', 'dg_superviseur', 'auditeur'].includes(r.value)) {
                      return null
                    }
                    return (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    )
                  })}
                </select>
                <span className="text-[10px] text-slate-450 dark:text-slate-550 mt-1 block">
                  {ROLES_LIST.find(r => r.value === newRole)?.desc}
                </span>
              </div>

              {/* Temporary Delegation Toggler */}
              <div className="pt-4 border-t border-outline-variant/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Activer une délégation temporaire
                    </span>
                    <span className="text-[10px] text-slate-450 dark:text-slate-550">
                      Permet d&apos;attribuer temporairement des droits de validation.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isDelegationActive}
                    onChange={(e) => setIsDelegationActive(e.target.checked)}
                    className="w-4 h-4 text-primary bg-slate-100 border-slate-300 rounded focus:ring-primary cursor-pointer"
                  />
                </div>

                {isDelegationActive && (
                  <div className="space-y-4 bg-slate-50 dark:bg-slate-900/40 p-4 border border-outline-variant/30 rounded-xl animate-none">
                    
                    {/* Delegated Role Select */}
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5">
                        Rôle temporaire délégué
                      </label>
                      <select
                        value={delegatedRole}
                        onChange={(e) => setDelegatedRole(e.target.value as UserRole)}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-outline-variant/30 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-semibold cursor-pointer"
                      >
                        {ROLES_LIST.map((r) => {
                          if (currentProfile?.role === 'chef_direction' && ['super_admin', 'dg_superviseur', 'auditeur'].includes(r.value)) {
                            return null
                          }
                          return (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          )
                        })}
                      </select>
                    </div>

                    {/* Expiration Date Input */}
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5">
                        Date d&apos;expiration automatique
                      </label>
                      <div className="relative">
                        <input
                          type="datetime-local"
                          required={isDelegationActive}
                          value={delegationExpiry}
                          onChange={(e) => setDelegationExpiry(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-outline-variant/30 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-semibold cursor-pointer"
                        />
                      </div>
                      <span className="text-[9px] text-amber-600 dark:text-amber-400 mt-1.5 block font-medium">
                        ⚠️ Une fois cette date dépassée, l&apos;agent retrouvera automatiquement son rôle principal.
                      </span>
                    </div>

                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-outline-variant/20 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  disabled={submitting}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting || (isDelegationActive && !delegationExpiry)}
                  className="px-5 py-2 bg-primary hover:bg-primary/95 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-55 cursor-pointer shadow-sm animate-none"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <span>Valider les modifications</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}
