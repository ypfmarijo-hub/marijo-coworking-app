import type { SupabaseClient } from '@supabase/supabase-js'
import { phoneKey, phoneSearchPattern, samePhone } from './phone'

const TOLERANCE_MINUTES = 15

/** Fecha (YYYY-MM-DD) y minutos del día en hora de Argentina, sin depender de la zona del servidor. */
export function argentinaNow(): { today: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return {
    today: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  }
}

function toMinutes(t: string | null | undefined, fallback: string): number {
  const [h, m] = (t || fallback).split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * Busca la reserva confirmada de HOY para ese teléfono que esté en curso
 * (o por empezar / recién terminada, con 15 minutos de tolerancia).
 * Requiere un cliente con la clave del servidor.
 */
export async function findActiveReservationByPhone(
  supabase: SupabaseClient,
  phone: string
): Promise<Record<string, any> | null> {
  const key = phoneKey(phone)
  if (!key) return null

  const { today, minutes: now } = argentinaNow()

  // Prefiltro en la base por los últimos 8 dígitos (solo números, sin riesgo de inyección)
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('date', today)
    .eq('status', 'confirmed')
    .ilike('phone', phoneSearchPattern(key))

  if (error || !data) return null

  const mine = data
    .filter((r: any) => samePhone(r.phone, phone))
    .sort((a: any, b: any) => (a.time_from || '').localeCompare(b.time_from || ''))

  let upcoming: Record<string, any> | null = null
  for (const r of mine) {
    const start = toMinutes(r.time_from, '00:00')
    const end = toMinutes(r.time_to, '23:59')
    if (now >= start && now <= end) return r
    const isUpcoming = now >= start - TOLERANCE_MINUTES && now < start
    const justEnded = now > end && now <= end + TOLERANCE_MINUTES
    if ((isUpcoming || justEnded) && !upcoming) upcoming = r
  }
  return upcoming
}

/** Campos de la reserva que se le pueden devolver al propio cliente. */
export function publicReservationFields(r: Record<string, any>) {
  return {
    id: r.id,
    workspace: r.workspace,
    desk_number: r.desk_number ?? null,
    date: r.date,
    time_from: r.time_from,
    time_to: r.time_to,
    first_name: r.first_name,
    last_name: r.last_name,
    status: r.status,
    reservation_code: r.reservation_code ?? null,
  }
}
