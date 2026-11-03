import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { findActiveReservationByPhone } from '@/lib/active-reservation'
import { saldoFor } from '@/lib/saldo'

// POST /api/market/saldo  { phone } — saldo a favor (Plan FULL) de la reserva EN CURSO de ese teléfono
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json().catch(() => ({}))
    if (!phone) return NextResponse.json({ saldo: null })
    const supabase = createServiceClient()
    const r = await findActiveReservationByPhone(supabase, String(phone))
    if (!r) return NextResponse.json({ saldo: null })
    return NextResponse.json({ saldo: await saldoFor(supabase, r) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
