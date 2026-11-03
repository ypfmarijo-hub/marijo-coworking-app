import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'

// POST /api/staff/orders/:id/items  { index, action: 'menos' | 'quitar' }
// Para corregir un consumo mal cargado: restar una unidad o sacar el producto del pedido.
// Si el pedido queda vacío, se anula (no se borra, para que quede registro).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireStaff()
  if (denied) return denied
  const { id } = await params
  const { index, action } = await req.json().catch(() => ({}))
  const supabase = createServiceClient()
  const { data: order } = await supabase.from('orders').select('id, items, status').eq('id', id).maybeSingle()
  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  const items: any[] = Array.isArray(order.items) ? [...order.items] : []
  const i = Number(index)
  if (!Number.isInteger(i) || i < 0 || i >= items.length) return NextResponse.json({ error: 'Producto no encontrado en el pedido' }, { status: 400 })

  const it = { ...items[i] }
  const qty = Number(it.quantity) || 1
  if (action === 'menos' && qty > 1) {
    it.quantity = qty - 1
    it.subtotal = (Number(it.price) || 0) * it.quantity
    items[i] = it
  } else if (action === 'menos' || action === 'quitar') {
    items.splice(i, 1)
  } else {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }
  const total = items.reduce((a, x) => a + (Number(x.subtotal) || (Number(x.price) || 0) * (Number(x.quantity) || 0)), 0)
  const update: any = { items, total_amount: total, updated_at: new Date().toISOString() }
  if (items.length === 0) update.status = 'anulado'
  const { error } = await supabase.from('orders').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo corregir' }, { status: 500 })
  return NextResponse.json({ ok: true, total, items, anulado: items.length === 0 })
}
