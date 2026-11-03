import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'

// GET /api/staff/clients?q=3585  ó  ?q=juli
// Para la "Reserva rápida": busca clientes que ya reservaron antes, por teléfono (4 números o más)
// o por nombre/apellido (2 letras o más). Devuelve hasta 8, el más reciente primero, sin repetir teléfono.
export async function GET(req: NextRequest) {
  const denied = await requireStaff()
  if (denied) return denied

  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 40)
  const digits = q.replace(/\D/g, '')
  const supabase = createServiceClient()

  let query = supabase
    .from('reservations')
    .select('first_name, last_name, phone, date, dni, age_range_staff')
    .order('date', { ascending: false })
    .limit(200)

  if (digits.length >= 4 && digits.length === q.replace(/[\s+\-()]/g, '').length) {
    // teléfono guardado con cualquier formato: los números en orden, con lo que sea entre medio
    query = query.ilike('phone', '%' + digits.slice(-8).split('').join('%') + '%')
  } else {
    const words = q.replace(/[%,()*]/g, ' ').split(/\s+/).filter((w) => w.length >= 2)
    if (words.length === 0) return NextResponse.json({ clients: [] })
    for (const w of words.slice(0, 3)) query = query.or(`first_name.ilike.%${w}%,last_name.ilike.%${w}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'No se pudo buscar' }, { status: 500 })

  const seen = new Map<string, { firstName: string; lastName: string; phone: string; lastDate: string; visits: number; dni: string | null; ageRangeStaff: string | null }>()
  for (const r of data || []) {
    const key = String(r.phone || '').replace(/\D/g, '').slice(-10) || `${r.first_name}|${r.last_name}`
    const prev = seen.get(key)
    if (prev) { prev.visits++; if (!prev.dni && r.dni) prev.dni = r.dni; if (!prev.ageRangeStaff && r.age_range_staff) prev.ageRangeStaff = r.age_range_staff }
    else seen.set(key, { firstName: r.first_name || '', lastName: r.last_name || '', phone: r.phone || '', lastDate: r.date, visits: 1, dni: r.dni || null, ageRangeStaff: r.age_range_staff || null })
  }
  return NextResponse.json({ clients: [...seen.values()].slice(0, 8) })
}
