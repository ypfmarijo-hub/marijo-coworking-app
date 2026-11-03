import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadSession } from '@/lib/pizarra'
import { pushToPhone, pushToStaff } from '@/lib/push'
import { getSettings } from '@/lib/settings'
import { pickOption } from '@/lib/cafe'

// Al pedirlo, quien recibe el café elige cómo lo quiere: queda escrito en el pedido para la barra
async function setKind(supabase: any, orderId: string | null, kind: string | null) {
  if (!orderId || !kind) return
  const { data: o } = await supabase.from('orders').select('items').eq('id', orderId).maybeSingle()
  const items = Array.isArray(o?.items) ? o.items : []
  if (!items[0]) return
  const base = String(items[0].name || 'Café').replace(/ · .*$/, '')
  items[0] = { ...items[0], name: `${base} · ${kind}`, selectedOptions: { ...(items[0].selectedOptions || {}), Tipo: kind } }
  await supabase.from('orders').update({ items }).eq('id', orderId)
}

// POST /api/pizarra/cafe/respond  { inviteId, action: 'ahora' | 'guardar', reply }
// Quien recibe el café elige tomarlo ahora o guardarlo para después, y responde un mensaje.
export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const s = await loadSession(supabase)
  if (!s || !s.active) return NextResponse.json({ error: 'Tu sesión no está activa.' }, { status: 401 })
  const { inviteId, action, reply, kind: rawKind } = await req.json().catch(() => ({}))
  const { data: inv } = await supabase.from('cafe_invites').select('*').eq('id', String(inviteId || '')).maybeSingle()
  if (!inv || inv.to_phone_key !== s.session.phone_key || inv.status !== 'enviada') {
    return NextResponse.json({ error: 'Invitación no encontrada.' }, { status: 404 })
  }
  const now = action === 'ahora'
  const kind = pickOption((await getSettings(supabase)).cafeGiftOptions, rawKind)
  if (now && !kind) return NextResponse.json({ error: 'Elegí cómo querés el café.' }, { status: 400 })
  const text = String(reply || '').trim().slice(0, 200) || '¡Muchas gracias por el café!'
  await supabase.from('cafe_invites').update({
    status: now ? 'tomada' : 'guardada', reply: text, responded_at: new Date().toISOString(),
  }).eq('id', inv.id)

  if (inv.order_id) {
    await supabase.from('orders').update({
      status: now ? 'pendiente' : 'regalo_guardado',
      table_number: s.session.location,
      updated_at: new Date().toISOString(),
    }).eq('id', inv.order_id)
  }
  if (now) await setKind(supabase, inv.order_id, kind)
  if (now) await pushToStaff(supabase, { title: `Nuevo pedido · ${s.session.location}`, body: `Regalo de ${inv.from_name} para ${inv.to_name}: 1 café (${kind}).`, tag: 'pedido' })

  // aviso a quien invitó
  if (inv.from_reservation) {
    const { data: fr } = await supabase.from('reservations').select('phone').eq('id', inv.from_reservation).maybeSingle()
    if (fr) await pushToPhone(supabase, fr.phone, { title: `${inv.to_name} te respondió`, body: text, tag: 'cafe' })
  }
  return NextResponse.json({ ok: true })
}
