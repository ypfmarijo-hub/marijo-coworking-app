import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY, getServiceRoleKey } from './config'

/** Cliente público (clave anon). Solo puede lo que permitan las reglas RLS. */
export function createClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

/**
 * Cliente con la clave secreta: saltea las reglas RLS.
 * Usar SOLO en rutas del servidor que ya validaron quién llama.
 */
export function createServiceClient() {
  return createSupabaseClient(SUPABASE_URL, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
