import { createHash, randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { WORKSPACE_LABELS, type WorkspaceType } from './types'
import { reservationWindow, ENTRY_TOLERANCE_MIN } from './time'

export const PZ_COOKIE = 'fw_pz'
export const EXTEND_GRACE_MIN = 60 // después de terminar, 1 hora para extender sin perder el lugar

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex')
export const newToken = () => randomBytes(32).toString('base64url')

export function displayName(first: string, last: string): string {
  const f = (first || '').trim().split(/\s+/)[0] || 'Cliente'
  const l = (last || '').trim()
  return l ? `${f} ${l[0].toUpperCase()}.` : f
}

export function placeLabel(r: { workspace: string; desk_number?: number | null }): string {
  if (r.workspace === 'escritorio') return r.desk_number ? `Escritorio N.° ${r.desk_number}` : 'Escritorio compartido'
  return WORKSPACE_LABELS[r.workspace as WorkspaceType] || r.workspace
}

export interface LoadedSession {
  session: any
  reservation: any
  startMs: number
  endMs: number
  /** dentro del horario (con 15 min de tolerancia al entrar) */
  active: boolean
  /** terminó el horario */
  ended: boolean
  /** terminó hace menos de una hora: todavía puede extender */
  canExtendAfterEnd: boolean
}

/** Lee la sesión de la pizarra desde la cookie y verifica que la reserva siga vigente. */
export async function loadSession(supabase: SupabaseClient): Promise<LoadedSession | null> {
  const token = (await cookies()).get(PZ_COOKIE)?.value
  if (!token) return null
  const { data: session } = await supabase.from('pizarra_sessions').select('*').eq('token_hash', hashToken(token)).maybeSingle()
  if (!session) return null
  const { data: reservation } = await supabase.from('reservations').select('*').eq('id', session.reservation_id).maybeSingle()
  if (!reservation || !['confirmed', 'completed'].includes(reservation.status)) return null
  const { startMs, endMs } = reservationWindow(reservation)
  const now = Date.now()
  // Si el staff marcó la salida antes, la hora real manda
  const realEnd = reservation.actual_time_to ? Math.min(endMs, reservationWindow({ ...reservation, time_to: reservation.actual_time_to }).endMs) : endMs
  const active = reservation.status === 'confirmed' && now >= startMs - ENTRY_TOLERANCE_MIN * 60000 && now <= realEnd
  const ended = now > realEnd || reservation.status === 'completed'
  return {
    session, reservation, startMs, endMs: realEnd, active, ended,
    // si se finalizó sola (no porque el staff marcó la salida), todavía puede pedir extender durante la hora siguiente
    canExtendAfterEnd: ended && (reservation.status === 'confirmed' || (reservation.status === 'completed' && reservation.auto_finalized === true))
      && now <= endMs + EXTEND_GRACE_MIN * 60000,
  }
}

export function sessionCookie(token: string) {
  return {
    name: PZ_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 18,
  }
}
