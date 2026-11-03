import type { SupabaseClient } from '@supabase/supabase-js'
import { getBlockedWorkspaces, timeRangesOverlap, type WorkspaceType } from './types'
import { getPricing } from './pricing'
import { addHoursToTime, CLOSING_TIME } from './time'

export const MAX_EXTENSION_HOURS = 4

/** Cuántas horas seguidas se puede extender una reserva sin chocar con otra ni pasar el cierre (22:00). */
export async function maxExtensionHours(supabase: SupabaseClient, r: any): Promise<number> {
  const { data } = await supabase.from('reservations')
    .select('id, workspace, desk_number, time_from, time_to, status')
    .eq('date', r.date).neq('status', 'cancelled').neq('id', r.id)
  const others = data ?? []
  let max = 0
  for (let h = 1; h <= MAX_EXTENSION_HOURS; h++) {
    const newEnd = addHoursToTime(r.time_to, h)
    if (newEnd > CLOSING_TIME) break
    const clash = others.some((o: any) => {
      if (!timeRangesOverlap(r.time_to, newEnd, o.time_from, o.time_to)) return false
      if (r.workspace === 'escritorio' && r.desk_number != null) return o.workspace === 'escritorio' && o.desk_number === r.desk_number
      return o.workspace === r.workspace || getBlockedWorkspaces(r.workspace as WorkspaceType).includes(o.workspace)
    })
    if (clash) break
    max = h
  }
  return max
}

/** Precio por hora actual (el que fija el staff en Ajustes). La extensión siempre se cobra por hora, aunque la reserva sea un combo. */
export async function pricePerHour(supabase: SupabaseClient, workspace: string): Promise<number> {
  const { prices } = await getPricing(supabase)
  return prices[workspace as WorkspaceType] ?? 0
}
