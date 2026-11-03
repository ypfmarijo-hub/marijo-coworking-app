import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadSession, displayName } from '@/lib/pizarra'
import { getSettings } from '@/lib/settings'
import { cafeGift } from '@/lib/cafe'
import { reservationWindow } from '@/lib/time'
import { pushToPhone } from '@/lib/push'

const MAX_INVITES_PER_VISIT = 10

// POST /api/pizarra/cafe  { toId, message }  — invitar un café a alguien que está "Abierto a charlar"
export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const s = await loadSession(supabase)
  if (!s || !s.active) return NextResponse.json({ error: 'Tu sesión no está activa.' }, { status: 401 })
  const settings = await getSettings(supabase)
  const product = await cafeGift(supabase, settings)
  if (!settings.cafeEnabled || !product) return NextResponse.json({ error: 'Esta función no está disponible.' }, { status: 400 })

  const { toId, message } = await req.json().catch(() => ({}))
  const { data: target } = await supabase.from('pizarra_sessions').select('*').eq('id', String(toId || '')).maybeSingle()
  if (!target || target.phone_key === s.session.phone_key) return NextResponse.json({ error: 'Persona no encontrada.' }, { status: 404 })
  if (!target.is_open) return NextResponse.json({ error: 'Ahora está concentrado: probá invitarle el café más tarde.' }, { status: 400 })
  const { data: tr } = await supabase.from('reservations').select('*').eq('id', target.reservation_id).maybeSingle()
  if (!tr || tr.status !== 'confirmed' || Date.now() > reservationWindow(tr).endMs) {
    return NextResponse.json({ error: 'Esa persona ya no está en la sala.' }, { status: 400 })
  }
  const { count } = await supabase.from('cafe_invites').select('id', { count: 'exact', head: true }).eq('from_reservation', s.reservation.id)
  if ((count ?? 0) >= MAX_INVITES_PER_VISIT) return NextResponse.json({ error: 'Ya invitaste 10 cafés en esta visita, que es el máximo.' }, { status: 400 })

  const r = s.reservation
  const fromName = displayName(r.first_name, r.last_name)
  const toName = displayName(tr.first_name, tr.last_name)
  const text = String(message || '').trim().slice(0, 200) || product.messages[0] || 'Te invito un café.'

  // El café se carga a la cuenta de quien invita. Queda "esperando" hasta que la otra persona responda.
  const { data: order, error: orderErr } = await supabase.from('orders').insert({
    customer_name: `Regalo de ${fromName} para ${toName}`,
    table_number: target.location,
    total_amount: product.price,
    status: 'regalo_esperando',
    reservation_id: r.id,
    items: [{ name: `${product.name} (regalo)`, price: product.price, quantity: 1, subtotal: product.price, selectedOptions: {}, customerNotes: null }],
    source: 'app',
  }).select('id').single()
  if (orderErr || !order) return NextResponse.json({ error: 'No se pudo enviar.' }, { status: 500 })

  const { error } = await supabase.from('cafe_invites').insert({
    from_reservation: r.id, from_phone_key: s.session.phone_key, from_name: fromName, from_location: s.session.location,
    to_phone_key: target.phone_key, to_name: toName, message: text, order_id: order.id,
  })
  if (error) return NextResponse.json({ error: 'No se pudo enviar.' }, { status: 500 })

  await pushToPhone(supabase, tr.phone, { title: `${fromName} te invitó un café`, body: text, tag: 'cafe' })
  return NextResponse.json({ ok: true, toName })
}
