import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadSession } from '@/lib/pizarra'
import { publicReservationFields } from '@/lib/active-reservation'

// GET /api/reservations/session — si el cliente ya entró a la pizarra, el Market no le vuelve a pedir el teléfono
export async function GET() {
  const s = await loadSession(createServiceClient())
  if (!s || !s.active) return NextResponse.json({ found: false })
  return NextResponse.json({ found: true, phone: s.reservation.phone, location: s.session.location, reservation: publicReservationFields(s.reservation) })
}
