import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getPricing } from '@/lib/pricing'
import { getSettings } from '@/lib/settings'

// GET /api/public/pricing — precios por hora y combos activos, para mostrarlos al reservar
export async function GET() {
  const supabase = createServiceClient()
  const [{ prices, combos }, settings] = await Promise.all([getPricing(supabase), getSettings(supabase)])
  return NextResponse.json({ prices, combos: combos.filter((c) => c.active), deskDepositRequired: settings.deskDepositRequired, askDni: settings.askDni },
    { headers: { 'Cache-Control': 'no-store' } })
}
