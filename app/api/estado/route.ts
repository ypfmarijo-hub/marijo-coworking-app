import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { SUPABASE_URL, supabaseConfigured } from '@/lib/supabase/config'

// GET /api/estado — chequeo rápido de la configuración, para el día de la instalación.
// Dice qué está bien y qué falta, SIN mostrar ninguna clave.
export async function GET() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const checks: Record<string, string> = {}
  checks.supabase_url = !supabaseConfigured ? 'FALTA'
    : /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL) ? (raw.trim() === SUPABASE_URL ? 'ok' : 'ok (se corrigió sola: tenía /rest/v1, una barra o espacios)')
    : 'revisar: tiene que ser https://xxxx.supabase.co'
  checks.clave_publica = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'ok' : 'FALTA (o quedó como Secret: tiene que ser Config)'
  checks.clave_secreta = (process.env.CLAVE_SECRETA_PEDIDOS || process.env.SUPABASE_SERVICE_ROLE_KEY) ? 'cargada' : 'FALTA'
  checks.avisos_publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? 'ok' : 'FALTA (o quedó como Secret: tiene que ser Config)'
  checks.avisos_privada = process.env.VAPID_PRIVATE_KEY ? 'ok' : 'FALTA'
  checks.cron = process.env.CRON_SECRET ? 'ok' : 'FALTA'
  if (supabaseConfigured && checks.clave_secreta === 'cargada') {
    try {
      const { error } = await createServiceClient().from('app_settings').select('key').limit(1)
      checks.conexion_base = error ? `ERROR: ${error.message.includes('app_settings') ? 'falta correr el script de la base (000 o 009)' : 'la clave secreta o la URL no son correctas'}` : 'ok'
    } catch {
      checks.conexion_base = 'ERROR: no se pudo conectar'
    }
  }
  const allOk = Object.values(checks).every((v) => v.startsWith('ok') || v === 'cargada')
  return NextResponse.json({ todo_bien: allOk, ...checks }, { headers: { 'Cache-Control': 'no-store' } })
}
