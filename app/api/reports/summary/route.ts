import { resolveAgeRange, AGE_RANGES } from '@/lib/age'
import { phoneKey } from '@/lib/phone'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'
import { getPricing, reservationBaseTotal } from '@/lib/pricing'
import { buildInsights } from '@/lib/report-insights'

// Redondea a 2 decimales para evitar los decimales largos que deja el punto flotante de JS
// (ej: 31.866666666666660 en vez de 31.87)
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function durationHours(timeFrom: string, timeTo: string): number {
  const [hFrom, mFrom] = timeFrom.split(':').map(Number)
  const [hTo, mTo] = timeTo.split(':').map(Number)
  const raw = ((hTo * 60 + mTo) - (hFrom * 60 + mFrom)) / 60
  return round2(raw)
}

// GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
// Devuelve el resumen de reservas y consumo de Market para ese rango de fechas (inclusive).
export async function GET(req: NextRequest) {
  const denied = await requireStaff()
  if (denied) return denied

  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'Faltan parámetros: from, to' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Reservas dentro del rango (todas, luego separamos confirmed/cancelled)
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('*')
      .gte('date', from)
      .lte('date', to)

    if (resError) {
      return NextResponse.json({ error: resError.message }, { status: 500 })
    }

    // Pedidos de Market creados dentro del rango (hora Argentina, UTC-3)
    const fromIso = `${from}T00:00:00-03:00`
    const toIso = `${to}T23:59:59-03:00`

    const { data: orders, error: ordError } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .in('status', ['entregado', 'aceptado'])

    if (ordError) {
      return NextResponse.json({ error: ordError.message }, { status: 500 })
    }

    const allReservations = reservations || []
    const confirmedReservations = allReservations.filter((r: any) => r.status === 'confirmed')
    const cancelledReservations = allReservations.filter((r: any) => r.status === 'cancelled')
    // 'completed' = reserva que ya se usó y terminó normalmente (no cancelada). Cuenta como facturable, igual que 'confirmed'.
    const completedReservations = allReservations.filter((r: any) => r.status === 'completed')
    // Cualquier otro estado que exista (ej: payment_pending) para que el total siempre cierre
    const otherReservations = allReservations.filter((r: any) =>
      !['confirmed', 'cancelled', 'completed'].includes(r.status)
    )
    // Reservas que efectivamente generan facturación: confirmadas + completadas (canceladas no)
    const billableReservations = [...confirmedReservations, ...completedReservations]

    // Igual criterio que el panel de Staff ("Reserva App" / "Atención Staff"): is_present = la cargó el staff.
    // (Las reservas viejas sin ese dato se clasifican por el comprobante, como antes.)
    const fromApp = (r: any) => (r.is_present == null ? !!r.receipt_url : !r.is_present)
    const appReservations = billableReservations.filter(fromApp)
    const staffReservations = billableReservations.filter((r: any) => !fromApp(r))

    const sumHours = (list: any[]) => round2(list.reduce((acc: number, r: any) => acc + durationHours(r.time_from, r.time_to), 0))
    const totalHours = sumHours(billableReservations)
    const appHours = sumHours(appReservations)
    const staffHours = sumHours(staffReservations)

    // Cada reserva vale lo que se cobró: total guardado (o, en las viejas, precio por hora × horas) + extensiones pagadas
    const { prices } = await getPricing(supabase)
    const reservationValue = (r: any) => reservationBaseTotal(r, prices) + Number(r.extra_paid || 0) + Number(r.extra_amount || 0)
    const espacioRevenue = billableReservations.reduce((acc: number, r: any) => acc + reservationValue(r), 0)

    const allOrders = orders || []
    const marketRevenue = allOrders.reduce((acc: number, o: any) => acc + (Number(o.total_amount) || 0), 0)

    // Desglose por origen del pedido: 'app' (cliente) vs 'staff' (cargado a mano, ej. WhatsApp)
    const appOrders = allOrders.filter((o: any) => (o.source || 'app') === 'app')
    const staffOrders = allOrders.filter((o: any) => o.source === 'staff')
    const marketBySource = {
      app: { count: appOrders.length, revenue: appOrders.reduce((acc: number, o: any) => acc + (Number(o.total_amount) || 0), 0) },
      staff: { count: staffOrders.length, revenue: staffOrders.reduce((acc: number, o: any) => acc + (Number(o.total_amount) || 0), 0) },
    }

    // Desglose por producto
    const productMap = new Map<string, { name: string; quantity: number; revenue: number }>()
    for (const order of allOrders) {
      const items = Array.isArray(order.items) ? order.items : []
      for (const item of items) {
        const name = item.name || 'Producto sin nombre'
        const quantity = Number(item.quantity) || 0
        const subtotal = Number(item.subtotal) || (Number(item.price) || 0) * quantity
        const existing = productMap.get(name)
        if (existing) {
          existing.quantity += quantity
          existing.revenue += subtotal
        } else {
          productMap.set(name, { name, quantity, revenue: subtotal })
        }
      }
    }
    const products = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue)

    // DNI de cada cliente (de cualquier reserva suya, aunque no sea de este rango) → rango de edad aproximado
    // (si no dejó DNI, vale la edad aproximada que estimó el staff)
    const { data: ageRows } = await supabase.from('reservations').select('phone, dni, age_range_staff, date').or('dni.not.is.null,age_range_staff.not.is.null').order('date', { ascending: false })
    const dniByPhone = new Map<string, string>(), staffAgeByPhone = new Map<string, string>()
    for (const d of ageRows ?? []) {
      const k = phoneKey(d.phone); if (!k) continue
      if (d.dni && !dniByPhone.has(k)) dniByPhone.set(k, d.dni)
      if (d.age_range_staff && !staffAgeByPhone.has(k)) staffAgeByPhone.set(k, d.age_range_staff)
    }
    const edadDe = (r: any) => { const k = phoneKey(r.phone) || ''; return resolveAgeRange(r.dni || dniByPhone.get(k), r.age_range_staff || staffAgeByPhone.get(k)) }

    // Detalle fila por fila de cada reserva, con su consumo de Market asociado (para el Excel)
    const reservationsDetail = allReservations
      .slice()
      .sort((a: any, b: any) => `${a.date} ${a.time_from}`.localeCompare(`${b.date} ${b.time_from}`))
      .map((r: any) => {
        const hours = durationHours(r.time_from, r.time_to)
        const isBillable = r.status === 'confirmed' || r.status === 'completed'
        const espacio = isBillable ? reservationValue(r) : 0
        const ordersForReservation = allOrders.filter((o: any) => o.reservation_id === r.id)
        const consumo = ordersForReservation.reduce((acc: number, o: any) => acc + (Number(o.total_amount) || 0), 0)
        return {
          date: r.date,
          code: r.reservation_code || '',
          workspace: r.workspace,
          deskNumber: r.desk_number ?? '',
          timeFrom: r.time_from,
          timeTo: r.time_to,
          hours,
          firstName: r.first_name || '',
          lastName: r.last_name || '',
          phone: r.phone || '',
          ageRange: edadDe(r) || 'Sin dato',
          source: fromApp(r) ? 'app' : 'staff',
          status: r.status,
          espacioRevenue: espacio,
          marketConsumption: consumo,
          total: espacio + consumo,
          planFull: isBillable ? Math.max(espacio, consumo) : consumo, // lo que realmente se cobra: el mayor de los dos
        }
      })

    // Opiniones de los clientes dejadas en el rango
    const { data: fbRows } = await supabase.from('feedback')
      .select('rating, comment, customer_name, created_at, reservations(date, workspace, desk_number)')
      .gte('created_at', fromIso).lte('created_at', toIso).order('created_at', { ascending: false })
    const fb = fbRows ?? []
    const feedback = {
      count: fb.length,
      average: fb.length ? Math.round((fb.reduce((a: number, f: any) => a + Number(f.rating), 0) / fb.length) * 10) / 10 : null,
      byStars: [5, 4, 3, 2, 1].map((n) => ({ stars: n, count: fb.filter((f: any) => Number(f.rating) === n).length })),
      items: fb.map((f: any) => ({ date: String(f.created_at).slice(0, 10), customer: f.customer_name || '', rating: Number(f.rating), comment: f.comment || '',
        visitDate: f.reservations?.date || '', workspace: f.reservations?.workspace || '', deskNumber: f.reservations?.desk_number ?? '' })),
    }

    // Pagos registrados en la caja por el staff (si los usan)
    const { data: payRows } = await supabase.from('payments').select('amount, method').gte('created_at', fromIso).lte('created_at', toIso)
    const cashPayments = {
      total: (payRows ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0),
      count: (payRows ?? []).length,
      byMethod: ['efectivo', 'transferencia', 'mercadopago', 'tarjeta'].map((m) => ({
        method: m, total: (payRows ?? []).filter((p: any) => p.method === m).reduce((a: number, p: any) => a + Number(p.amount), 0) })),
    }

    // Por rango de edad (aprox., según DNI): cuántas reservas, horas, valor del espacio y consumo en el Market
    const byAge = [...AGE_RANGES, 'Sin dato'].map((range) => {
      const rows = reservationsDetail.filter((d: any) => d.status !== 'cancelled' && d.ageRange === range)
      return { range, reservations: rows.length, clients: new Set(rows.map((d: any) => phoneKey(d.phone) || d.phone)).size,
        hours: round2(rows.reduce((a: number, d: any) => a + d.hours, 0)),
        espacio: rows.reduce((a: number, d: any) => a + d.espacioRevenue, 0), market: rows.reduce((a: number, d: any) => a + d.marketConsumption, 0) }
    }).filter((x) => x.reservations > 0)

    // Resumen para decidir (ocupación, horarios, escritorios, lo más consumido, comparación con el período anterior)
    const insights = await buildInsights(supabase, from, to, prices)

    return NextResponse.json({
      insights,
      byAge,
      cashPayments,
      feedback,
      range: { from, to },
      reservations: {
        total: allReservations.length,
        confirmed: confirmedReservations.length,
        completed: completedReservations.length,
        cancelled: cancelledReservations.length,
        other: otherReservations.length,
        revenue: espacioRevenue,
        totalHours,
        bySource: {
          app: { count: appReservations.length, hours: appHours },
          staff: { count: staffReservations.length, hours: staffHours },
        },
      },
      market: {
        orderCount: allOrders.length,
        revenue: marketRevenue,
        bySource: marketBySource,
        products,
      },
      totalRevenue: espacioRevenue + marketRevenue,
      // Con el Plan FULL el consumo cubre el espacio: por cada reserva se cobra el mayor entre espacio y consumo.
      // Más los pedidos de reservas fuera del rango o sin reserva.
      planFullTotal: reservationsDetail.reduce((a: number, r: any) => a + r.planFull, 0)
        + allOrders.filter((o: any) => !allReservations.some((r: any) => r.id === o.reservation_id)).reduce((a: number, o: any) => a + (Number(o.total_amount) || 0), 0),
      reservationsDetail,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
