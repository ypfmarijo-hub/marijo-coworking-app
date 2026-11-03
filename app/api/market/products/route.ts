import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: products, error } = await supabase.from('products').select('*').order('category', { ascending: true }).order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(products)
}

export async function POST(req: NextRequest) {
  const denied = await requireStaff()
  if (denied) return denied

  const supabase = createServiceClient()
  const body = await req.json()
  const { name, price, category, image_url, options, notes_label, max_notes_chars } = body
  const { data, error } = await supabase.from('products').insert({ name, price, category, image_url, options, notes_label, max_notes_chars }).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data[0], { status: 201 })
}