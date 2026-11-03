import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import { phoneKey, phoneSearchPattern } from './phone'

// Avisos al celular (Web Push). Gratis: los entrega el navegador (Chrome, Safari, etc.).
// Requiere las variables NEXT_PUBLIC_VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY. Sin ellas, no se envía nada.

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

let configured: boolean | null = null
function ready(): boolean {
  if (configured !== null) return configured
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  configured = !!(pub && priv)
  if (configured) webpush.setVapidDetails('mailto:avisos@fullwork.app', pub!, priv!)
  return configured
}

async function sendToRows(supabase: SupabaseClient, rows: any[], payload: PushPayload) {
  if (!ready() || !rows.length) return 0
  let sent = 0
  await Promise.all(rows.map(async (row) => {
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify(payload), { TTL: 600 })
      sent++
    } catch (e: any) {
      // 404/410 = el celular ya no acepta avisos de esta suscripción: se borra
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', row.endpoint)
      }
    }
  }))
  return sent
}

export async function pushToStaff(supabase: SupabaseClient, payload: PushPayload) {
  const { data } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('role', 'staff')
  return sendToRows(supabase, data ?? [], { url: '/staff', ...payload })
}

export async function pushToPhone(supabase: SupabaseClient, phone: string, payload: PushPayload) {
  const key = phoneKey(phone)
  if (!key) return 0
  const { data } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth, phone').eq('role', 'cliente')
    .ilike('phone', phoneSearchPattern(key))
  const rows = (data ?? []).filter((r: any) => phoneKey(r.phone) === key)
  return sendToRows(supabase, rows, { url: '/?pantalla=pizarra', ...payload })
}

/** Guarda (o actualiza) la suscripción de un celular. */
export async function saveSubscription(
  supabase: SupabaseClient,
  sub: any,
  who: { role: 'staff'; staffUserId: string } | { role: 'cliente'; phone: string }
) {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return false
  const row: Record<string, unknown> = {
    endpoint: String(sub.endpoint).slice(0, 1000),
    p256dh: String(sub.keys.p256dh).slice(0, 300),
    auth: String(sub.keys.auth).slice(0, 300),
    role: who.role,
    phone: who.role === 'cliente' ? who.phone : null,
    staff_user_id: who.role === 'staff' ? who.staffUserId : null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' })
  return !error
}
