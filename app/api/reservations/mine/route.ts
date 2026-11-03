import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { publicReservationFields } from '@/lib/active-reservation'
import { phoneKey, phoneSearchPattern, samePhone } from '@/lib/phone'
import { getSettings } from '@/lib/settings'
import { benefitFor, benefitForClient } from '@/lib/benefits'

// POST /api/reservations/mine  { phone }
// Público. Devuelve solo las reservas de ESE teléfono (exacto), de los últimos 6 meses en adelante.
// Antes el navegador descargaba todas las reservas de todos los clientes y filtraba en pantalla.
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()
    const key = phoneKey(String(phone || ''))
    if (!key) return NextResponse.json({ reservations: [], benefit: null })

    const since = new Date()
    since.setMonth(since.getMonth() - 6)

    const { data, error } = await createServiceClient()
      .from('reservations')
      .select('*')
      .ilike('phone', phoneSearchPattern(key))
      .gte('date', since.toISOString().slice(0, 10))
      .order('date', { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: 'No se pudieron leer tus reservas' }, { status: 500 })

    // Decisión del 30/10: con solo el teléfono NO se entrega el código (es la llave de la pizarra:
    // cualquiera que conozca un número podría entrar). El código lo da el staff, en la caja o por WhatsApp.
    const rows = (data ?? []).filter((r: any) => samePhone(r.phone, phone))
    // Opiniones ya dejadas (para mostrar "Gracias" en vez del formulario)
    const ids = rows.map((r: any) => r.id)
    const { data: fb } = ids.length ? await createServiceClient().from('feedback').select('reservation_id, rating').in('reservation_id', ids) : { data: [] }
    const ratings = new Map((fb ?? []).map((f: any) => [f.reservation_id, f.rating]))
    const mine = rows.map((r: any) => ({ ...publicReservationFields(r), reservation_code: null, my_rating: ratings.get(r.id) ?? null, combo_name: r.combo_name ?? null }))
    const supabase = createServiceClient()
    const settings = await getSettings(supabase)
    const name = rows[0] ? `${rows[0].first_name} ${rows[0].last_name}`.trim() : ''
    const b = rows.length ? await benefitFor(supabase, String(phone), name, settings) : null
    return NextResponse.json({
      reservations: mine,
      benefit: b ? benefitForClient(b) : null,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
