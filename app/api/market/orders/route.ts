import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'
import { findActiveReservationByPhone } from '@/lib/active-reservation'
import { pushToPhone, pushToStaff } from '@/lib/push'

// GET - Lista de pedidos (solo staff)
export async function GET(req: NextRequest) {
  const denied = await requireStaff()
  if (denied) return denied

  const supabase = createServiceClient()
  const status = new URL(req.url).searchParams.get('status')

  // los cafés de regalo que todavía no se pidieron no le aparecen al bar
  let query = supabase.from('orders').select('*').not('status', 'in', '("regalo_esperando","regalo_guardado")')
  if (status) query = query.eq('status', status)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST - El cliente hace un pedido desde su lugar (público, validado por teléfono + reserva en curso)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { products, phone, table_number } = body

    if (!Array.isArray(products) || products.length === 0 || !phone) {
      return NextResponse.json({ error: 'Faltan campos: products, phone' }, { status: 400 })
    }
    if (products.length > 50) {
      return NextResponse.json({ error: 'Demasiados productos en un pedido' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const reservation = await findActiveReservationByPhone(supabase, String(phone))
    if (!reservation) {
      return NextResponse.json({ error: 'No hay una reserva activa en este horario' }, { status: 404 })
    }

    // Los precios se toman SIEMPRE de la base, nunca de lo que manda el navegador
    const { data: catalog, error: catalogError } = await supabase
      .from('products')
      .select('id, name, price')
    if (catalogError || !catalog) {
      return NextResponse.json({ error: 'No se pudo leer el menú' }, { status: 500 })
    }
    const byId = new Map(catalog.map((p: any) => [String(p.id), p]))
    const byName = new Map(catalog.map((p: any) => [String(p.name), p]))

    const itemsData = []
    for (const p of products as any[]) {
      const product = (p.product_id && byId.get(String(p.product_id))) || byName.get(String(p.name))
      const quantity = Math.floor(Number(p.quantity))
      if (!product) {
        return NextResponse.json({ error: `El producto "${p.name}" ya no está en el menú` }, { status: 400 })
      }
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
        return NextResponse.json({ error: `Cantidad inválida para "${product.name}"` }, { status: 400 })
      }
      const price = Number(product.price)
      itemsData.push({
        name: product.name,
        price,
        quantity,
        subtotal: price * quantity,
        selectedOptions: p.selectedOptions && typeof p.selectedOptions === 'object' ? p.selectedOptions : {},
        customerNotes: typeof p.customerNotes === 'string' ? p.customerNotes.slice(0, 300) : null,
      })
    }
    const totalAmount = itemsData.reduce((acc, i) => acc + i.subtotal, 0)

    const customerName =
      `${reservation.first_name || ''} ${reservation.last_name || ''}`.trim() || 'Cliente'

    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_name: customerName,
        table_number: typeof table_number === 'string' ? table_number.slice(0, 100) : null,
        total_amount: totalAmount,
        status: 'pendiente',
        reservation_id: reservation.id,
        items: itemsData,
      })
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await pushToStaff(supabase, { title: `Nuevo pedido · ${table_number || customerName}`,
      body: `${customerName}: ${itemsData.map((i) => `${i.quantity} × ${i.name}`).join(', ')}`, tag: 'pedido' })
    return NextResponse.json({ success: true, data: data[0] }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH - Cambiar estado de un pedido (solo staff)
export async function PATCH(req: NextRequest) {
  const denied = await requireStaff()
  if (denied) return denied

  try {
    const { order_id, status } = await req.json()
    if (!order_id || !['pendiente', 'aceptado', 'entregado'].includes(status)) {
      return NextResponse.json({ error: 'order_id y un estado válido son requeridos' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', order_id)
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }
    // Aviso al celular del cliente (si activó los avisos en la pizarra)
    const order = data[0] as any
    if (order.reservation_id && status !== 'pendiente') {
      const { data: r } = await supabase.from('reservations').select('phone').eq('id', order.reservation_id).maybeSingle()
      if (r?.phone) await pushToPhone(supabase, r.phone, status === 'aceptado'
        ? { title: 'Tu pedido está en preparación', body: 'Ya lo están preparando.', tag: 'pedido', url: '/?pantalla=bar' }
        : { title: 'Tu pedido fue entregado', body: '¡Que lo disfrutes!', tag: 'pedido', url: '/?pantalla=bar' })
    }
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
