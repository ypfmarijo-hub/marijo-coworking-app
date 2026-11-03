import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import { PZ_COOKIE, hashToken } from '@/lib/pizarra'

export async function POST() {
  const token = (await cookies()).get(PZ_COOKIE)?.value
  if (token) await createServiceClient().from('pizarra_sessions').delete().eq('token_hash', hashToken(token))
  const res = NextResponse.json({ ok: true })
  res.cookies.set({ name: PZ_COOKIE, value: '', path: '/', maxAge: 0 })
  return res
}
