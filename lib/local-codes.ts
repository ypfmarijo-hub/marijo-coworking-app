// Códigos de reserva guardados en ESTE celular/computadora.
// El servidor nunca muestra el código completo con solo el teléfono (es la llave de la pizarra),
// así que el dispositivo donde se reservó (o donde se entró a la pizarra) lo recuerda.

const KEY = 'fw_codigos'

export function getLocalCodes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {}
  } catch {
    return {}
  }
}

export function saveLocalCode(reservationId: string, code: string) {
  try {
    const all = getLocalCodes()
    all[reservationId] = code
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // sin almacenamiento disponible: no pasa nada, el código está en WhatsApp o lo da el staff
  }
}

/** El código guardado más reciente (para completar solo el ingreso a la pizarra). */
export function lastLocalCode(): string {
  const codes = Object.values(getLocalCodes())
  return codes[codes.length - 1] || ''
}
