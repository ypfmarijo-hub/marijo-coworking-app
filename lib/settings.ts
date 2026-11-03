import type { SupabaseClient } from '@supabase/supabase-js'

/** Un beneficio por horas: al llegar a `hours` horas en el mes (desde el último beneficio usado), puede usar `text`. */
export interface BenefitTier { id: string; hours: number; text: string }

export interface AppSettings {
  cafeEnabled: boolean
  benefitsEnabled: boolean
  benefitHours: number
  benefitText: string
  deskDepositRequired: boolean // ¿se pide la seña del 50% también para los escritorios? (salas y oficinas siempre)
  benefitTiers: BenefitTier[] // varios beneficios (ej: 10 h, 15 h, 20 h). Si está vacío se usa benefitHours/benefitText
  askDni: boolean // ¿se pide el DNI (una sola vez) al reservar desde la app?
  cafeGiftName: string // el café de regalo de la pizarra (siempre el mismo, ej. "Café chico")
  cafeGiftPrice: number // su precio (lo fija el staff en Ajustes)
  cafeGiftOptions: string[] // cómo lo puede pedir quien lo recibe (común, cortado, latte, descremado…)
  cafeGiftMessages: string[] // mensajes ya escritos para quien invita (los edita el staff)
}

export const DEFAULT_SETTINGS: AppSettings = {
  cafeEnabled: true,
  benefitsEnabled: true,
  benefitHours: 20,
  benefitText: '10% de descuento (a definir)',
  deskDepositRequired: false,
  benefitTiers: [],
  askDni: false,
  cafeGiftName: 'Café chico',
  cafeGiftPrice: 0,
  cafeGiftOptions: ['Café común', 'Cortado', 'Lágrima', 'Latte', 'Con leche descremada'],
  cafeGiftMessages: [
    '¡Hola! Me gustaría charlar con vos, te invito un café.',
    '¡Hola! Me interesa lo que hacés, me gustaría charlar con vos. Te invito un café.',
    '¡Hola! Creo que podemos ayudarnos con nuestros trabajos. ¿Charlamos con un café?',
  ],
}

const KEYS: Record<keyof AppSettings, string> = {
  cafeEnabled: 'cafe_enabled',
  benefitsEnabled: 'benefits_enabled',
  benefitHours: 'benefit_hours',
  benefitText: 'benefit_text',
  deskDepositRequired: 'desk_deposit_required',
  benefitTiers: 'benefit_tiers',
  askDni: 'ask_dni',
  cafeGiftName: 'cafe_gift_name',
  cafeGiftPrice: 'cafe_gift_price',
  cafeGiftOptions: 'cafe_gift_options',
  cafeGiftMessages: 'cafe_gift_messages',
}

/** Lee los ajustes que el staff cambia desde el panel. Si la tabla no existe, usa los valores por defecto. */
export async function getSettings(supabase: SupabaseClient): Promise<AppSettings> {
  const { data, error } = await supabase.from('app_settings').select('key, value')
  if (error || !data) return { ...DEFAULT_SETTINGS }
  const map = new Map(data.map((r: any) => [r.key, r.value]))
  const out = { ...DEFAULT_SETTINGS }
  for (const [prop, key] of Object.entries(KEYS) as [keyof AppSettings, string][]) {
    if (map.has(key)) (out as any)[prop] = map.get(key)
  }
  out.benefitHours = Number(out.benefitHours) || DEFAULT_SETTINGS.benefitHours
  out.cafeGiftPrice = Math.max(0, Math.round(Number(out.cafeGiftPrice) || 0))
  out.cafeGiftName = String(out.cafeGiftName || DEFAULT_SETTINGS.cafeGiftName).slice(0, 60)
  out.cafeGiftOptions = cleanOptions(out.cafeGiftOptions)
  out.cafeGiftMessages = cleanMessages(out.cafeGiftMessages)
  out.benefitTiers = cleanTiers(out.benefitTiers)
  // compatibilidad: si todavía no hay lista, el beneficio único de antes es el primero
  if (out.benefitTiers.length === 0) out.benefitTiers = [{ id: 'b1', hours: out.benefitHours, text: out.benefitText }]
  return out
}

export function cleanOptions(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.map((x) => String(x ?? '').trim().slice(0, 40)).filter(Boolean) : []
  const uniq = [...new Set(list)].slice(0, 10)
  return uniq.length ? uniq : [...DEFAULT_SETTINGS.cafeGiftOptions]
}

export function cleanMessages(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.map((x) => String(x ?? '').trim().slice(0, 200)).filter(Boolean) : []
  const uniq = [...new Set(list)].slice(0, 8)
  return uniq.length ? uniq : [...DEFAULT_SETTINGS.cafeGiftMessages]
}

export function cleanTiers(raw: unknown): BenefitTier[] {
  if (!Array.isArray(raw)) return []
  const out: BenefitTier[] = []
  for (const t of raw.slice(0, 10)) {
    const hours = Math.round(Number((t as any)?.hours))
    const text = String((t as any)?.text ?? '').trim().slice(0, 120)
    if (!(hours >= 1 && hours <= 500) || !text) continue
    out.push({ id: String((t as any)?.id || `b${hours}`).slice(0, 30), hours, text })
  }
  return out.sort((a, b) => a.hours - b.hours)
}

export async function saveSettings(supabase: SupabaseClient, input: Partial<AppSettings>): Promise<AppSettings> {
  const rows: { key: string; value: unknown; updated_at: string }[] = []
  if (typeof input.cafeEnabled === 'boolean') rows.push({ key: KEYS.cafeEnabled, value: input.cafeEnabled, updated_at: new Date().toISOString() })
  if (typeof input.benefitsEnabled === 'boolean') rows.push({ key: KEYS.benefitsEnabled, value: input.benefitsEnabled, updated_at: new Date().toISOString() })
  if (input.benefitHours != null) {
    const h = Math.round(Number(input.benefitHours))
    if (h >= 1 && h <= 500) rows.push({ key: KEYS.benefitHours, value: h, updated_at: new Date().toISOString() })
  }
  if (typeof input.deskDepositRequired === 'boolean') rows.push({ key: KEYS.deskDepositRequired, value: input.deskDepositRequired, updated_at: new Date().toISOString() })
  if (typeof input.benefitText === 'string' && input.benefitText.trim()) {
    rows.push({ key: KEYS.benefitText, value: input.benefitText.trim().slice(0, 120), updated_at: new Date().toISOString() })
  }
  if (Array.isArray(input.benefitTiers)) {
    const tiers = cleanTiers(input.benefitTiers)
    if (tiers.length) {
      rows.push({ key: KEYS.benefitTiers, value: tiers, updated_at: new Date().toISOString() })
      // se mantienen los campos viejos con el primero, por compatibilidad
      rows.push({ key: KEYS.benefitHours, value: tiers[0].hours, updated_at: new Date().toISOString() })
      rows.push({ key: KEYS.benefitText, value: tiers[0].text, updated_at: new Date().toISOString() })
    }
  }
  else if (input.benefitHours != null || input.benefitText != null) {
    // forma vieja (un solo beneficio): se convierte en una lista de uno
    const cur = await getSettings(supabase)
    const tiers = cleanTiers([{ id: 'b1', hours: input.benefitHours ?? cur.benefitHours, text: input.benefitText ?? cur.benefitText }])
    if (tiers.length) rows.push({ key: KEYS.benefitTiers, value: tiers, updated_at: new Date().toISOString() })
  }
  if (typeof input.askDni === 'boolean') rows.push({ key: KEYS.askDni, value: input.askDni, updated_at: new Date().toISOString() })
  if (input.cafeGiftPrice != null && Number(input.cafeGiftPrice) >= 0) rows.push({ key: KEYS.cafeGiftPrice, value: Math.round(Number(input.cafeGiftPrice)), updated_at: new Date().toISOString() })
  if (typeof input.cafeGiftName === 'string' && input.cafeGiftName.trim()) rows.push({ key: KEYS.cafeGiftName, value: input.cafeGiftName.trim().slice(0, 60), updated_at: new Date().toISOString() })
  if (Array.isArray(input.cafeGiftMessages)) rows.push({ key: KEYS.cafeGiftMessages, value: cleanMessages(input.cafeGiftMessages), updated_at: new Date().toISOString() })
  if (Array.isArray(input.cafeGiftOptions)) rows.push({ key: KEYS.cafeGiftOptions, value: cleanOptions(input.cafeGiftOptions), updated_at: new Date().toISOString() })
  // una fila por clave (la última gana), si no la base rechaza el guardado
  const unique = [...new Map(rows.map((r) => [r.key, r])).values()]
  if (unique.length) await supabase.from('app_settings').upsert(unique)
  return getSettings(supabase)
}
