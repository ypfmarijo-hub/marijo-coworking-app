import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  
  const { data: products, error } = await supabase
    .from('products')
    .select('category')
    .not('category', 'is', null)

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  // Get unique categories
  const categories = [...new Set(products.map(p => p.category))] as string[]
  
  return NextResponse.json(categories.sort())
}
