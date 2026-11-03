// Comparación de teléfonos argentinos.
// Antes se buscaba con "contiene", entonces escribir "5" encontraba la reserva de cualquiera.
// Ahora se comparan los últimos 10 dígitos (código de área + número), que es como se identifica
// un celular en Argentina con o sin +54 / 9 / 0 adelante.

function phoneDigits(phone: string | null | undefined): string {
  return String(phone ?? '').replace(/\D/g, '')
}

/** Clave de comparación: últimos 10 dígitos. Null si el número es demasiado corto para ser válido. */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = phoneDigits(phone)
  if (digits.length < 10) return null
  return digits.slice(-10)
}

export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = phoneKey(a)
  const kb = phoneKey(b)
  return ka !== null && ka === kb
}

/**
 * Patrón para buscar en la base un teléfono guardado con cualquier formato
 * ("+54 9 358 576-9421", "3585769421", "358-576 9421"…): los últimos 8 dígitos en orden,
 * con lo que sea entre medio. Después se confirma con samePhone().
 */
export function phoneSearchPattern(key: string): string {
  return '%' + key.slice(-8).split('').join('%') + '%'
}
