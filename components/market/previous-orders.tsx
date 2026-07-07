'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShoppingBag } from 'lucide-react'

interface PreviousOrder {
  timestamp: string
  items: Array<{
    name: string
    quantity: number
    price: number
    subtotal: number
  }>
  total_price: number
}

interface PreviousOrdersProps {
  reservationId: string
  onReorder?: (items: any[]) => void
}

export function PreviousOrders({ reservationId, onReorder }: PreviousOrdersProps) {
  const [orders, setOrders] = useState<PreviousOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadOrders = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('reservations')
        .select('market_orders')
        .eq('id', reservationId)
        .single()

      if (!error && data?.market_orders) {
        // Extract all market_orders from history (could be array or single object)
        const ordersList = Array.isArray(data.market_orders)
          ? data.market_orders
          : [data.market_orders]
        setOrders(ordersList)
      }
      setLoading(false)
    }

    loadOrders()
  }, [reservationId])

  if (loading) return <div>Cargando pedidos...</div>
  if (orders.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-sm">Pedidos anteriores</h3>
      {orders.map((order, idx) => (
        <Card key={idx} className="p-3">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs text-muted-foreground">
                {new Date(order.timestamp).toLocaleString('es-AR')}
              </p>
              <p className="font-semibold text-sm">
                {order.items.length} producto{order.items.length !== 1 ? 's' : ''}
              </p>
            </div>
            <span className="font-bold">${order.total_price.toFixed(2)}</span>
          </div>
          <div className="text-xs text-muted-foreground mb-2 space-y-1">
            {order.items.map((item, itemIdx) => (
              <div key={itemIdx}>
                {item.name} x{item.quantity}
              </div>
            ))}
          </div>
          {onReorder && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReorder(order.items)}
              className="w-full gap-2"
            >
              <ShoppingBag className="w-3 h-3" />
              Repetir pedido
            </Button>
          )}
        </Card>
      ))}
    </div>
  )
}
