import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'
import { phoneKey, phoneSearchPattern, samePhone } from '@/lib/phone'
import { displayName } from '@/lib/pizarra'

// POST /api/staff/client-name  { reservationId? | phone?, firstName, lastName, all? }
// Corregir el nombre de un cliente mal cargado. Con all=true (por defecto) se corrige en TODAS sus reservas
// (las que tienen el mismo teléfono) y en su perfil de la pizarra.
export async function POST(req: NextRequest) {
  const denied = await requireStaff()
  if (denied) return denied
  const body = await req.json().catch(() => ({}))
  const firstName = String(body.firstName || '').trim().slice(0, 60)
  const lastName = String(body.lastName || '').trim().slice(0, 60)
  if (!firstName) return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 })
  const all = body.all !== false
  const supabase = createServiceClient()

  let phone: string | null = body.phone ? String(body.phone) : null
  let ids: string[] = []
  if (body.reservationId) {
    const { data: r } = await supabase.from('reservations').select('id, phone').eq('id', String(body.reservationId)).maybeSingle()
    if (!r) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    ids = [r.id]
    phone = r.phone
  }
  const key = phoneKey(phone)
  if (all && key) {
    const { data } = await supabase.from('reservations').select('id, phone').ilike('phone', phoneSearchPattern(key)).limit(1000)
    ids = [...new Set([...ids, ...(data ?? []).filter((x: any) => samePhone(x.phone, phone)).map((x: any) => x.id)])]
  }
  if (ids.length === 0) return NextResponse.json({ error: 'No se encontraron reservas de ese cliente' }, { status: 404 })

  const { error } = await supabase.from('reservations').update({ first_name: firstName, last_name: lastName }).in('id', ids)
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  if (key) await supabase.from('pizarra_profiles').update({ display_name: displayName(firstName, lastName) }).eq('phone_key', key)
  return NextResponse.json({ ok: true, updated: ids.length })
}
