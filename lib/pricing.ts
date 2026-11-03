// Precios por hora y combos, editables por el staff desde "Ajustes".
// Se guardan en app_settings (claves 'prices' y 'combos'). Si no hay nada guardado, se usan los precios de siempre.
// Cada reserva guarda el total con el que se hizo (price_total), así un cambio de precio no altera lo ya cobrado.

import type { SupabaseClient } from '@supabase/supabase-js'
import { WORKSPACE_PRICES, type WorkspaceType } from './types'
import { hoursBetween, addHoursToTime, CLOSING_TIME } from './time'

export type Prices = Record<WorkspaceType, number>
export interface Combo {
  id: string
  name: string
  workspace: WorkspaceType
  hours: number
  price: number
  active: boolean
}
export interface Pricing { prices: Prices; combos: Combo[] }

const SPACES = Object.keys(WORKSPACE_PRICES) as WorkspaceType[]

export function cleanPrices(raw: unknown): Prices {
  const out = { ...WORKSPACE_PRICES }
  if (raw && typeof raw === 'object') {
    for (const s of SPACES) {
      const v = Math.round(Number((raw as Record<string, unknown>)[s]))
      if (Number.isFinite(v) && v >= 0 && v <= 10_000_000) out[s] = v
    }
  }
  return out
}

export function cleanCombos(raw: unknown): Combo[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 30).flatMap((c: any) => {
    const name = String(c?.name ?? '').trim().slice(0, 40)
    const workspace = String(c?.workspace ?? '') as WorkspaceType
    const hours = Math.round(Number(c?.hours))
    const price = Math.round(Number(c?.price))
    if (!name || !SPACES.includes(workspace) || !(hours >= 1 && hours <= 15) || !(price >= 0 && price <= 10_000_000)) return []
    const id = String(c?.id ?? '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40) || `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    return [{ id, name, workspace, hours, price, active: c?.active !== false }]
  })
}

export async function getPricing(supabase: SupabaseClient): Promise<Pricing> {
  const { data } = await supabase.from('app_settings').select('key, value').in('key', ['prices', 'combos'])
  const map = new Map((data ?? []).map((r: any) => [r.key, r.value]))
  return { prices: cleanPrices(map.get('prices')), combos: cleanCombos(map.get('combos')) }
}

export async function savePricing(supabase: SupabaseClient, input: { prices?: unknown; combos?: unknown }): Promise<Pricing> {
  const now = new Date().toISOString()
  const rows: { key: string; value: unknown; updated_at: string }[] = []
  if (input.prices !== undefined) rows.push({ key: 'prices', value: cleanPrices(input.prices), updated_at: now })
  if (input.combos !== undefined) rows.push({ key: 'combos', value: cleanCombos(input.combos), updated_at: now })
  if (rows.length) await supabase.from('app_settings').upsert(rows)
  return getPricing(supabase)
}

/** Total de una reserva: por horas, o el precio del combo (que fija la hora de fin). */
export function quote(pricing: Pricing, workspace: WorkspaceType, timeFrom: string, timeTo: string, comboId?: string | null):
  { ok: true; total: number; combo: Combo | null; timeTo: string } | { ok: false; error: string } {
  if (comboId) {
    const combo = pricing.combos.find((c) => c.id === comboId && c.active)
    if (!combo) return { ok: false, error: 'Ese combo ya no está disponible. Elegí otra opción.' }
    if (combo.workspace !== workspace) return { ok: false, error: 'Ese combo es para otro espacio.' }
    const end = addHoursToTime(timeFrom, combo.hours)
    if (end > CLOSING_TIME) return { ok: false, error: `El combo dura ${combo.hours} h y no termina antes del cierre (${CLOSING_TIME}).` }
    return { ok: true, total: combo.price, combo, timeTo: end }
  }
  return { ok: true, total: Math.round((pricing.prices[workspace] ?? 0) * hoursBetween(timeFrom, timeTo)), combo: null, timeTo }
}

/** Lo que vale una reserva ya hecha: el total guardado, o (reservas viejas) el precio por hora × horas. */
export function reservationBaseTotal(r: { price_total?: number | null; workspace: string; time_from: string; time_to: string; extra_hours?: number | null },
  prices: Prices = WORKSPACE_PRICES): number {
  if (r.price_total != null) return Number(r.price_total)
  const baseHours = Math.max(0, hoursBetween(r.time_from, r.time_to) - Number(r.extra_hours || 0))
  return Math.round((prices[r.workspace as WorkspaceType] ?? 0) * baseHours)
}
