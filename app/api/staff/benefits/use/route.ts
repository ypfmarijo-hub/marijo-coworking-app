import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'
import { getSettings } from '@/lib/settings'
import { benefitFor } from '@/lib/benefits'

// POST /api/staff/benefits/use  { id, tierId? }
// Marca como usado el beneficio que eligió el cliente. Después de esto, sus horas vuelven a contar desde cero.
export async function POST(req: NextRequest) {
  const denied = await requireStaff()
  if (denied) return denied
  const { id, tierId } = await req.json().catch(() => ({}))
  const supabase = createServiceClient()
  const { data: row } = await supabase.from('benefits').select('*').eq('id', String(id || '')).maybeSingle()
  if (!row || row.used_at) return NextResponse.json({ error: 'Ese beneficio ya fue usado o no existe.' }, { status: 400 })
  const info = await benefitFor(supabase, row.phone_key, row.customer_name || '', await getSettings(supabase))
  const tier = tierId ? info.available.find((t) => t.id === tierId) : info.available.length === 1 ? info.available[0] : null
  if (!tier) {
    return NextResponse.json({ error: info.available.length ? 'Elegí cuál de los beneficios usa.' : 'Todavía no llegó a las horas de ningún beneficio.' }, { status: 400 })
  }
  const { data, error } = await supabase.from('benefits')
    .update({ used_at: new Date().toISOString(), description: tier.text, tier_hours: tier.hours, hours_reached: info.hours })
    .eq('id', row.id).is('used_at', null).select('id').maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Ese beneficio ya fue usado o no existe.' }, { status: 400 })
  return NextResponse.json({ ok: true, used: tier })
}
