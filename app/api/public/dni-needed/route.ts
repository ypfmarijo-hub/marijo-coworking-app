import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { phoneKey, phoneSearchPattern, samePhone } from '@/lib/phone'

// POST /api/public/dni-needed  { phone } → { needed }
// El DNI se pide UNA sola vez: si ese teléfono ya lo dejó en otra reserva, no se vuelve a pedir.
// (Solo responde sí/no; nunca devuelve el DNI ni otros datos.)
export async function POST(req: NextRequest) {
  const { phone } = await req.json().catch(() => ({}))
  const key = phoneKey(String(phone || ''))
  if (!key) return NextResponse.json({ needed: true })
  const supabase = createServiceClient()
  const { data } = await supabase.from('reservations').select('phone').ilike('phone', phoneSearchPattern(key)).not('dni', 'is', null).limit(20)
  const has = (data ?? []).some((r: any) => samePhone(r.phone, String(phone)))
  return NextResponse.json({ needed: !has }, { headers: { 'Cache-Control': 'no-store' } })
}
