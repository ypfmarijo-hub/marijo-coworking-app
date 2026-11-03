import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadSession } from '@/lib/pizarra'
import { phoneKey, samePhone } from '@/lib/phone'
import { reservationWindow } from '@/lib/time'
import { pushToStaff } from '@/lib/push'

// POST /api/feedback  { rating 1-5, comment?, reservationId?, phone? }
// El cliente deja su opinión sobre una visita. Se identifica con la sesión de la pizarra
// o, desde "Mis reservas", con su teléfono + la reserva (que tiene que ser suya y ya haber empezado).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const rating = Math.round(Number(body.rating))
    if (!(rating >= 1 && rating <= 5)) return NextResponse.json({ error: 'Elegí de 1 a 5 estrellas.' }, { status: 400 })
    const comment = String(body.comment ?? '').trim().slice(0, 600) || null
    const supabase = createServiceClient()

    let r: any = null
    if (body.reservationId && body.phone) {
      const { data } = await supabase.from('reservations').select('*').eq('id', String(body.reservationId)).maybeSingle()
      if (data && samePhone(data.phone, String(body.phone))) r = data
    } else {
      const s = await loadSession(supabase)
      if (s) r = s.reservation
    }
    if (!r || r.status === 'cancelled') return NextResponse.json({ error: 'No encontramos esa visita.' }, { status: 404 })
    if (Date.now() < reservationWindow(r).startMs) return NextResponse.json({ error: 'Podés opinar cuando empiece tu reserva.' }, { status: 400 })

    const { error } = await supabase.from('feedback').upsert({
      reservation_id: r.id, phone_key: phoneKey(r.phone), customer_name: `${r.first_name} ${r.last_name}`.trim(),
      rating, comment, created_at: new Date().toISOString(), read_at: null,
    }, { onConflict: 'reservation_id' })
    if (error) return NextResponse.json({ error: 'No se pudo guardar. Reintentá.' }, { status: 500 })

    await pushToStaff(supabase, { title: `Nueva opinión: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`,
      body: `${r.first_name} ${r.last_name}${comment ? `: "${comment.slice(0, 90)}"` : ''}`, tag: 'opinion' })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
