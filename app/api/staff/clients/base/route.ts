import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'
import { phoneKey } from '@/lib/phone'
import { resolveAgeRange, estimateBirthYear } from '@/lib/age'
import { getPricing, reservationBaseTotal } from '@/lib/pricing'
import { hoursBetween } from '@/lib/time'

// GET /api/staff/clients/base — Base de datos de clientes (solo staff).
// Un renglón por cliente (por teléfono): datos de contacto, DNI y edad aproximada, lo que cargó en la pizarra
// (a qué se dedica, qué ofrece, qué busca), cuántas veces vino, horas, cuánto gastó y en el Market.
async function all(supabase: any, table: string, cols: string) {
  const out: any[] = []
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await supabase.from(table).select(cols).range(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

export async function GET() {
  const denied = await requireStaff()
  if (denied) return denied
  const supabase = createServiceClient()
  try {
    const [resv, profiles, orders, { prices }] = await Promise.all([
      all(supabase, 'reservations', 'id, phone, first_name, last_name, dni, age_range_staff, date, time_from, time_to, actual_time_to, status, workspace, price_total, extra_hours, extra_amount, extra_paid'),
      all(supabase, 'pizarra_profiles', 'phone_key, rubro, offers, seeks, updated_at'),
      all(supabase, 'orders', 'reservation_id, total_amount, status'),
      getPricing(supabase),
    ])
    const profByKey = new Map(profiles.map((p: any) => [p.phone_key, p]))
    const marketByRes = new Map<string, number>()
    for (const o of orders) {
      if (!o.reservation_id || !['aceptado', 'entregado'].includes(o.status)) continue
      marketByRes.set(o.reservation_id, (marketByRes.get(o.reservation_id) || 0) + (Number(o.total_amount) || 0))
    }

    const clients = new Map<string, any>()
    // de la más nueva a la más vieja: el nombre y el teléfono que quedan son los últimos que usó
    for (const r of resv.slice().sort((a: any, b: any) => `${b.date}${b.time_from}`.localeCompare(`${a.date}${a.time_from}`))) {
      const key = phoneKey(r.phone) || String(r.phone || '').replace(/\D/g, '') || r.id
      let c = clients.get(key)
      if (!c) {
        c = { key, firstName: r.first_name || '', lastName: r.last_name || '', phone: r.phone || '', dni: null as string | null, ageRangeStaff: null as string | null,
          visits: 0, cancelled: 0, hours: 0, espacio: 0, market: 0, firstVisit: r.date, lastVisit: null as string | null }
        clients.set(key, c)
      }
      if (!c.dni && r.dni) c.dni = r.dni
      if (!c.ageRangeStaff && r.age_range_staff) c.ageRangeStaff = r.age_range_staff
      if (r.status === 'cancelled') { c.cancelled++; continue }
      c.visits++
      c.lastVisit = c.lastVisit || r.date
      c.firstVisit = r.date
      c.hours += hoursBetween(r.time_from, r.actual_time_to || r.time_to)
      c.espacio += reservationBaseTotal(r, prices) + Number(r.extra_amount || 0) + Number(r.extra_paid || 0)
      c.market += marketByRes.get(r.id) || 0
    }

    const list = [...clients.values()].map((c) => {
      const p: any = profByKey.get(c.key)
      const birth = estimateBirthYear(c.dni)
      return {
        ...c,
        hours: Math.round(c.hours * 10) / 10,
        ageRange: resolveAgeRange(c.dni, c.ageRangeStaff) || 'Sin dato',
        ageSource: c.dni && birth ? 'dni' : c.ageRangeStaff ? 'staff' : null,
        birthYearApprox: birth,
        rubro: p?.rubro || '',
        offers: p?.offers || [],
        seeks: p?.seeks || [],
      }
    }).sort((a, b) => String(b.lastVisit || b.firstVisit).localeCompare(String(a.lastVisit || a.firstVisit)))

    return NextResponse.json({ clients: list }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    return NextResponse.json({ error: 'No se pudo armar la base de clientes' }, { status: 500 })
  }
}
