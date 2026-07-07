'use client'

import { useMarket } from '@/lib/market-context'
import { useReservation } from '@/lib/reservation-context'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'

export function MarketCategoriesScreen() {
  const { setCurrentView, products } = useMarket()
  const { setCurrentScreen } = useReservation()
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Extract unique categories from products
    const uniqueCats = [...new Set(products.map(p => p.category).filter(Boolean))] as string[]
    setCategories(uniqueCats.sort())
    setLoading(false)
  }, [products])

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col">
      {/* Header with back arrow to home */}
      <div className="flex items-center gap-3 mb-6 pt-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentScreen('home')}
          className="h-9 w-9"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Market Full Work</h1>
      </div>

      {/* Categories Grid */}
      {!loading && categories.length > 0 ? (
        <div className="flex-1 grid grid-cols-2 gap-3">
          {/* Category Buttons */}
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setCurrentView('products', category)}
              className="p-4 bg-[#0057a5] hover:bg-[#004080] text-white rounded-2xl font-semibold text-center transition-colors flex items-center justify-center min-h-[120px]"
            >
              {category}
            </button>
          ))}

          {/* Ver Todos Button */}
          <button
            onClick={() => setCurrentView('products', null)}
            className="p-4 bg-[#0057a5] hover:bg-[#004080] text-white rounded-2xl font-semibold text-center transition-colors flex items-center justify-center min-h-[120px] border-2 border-white/20"
          >
            Ver todos los productos
          </button>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-center">No hay productos disponibles</p>
        </div>
      )}
    </div>
  )
}
