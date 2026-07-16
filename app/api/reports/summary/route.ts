import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { WORKSPACE_PRICES, WorkspaceType } from '@/lib/types'

const SUPABASE_URL = 'https://coxfxtcpoyssejhnyqyt.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.CLAVE_SECRETA_PEDIDOS!

function getServiceSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

function durationHours(timeFrom: string, timeTo: string): number {
  const [hFrom, mFrom] = timeFrom.split(':').map(Number)
  const [hTo, mTo] = timeTo.split(':').map(Number)
  return ((hTo * 60 + mTo) - (hFrom * 60 + mFrom)) / 60
}

// GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
// Devuelve el resumen de reservas y consumo de Market para ese rango de fechas (inclusive).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'Faltan parámetros: from, to' }, { status: 400 })
    }

    const supabase = getServiceSupabase()

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

    // Igual criterio que usa el panel de Staff para las etiquetas "Reserva App" / "Atención Staff":
    // si tiene comprobante subido (receipt_url), fue pagada/hecha desde la app; si no, la cargó el staff.
    const appReservations = confirmedReservations.filter((r: any) => !!r.receipt_url)
    const staffReservations = confirmedReservations.filter((r: any) => !r.receipt_url)

    const sumHours = (list: any[]) => list.reduce((acc: number, r: any) => acc + durationHours(r.time_from, r.time_to), 0)
    const totalHours = sumHours(confirmedReservations)
    const appHours = sumHours(appReservations)
    const staffHours = sumHours(staffReservations)

    const espacioRevenue = confirmedReservations.reduce((acc: number, r: any) => {
      const price = WORKSPACE_PRICES[r.workspace as WorkspaceType] || 0
      const hours = durationHours(r.time_from, r.time_to)
      return acc + price * hours
    }, 0)

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

    // Detalle fila por fila de cada reserva, con su consumo de Market asociado (para el Excel)
    const reservationsDetail = allReservations
      .slice()
      .sort((a: any, b: any) => `${a.date} ${a.time_from}`.localeCompare(`${b.date} ${b.time_from}`))
      .map((r: any) => {
        const hours = durationHours(r.time_from, r.time_to)
        const espacio = r.status === 'confirmed' ? (WORKSPACE_PRICES[r.workspace as WorkspaceType] || 0) * hours : 0
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
          source: r.receipt_url ? 'app' : 'staff',
          status: r.status,
          espacioRevenue: espacio,
          marketConsumption: consumo,
          total: espacio + consumo,
        }
      })

    return NextResponse.json({
      range: { from, to },
      reservations: {
        total: allReservations.length,
        confirmed: confirmedReservations.length,
        cancelled: cancelledReservations.length,
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
      reservationsDetail,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
