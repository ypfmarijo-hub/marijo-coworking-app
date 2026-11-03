import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'
import { placeLabel } from '@/lib/pizarra'

// GET /api/staff/extensions — pedidos de extensión pendientes y los resueltos de hoy (solo staff)
export async function GET() {
  const denied = await requireStaff()
  if (denied) return denied
  const supabase = createServiceClient()
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data, error } = await supabase.from('extension_requests')
    .select('id, hours, amount, method, receipt_path, status, created_at, resolved_at, reservation_id, reservations(first_name, last_name, phone, workspace, desk_number, time_from, time_to, reservation_code)')
    .or(`status.eq.pendiente,created_at.gte.${since}`)
    .order('created_at', { ascending: false }).limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((x: any) => ({
    id: x.id, hours: Number(x.hours), amount: x.amount, method: x.method, status: x.status,
    createdAt: x.created_at, customer: x.reservations ? `${x.reservations.first_name} ${x.reservations.last_name}`.trim() : '',
    place: x.reservations ? placeLabel(x.reservations) : '', code: x.reservations?.reservation_code ?? '',
    timeTo: x.reservations?.time_to ?? '',
  })))
}
