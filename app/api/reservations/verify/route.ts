import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { findActiveReservationByPhone, publicReservationFields } from '@/lib/active-reservation'
import { phoneKey } from '@/lib/phone'

// POST - El cliente valida con su teléfono que tiene una reserva en curso (para pedir al Market)
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()
    if (!phone || !phoneKey(String(phone))) {
      return NextResponse.json(
        { error: 'Ingresá tu número completo, con código de área.', found: false },
        { status: 400 }
      )
    }

    const reservation = await findActiveReservationByPhone(createServiceClient(), String(phone))
    if (!reservation) {
      return NextResponse.json(
        {
          error:
            'No encontramos una reserva activa para hoy con ese número. Verificá que estés dentro de tu horario reservado.',
          found: false,
        },
        { status: 404 }
      )
    }

    return NextResponse.json({ found: true, reservation: publicReservationFields(reservation) })
  } catch (e: any) {
    console.error('[API verify] Error:', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
