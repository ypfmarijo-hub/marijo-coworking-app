import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadSession, placeLabel } from '@/lib/pizarra'
import { maxExtensionHours, pricePerHour } from '@/lib/extension'
import { pushToStaff } from '@/lib/push'

// POST /api/pizarra/extend  { hours }
// El cliente pide quedarse más horas. El staff confirma la extensión y esas horas se suman a lo que paga en caja al irse.
export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const s = await loadSession(supabase)
  if (!s || !(s.active || s.canExtendAfterEnd)) return NextResponse.json({ error: 'Tu reserva ya no se puede extender.' }, { status: 401 })
  try {
    let hours = 0
    const type = req.headers.get('content-type') || ''
    if (type.includes('application/json')) hours = Math.round(Number((await req.json().catch(() => ({}))).hours))
    else hours = Math.round(Number((await req.formData()).get('hours')))

    const r = s.reservation
    const { data: pending } = await supabase.from('extension_requests').select('id').eq('reservation_id', r.id).eq('status', 'pendiente').maybeSingle()
    if (pending) return NextResponse.json({ error: 'Ya tenés un pedido de extensión esperando confirmación.' }, { status: 400 })
    const max = await maxExtensionHours(supabase, r)
    if (!(hours >= 1 && hours <= max)) {
      return NextResponse.json({ error: max ? `Podés extender hasta ${max} h.` : 'Tu lugar no está libre después de tu horario.' }, { status: 400 })
    }

    const amount = (await pricePerHour(supabase, r.workspace)) * hours
    const { error } = await supabase.from('extension_requests').insert({ reservation_id: r.id, hours, amount, method: 'caja', receipt_path: null })
    if (error) return NextResponse.json({ error: 'No se pudo enviar el pedido.' }, { status: 500 })

    await pushToStaff(supabase, { title: 'Pedido de extensión', tag: 'extension',
      body: `${r.first_name} ${r.last_name} (${placeLabel(r)}) quiere ${hours} h más ($ ${amount.toLocaleString('es-AR')}, se cobra en caja). Confirmalo en Extensiones.` })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
