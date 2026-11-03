// Activar avisos en el celular (desde el navegador). Gratis.
// Android: funciona desde la web. iPhone: solo si la app se agregó a la pantalla de inicio.

export type PushSupport = 'ok' | 'sin-soporte' | 'iphone-instalar' | 'bloqueado' | 'sin-config'

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'sin-soporte'
  if (!VAPID) return 'sin-config'
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIos && !standalone ? 'iphone-instalar' : 'sin-soporte'
  }
  if (Notification.permission === 'denied') return 'bloqueado'
  return 'ok'
}

export const pushEnabled = () => typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'

function keyToBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

/** Pide permiso, se suscribe y le avisa al servidor. Devuelve un mensaje de error o null si salió bien. */
export async function enablePush(endpoint: '/api/pizarra/push' | '/api/staff/push'): Promise<string | null> {
  const support = pushSupport()
  if (support === 'sin-config') return 'Los avisos todavía no están configurados en el servidor.'
  if (support === 'iphone-instalar') return 'En iPhone: tocá Compartir → "Agregar a inicio", abrí la app desde ahí y activá los avisos.'
  if (support === 'sin-soporte') return 'Este navegador no permite avisos.'
  if (support === 'bloqueado') return 'Los avisos están bloqueados para este sitio. Activalos desde la configuración del navegador.'
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'No diste permiso para los avisos.'
    const sub = (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID) }))
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) })
    if (!res.ok) return 'No se pudieron activar los avisos. Probá de nuevo.'
    return null
  } catch {
    return 'No se pudieron activar los avisos en este celular.'
  }
}
