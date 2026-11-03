import type { SupabaseClient } from '@supabase/supabase-js'
import { argentinaNow } from './active-reservation'
import { reservationWindow } from './time'

/**
 * Finaliza solas las reservas cuyo horario ya terminó (pasan a "Ya se fueron" en el panel).
 * No toca las que tienen un pedido de extensión esperando al staff.
 * Quedan marcadas como automáticas: si el cliente pide extender dentro de la hora siguiente, se reabren.
 */
export async function finalizeDue(supabase: SupabaseClient): Promise<number> {
  const { today } = argentinaNow()
  const { data } = await supabase.from('reservations').select('id, date, time_from, time_to').eq('status', 'confirmed').lte('date', today)
  const now = Date.now()
  const due = (data ?? []).filter((r: any) => reservationWindow(r).endMs <= now)
  if (due.length === 0) return 0
  const { data: pend } = await supabase.from('extension_requests').select('reservation_id').eq('status', 'pendiente').in('reservation_id', due.map((r: any) => r.id))
  const waiting = new Set((pend ?? []).map((p: any) => p.reservation_id))
  let n = 0
  for (const r of due) {
    if (waiting.has(r.id)) continue
    const { error } = await supabase.from('reservations')
      .update({ status: 'completed', actual_time_to: r.time_to, completed_at: new Date().toISOString(), auto_finalized: true })
      .eq('id', r.id).eq('status', 'confirmed')
    if (!error) n++
  }
  return n
}
