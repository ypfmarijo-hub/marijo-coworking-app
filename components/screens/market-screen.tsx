'use client'

import { useMarket } from '@/lib/market-context'
import { useReservation } from '@/lib/reservation-context'
import { useState, useMemo } from 'react'
import { ShoppingCart, ArrowLeft, Trash2, AlertCircle, UserCheck, X, CheckCircle2, List, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MarketCategoriesScreen } from './market-categories-screen'
import { CartModal } from '@/components/market/cart-modal'
import { ProductOptionsForm } from '@/components/market/product-options-form'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'

export function MarketScreen() {
  const { setCurrentScreen, firstName, lastName, activeUserReservation } = useReservation()
  const { products, cart, currentView, selectedCategory, addToCart, removeFromCart, getCartTotal, createOrder, setCurrentView } = useMarket()
  
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({})
  const [showCheckout, setShowCheckout] = useState(false)
  const [showCartModal, setShowCartModal] = useState(false)
  const [showProductOptions, setShowProductOptions] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [showMyOrders, setShowMyOrders] = useState(false)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)

  // --- ESTADOS PARA VERIFICACIÓN PRESENCIAL ---
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [phone, setPhone] = useState('')
  const [loadingVerify, setLoadingVerify] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [isVerifiedLocally, setIsVerifiedLocally] = useState(false)
  const [localCustomerData, setLocalCustomerData] = useState<any>(null)

  // Priorizamos la reserva del contexto, pero si no está, usamos la verificación local
  const activeReservation = activeUserReservation || localCustomerData
  const hasActiveReservation = !!activeReservation || isVerifiedLocally

  const customerName = activeReservation
    ? `${activeReservation.firstName || activeReservation.first_name || firstName} ${activeReservation.lastName || activeReservation.last_name || lastName}`.trim()
    : `${firstName} ${lastName}`.trim()

  const workspaceInfo = useMemo(() => {
    if (!activeReservation) return null
    const workspace = activeReservation.workspace || ''
    const deskNumber = activeReservation.deskNumber || activeReservation.desk_number
    // Normalizar al formato exacto de la agenda: "ESCRITORIO COMPARTIDO – N.° X"
    if (workspace.toLowerCase().includes('escritorio') && deskNumber) {
      return `ESCRITORIO COMPARTIDO – N.° ${deskNumber}`
    }
    return workspace
  }, [activeReservation])

  const handleVerify = async () => {
    const cleanPhone = phone.replace(/\D/g, '') // Limpia espacios y guiones
    if (!cleanPhone) return

    setLoadingVerify(true)
    setVerifyError('')
    
    try {
      // Usar la API route que tiene CLAVE_SECRETA_PEDIDOS (bypass RLS) y tolerancia de tiempo
      const res = await fetch('/api/reservations/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
      })
      
      const result = await res.json()
      
      if (res.ok && result.found && result.reservation) {
        const data = result.reservation
        localStorage.setItem('user_phone', cleanPhone)
        localStorage.setItem('active_reserva_id', data.id)
        localStorage.setItem('customer_name', `${data.first_name} ${data.last_name}`)
        
        setLocalCustomerData(data)
        setIsVerifiedLocally(true)
        setShowLoginModal(false)
      } else {
        setVerifyError(result.error || 'No encontramos una reserva activa para hoy con ese número.')
      }
    } catch (error) {
      console.error('[v0] handleVerify error:', error)
      setVerifyError('Error al verificar. Intentá de nuevo.')
    }
    
    setLoadingVerify(false)
  }

  if (currentView === 'categories') {
    return <MarketCategoriesScreen />
  }

  const filteredProducts = selectedCategory
    ? products.filter(p => p.category === selectedCategory)
    : products

  const groupedProducts = selectedCategory
    ? undefined
    : products.reduce((acc, product) => {
        const category = product.category || 'Sin categoría'
        if (!acc[category]) acc[category] = []
        acc[category].push(product)
        return acc
      }, {} as Record<string, typeof products>)

  const handleAddToCart = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return
    if ((product.options && product.options.length > 0) || product.notes_label) {
      setSelectedProduct(product)
      setShowProductOptions(true)
    } else {
      const quantity = selectedQuantities[productId] || 1
      addToCart(product, quantity)
      setSelectedQuantities(prev => ({ ...prev, [productId]: 1 }))
    }
  }

  const handleConfirmProductOptions = (selectedOptions: Record<string, string>, quantity: number, customerNotes?: string) => {
    if (!selectedProduct) return
    addToCart(selectedProduct, quantity, selectedOptions, customerNotes)
    setSelectedQuantities(prev => ({ ...prev, [selectedProduct.id]: 1 }))
    setShowProductOptions(false)
    setSelectedProduct(null)
  }

  const handleCheckout = async () => {
    const reservaId = activeReservation?.id  // ← debe ser el UUID de Supabase
    if (!hasActiveReservation || !reservaId || cart.length === 0) return

    // Obtener el teléfono de la reserva activa o del localStorage como fallback
    const finalPhone = activeReservation?.phone || localStorage.getItem('user_phone') || ''
    const cleanPhone = finalPhone.replace(/\D/g, '')

    if (!cleanPhone) {
      alert('No se encontró tu número de teléfono. Por favor, volvé a iniciar sesión.')
      return
    }

setIsCreatingOrder(true)
  // workspaceInfo como tabla_number, reservaId como reservation_id, cleanPhone para buscar reserva activa
  const success = await createOrder(customerName || 'Cliente', workspaceInfo, reservaId, cleanPhone)
  setIsCreatingOrder(false)
  if (success) {
    setShowCheckout(false)
    setCurrentScreen('my-reservations')
  }
}

  return (
    <div className="flex flex-col h-screen bg-background text-slate-800">
      {/* Header */}
      <div className="bg-white border-b border-border p-4 flex items-center justify-between">
        <button onClick={() => setCurrentView('categories')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold flex-1 text-center">
          {selectedCategory ? selectedCategory : 'Todos los productos'}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowMyOrders(true)} className="text-xs font-bold text-[#0057a5]">
            Mis Pedidos
          </Button>
          <div className="relative">
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#0057a5] text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-black">
                {cart.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedCategory ? (
          <div className="space-y-4">
            {filteredProducts.map(product => (
              <Card key={product.id} className="p-4 border-0 shadow-sm rounded-2xl">
                <div className="flex gap-4">
                  {product.image_url && <img src={product.image_url} alt={product.name} className="w-24 h-24 object-cover rounded-xl" />}
                  <div className="flex-1">
                    <h3 className="font-bold leading-tight">{product.name}</h3>
                    <p className="text-sm font-black text-[#0057a5] mt-1">${product.price.toFixed(2)}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <input
                        type="number"
                        min="1"
                        value={selectedQuantities[product.id] || 1}
                        onChange={(e) => setSelectedQuantities(prev => ({ ...prev, [product.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                        className="w-12 h-8 border border-border rounded-lg text-center text-sm font-bold"
                      />
                      <Button size="sm" onClick={() => handleAddToCart(product.id)} className="bg-[#0057a5] hover:bg-[#004080] rounded-lg text-[10px] font-black uppercase">
                        Agregar
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedProducts || {}).map(([category, categoryProducts]) => (
              <div key={category}>
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">{category}</h2>
                <div className="space-y-3">
                  {categoryProducts.map(product => (
                    <Card key={product.id} className="p-3 border-0 shadow-sm rounded-xl">
                      <div className="flex gap-3">
                        {product.image_url && <img src={product.image_url} alt={product.name} className="w-20 h-20 object-cover rounded-lg" />}
                        <div className="flex-1">
                          <h3 className="font-bold text-sm leading-tight">{product.name}</h3>
                          <p className="text-xs font-black text-[#0057a5] mt-1">${product.price.toFixed(2)}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="number"
                              min="1"
                              value={selectedQuantities[product.id] || 1}
                              onChange={(e) => setSelectedQuantities(prev => ({ ...prev, [product.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                              className="w-10 h-7 border border-border rounded-md text-center text-xs font-bold"
                            />
                            <Button size="sm" onClick={() => handleAddToCart(product.id)} className="bg-[#0057a5] hover:bg-[#004080] h-7 text-[9px] font-black uppercase rounded-md px-3">
                              Agregar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Footer */}
      {cart.length > 0 && (
        <div className="bg-white border-t border-border p-4 space-y-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between items-center text-lg font-black">
            <span className="text-slate-400 uppercase text-xs tracking-widest">Total Pedido:</span>
            <span className="text-[#0057a5] text-2xl">${getCartTotal().toFixed(2)}</span>
          </div>

          {!hasActiveReservation ? (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>Solo podrás realizar pedidos mientras te encuentres en tu horario de reserva en el Full Work.</span>
              </div>
              <Button
                onClick={() => setShowLoginModal(true)}
                className="w-full bg-[#0057a5] hover:bg-[#004080] h-14 font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg flex gap-2"
              >
                <UserCheck className="w-5 h-5" />
                Ya estoy en el local
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setShowCartModal(true)}
              className="w-full bg-[#0057a5] hover:bg-[#004080] h-14 font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg"
            >
              Ver carrito ({cart.length} items)
            </Button>
          )}
        </div>
      )}

      {/* MODAL DE VERIFICACIÓN */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm bg-white rounded-[40px] shadow-2xl border-none overflow-hidden animate-in zoom-in-95 duration-200 p-8 space-y-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h2 className="text-xl font-black text-[#0057a5] uppercase leading-tight">Ya estoy aquí</h2>
                <div className="h-1.5 w-10 bg-[#0057a5] rounded-full" />
              </div>
              <button onClick={() => setShowLoginModal(false)} className="p-2 bg-slate-100 rounded-full text-slate-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-5 text-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed">Ingresá tu teléfono para activar tu sesión y comprar en el Market.</p>
              <Input 
                type="tel" placeholder="Ej: 03585735739" value={phone} 
                onChange={(e) => setPhone(e.target.value)}
                className="h-14 border-2 border-slate-100 rounded-2xl font-black text-center text-lg focus-visible:ring-[#0057a5]"
              />
              {verifyError && <p className="text-[9px] text-red-500 font-bold text-center uppercase bg-red-50 p-2 rounded-lg">{verifyError}</p>}
              <Button onClick={handleVerify} disabled={loadingVerify} className="w-full h-14 bg-[#0057a5] text-white font-black uppercase tracking-widest rounded-2xl shadow-lg">
                {loadingVerify ? 'Verificando...' : 'Verificar y Activar'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm p-6 space-y-4 max-h-[90vh] overflow-y-auto rounded-[32px] border-none shadow-2xl animate-in zoom-in-95">
            <h2 className="text-xl font-black uppercase text-[#0057a5]">Confirmar pedido</h2>
            <div className="space-y-3">
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Cliente</p>
                <p className="font-bold">{customerName}</p>
                {workspaceInfo && <p className="text-xs font-black text-[#0057a5] mt-1 uppercase">{workspaceInfo}</p>}
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                {cart.map(item => (
                  <div key={item.product_id} className="text-sm flex justify-between font-bold">
                    <span>{item.product.name} x{item.quantity}</span>
                    <span>${(item.product.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t flex justify-between font-black text-[#0057a5]">
                  <span>TOTAL:</span>
                  <span>${getCartTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowCheckout(false)} disabled={isCreatingOrder} className="rounded-xl font-bold uppercase text-[10px]">Cancelar</Button>
              <Button onClick={handleCheckout} disabled={isCreatingOrder} className="flex-1 bg-[#0057a5] rounded-xl font-black uppercase tracking-widest text-[10px]">
                {isCreatingOrder ? 'Enviando...' : 'Confirmar'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Mis Pedidos Modal Mejorado */}
      <Dialog open={showMyOrders} onOpenChange={setShowMyOrders}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-[32px] border-none p-6">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-[#0057a5] text-xl flex items-center gap-2">
              <List className="w-5 h-5" />
              Mis Pedidos
            </DialogTitle>
          </DialogHeader>

          {activeReservation?.market_orders?.length > 0 ? (
            <div className="space-y-4 mt-4">
              {activeReservation.market_orders.map((order: any) => (
                <Card key={order.id} className="p-5 rounded-[24px] border-slate-100 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-[10px] text-slate-400 uppercase tracking-widest">
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(order.created_at).toLocaleDateString()}
                      </p>
                      <Badge className={`mt-2 font-black text-[9px] uppercase px-3 py-1 rounded-full text-white ${
                        order.status === 'pendiente' ? 'bg-amber-500' : 
                        order.status === 'aceptado' ? 'bg-[#0057a5]' : 
                        'bg-green-500'
                      }`}>
                        {order.status}
                      </Badge>
                    </div>
                    <p className="text-[#0057a5] font-black text-xl leading-none">$ {order.total_price.toLocaleString()}</p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
                    {order.items.map((item: any, idx: number) => (
                      <div key={idx} className="text-xs font-bold text-slate-600 flex justify-between items-center">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="text-slate-400 font-medium">${item.price}</span>
                      </div>
                    ))}
                  </div>

                  <Button 
                    variant="ghost" 
                    className="w-full h-10 text-[10px] font-black uppercase text-green-600 flex gap-2 items-center hover:bg-green-50 rounded-xl"
                    onClick={() => window.open(`https://wa.me/5493585769421?text=Hola! Soy ${customerName}, consulto por mi pedido de ${order.items[0]?.name || 'Market'} que figura como ${order.status}.`)}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Consultar por WhatsApp
                  </Button>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">No tienes pedidos aún</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cart Modal */}
      <CartModal 
        open={showCartModal} onClose={() => setShowCartModal(false)} 
        onCheckout={() => { setShowCartModal(false); setShowCheckout(true); }}
        isDisabled={!hasActiveReservation}
      />
      
      {/* Product Options Modal */}
      <Dialog open={showProductOptions} onOpenChange={setShowProductOptions}>
        <DialogContent className="max-w-sm rounded-[32px] border-none">
          <DialogHeader><DialogTitle className="font-black uppercase text-[#0057a5]">{selectedProduct?.name}</DialogTitle></DialogHeader>
          {selectedProduct && <ProductOptionsForm product={selectedProduct} onConfirm={handleConfirmProductOptions} onClose={() => setShowProductOptions(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
