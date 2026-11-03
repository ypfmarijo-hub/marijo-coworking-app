import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadSession } from '@/lib/pizarra'
import { saveSubscription } from '@/lib/push'

// POST /api/pizarra/push  { subscription }  — el cliente activa los avisos en su celular
export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const s = await loadSession(supabase)
  if (!s) return NextResponse.json({ error: 'Sesión vencida.' }, { status: 401 })
  const { subscription } = await req.json().catch(() => ({}))
  const ok = await saveSubscription(supabase, subscription, { role: 'cliente', phone: s.reservation.phone })
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'No se pudo activar.' }, { status: 400 })
}
