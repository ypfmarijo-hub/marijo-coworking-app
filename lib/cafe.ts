import type { SupabaseClient } from '@supabase/supabase-js'
import { getSettings, type AppSettings } from './settings'

/**
 * El café de regalo de la pizarra: siempre el mismo café (ej. "Café chico"), con el precio que fija el staff en Ajustes.
 * Quien lo recibe elige cómo lo quiere (común, cortado, latte, descremado…). Sin precio cargado, la función queda apagada.
 */
export async function cafeGift(supabase: SupabaseClient, settings?: AppSettings): Promise<{ name: string; price: number; options: string[]; messages: string[] } | null> {
  const s = settings ?? (await getSettings(supabase))
  let price = s.cafeGiftPrice
  // Si en Ajustes no pusieron precio, se usa el del menú: el producto con ese nombre ("Café chico") o "Café"
  if (!(price > 0)) price = (await menuPrice(supabase, s.cafeGiftName)) ?? 0
  if (!(price > 0)) return null
  return { name: s.cafeGiftName, price, options: s.cafeGiftOptions, messages: s.cafeGiftMessages }
}

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

/** Precio del producto del menú que se llame como el café de regalo (o "Café"). */
export async function menuPrice(supabase: SupabaseClient, name: string): Promise<number | null> {
  const { data } = await supabase.from('products').select('name, price')
  const list = data ?? []
  const p = list.find((x: any) => norm(x.name) === norm(name)) || list.find((x: any) => norm(x.name) === 'cafe')
  return p ? Number(p.price) : null
}

/** Compatibilidad con el código anterior. */
export const cafeProduct = (supabase: SupabaseClient) => cafeGift(supabase)

/** Valida la opción elegida por quien recibe el café. */
export function pickOption(options: string[], kind: unknown): string | null {
  const k = String(kind ?? '').trim()
  return options.includes(k) ? k : null
}
