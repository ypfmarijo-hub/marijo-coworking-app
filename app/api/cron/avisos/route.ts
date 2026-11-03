import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { argentinaNow } from '@/lib/active-reservation'
import { reservationWindow } from '@/lib/time'
import { placeLabel } from '@/lib/pizarra'
import { pushToPhone, pushToStaff } from '@/lib/push'
import { finalizeDue } from '@/lib/auto-finalize'

// GET /api/cron/avisos?key=CRON_SECRET
// Se llama cada minuto (desde Supabase, ver guía). Avisa al cliente y al staff cuando a una reserva le quedan 10 minutos.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const key = req.nextUrl.searchParams.get('key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || key !== secret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createServiceClient()
  const { today } = argentinaNow()
  const { data } = await supabase.from('reservations').select('id, first_name, last_name, phone, workspace, desk_number, date, time_from, time_to, status')
    .eq('date', today).eq('status', 'confirmed')
  const now = Date.now()
  const due = (data ?? []).filter((r: any) => {
    const left = reservationWindow(r).endMs - now
    return left > 0 && left <= 10.5 * 60000
  })
  let sent = 0
  for (const r of due) {
    // un solo aviso por reserva (la tabla no deja repetir reserva + tipo)
    const { error } = await supabase.from('notification_logs').insert({ reservation_id: r.id, notification_type: 'ending_10min' })
    if (error) continue
    await pushToPhone(supabase, r.phone, { title: 'Te quedan 10 minutos', body: '¿Querés quedarte más? Tocá para extender tu estadía. Al pagar en caja, cargá tus puntos en la App YPF.', tag: 'fin' })
    await pushToStaff(supabase, { title: 'Reserva por terminar', body: `${r.first_name} ${r.last_name} (${placeLabel(r)}) termina en 10 minutos.`, tag: 'fin' })
    sent++
  }
  // las reservas que ya terminaron se finalizan solas
  const finalizadas = await finalizeDue(supabase)
  return NextResponse.json({ ok: true, avisos: sent, finalizadas })
}
