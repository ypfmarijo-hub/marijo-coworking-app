'use client'

import { useMarket } from '@/lib/market-context'
import { useReservation } from '@/lib/reservation-context'
import { Button } from '@/components/ui/button'
import { ArrowLeft, List } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

export function MarketCategoriesScreen({ myOrdersCount = 0, activeOrders = 0, onMyOrders, searchBox, searchResults }: { myOrdersCount?: number; activeOrders?: number; onMyOrders?: () => void; searchBox?: ReactNode; searchResults?: ReactNode }) {
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
    <div className="min-h-screen bg-background p-4 md:p-8 flex flex-col">
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

      {/* Mis pedidos: bien visible arriba */}
      {onMyOrders && (
        <button onClick={onMyOrders}
          className={`w-full md:max-w-md mb-4 min-h-[56px] rounded-2xl border-2 px-4 flex items-center gap-3 text-left ${activeOrders > 0 ? 'border-amber-400 bg-amber-50' : 'border-[#0057a5]/30 bg-white'}`}>
          <List className="w-5 h-5 text-[#0057a5] flex-shrink-0" />
          <span className="flex-1">
            <span className="block font-bold text-[#0057a5]">Mis pedidos</span>
            <span className="block text-xs text-slate-600">
              {activeOrders > 0 ? `${activeOrders} en curso · tocá para ver cómo van` : myOrdersCount > 0 ? 'Ver lo que pediste hoy' : 'Acá vas a ver el estado de lo que pidas'}
            </span>
          </span>
          {activeOrders > 0 && <span className="min-w-[24px] h-6 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{activeOrders}</span>}
        </button>
      )}

      {/* Buscador del menú: mientras se escribe, en lugar de las categorías se ven los productos que coinciden */}
      {searchBox && <div className="mb-4 md:max-w-md">{searchBox}</div>}

      {/* Categories Grid */}
      {searchResults ? searchResults : !loading && categories.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 auto-rows-[120px] md:grid-cols-4 md:auto-rows-[140px]">
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
