import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getStaffUser } from '@/lib/supabase/staff'

const METHODS = ['efectivo', 'transferencia', 'mercadopago', 'tarjeta']

// GET /api/staff/payments?ids=uuid,uuid — pagos registrados en caja de esas reservas
export async function GET(req: NextRequest) {
  if (!(await getStaffUser())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ids = (req.nextUrl.searchParams.get('ids') || '').split(',').filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 300)
  if (!ids.length) return NextResponse.json([])
  const { data, error } = await createServiceClient().from('payments')
    .select('id, reservation_id, amount, method, note, created_by, created_at').in('reservation_id', ids).order('created_at')
  if (error) return NextResponse.json({ error: 'No se pudieron leer los pagos.' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/staff/payments  { reservationId, amount, method, note? } — el staff registra lo que pagó el cliente
export async function POST(req: NextRequest) {
  const user = await getStaffUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const amount = Math.round(Number(body.amount))
  if (!(amount > 0 && amount <= 50_000_000)) return NextResponse.json({ error: 'Poné un monto mayor a $0.' }, { status: 400 })
  if (!METHODS.includes(body.method)) return NextResponse.json({ error: 'Elegí cómo pagó.' }, { status: 400 })
  const supabase = createServiceClient()
  const { data: r } = await supabase.from('reservations').select('id, status').eq('id', String(body.reservationId || '')).maybeSingle()
  if (!r || r.status === 'cancelled') return NextResponse.json({ error: 'Reserva no encontrada.' }, { status: 404 })
  const { data, error } = await supabase.from('payments').insert({
    reservation_id: r.id, amount, method: body.method, note: String(body.note || '').trim().slice(0, 200) || null, created_by: user.email ?? null,
  }).select('id, reservation_id, amount, method, note, created_by, created_at').single()
  if (error) return NextResponse.json({ error: 'No se pudo registrar el pago.' }, { status: 500 })
  return NextResponse.json(data)
}
