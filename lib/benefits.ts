import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { phoneKey, phoneSearchPattern, samePhone } from './phone'
import { argentinaNow } from './active-reservation'
import { currentPeriod, hoursBetween, arToMs } from './time'
import type { AppSettings, BenefitTier } from './settings'

// Beneficios por horas (puede haber varios: ej. 10 h, 15 h y 20 h).
// Las horas del mes se van sumando. Cuando llega a uno o más beneficios, el cliente elige cuál usar en la caja.
// Al usar uno, el contador vuelve a cero (cuentan solo las horas que reserve después). Si no usa ninguno, sigue sumando.

export interface BenefitInfo {
  enabled: boolean
  /** horas que cuentan: las del mes, desde el último beneficio usado */
  hours: number
  tiers: (BenefitTier & { unlocked: boolean })[]
  /** beneficios que ya puede usar */
  available: BenefitTier[]
  /** el próximo que le falta */
  next: (BenefitTier & { missing: number }) | null
  /** compatibilidad con pantallas viejas: el próximo (o el más alto) */
  threshold: number
  text: string
  /** código para mostrar en la caja (existe si tiene al menos un beneficio para usar) */
  benefit: { id: string; code: string; description: string; usedAt: string | null } | null
  /** el último que usó este mes */
  lastUsed: { description: string; usedAt: string } | null
}

/** Horas del mes de un teléfono (reservas confirmadas o finalizadas que ya empezaron), contando solo las que empezaron después de `sinceMs`. */
export async function monthHours(supabase: SupabaseClient, phone: string, sinceMs = 0): Promise<number> {
  const key = phoneKey(phone)
  if (!key) return 0
  const period = currentPeriod()
  const { today } = argentinaNow()
  const { data } = await supabase.from('reservations')
    .select('phone, date, time_from, time_to, actual_time_to, status')
    .ilike('phone', phoneSearchPattern(key))
    .in('status', ['confirmed', 'completed'])
    .gte('date', `${period}-01`).lte('date', today)
  const now = Date.now()
  return Math.round((data ?? [])
    .filter((r: any) => samePhone(r.phone, phone) && arToMs(r.date, r.time_from) <= now && arToMs(r.date, r.time_from) >= sinceMs)
    .reduce((acc: number, r: any) => acc + hoursBetween(r.time_from, r.actual_time_to || r.time_to), 0) * 10) / 10
}

function newCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const b = randomBytes(4)
  return 'BN-' + Array.from(b).map((x) => abc[x % abc.length]).join('')
}

/** Horas y beneficios del cliente; si ya ganó alguno y no tiene código, lo genera. */
export async function benefitFor(supabase: SupabaseClient, phone: string, customerName: string, settings: AppSettings): Promise<BenefitInfo> {
  const tiersCfg = settings.benefitTiers
  const info: BenefitInfo = {
    enabled: settings.benefitsEnabled, hours: 0, tiers: tiersCfg.map((t) => ({ ...t, unlocked: false })), available: [], next: null,
    threshold: tiersCfg[0]?.hours ?? settings.benefitHours, text: tiersCfg[0]?.text ?? settings.benefitText, benefit: null, lastUsed: null,
  }
  const key = phoneKey(phone)
  if (!settings.benefitsEnabled || !key || tiersCfg.length === 0) return info
  const period = currentPeriod()
  const { data: rows } = await supabase.from('benefits').select('id, code, description, used_at, created_at')
    .eq('phone_key', key).eq('period', period).order('created_at', { ascending: true })
  const used = (rows ?? []).filter((r: any) => r.used_at).sort((a: any, b: any) => String(b.used_at).localeCompare(String(a.used_at)))
  if (used[0]) info.lastUsed = { description: used[0].description, usedAt: used[0].used_at }

  info.hours = await monthHours(supabase, phone, used[0] ? Date.parse(used[0].used_at) : 0)
  info.tiers = tiersCfg.map((t) => ({ ...t, unlocked: info.hours >= t.hours }))
  info.available = tiersCfg.filter((t) => info.hours >= t.hours)
  const nxt = tiersCfg.find((t) => info.hours < t.hours)
  info.next = nxt ? { ...nxt, missing: Math.round((nxt.hours - info.hours) * 10) / 10 } : null
  const ref = nxt ?? tiersCfg[tiersCfg.length - 1]
  info.threshold = ref.hours
  info.text = ref.text

  const open = (rows ?? []).find((r: any) => !r.used_at)
  if (info.available.length === 0) return info
  const best = info.available[info.available.length - 1]
  const description = info.available.length === 1 ? best.text : info.available.map((t) => `${t.hours} h: ${t.text}`).join(' · ')
  if (open) {
    if (open.description !== description) await supabase.from('benefits').update({ description, hours_reached: info.hours }).eq('id', open.id)
    info.benefit = { id: open.id, code: open.code, description, usedAt: null }
    return info
  }
  for (let i = 0; i < 4 && !info.benefit; i++) {
    const { data } = await supabase.from('benefits').insert({
      phone_key: key, period, code: newCode(), description, hours_reached: info.hours, customer_name: customerName,
    }).select('id, code, description, used_at').single()
    if (data) info.benefit = { id: data.id, code: data.code, description: data.description, usedAt: data.used_at }
  }
  return info
}

/** Lo que ve el cliente (pizarra y Mis reservas). */
export function benefitForClient(b: BenefitInfo) {
  if (!b.enabled) return null
  return {
    hours: b.hours, threshold: b.threshold, text: b.text,
    tiers: b.tiers, available: b.available, next: b.next, lastUsed: b.lastUsed,
    code: b.benefit ? b.benefit.code : null,
    won: b.available.length > 0, used: false,
  }
}
