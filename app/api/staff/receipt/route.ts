import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'
import { RECEIPTS_BUCKET, receiptObjectPath } from '@/lib/receipts'

// GET /api/staff/receipt?id=<reservationId>
// Solo staff. Genera un enlace temporal (5 minutos) al comprobante y redirige.
export async function GET(req: NextRequest) {
  const denied = await requireStaff()
  if (denied) return denied

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: reservation } = await supabase
    .from('reservations')
    .select('receipt_url')
    .eq('id', id)
    .maybeSingle()

  const path = receiptObjectPath(reservation?.receipt_url)
  if (!path) return NextResponse.json({ error: 'Esta reserva no tiene comprobante' }, { status: 404 })

  const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrl(path, 300)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'No se pudo abrir el comprobante' }, { status: 500 })
  }
  return NextResponse.redirect(data.signedUrl)
}
