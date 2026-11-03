import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadSession, displayName } from '@/lib/pizarra'

const cleanList = (v: unknown) => (Array.isArray(v) ? v : [])
  .map((t) => String(t).trim().slice(0, 40)).filter(Boolean)
  .filter((t, i, a) => a.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i).slice(0, 12)

// POST /api/pizarra/profile  { rubro, offers[], seeks[], showWhatsapp, location }
// Guarda el perfil (queda para la próxima visita) y dónde está sentado hoy.
export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const s = await loadSession(supabase)
  if (!s || !s.active) return NextResponse.json({ error: 'Tu sesión no está activa.' }, { status: 401 })
  try {
    const body = await req.json()
    const r = s.reservation
    const row = {
      phone_key: s.session.phone_key,
      display_name: displayName(r.first_name, r.last_name),
      rubro: String(body.rubro || '').trim().slice(0, 80),
      offers: cleanList(body.offers),
      seeks: cleanList(body.seeks),
      show_whatsapp: !!body.showWhatsapp,
      whatsapp: body.showWhatsapp ? String(r.phone).slice(0, 30) : null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('pizarra_profiles').upsert(row)
    if (error) return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 })
    if (typeof body.location === 'string' && body.location.trim()) {
      await supabase.from('pizarra_sessions').update({ location: body.location.trim().slice(0, 60) }).eq('id', s.session.id)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }
}
