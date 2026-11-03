import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'
import { placeLabel } from '@/lib/pizarra'

// GET /api/staff/feedback — últimas opiniones de los clientes, con el promedio
export async function GET() {
  const denied = await requireStaff()
  if (denied) return denied
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('feedback')
    .select('id, rating, comment, customer_name, created_at, read_at, reservations(date, time_from, time_to, workspace, desk_number)')
    .order('created_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: 'No se pudieron leer las opiniones.' }, { status: 500 })
  const items = (data ?? []).map((f: any) => ({
    id: f.id, rating: f.rating, comment: f.comment, customer: f.customer_name, createdAt: f.created_at, read: !!f.read_at,
    visit: f.reservations ? `${f.reservations.date} · ${f.reservations.time_from} a ${f.reservations.time_to} · ${placeLabel(f.reservations)}` : '',
  }))
  const avg = items.length ? Math.round((items.reduce((a, b) => a + b.rating, 0) / items.length) * 10) / 10 : null
  return NextResponse.json({ items, average: avg, unread: items.filter((i) => !i.read).length })
}

// POST /api/staff/feedback — marcar todas como leídas
export async function POST(_req: NextRequest) {
  const denied = await requireStaff()
  if (denied) return denied
  await createServiceClient().from('feedback').update({ read_at: new Date().toISOString() }).is('read_at', null)
  return NextResponse.json({ ok: true })
}
