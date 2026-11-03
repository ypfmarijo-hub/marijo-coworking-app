import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

/** Un usuario es staff si en Supabase tiene app_metadata.role = "staff" (no lo puede cambiar él mismo). */
function isStaffUser(user: User | null | undefined): boolean {
  return user?.app_metadata?.role === 'staff'
}

/** Lee la sesión del staff desde las cookies del pedido. */
export async function getStaffUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {
        // En rutas de API solo leemos; la renovación de la sesión la hace proxy.ts
      },
    },
  })
  const { data } = await supabase.auth.getUser()
  return isStaffUser(data.user) ? data.user : null
}

/**
 * Para usar al inicio de cada ruta de API interna:
 *   const denied = await requireStaff(); if (denied) return denied
 */
export async function requireStaff(): Promise<NextResponse | null> {
  const user = await getStaffUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado. Iniciá sesión como staff.' }, { status: 401 })
  }
  return null
}
