import type { SupabaseClient } from '@supabase/supabase-js'
import { SPACE_DETAILS, WorkspaceType, getBlockedWorkspaces, timeRangesOverlap } from './types'

const WORKSPACES: WorkspaceType[] = SPACE_DETAILS.map((s) => s.id)
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface NewReservationInput {
  workspace: WorkspaceType
  date: string // YYYY-MM-DD
  timeFrom: string // HH:MM
  timeTo: string // HH:MM
  deskNumber: number | null
  firstName: string
  lastName: string
  phone: string
  dni: string | null
}

/** Valida y normaliza lo que manda el navegador. Devuelve un mensaje de error si algo no cierra. */
export function parseNewReservation(raw: any): { value?: NewReservationInput; error?: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Datos de reserva inválidos' }

  const workspace = String(raw.workspace) as WorkspaceType
  if (!WORKSPACES.includes(workspace)) return { error: 'Espacio inválido' }

  const date = String(raw.date || '')
  if (!DATE_RE.test(date) || isNaN(new Date(`${date}T12:00:00`).getTime())) {
    return { error: 'Fecha inválida' }
  }

  const timeFrom = String(raw.timeFrom || '')
  const timeTo = String(raw.timeTo || '')
  if (!TIME_RE.test(timeFrom) || !TIME_RE.test(timeTo) || timeFrom >= timeTo) {
    return { error: 'Horario inválido' }
  }

  let deskNumber: number | null = null
  if (workspace === 'escritorio' && raw.deskNumber != null && raw.deskNumber !== '') {
    deskNumber = Number(raw.deskNumber)
    const deskCount = SPACE_DETAILS.find((s) => s.id === 'escritorio')?.deskCount ?? 0
    if (!Number.isInteger(deskNumber) || deskNumber < 1 || deskNumber > deskCount) {
      return { error: 'Número de escritorio inválido' }
    }
  }

  const firstName = String(raw.firstName || '').trim().slice(0, 60)
  const lastName = String(raw.lastName || '').trim().slice(0, 60)
  const phone = String(raw.phone || '').trim().slice(0, 30)
  if (!firstName || !lastName) return { error: 'Falta nombre o apellido' }
  if (phone.replace(/\D/g, '').length < 10) return { error: 'Teléfono inválido (incluí el código de área)' }

  // DNI: opcional; si viene, 7 u 8 números (se aceptan puntos)
  const dniRaw = String(raw.dni ?? '').replace(/[.\s-]/g, '')
  let dni: string | null = null
  if (dniRaw) {
    if (!/^\d{7,8}$/.test(dniRaw)) return { error: 'El DNI tiene que tener 7 u 8 números (sin puntos).' }
    dni = dniRaw
  }

  return { value: { workspace, date, timeFrom, timeTo, deskNumber, firstName, lastName, phone, dni } }
}

/** Revisa contra la base (no contra el navegador) si el horario ya está tomado. */
export async function hasConflict(supabase: SupabaseClient, r: NewReservationInput): Promise<boolean> {
  const { data, error } = await supabase
    .from('reservations')
    .select('workspace, time_from, time_to, desk_number, status')
    .eq('date', r.date)
    .neq('status', 'cancelled')

  if (error) throw new Error('No se pudo verificar la disponibilidad')

  return (data ?? []).some((row: any) => {
    if (!timeRangesOverlap(r.timeFrom, r.timeTo, row.time_from, row.time_to)) return false
    if (r.workspace === 'escritorio' && r.deskNumber != null) {
      return row.workspace === 'escritorio' && row.desk_number === r.deskNumber
    }
    return row.workspace === r.workspace || getBlockedWorkspaces(r.workspace).includes(row.workspace)
  })
}
