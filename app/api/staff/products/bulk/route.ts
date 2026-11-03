import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'

// POST /api/staff/products/bulk  { updates: [{ id, price }], creates: [{ name, category, price }] }
// Actualizar precios del menú desde un Excel (y, si se pide, agregar los productos nuevos).
export async function POST(req: NextRequest) {
  const denied = await requireStaff()
  if (denied) return denied
  const body = await req.json().catch(() => ({}))
  const updates = (Array.isArray(body.updates) ? body.updates : []).slice(0, 2000)
    .map((u: any) => ({ id: String(u.id || ''), price: Math.round(Number(u.price)) }))
    .filter((u: any) => u.id && u.price >= 0 && u.price < 100000000)
  const creates = (Array.isArray(body.creates) ? body.creates : []).slice(0, 500)
    .map((c: any) => ({ name: String(c.name || '').trim().slice(0, 120), category: String(c.category || '').trim().slice(0, 60) || 'Varios', price: Math.round(Number(c.price)) }))
    .filter((c: any) => c.name && c.price > 0 && c.price < 100000000)
  const supabase = createServiceClient()
  let updated = 0, failed = 0
  const now = new Date().toISOString()
  // de a 20 a la vez para no saturar
  for (let i = 0; i < updates.length; i += 20) {
    const res = await Promise.all(updates.slice(i, i + 20).map((u: any) =>
      supabase.from('products').update({ price: u.price, updated_at: now }).eq('id', u.id)))
    for (const r of res) { if (r.error) failed++; else updated++ }
  }
  let created = 0
  if (creates.length) {
    const { data: existing } = await supabase.from('products').select('name')
    const names = new Set((existing ?? []).map((p: any) => String(p.name).toLowerCase().trim()))
    const fresh = creates.filter((c: any) => !names.has(c.name.toLowerCase()))
    if (fresh.length) {
      const { error, data } = await supabase.from('products').insert(fresh).select('id')
      if (error) failed += fresh.length; else created = data?.length ?? 0
    }
  }
  return NextResponse.json({ ok: failed === 0, updated, created, failed })
}
