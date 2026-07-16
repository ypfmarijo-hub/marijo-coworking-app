import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Credenciales para marijo-reservas (la misma base de datos que el resto del sistema)
const SUPABASE_URL = 'https://coxfxtcpoyssejhnyqyt.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.CLAVE_SECRETA_PEDIDOS!

function getServiceSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

// POST - El staff carga manualmente un consumo (ej: pedido por WhatsApp) directo a una reserva.
// A diferencia de /api/market/orders, acá no se busca la reserva por teléfono/horario:
// el staff ya sabe exactamente a qué reserva pertenece, así que reservation_id viene fijo en el body.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { reservation_id, customer_name, items } = body

    if (!reservation_id) {
      return NextResponse.json({ error: 'Falta reservation_id' }, { status: 400 })
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Falta al menos un ítem' }, { status: 400 })
    }

    const itemsData = items.map((p: any) => ({
      name: p.name,
      price: Number(p.price),
      quantity: Number(p.quantity),
      subtotal: Number(p.subtotal ?? p.price * p.quantity),
      selectedOptions: {},
      customerNotes: null,
    }))

    const total_amount = itemsData.reduce((acc: number, i: any) => acc + i.subtotal, 0)

    const supabase = getServiceSupabase()

    // Confirmar que la reserva exista antes de insertar
    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select('id')
      .eq('id', reservation_id)
      .maybeSingle()

    if (resError || !reservation) {
      return NextResponse.json({ error: 'La reserva no existe' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_name: customer_name || 'Cliente',
        table_number: null,
        total_amount,
        status: 'entregado',
        reservation_id,
        items: itemsData,
        source: 'staff',
      })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data[0] }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
