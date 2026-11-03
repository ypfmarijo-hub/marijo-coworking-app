import { randomUUID } from 'crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/supabase/staff'
import { createServiceClient } from '@/lib/supabase/server'

const PRODUCTS_BUCKET = 'productos'
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

// POST /api/market/upload — foto de un producto del menú (solo staff).
// Se guarda en Supabase (carpeta pública "productos"), así no hace falta configurar otro servicio.
export async function POST(request: NextRequest) {
  const denied = await requireStaff()
  if (denied) return denied

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    const ext = EXT[file.type]
    if (!ext || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Solo imágenes JPG, PNG, WEBP o GIF de hasta 5 MB' }, { status: 400 })
    }
    const supabase = createServiceClient()
    const path = `${randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(PRODUCTS_BUCKET).upload(path, file, { contentType: file.type })
    if (error) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    const { data } = supabase.storage.from(PRODUCTS_BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
