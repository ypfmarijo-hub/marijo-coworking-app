import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { phoneKey, samePhone } from '@/lib/phone'
import { reservationWindow, ENTRY_TOLERANCE_MIN } from '@/lib/time'
import { codeCandidates } from '@/lib/codes'
import { argentinaNow } from '@/lib/active-reservation'
import { hashToken, newToken, placeLabel, sessionCookie } from '@/lib/pizarra'

// POST /api/pizarra/login  { phone, code }
// Entra a la pizarra SOLO quien tiene una reserva confirmada con ese WhatsApp y ese código, y dentro de su horario.
export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json()
    const key = phoneKey(String(phone || ''))
    const cleanCode = String(code || '').trim().toUpperCase().replace(/\s+/g, '')
    if (!key) return NextResponse.json({ error: 'Ingresá tu WhatsApp completo, con código de área.' }, { status: 400 })
    // Se acepta "F23", "f 23" o solo "23" (y los códigos viejos FW1234 / FW-1234).
    const candidates = codeCandidates(cleanCode)
    if (!candidates) return NextResponse.json({ error: 'El código tiene la forma F23.' }, { status: 400 })

    const supabase = createServiceClient()
    const { data: rows } = await supabase.from('reservations').select('*').in('reservation_code', candidates)
    // El mismo código se repite en otros días: se toma la reserva de ese teléfono más cercana a hoy
    const today = argentinaNow().today
    const dayDiff = (d: string) => Math.abs(Date.parse(d) - Date.parse(today))
    const r = (rows ?? []).filter((x: any) => samePhone(x.phone, String(phone)) && x.status !== 'cancelled')
      .sort((a: any, b: any) => dayDiff(a.date) - dayDiff(b.date))[0]
      ?? (rows ?? []).find((x: any) => samePhone(x.phone, String(phone)))
    // Mismo mensaje si el código no existe o no es de ese número: no se revela de quién es
    if (!r) {
      return NextResponse.json({ error: 'Ese código no corresponde a una reserva de este número.' }, { status: 404 })
    }
    if (r.status === 'cancelled') return NextResponse.json({ error: 'Esa reserva está cancelada.' }, { status: 400 })

    const { startMs, endMs } = reservationWindow(r)
    const now = Date.now()
    if (now < startMs - ENTRY_TOLERANCE_MIN * 60000) {
      return NextResponse.json({ error: `Tu reserva empieza a las ${r.time_from}. Podés entrar 15 minutos antes.` }, { status: 400 })
    }
    if (now > endMs || r.status === 'completed') {
      return NextResponse.json({ error: 'Tu reserva ya terminó. La pizarra está disponible solo durante tu horario.' }, { status: 400 })
    }

    const token = newToken()
    const { error } = await supabase.from('pizarra_sessions').insert({
      token_hash: hashToken(token), reservation_id: r.id, phone_key: key, location: placeLabel(r), is_open: true,
    })
    if (error) return NextResponse.json({ error: 'No se pudo iniciar la sesión. Reintentá.' }, { status: 500 })

    const res = NextResponse.json({ ok: true, code: r.reservation_code, reservationId: r.id })
    res.cookies.set(sessionCookie(token))
    return res
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
