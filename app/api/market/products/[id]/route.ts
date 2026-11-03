import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/supabase/staff'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireStaff()
  if (denied) return denied

  try {
    const { id } = await params
    const body = await request.json()
    const supabase = createServiceClient()
    
    // Antes solo se guardaban nombre, precio, categoría y foto: las opciones y las
    // aclaraciones editadas se perdían. Ahora se guardan igual que al crear el producto.
    const updateData = {
      name: body.name,
      price: body.price,
      category: body.category,
      image_url: body.image_url,
      options: body.options ?? null,
      notes_label: body.notes_label ?? null,
      max_notes_chars: body.max_notes_chars ?? null,
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error("Error de Supabase:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireStaff()
  if (denied) return denied

  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}