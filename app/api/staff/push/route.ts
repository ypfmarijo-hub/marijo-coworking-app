import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getStaffUser } from '@/lib/supabase/staff'
import { saveSubscription } from '@/lib/push'

// POST /api/staff/push  { subscription }  — activar avisos en el celular del staff
export async function POST(req: NextRequest) {
  const user = await getStaffUser()
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  const { subscription } = await req.json().catch(() => ({}))
  const ok = await saveSubscription(createServiceClient(), subscription, { role: 'staff', staffUserId: user.id })
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'No se pudo activar.' }, { status: 400 })
}
