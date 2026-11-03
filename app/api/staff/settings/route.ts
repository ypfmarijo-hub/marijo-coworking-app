import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'
import { getSettings, saveSettings } from '@/lib/settings'
import { getPricing, savePricing } from '@/lib/pricing'
import { menuPrice } from '@/lib/cafe'

// GET/POST /api/staff/settings — "Ajustes" del panel: café, beneficio, precios por hora y combos
export async function GET() {
  const denied = await requireStaff()
  if (denied) return denied
  const supabase = createServiceClient()
  const [settings, pricing] = await Promise.all([getSettings(supabase), getPricing(supabase)])
  const cafeMenuPrice = await menuPrice(supabase, settings.cafeGiftName)
  return NextResponse.json({ ...settings, ...pricing, cafeMenuPrice })
}

export async function POST(req: NextRequest) {
  const denied = await requireStaff()
  if (denied) return denied
  const body = await req.json().catch(() => ({}))
  const supabase = createServiceClient()
  const settings = await saveSettings(supabase, body)
  const pricing = await savePricing(supabase, { prices: body.prices, combos: body.combos })
  return NextResponse.json({ ...settings, ...pricing })
}
