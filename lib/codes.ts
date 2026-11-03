// Códigos de reserva cortos: "F" + 2 números (F10 a F99). Se pueden repetir entre días, nunca en el mismo día.
// Para entrar a la pizarra hace falta el código + el teléfono + estar en el horario, así que alcanza.
import type { SupabaseClient } from '@supabase/supabase-js'

export function pickFreeCode(used: Iterable<string>): string {
  const taken = new Set(used)
  const free: string[] = []
  for (let n = 10; n <= 99; n++) if (!taken.has(`F${n}`)) free.push(`F${n}`)
  if (free.length) return free[Math.floor(Math.random() * free.length)]
  // día con más de 90 reservas (no debería pasar): se usa un número más largo
  return `F${Math.floor(100 + Math.random() * 900)}`
}

/** Elige un código libre para ese día (YYYY-MM-DD). */
export async function newReservationCode(supabase: SupabaseClient, date: string): Promise<string> {
  const { data } = await supabase.from('reservations').select('reservation_code').eq('date', date)
  return pickFreeCode((data ?? []).map((r: any) => r.reservation_code).filter(Boolean))
}

/** Normaliza lo que escribe el cliente: "f 23", "F23", "23" → posibles códigos guardados (también los viejos FW-1234). */
export function codeCandidates(input: string): string[] | null {
  const clean = String(input || '').toUpperCase().replace(/\s+/g, '')
  const digits = clean.replace(/^FW-?/, '').replace(/^F/, '')
  if (!/^\d{2,6}$/.test(digits)) return null
  if (digits.length <= 3) return [`F${digits}`]
  return [`FW${digits}`, `FW-${digits}`]
}
