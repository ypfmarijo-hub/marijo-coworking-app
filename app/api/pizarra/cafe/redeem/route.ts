import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadSession } from '@/lib/pizarra'
import { pushToStaff } from '@/lib/push'
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

// POST /api/pizarra/cafe/redeem  { inviteId }  — pedir un café que había guardado para después
export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const s = await loadSession(supabase)
  if (!s || !s.active) return NextResponse.json({ error: 'Tu sesión no está activa.' }, { status: 401 })
  const { inviteId, kind: rawKind } = await req.json().catch(() => ({}))
  const kind = pickOption((await getSettings(supabase)).cafeGiftOptions, rawKind)
  if (!kind) return NextResponse.json({ error: 'Elegí cómo querés el café.' }, { status: 400 })
  const { data: inv } = await supabase.from('cafe_invites').select('*').eq('id', String(inviteId || '')).maybeSingle()
  if (!inv || inv.to_phone_key !== s.session.phone_key || inv.status !== 'guardada') {
    return NextResponse.json({ error: 'Regalo no encontrado.' }, { status: 404 })
  }
  await supabase.from('cafe_invites').update({ status: 'canjeada' }).eq('id', inv.id)
  await setKind(supabase, inv.order_id, kind)
  if (inv.order_id) {
    await supabase.from('orders').update({ status: 'pendiente', table_number: s.session.location, updated_at: new Date().toISOString() }).eq('id', inv.order_id)
  }
  await pushToStaff(supabase, { title: `Nuevo pedido · ${s.session.location}`, body: `Café de regalo (de ${inv.from_name}) para ${inv.to_name}: ${kind}.`, tag: 'pedido' })
  return NextResponse.json({ ok: true })
}
