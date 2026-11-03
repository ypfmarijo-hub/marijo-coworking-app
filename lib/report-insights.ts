import type { SupabaseClient } from '@supabase/supabase-js'
import { WORKSPACE_LABELS, type WorkspaceType } from './types'
import { phoneKey } from './phone'
import { hoursBetween } from './time'
import { reservationBaseTotal, type Prices } from './pricing'

// "Resumen para decidir": números pensados para el dueño (ocupación, horarios fuertes, escritorios más pedidos,
// lo más consumido, clientes nuevos y recurrentes, comparación con el período anterior) + conclusiones en palabras.

const OPEN_FROM = 7 // horario del panel: de 7 a 22
const OPEN_TO = 22
const DESKS = 12
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const r1 = (n: number) => Math.round(n * 10) / 10
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0)

function daysBetween(from: string, to: string) {
  return Math.max(1, Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000) + 1)
}
function shiftDate(iso: string, days: number) {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
}
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

async function periodData(supabase: SupabaseClient, from: string, to: string) {
  const [{ data: res }, { data: ord }] = await Promise.all([
    supabase.from('reservations').select('*').gte('date', from).lte('date', to),
    supabase.from('orders').select('reservation_id, total_amount, items, status, created_at')
      .gte('created_at', `${from}T00:00:00-03:00`).lte('created_at', `${to}T23:59:59-03:00`).in('status', ['entregado', 'aceptado']),
  ])
  return { reservations: res ?? [], orders: ord ?? [] }
}

function metrics(reservations: any[], orders: any[], prices: Prices) {
  const billable = reservations.filter((r) => r.status === 'confirmed' || r.status === 'completed')
  const value = (r: any) => reservationBaseTotal(r, prices) + Number(r.extra_paid || 0) + Number(r.extra_amount || 0)
  const espacio = billable.reduce((a, r) => a + value(r), 0)
  const market = orders.reduce((a, o) => a + (Number(o.total_amount) || 0), 0)
  const byRes = new Map<string, number>()
  for (const o of orders) if (o.reservation_id) byRes.set(o.reservation_id, (byRes.get(o.reservation_id) || 0) + (Number(o.total_amount) || 0))
  const planFull = billable.reduce((a, r) => a + Math.max(value(r), byRes.get(r.id) || 0), 0)
  const hours = billable.reduce((a, r) => a + hoursBetween(r.time_from, r.time_to), 0)
  const clients = new Set(billable.map((r) => phoneKey(r.phone) || r.phone)).size
  return { reservations: billable.length, hours: r1(hours), espacio, market, planFull, clients,
    cancelled: reservations.filter((r) => r.status === 'cancelled').length,
    avgConsumo: billable.length ? Math.round(billable.reduce((a, r) => a + (byRes.get(r.id) || 0), 0) / billable.length) : 0 }
}

export async function buildInsights(supabase: SupabaseClient, from: string, to: string, prices: Prices) {
  const days = daysBetween(from, to)
  const prevTo = shiftDate(from, -1)
  const prevFrom = shiftDate(prevTo, -(days - 1))
  const [cur, prev] = await Promise.all([periodData(supabase, from, to), periodData(supabase, prevFrom, prevTo)])
  const now = metrics(cur.reservations, cur.orders, prices)
  const before = metrics(prev.reservations, prev.orders, prices)
  const change = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null)
  const comparison = {
    previousRange: { from: prevFrom, to: prevTo },
    rows: ([
      ['Reservas', 'reservations'], ['Horas reservadas', 'hours'], ['Clientes distintos', 'clients'], ['Valor de los espacios', 'espacio'],
      ['Consumo en el Market', 'market'], ['Lo que corresponde cobrar (Plan FULL)', 'planFull'], ['Consumo promedio por visita', 'avgConsumo'], ['Cancelaciones', 'cancelled'],
    ] as const).map(([label, k]) => ({ label, key: k, current: (now as any)[k], previous: (before as any)[k], change: change((now as any)[k], (before as any)[k]) })),
  }

  const billable = cur.reservations.filter((r: any) => r.status === 'confirmed' || r.status === 'completed')
  const openHours = (OPEN_TO - OPEN_FROM) * days

  // ---- ocupación por espacio (la sala grande ocupa la A y la B)
  const hoursBy = (w: string) => billable.filter((r: any) => r.workspace === w).reduce((a: number, r: any) => a + hoursBetween(r.time_from, r.time_to), 0)
  const grande = hoursBy('sala-grande')
  const occupancy = (['escritorio', 'sala-a', 'sala-b', 'sala-grande', 'oficina-c', 'oficina-d'] as WorkspaceType[]).map((w) => {
    const booked = w === 'sala-a' || w === 'sala-b' ? hoursBy(w) + grande : hoursBy(w)
    const capacity = w === 'escritorio' ? openHours * DESKS : openHours
    return { workspace: w, label: WORKSPACE_LABELS[w], hours: r1(booked), capacity, percent: pct(booked, capacity),
      reservations: billable.filter((r: any) => r.workspace === w).length }
  })

  // ---- escritorios más y menos pedidos
  const desks = Array.from({ length: DESKS }, (_, i) => {
    const list = billable.filter((r: any) => r.workspace === 'escritorio' && Number(r.desk_number) === i + 1)
    return { desk: i + 1, reservations: list.length, hours: r1(list.reduce((a: number, r: any) => a + hoursBetween(r.time_from, r.time_to), 0)) }
  }).sort((a, b) => b.hours - a.hours || a.desk - b.desk)

  // ---- horarios y días con más gente (horas-persona en cada franja)
  const byHour = Array.from({ length: OPEN_TO - OPEN_FROM }, (_, i) => ({ hour: OPEN_FROM + i, people: 0 }))
  const byWeekday = DAYS.map((d) => ({ day: d, hours: 0, reservations: 0 }))
  for (const r of billable) {
    const a = toMin(r.time_from), b = toMin(r.time_to)
    for (const slot of byHour) {
      const s = slot.hour * 60, e = s + 60
      slot.people += Math.max(0, Math.min(b, e) - Math.max(a, s)) / 60
    }
    const wd = new Date(`${r.date}T12:00:00Z`).getUTCDay()
    byWeekday[wd].hours += hoursBetween(r.time_from, r.time_to)
    byWeekday[wd].reservations++
  }
  byHour.forEach((h) => (h.people = r1(h.people / days)))
  byWeekday.forEach((d) => (d.hours = r1(d.hours)))

  // ---- lo más consumido (por cantidad)
  const prod = new Map<string, { name: string; quantity: number; revenue: number }>()
  for (const o of cur.orders) for (const it of Array.isArray(o.items) ? o.items : []) {
    const name = it.name || 'Producto'
    const q = Number(it.quantity) || 0
    const p = prod.get(name) || { name, quantity: 0, revenue: 0 }
    p.quantity += q; p.revenue += Number(it.subtotal) || (Number(it.price) || 0) * q
    prod.set(name, p)
  }
  const topProducts = [...prod.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5)

  // ---- consumo y Plan FULL
  const consumoByRes = new Map<string, number>()
  for (const o of cur.orders) if (o.reservation_id) consumoByRes.set(o.reservation_id, (consumoByRes.get(o.reservation_id) || 0) + (Number(o.total_amount) || 0))
  const value = (r: any) => reservationBaseTotal(r, prices) + Number(r.extra_paid || 0) + Number(r.extra_amount || 0)
  const consumed = billable.filter((r: any) => (consumoByRes.get(r.id) || 0) > 0)
  const overSpace = billable.filter((r: any) => (consumoByRes.get(r.id) || 0) >= value(r) && value(r) > 0)
  const consumption = {
    visitsWithConsumption: consumed.length, percentWithConsumption: pct(consumed.length, billable.length),
    visitsOverSpace: overSpace.length, percentOverSpace: pct(overSpace.length, billable.length),
    unusedCredit: billable.reduce((a: number, r: any) => a + Math.max(0, value(r) - (consumoByRes.get(r.id) || 0)), 0),
  }

  // ---- clientes nuevos y recurrentes
  const keys = [...new Set(billable.map((r: any) => phoneKey(r.phone)).filter(Boolean))] as string[]
  let newClients = 0
  if (keys.length) {
    const { data: older } = await supabase.from('reservations').select('phone').lt('date', from).in('status', ['confirmed', 'completed'])
    const seenBefore = new Set((older ?? []).map((r: any) => phoneKey(r.phone)).filter(Boolean))
    newClients = keys.filter((k) => !seenBefore.has(k)).length
  }
  const visitsPerClient = keys.length ? r1(billable.length / keys.length) : 0
  const clients = { total: keys.length, new: newClients, returning: keys.length - newClients, visitsPerClient }

  // ---- combos y beneficios
  const comboMap = new Map<string, number>()
  for (const r of billable) if (r.combo_name) comboMap.set(r.combo_name, (comboMap.get(r.combo_name) || 0) + 1)
  const combos = [...comboMap.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  const { data: bens } = await supabase.from('benefits').select('description, used_at')
    .gte('used_at', `${from}T00:00:00-03:00`).lte('used_at', `${to}T23:59:59-03:00`)
  const benefitMap = new Map<string, number>()
  for (const b of bens ?? []) benefitMap.set(b.description, (benefitMap.get(b.description) || 0) + 1)
  const benefitsUsed = [...benefitMap.entries()].map(([description, count]) => ({ description, count }))

  // ---- conclusiones en palabras
  const tips: string[] = []
  const pesos = (n: number) => '$ ' + Math.round(n).toLocaleString('es-AR')
  const ch = comparison.rows.find((x) => x.key === 'planFull')!
  if (ch.change != null) tips.push(`Lo que corresponde cobrar ${ch.change >= 0 ? 'subió' : 'bajó'} ${Math.abs(ch.change).toLocaleString('es-AR')}% contra el período anterior (de ${pesos(ch.previous)} a ${pesos(ch.current)}).`)
  const occSorted = occupancy.filter((o) => o.workspace !== 'sala-grande').slice().sort((a, b) => b.percent - a.percent)
  if (billable.length) {
    tips.push(`El espacio más ocupado fue ${occSorted[0].label} (${occSorted[0].percent.toLocaleString('es-AR')}% del horario).`)
    const low = occSorted[occSorted.length - 1]
    tips.push(`El menos usado fue ${low.label} (${low.percent.toLocaleString('es-AR')}%): puede servir una promo o un combo para ese espacio.`)
    const peak = byHour.slice().sort((a, b) => b.people - a.people)[0]
    if (peak.people > 0) tips.push(`La hora con más gente es de ${peak.hour} a ${peak.hour + 1} h (en promedio ${peak.people.toLocaleString('es-AR')} personas). Conviene tener más staff en esa franja.`)
    const quiet = byHour.filter((h) => h.hour >= 9 && h.hour < 20).sort((a, b) => a.people - b.people)[0]
    if (quiet) tips.push(`La franja más tranquila es de ${quiet.hour} a ${quiet.hour + 1} h: buen momento para una promo por horario.`)
    const wd = byWeekday.slice().sort((a, b) => b.hours - a.hours)[0]
    if (wd.hours > 0) tips.push(`El día más fuerte es el ${wd.day}.`)
    if (desks[0].hours > 0) {
      const unused = desks.filter((d) => d.hours === 0).map((d) => d.desk)
      tips.push(`El escritorio más pedido es el N.° ${desks[0].desk}${unused.length ? `; no se usaron: ${unused.join(', ')}` : ''}.`)
    }
  }
  if (topProducts[0]) tips.push(`Lo más consumido: ${topProducts.slice(0, 3).map((p) => `${p.name} (${p.quantity})`).join(', ')}.`)
  if (billable.length) {
    tips.push(`${consumption.percentWithConsumption.toLocaleString('es-AR')}% de las visitas pidió algo del Market y ${consumption.percentOverSpace.toLocaleString('es-AR')}% consumió igual o más que el valor del espacio.`)
    if (consumption.unusedCredit > 0) tips.push(`Quedó ${pesos(consumption.unusedCredit)} de saldo a favor sin usar: avisar a los clientes cuánto les queda puede subir el consumo.`)
    tips.push(`Clientes: ${clients.new} nuevos y ${clients.returning} que ya habían venido (${visitsPerClient.toLocaleString('es-AR')} ${visitsPerClient === 1 ? 'visita' : 'visitas'} por cliente en promedio).`)
  }
  if (now.cancelled > 0) tips.push(`Se cancelaron ${now.cancelled} reservas (${pct(now.cancelled, now.cancelled + now.reservations).toLocaleString('es-AR')}%).`)

  return { days, comparison, occupancy, desks, byHour, byWeekday, topProducts, consumption, clients, combos, benefitsUsed, tips,
    note: `Ocupación calculada sobre el horario de ${OPEN_FROM} a ${OPEN_TO} h, todos los días del período (${days} ${days === 1 ? 'día' : 'días'}). Escritorios: ${DESKS} lugares.` }
}
