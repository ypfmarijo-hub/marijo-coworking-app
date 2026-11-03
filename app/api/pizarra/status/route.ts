import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadSession } from '@/lib/pizarra'

// POST /api/pizarra/status  { isOpen }  — verde "Abierto a charlar" / rojo "En foco"
export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const s = await loadSession(supabase)
  if (!s || !s.active) return NextResponse.json({ error: 'Tu sesión no está activa.' }, { status: 401 })
  const { isOpen } = await req.json().catch(() => ({}))
  // el estado vale para todos los celulares con los que entró esa persona hoy
  await supabase.from('pizarra_sessions').update({ is_open: !!isOpen }).eq('reservation_id', s.reservation.id)
  return NextResponse.json({ ok: true, isOpen: !!isOpen })
}
