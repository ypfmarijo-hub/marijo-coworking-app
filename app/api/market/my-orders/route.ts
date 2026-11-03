import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { findActiveReservationByPhone } from '@/lib/active-reservation'

// POST /api/market/my-orders  { phone }
// Público. Devuelve los pedidos del Market de la reserva EN CURSO de ese teléfono,
// para la pantalla "Mis pedidos" del cliente (antes leía de un lugar donde nunca se guardaban).
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()
    if (!phone) return NextResponse.json([])

    const supabase = createServiceClient()
    const reservation = await findActiveReservationByPhone(supabase, String(phone))
    if (!reservation) return NextResponse.json([])

    const { data, error } = await supabase
      .from('orders')
      .select('id, created_at, status, total_amount, items')
      .eq('reservation_id', reservation.id)
      .not('status', 'in', '("regalo_esperando","regalo_guardado")')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: 'No se pudieron leer tus pedidos' }, { status: 500 })

    const orders = (data ?? []).map((o: any) => ({
      id: o.id,
      created_at: o.created_at,
      status: o.status,
      total_amount: Number(o.total_amount) || 0,
      items: (Array.isArray(o.items) ? o.items : []).map((i: any) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
      })),
    }))
    return NextResponse.json(orders, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
