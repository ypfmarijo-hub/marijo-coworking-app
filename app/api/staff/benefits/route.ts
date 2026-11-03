import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'
import { phoneKey } from '@/lib/phone'
import { getSettings } from '@/lib/settings'
import { benefitFor } from '@/lib/benefits'

// POST /api/staff/benefits  { query }  — buscar un beneficio por código (BN-XXXX) o por teléfono del cliente
export async function POST(req: NextRequest) {
  const denied = await requireStaff()
  if (denied) return denied
  const { query } = await req.json().catch(() => ({}))
  const q = String(query || '').trim().toUpperCase()
  const supabase = createServiceClient()
  let rows: any[] = []
  if (/^BN-?[A-Z0-9]{4}$/.test(q)) {
    const code = q.includes('-') ? q : q.replace(/^BN/, 'BN-')
    const { data } = await supabase.from('benefits').select('*').eq('code', code)
    rows = data ?? []
  } else if (phoneKey(q)) {
    const { data } = await supabase.from('benefits').select('*').eq('phone_key', phoneKey(q)!).order('created_at', { ascending: false }).limit(5)
    rows = data ?? []
  } else {
    return NextResponse.json({ error: 'Escribí el código (BN-XXXX) o el teléfono completo.' }, { status: 400 })
  }
  // para los que todavía no se usaron: qué beneficios puede elegir hoy (según sus horas actuales)
  const settings = await getSettings(supabase)
  const out = []
  for (const b of rows) {
    let options: { id: string; hours: number; text: string }[] = []
    let hours = Number(b.hours_reached)
    if (!b.used_at) {
      const info = await benefitFor(supabase, b.phone_key, b.customer_name || '', settings)
      options = info.available
      hours = info.hours
    }
    out.push({ id: b.id, code: b.code, description: b.description, customer: b.customer_name,
      period: b.period, hours, usedAt: b.used_at, options })
  }
  return NextResponse.json(out)
}
