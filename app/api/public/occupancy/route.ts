import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { argentinaNow } from '@/lib/active-reservation'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// GET /api/public/occupancy?from=YYYY-MM-DD&to=YYYY-MM-DD
// Público. Devuelve qué espacios están ocupados y cuándo, SIN nombres ni teléfonos.
// Reemplaza la lectura directa de la tabla de reservas desde el navegador.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const from = params.get('from') || argentinaNow().today
  const to = params.get('to')

  if (!DATE_RE.test(from) || (to && !DATE_RE.test(to))) {
    return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 })
  }

  let query = createServiceClient()
    .from('reservations')
    .select('id, workspace, date, time_from, time_to, desk_number, status')
    .gte('date', from)
    .neq('status', 'cancelled')
    .order('date', { ascending: true })
    .limit(5000)
  if (to) query = query.lte('date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'No se pudo leer la disponibilidad' }, { status: 500 })

  return NextResponse.json(data ?? [], {
    headers: { 'Cache-Control': 'no-store' },
  })
}
