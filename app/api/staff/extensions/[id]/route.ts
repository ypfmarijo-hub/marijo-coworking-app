import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'
import { maxExtensionHours } from '@/lib/extension'
import { addHoursToTime } from '@/lib/time'
import { pushToPhone } from '@/lib/push'

// POST /api/staff/extensions/:id  { action: 'confirmar' | 'rechazar' }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireStaff()
  if (denied) return denied
  const { id } = await params
  const { action } = await req.json().catch(() => ({}))
  const supabase = createServiceClient()
  const { data: ext } = await supabase.from('extension_requests').select('*').eq('id', id).maybeSingle()
  if (!ext || ext.status !== 'pendiente') return NextResponse.json({ error: 'Ese pedido ya fue resuelto.' }, { status: 400 })
  const { data: r } = await supabase.from('reservations').select('*').eq('id', ext.reservation_id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Reserva no encontrada.' }, { status: 404 })

  if (action === 'rechazar') {
    await supabase.from('extension_requests').update({ status: 'rechazada', resolved_at: new Date().toISOString() }).eq('id', id)
    await pushToPhone(supabase, r.phone, { title: 'No se pudo extender', body: 'Acercate a la caja para resolverlo.', tag: 'extension' })
    return NextResponse.json({ ok: true })
  }

  const hours = Number(ext.hours)
  if ((await maxExtensionHours(supabase, r)) < hours) {
    return NextResponse.json({ error: 'El lugar ya no está libre todas esas horas. Hablá con el cliente.' }, { status: 409 })
  }
  const newEnd = addHoursToTime(r.time_to, hours)
  const { error } = await supabase.from('reservations')
    .update({ time_to: newEnd, extra_hours: Number(r.extra_hours || 0) + hours, extra_amount: Number(r.extra_amount || 0) + Number(ext.amount || 0),
      // si se había finalizado sola al terminar el horario, se reabre con el horario nuevo
      ...(r.status === 'completed' && r.auto_finalized ? { status: 'confirmed', actual_time_to: null, completed_at: null, auto_finalized: false } : {}) }).eq('id', r.id)
  if (error) return NextResponse.json({ error: 'No se pudo extender.' }, { status: 500 })
  await supabase.from('extension_requests').update({ status: 'confirmada', resolved_at: new Date().toISOString() }).eq('id', id)
  // el aviso de "faltan 10 minutos" vuelve a valer para el nuevo horario
  await supabase.from('notification_logs').delete().eq('reservation_id', r.id).eq('notification_type', 'ending_10min')
  await pushToPhone(supabase, r.phone, { title: 'Extensión confirmada', body: `Tu estadía se extendió ${hours} h, hasta las ${newEnd}. Lo pagás en caja antes de irte.`, tag: 'extension' })
  return NextResponse.json({ ok: true, timeTo: newEnd })
}
