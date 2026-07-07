import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Credenciales para marijo-reservas (la misma base de datos que el resto del sistema)
const SUPABASE_URL = 'https://coxfxtcpoyssejhnyqyt.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.CLAVE_SECRETA_PEDIDOS!

function getServiceSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

export async function GET(req: NextRequest) {
  const supabase = getServiceSupabase()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let query = supabase.from('orders').select('*')
  if (status) query = query.eq('status', status)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { products, total_amount, phone, table_number } = body

    if (!products || !total_amount || !phone) {
      return NextResponse.json(
        { error: 'Faltan campos: products, total_amount, phone' },
        { status: 400 }
      )
    }

    const supabase = getServiceSupabase()
    const cleanPhone = String(phone).replace(/\D/g, '')
    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes()
    const TOLERANCE_MINUTES = 15

    // Buscar TODAS las reservas confirmadas de hoy para este teléfono
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('*')
      .eq('status', 'confirmed')
      .eq('date', today)
      .or(`phone.eq.${cleanPhone},phone.ilike.%${cleanPhone}%`)

    if (resError || !reservations || reservations.length === 0) {
      return NextResponse.json({ error: 'No se encontró una reserva activa' }, { status: 404 })
    }

    // Ordenar por hora de inicio y buscar la que está EN CURSO
    const sortedReservations = reservations.sort((a: any, b: any) => {
      const aStart = a.start_time || a.startTime || '00:00'
      const bStart = b.start_time || b.startTime || '00:00'
      return aStart.localeCompare(bStart)
    })

    let activeReservation = null
    let upcomingReservation = null

    for (const res of sortedReservations) {
      const startTime = res.start_time || res.startTime || '00:00'
      const endTime = res.end_time || res.endTime || '23:59'
      const [startHour, startMin] = startTime.split(':').map(Number)
      const [endHour, endMin] = endTime.split(':').map(Number)
      const startMinutes = startHour * 60 + startMin
      const endMinutes = endHour * 60 + endMin

      const isActiveNow = currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes
      const isUpcoming = currentTimeMinutes >= startMinutes - TOLERANCE_MINUTES && currentTimeMinutes < startMinutes
      const justEnded = currentTimeMinutes > endMinutes && currentTimeMinutes <= endMinutes + TOLERANCE_MINUTES

      if (isActiveNow) {
        activeReservation = res
        break
      } else if (isUpcoming && !upcomingReservation) {
        upcomingReservation = res
      } else if (justEnded && !activeReservation && !upcomingReservation) {
        upcomingReservation = res
      }
    }

    const finalReservation = activeReservation || upcomingReservation
    if (!finalReservation) {
      return NextResponse.json({ error: 'No hay una reserva activa en este horario' }, { status: 404 })
    }

    const customerName = `${finalReservation.first_name || ''} ${finalReservation.last_name || ''}`.trim() || 'Cliente'

    // Construir items con detalle completo
    const itemsData = (products as any[]).map((p: any) => ({
      name: p.name,
      price: p.price,
      quantity: p.quantity,
      subtotal: p.subtotal ?? p.price * p.quantity,
      selectedOptions: p.selectedOptions || {},
      customerNotes: p.customerNotes || null,
    }))

    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_name: customerName,
        table_number: table_number || null,
        total_amount: Number(total_amount),
        status: 'pendiente',
        reservation_id: finalReservation.id,
        items: itemsData,
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

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { order_id, status } = body
    
    console.log('[PATCH /market/orders] Received:', { order_id, status })
    
    if (!order_id || !status) {
      return NextResponse.json({ error: 'order_id y status son requeridos' }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    
    // Verificar que la orden existe primero
    const { data: existingOrder, error: findError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', order_id)
      .maybeSingle()
    
    console.log('[PATCH /market/orders] Found order:', existingOrder, 'error:', findError)
    
    if (findError || !existingOrder) {
      console.error('[PATCH /market/orders] Order not found:', order_id)
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }
    
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', order_id)
      .select()

    console.log('[PATCH /market/orders] Update result:', { data, error })

    if (error) {
      console.error('[PATCH /market/orders] Update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error('[PATCH /market/orders] Critical error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
