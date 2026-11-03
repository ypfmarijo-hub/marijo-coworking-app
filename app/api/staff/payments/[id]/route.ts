import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'

// DELETE /api/staff/payments/:id — anular un pago cargado por error
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireStaff()
  if (denied) return denied
  const { id } = await params
  const { error } = await createServiceClient().from('payments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo anular.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
