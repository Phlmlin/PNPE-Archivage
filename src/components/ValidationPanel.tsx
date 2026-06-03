'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUserRole } from '@/hooks/useUserRole'

interface Props {
  document: {
    id: string
    title: string
    status: string
    direction_id: string
  }
  onUpdated: () => void
}

export function ValidationPanel({ document, onUpdated }: Props) {
  const { profile, can } = useUserRole()
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  if (!can.validateDocuments) return null

  async function handleAction(action: 'approve' | 'reject') {
    setLoading(true)

    let newStatus = ''
    let eventAction = ''

    if (profile?.role === 'chef_direction') {
      newStatus = action === 'approve' ? 'en_attente_dg' : 'rejete'
      eventAction = action === 'approve' ? 'approve_chef' : 'reject_chef'
    } else if (profile?.role === 'dg_superviseur' || profile?.role === 'super_admin') {
      newStatus = action === 'approve' ? 'approuve' : 'rejete'
      eventAction = action === 'approve' ? 'approve_dg' : 'reject_dg'
    }

    const updateData: Record<string, any> = { status: newStatus }
    if (action === 'reject') updateData.rejection_reason = comment
    if (profile?.role === 'chef_direction' && action === 'approve') {
      updateData.validated_by_chef = profile.id
      updateData.validated_by_chef_at = new Date().toISOString()
    }
    if ((profile?.role === 'dg_superviseur' || profile?.role === 'super_admin') && action === 'approve') {
      updateData.validated_by_dg = profile.id
      updateData.validated_by_dg_at = new Date().toISOString()
    }

    try {
      const { error: docError } = await supabase.from('documents').update(updateData).eq('id', document.id)
      if (docError) throw docError

      const { error: eventError } = await supabase.from('workflow_events').insert({
        document_id: document.id,
        actor_id: profile?.id,
        action: eventAction,
        comment: comment || null,
      })
      if (eventError) throw eventError

      // Log audit event
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: action === 'approve' ? 'document.approve' : 'document.reject',
          resource_type: 'document',
          resource_id: document.id,
          resource_label: document.title,
          metadata: { comment: comment || null, role: profile?.role },
        })
      }

      setComment('')
      onUpdated()
    } catch (err) {
      console.error('Error during validation action:', err)
      alert('Une erreur est survenue lors de la validation.')
    } finally {
      setLoading(false)
    }
  }

  const canActOnThis =
    (profile?.role === 'chef_direction' &&
      profile.direction_id === document.direction_id &&
      document.status === 'en_attente_chef') ||
    (['dg_superviseur', 'super_admin'].includes(profile?.role ?? '') &&
      document.status === 'en_attente_dg')

  if (!canActOnThis) return null

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 border border-outline-variant/30 rounded-xl p-4 space-y-3 mt-4">
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant">
        Action requise sur ce document
      </div>
      <textarea
        className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-white dark:bg-slate-950 resize-none outline-none focus:border-primary transition-all text-on-surface"
        rows={2}
        placeholder="Commentaire (obligatoire si rejet)..."
        value={comment}
        onChange={e => setComment(e.target.value)}
      />
      <div className="flex gap-3">
        <button
          onClick={() => handleAction('approve')}
          disabled={loading}
          className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer text-center"
        >
          ✅ Approuver
        </button>
        <button
          onClick={() => handleAction('reject')}
          disabled={loading || !comment.trim()}
          className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer text-center"
        >
          ❌ Rejeter
        </button>
      </div>
    </div>
  )
}
