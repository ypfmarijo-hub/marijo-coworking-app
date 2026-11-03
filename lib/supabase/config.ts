// Configuración central de Supabase.
// Se toma SOLO de las variables de entorno de Vercel (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY).
// Antes había valores escritos en el código como respaldo: se quitaron a propósito, para que una copia
// de prueba sin variables nunca termine conectada a la base real por accidente.
// Si faltan, la app carga pero no puede leer ni guardar nada (y lo avisa en los registros).

const MISSING_URL = 'https://falta-configurar-supabase.invalid'

// Tolera los errores típicos al pegar en Vercel: espacios, comillas, una "/" al final o el "/rest/v1/"
// que muestra Supabase en algunas pantallas (pasó en la prueba: con eso la app no encontraba la base).
function cleanUrl(raw: string | undefined): string {
  const v = String(raw ?? '').trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '').replace(/\/rest\/v1$/i, '')
  return v
}
const cleanKey = (raw: string | undefined) => String(raw ?? '').trim().replace(/^['"]|['"]$/g, '')

export const SUPABASE_URL = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) || MISSING_URL
export const SUPABASE_ANON_KEY = cleanKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || 'falta-configurar'

export const supabaseConfigured = SUPABASE_URL !== MISSING_URL

if (!supabaseConfigured && typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  console.warn('[Fullwork] Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en las variables de entorno.')
}

/** Clave secreta (service role). Solo existe en el servidor; nunca llega al navegador. */
export function getServiceRoleKey(): string {
  const key = cleanKey(process.env.CLAVE_SECRETA_PEDIDOS || process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!key) {
    throw new Error('Falta la variable de entorno CLAVE_SECRETA_PEDIDOS en el servidor')
  }
  return key
}
