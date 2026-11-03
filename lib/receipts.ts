// Comprobantes de pago: se guardan en el bucket PRIVADO "comprobantes" de Supabase.
// En la columna reservations.receipt_url se guarda la ruta interna ("comprobantes/<archivo>").
// Las reservas viejas tienen una URL pública completa; de ahí se extrae la ruta igual.

export const RECEIPTS_BUCKET = 'comprobantes'
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024 // 10 MB

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
}

export function receiptExtension(mimeType: string): string | null {
  return ALLOWED_TYPES[mimeType] ?? null
}

/** Devuelve la ruta del archivo dentro del bucket, o null si no se reconoce. */
export function receiptObjectPath(receiptUrl: string | null | undefined): string | null {
  if (!receiptUrl) return null
  const prefix = `${RECEIPTS_BUCKET}/`
  if (receiptUrl.startsWith(prefix)) return receiptUrl.slice(prefix.length)
  const marker = `/storage/v1/object/public/${RECEIPTS_BUCKET}/`
  const idx = receiptUrl.indexOf(marker)
  if (idx >= 0) return decodeURIComponent(receiptUrl.slice(idx + marker.length).split('?')[0])
  return null
}
