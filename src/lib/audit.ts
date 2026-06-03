import { supabase as defaultSupabase } from './supabaseClient'

export async function logAuditEvent({
  action,
  resourceType,
  resourceId,
  resourceLabel,
  metadata = {},
  supabaseClient,
}: {
  action: string
  resourceType?: string
  resourceId?: string
  resourceLabel?: string
  metadata?: Record<string, any>
  supabaseClient?: any
}) {
  try {
    const client = supabaseClient || defaultSupabase
    const { data: { user } } = await client.auth.getUser()
    if (!user) return

    const { error } = await client.from('audit_logs').insert({
      user_id: user.id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      resource_label: resourceLabel,
      metadata,
    })
    if (error) {
      console.error('Erreur lors de l\'écriture du log d\'audit:', error)
    }
  } catch (err) {
    console.error('Erreur lors du log d\'audit:', err)
  }
}
