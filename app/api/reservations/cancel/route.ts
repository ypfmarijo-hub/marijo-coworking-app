import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { samePhone } from '@/lib/phone'
import { pushToStaff } from '@/lib/push'
import { placeLabel } from '@/lib/pizarra'

// POST /api/reservations/cancel  { id, phone }
// Público. El cliente cancela SU reserva: solo funciona si el teléfono coincide con el de la reserva.
export async function POST(req: NextRequest) {
  try {
    const { id, phone } = await req.json()
    if (!id || !phone) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

    const supabase = createServiceClient()
    const { data: reservation } = await supabase
      .from('reservations')
      .select('id, phone, status, first_name, last_name, workspace, desk_number, date, time_from')
      .eq('id', String(id))
      .maybeSingle()

    if (!reservation || !samePhone(reservation.phone, String(phone))) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    }
    if (reservation.status === 'cancelled') {
      return NextResponse.json({ success: true })
    }
    if (reservation.status === 'completed') {
      return NextResponse.json({ error: 'Esta reserva ya finalizó' }, { status: 400 })
    }

    const { error } = await supabase
      .from('reservations')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', reservation.id)

    if (error) return NextResponse.json({ error: 'No se pudo cancelar' }, { status: 500 })
    await pushToStaff(supabase, { title: 'Reserva cancelada', body: `${reservation.first_name} ${reservation.last_name} canceló ${placeLabel(reservation)} del ${reservation.date} a las ${reservation.time_from}.`, tag: 'reserva' })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
