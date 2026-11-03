import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'
import { AGE_RANGES } from '@/lib/age'
import { phoneKey, phoneSearchPattern, samePhone } from '@/lib/phone'

// POST /api/staff/age  { reservationId | phone, range }
// Edad aproximada que el staff estima a ojo (sin preguntarle nada al cliente). range = null la borra.
export async function POST(req: NextRequest) {
  const denied = await requireStaff()
  if (denied) return denied
  const { reservationId, phone, range } = await req.json().catch(() => ({}))
  const value = range == null || range === '' ? null : String(range)
  if (value && !(AGE_RANGES as readonly string[]).includes(value)) return NextResponse.json({ error: 'Rango de edad inválido' }, { status: 400 })
  const supabase = createServiceClient()
  let id = reservationId ? String(reservationId) : null
  if (!id && phone) {
    // por teléfono: se guarda en su reserva más reciente
    const key = phoneKey(String(phone))
    if (!key) return NextResponse.json({ error: 'Teléfono inválido' }, { status: 400 })
    const { data } = await supabase.from('reservations').select('id, phone, date, time_from').ilike('phone', phoneSearchPattern(key))
      .order('date', { ascending: false }).order('time_from', { ascending: false }).limit(20)
    id = (data ?? []).find((r: any) => samePhone(r.phone, String(phone)))?.id ?? null
  }
  if (!id) return NextResponse.json({ error: 'No se encontró la reserva' }, { status: 404 })
  const { error } = await supabase.from('reservations').update({ age_range_staff: value }).eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ ok: true, range: value })
}
