import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'
import { finalizeDue } from '@/lib/auto-finalize'

// POST /api/staff/finalize-due — el panel lo llama cuando ve reservas con el horario terminado
export async function POST() {
  const denied = await requireStaff()
  if (denied) return denied
  const finalizadas = await finalizeDue(createServiceClient())
  return NextResponse.json({ ok: true, finalizadas })
}
