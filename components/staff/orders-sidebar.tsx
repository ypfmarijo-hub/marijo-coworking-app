'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Clock, ShoppingBag, User, Volume2, VolumeX, AlertCircle } from 'lucide-react'

interface OrderItem {
  product_id: string
  name: string
  price: number
  quantity: number
  subtotal: number
  selectedOptions?: Record<string, string>
  customerNotes?: string
}

interface Order {
  id: string 
  reservationId: string 
  customer_name: string
  workspace: string | null
  products: OrderItem[]
  total_price: number
  status: 'pendiente' | 'preparando' | 'entregado'
  created_at: string
}

interface OrdersSidebarProps {
  reservations?: any[]
  onNewOrder?: () => void
  onOrderUpdated?: () => void
}

export function OrdersSidebar({ reservations, onNewOrder, onOrderUpdated }: OrdersSidebarProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(380)
  const prevPendingCountRef = useRef(0)
  const startXRef = useRef(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    startXRef.current = e.clientX
    if (typeof document !== 'undefined') {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    const delta = e.clientX - startXRef.current
    setSidebarWidth(prev => Math.max(300, Math.min(600, prev - delta)))
    startXRef.current = e.clientX
  }

  const handleMouseUp = () => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }

  const loadOrders = useCallback(async () => {
    try {
      // Usar la API route que tiene CLAVE_SECRETA_PEDIDOS (bypass RLS)
      const res = await fetch('/api/market/orders')
      if (!res.ok) {
        console.error('[OrdersSidebar] API error:', res.status)
        setLoading(false)
        return
      }
      const data = await res.json()

      // Verificar que data sea un arreglo
      const ordersArray = Array.isArray(data) ? data : []
      
      const today = new Date().toISOString().split('T')[0]
      const todayOrders = ordersArray.filter((row: any) => 
        row.created_at && row.created_at.startsWith(today)
      )

      const formattedOrders: Order[] = todayOrders.map((row: any) => ({
        id: row.id,
        reservationId: row.reservation_id,
        customer_name: row.customer_name || 'Cliente',
        workspace: row.table_number || null,
        products: Array.isArray(row.items) ? row.items : [],
        total_price: Number(row.total_amount) || 0,
        status: row.status || 'pendiente',
        created_at: row.created_at,
      }))

      const currentPendingCount = formattedOrders.filter(o => o.status === 'pendiente').length
      if (currentPendingCount > prevPendingCountRef.current) {
        if (onNewOrder) onNewOrder()
      }
      prevPendingCountRef.current = currentPendingCount

      setOrders(formattedOrders)
      setLoading(false)
    } catch (err) {
      console.error('[OrdersSidebar] loadOrders error:', err)
      setLoading(false)
    }
  }, [onNewOrder])

  useEffect(() => {
    loadOrders()
    // Polling cada 5 segundos en lugar de Realtime (evita depender de createClient)
    const interval = setInterval(loadOrders, 5000)
    return () => clearInterval(interval)
  }, [loadOrders])

  const updateStatus = async (orderId: string, newStatus: 'entregado') => {
    setUpdating(orderId)
    try {
      console.log('[v0] updateStatus called with orderId:', orderId, 'newStatus:', newStatus)
      
      // Usar la API route que tiene CLAVE_SECRETA_PEDIDOS (bypass RLS)
      const res = await fetch('/api/market/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, status: newStatus }),
      })
      
      const responseData = await res.json()
      console.log('[v0] updateStatus response:', res.status, responseData)
      
      if (!res.ok) {
        console.error('[v0] Error updating order status:', res.status, responseData)
        alert(`Error al actualizar el pedido: ${responseData.error || 'Error desconocido'}`)
      } else {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
        if (onOrderUpdated) onOrderUpdated() 
      }
    } catch (error) {
      console.error('[v0] Exception in updateStatus:', error)
      alert('Error al procesar el pedido')
    } finally {
      setUpdating(null)
    }
  }

  const pendingOrders = orders.filter(o => o.status === 'pendiente')
  const otherOrders = orders.filter(o => o.status !== 'pendiente')

  return (
    <div className="relative flex h-full bg-white border-l border-slate-200 shadow-xl" style={{ width: `${sidebarWidth}px` }}>
      <div onMouseDown={handleMouseDown} className="absolute -left-1 top-0 bottom-0 w-1.5 bg-slate-100 hover:bg-[#0057a5] cursor-col-resize transition-all z-30" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag className="w-5 h-5 text-[#0057a5]" />
            <h2 className="font-black text-sm uppercase tracking-widest text-slate-800">Pedidos Market</h2>
          </div>
          {pendingOrders.length > 0 ? (
            <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase animate-pulse">
              <AlertCircle className="w-3.5 h-3.5" />
              {pendingOrders.length} Pedido{pendingOrders.length > 1 ? 's' : ''} por atender
            </div>
          ) : (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Sin pedidos pendientes</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
          {loading ? (
            <div className="py-20 text-center font-bold text-slate-300 uppercase text-[10px] tracking-widest">Sincronizando...</div>
          ) : orders.length === 0 ? (
            <div className="py-20 text-center opacity-20 flex flex-col items-center">
              <ShoppingBag className="w-12 h-12 mb-2" />
              <p className="font-black text-[10px] uppercase">Hoy no hubo pedidos</p>
            </div>
          ) : (
            <>
              {pendingOrders.map(order => (
                <Card key={order.id} className="border-none shadow-md overflow-hidden ring-1 ring-red-100">
                  <div className="bg-red-500 p-2 flex justify-between items-center text-white">
                     <div className="flex items-center gap-1.5 font-black text-[10px] uppercase">
                        <User className="w-3 h-3" />
                        <span>{order.customer_name}</span>
                     </div>
                     <span className="text-[9px] font-black bg-white/20 px-1.5 py-0.5 rounded uppercase">{order.workspace}</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {order.products.map((item, idx) => (
                      <div key={idx} className="text-xs border-b border-slate-50 pb-2 last:border-0">
                        <div className="flex justify-between font-bold text-slate-700">
                          <span>{item.quantity}x {item.name}</span>
                          <span className="text-[#0057a5]">$ {item.subtotal.toLocaleString('es-AR')}</span>
                        </div>
                        {item.customerNotes && (
                          <p className="mt-1 text-[10px] bg-amber-50 text-amber-700 p-1 rounded font-medium">Nota: {item.customerNotes}</p>
                        )}
                      </div>
                    ))}
                    <div className="pt-2 flex items-center justify-between">
                      <p className="text-xs font-black text-slate-800 uppercase">Total: $ {order.total_price.toLocaleString('es-AR')}</p>
                      <Button 
                        onClick={() => updateStatus(order.id, 'entregado')}
                        disabled={updating === order.id}
                        className="h-8 bg-green-600 hover:bg-green-700 text-white font-black text-[10px] uppercase rounded-lg px-4"
                      >
                        {updating === order.id ? '...' : 'Aceptar'}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}

              {otherOrders.length > 0 && (
                <div className="pt-4 space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Atendidos recientemente</p>
                  {otherOrders.slice(0, 5).map(o => (
                    <div key={o.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100 opacity-60">
                      <div className="text-[10px] font-bold text-slate-600 truncate mr-2">
                        {o.customer_name} <span className="text-slate-400">({o.workspace})</span>
                      </div>
                      <span className="text-[9px] font-black text-green-600 uppercase">Entregado</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
