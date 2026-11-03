'use client'

import { SaldoCard, type Saldo } from '@/components/saldo-card'
import { YpfPointsTip, YPF_POINTS_TEXT, YPF_POINTS_STAFF } from '@/components/ypf-points-tip'
import { useMarket } from '@/lib/market-context'
import { useReservation } from '@/lib/reservation-context'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { ShoppingCart, ArrowLeft, AlertCircle, UserCheck, X, List, MessageCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MarketCategoriesScreen } from './market-categories-screen'
import { CartModal } from '@/components/market/cart-modal'
import { ProductOptionsForm } from '@/components/market/product-options-form'
import { Badge } from '@/components/ui/badge'

const normText = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const ORDER_LABEL: Record<string, string> = { pendiente: 'Recibido', aceptado: 'En preparación', entregado: 'Entregado' }

export function MarketScreen() {
  const { setCurrentScreen, firstName, lastName, activeUserReservation } = useReservation()
  const { products, cart, currentView, selectedCategory, addToCart, getCartTotal, createOrder, setCurrentView } = useMarket()
  
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({})
  const [showCheckout, setShowCheckout] = useState(false)
  const [showCartModal, setShowCartModal] = useState(false)
  const [showProductOptions, setShowProductOptions] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [showMyOrders, setShowMyOrders] = useState(false)
  const [query, setQuery] = useState('') // buscador del menú
  const [myOrders, setMyOrders] = useState<any[]>([])
  const [myOrdersLoading, setMyOrdersLoading] = useState(false)
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

  // "Mis pedidos": se leen de la tabla de pedidos (donde realmente se guardan)
  // y se actualizan cada 10 segundos mientras la ventana está abierta, para ver el estado.
  const loadMyOrders = useCallback(async () => {
    const savedPhone =
      (typeof window !== 'undefined' && localStorage.getItem('user_phone')) || phone || ''
    if (!savedPhone) { setMyOrders([]); return }
    setMyOrdersLoading(true)
    try {
      const res = await fetch('/api/market/my-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: savedPhone }),
      })
      if (res.ok) setMyOrders(await res.json())
    } finally {
      setMyOrdersLoading(false)
    }
  }, [phone])

  // Saldo a favor (Plan FULL): el valor del espacio se puede consumir en el Market
  const [saldo, setSaldo] = useState<Saldo | null>(null)
  const loadSaldo = useCallback(async () => {
    const p = activeReservation?.phone || (typeof window !== 'undefined' && localStorage.getItem('user_phone')) || phone || ''
    if (!p) { setSaldo(null); return }
    try {
      const res = await fetch('/api/market/saldo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: p }) })
      if (res.ok) setSaldo((await res.json()).saldo ?? null)
    } catch {}
  }, [activeReservation?.phone, phone])
  useEffect(() => { loadSaldo() }, [loadSaldo, myOrders.length])
  const pesosAR = (n: number) => '$ ' + Math.round(n).toLocaleString('es-AR')
  const saldoCard = saldo && saldo.valor > 0 ? <SaldoCard s={saldo} /> : null

  // Se cargan al entrar (para mostrar cuántos hay en curso) y se actualizan solos: cada 10 s con la lista abierta, cada 30 s si no
  useEffect(() => {
    loadMyOrders()
    const timer = setInterval(loadMyOrders, showMyOrders ? 10000 : 30000)
    return () => clearInterval(timer)
  }, [showMyOrders, loadMyOrders])
  const activeOrders = myOrders.filter((o: any) => o.status !== 'entregado').length

  // Si ya entró a la pizarra con su código, no le volvemos a pedir el teléfono
  useEffect(() => {
    if (activeUserReservation) return
    let cancelled = false
    fetch('/api/reservations/session', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (cancelled || !s?.found || !s.reservation) return
        const cleanPhone = String(s.phone || '').replace(/\D/g, '')
        try {
          if (cleanPhone) localStorage.setItem('user_phone', cleanPhone)
          localStorage.setItem('active_reserva_id', s.reservation.id)
        } catch { /* sin almacenamiento */ }
        setLocalCustomerData(s.reservation)
        setIsVerifiedLocally(true)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [activeUserReservation])

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

  const myOrdersDialog = (
    <>
      {/* Mis Pedidos Modal Mejorado */}
      <Dialog open={showMyOrders} onOpenChange={setShowMyOrders}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-[32px] border-none p-6">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-[#0057a5] text-xl flex items-center gap-2">
              <List className="w-5 h-5" />
              Mis Pedidos
            </DialogTitle>
          </DialogHeader>

          <YpfPointsTip className="mt-2" />

          {myOrdersLoading && myOrders.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-8 h-8 border-4 border-[#0057a5] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : myOrders.length > 0 ? (
            <div className="space-y-4 mt-4">
              {myOrders.map((order: any) => (
                <Card key={order.id} className="p-5 rounded-[24px] border-slate-100 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-[0.625rem] text-slate-400 uppercase tracking-widest">
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(order.created_at).toLocaleDateString()}
                      </p>
                      <Badge className={`mt-2 font-black text-[0.6875rem] px-3 py-1 rounded-full text-white ${
                        order.status === 'pendiente' ? 'bg-amber-500' :
                        order.status === 'aceptado' ? 'bg-[#0057a5]' :
                        'bg-green-600'
                      }`}>
                        {ORDER_LABEL[order.status] || order.status}
                      </Badge>
                    </div>
                    <p className="text-[#0057a5] font-black text-xl leading-none">$ {Number(order.total_amount).toLocaleString('es-AR')}</p>
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
                    className="w-full h-10 text-[0.625rem] font-black uppercase text-green-600 flex gap-2 items-center hover:bg-green-50 rounded-xl"
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
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Todavía no hiciste pedidos en esta visita</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </>
  )

  // Buscador del menú: por nombre, categoría o descripción (sin importar tildes ni mayúsculas)
  const q = normText(query.trim())
  const matches = (p: any) => !q || normText(`${p.name} ${p.category || ''} ${p.description || ''}`).includes(q)
  const filteredProducts = (selectedCategory ? products.filter(p => p.category === selectedCategory) : products).filter(matches)

  const groupedProducts = selectedCategory
    ? undefined
    : filteredProducts.reduce((acc, product) => {
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
  const success = await createOrder(workspaceInfo, reservaId, cleanPhone)
  setIsCreatingOrder(false)
  if (success) {
    setShowCheckout(false)
    await loadMyOrders()
    setShowMyOrders(true) // después de pedir, se muestra el pedido y su estado
  }
}

  const renderCompact = (product: any) => (
                    <Card key={product.id} className="p-3 border-0 shadow-sm rounded-xl">
                      <div className="flex gap-3">
                        {product.image_url && <img src={product.image_url} alt={product.name} className="w-20 h-20 object-cover rounded-lg" />}
                        <div className="flex-1">
                          <h3 className="font-bold text-sm leading-tight">{product.name}</h3>
                          <p className="text-xs font-black text-[#0057a5] mt-1">$ {Math.round(Number(product.price)).toLocaleString('es-AR')}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="number"
                              min="1"
                              value={selectedQuantities[product.id] || 1}
                              onChange={(e) => setSelectedQuantities(prev => ({ ...prev, [product.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                              className="w-10 h-7 border border-border rounded-md text-center text-xs font-bold"
                            />
                            <Button size="sm" onClick={() => handleAddToCart(product.id)} className="bg-[#0057a5] hover:bg-[#004080] h-7 text-[0.5625rem] font-black uppercase rounded-md px-3">
                              Agregar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
  )

  const searchBox = (
    <div className="relative">
      <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input type="text" inputMode="search" value={query} onChange={(e) => setQuery(e.target.value)} enterKeyHint="search"
        placeholder={selectedCategory && currentView !== 'categories' ? `Buscar en ${selectedCategory}…` : 'Buscar en el menú: café, tostado, agua…'}
        aria-label="Buscar en el menú"
        className="w-full h-12 rounded-2xl border-2 border-slate-200 bg-white pl-10 pr-10 text-base font-medium focus:border-[#0057a5] focus:outline-none" />
      {query && (
        <button type="button" onClick={() => setQuery('')} aria-label="Borrar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><X className="w-4 h-4" /></button>
      )}
    </div>
  )

  const noResults = (
    <div className="text-center py-10 text-slate-500">
      <p className="font-bold">No encontramos "{query.trim()}" en el menú.</p>
      <p className="text-sm mt-1">Probá con otra palabra o preguntá en la barra.</p>
    </div>
  )

  const cartFooter = (
    <>
      {cart.length > 0 && (
        <div className="bg-white border-t border-border p-4 space-y-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between items-center text-lg font-black">
            <span className="text-slate-400 uppercase text-xs tracking-widest">Total Pedido:</span>
            <span className="text-[#0057a5] text-2xl">$ {Math.round(Number(getCartTotal())).toLocaleString('es-AR')}</span>
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

    </>
  )

  const sharedModals = (
    <>
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
              <p className="text-[0.625rem] font-bold text-slate-500 uppercase leading-relaxed">Ingresá tu teléfono para activar tu sesión y comprar en el Market.</p>
              <Input 
                type="tel" placeholder="Ej: 03585735739" value={phone} 
                onChange={(e) => setPhone(e.target.value)}
                className="h-14 border-2 border-slate-100 rounded-2xl font-black text-center text-lg focus-visible:ring-[#0057a5]"
              />
              {verifyError && <p className="text-[0.5625rem] text-red-500 font-bold text-center uppercase bg-red-50 p-2 rounded-lg">{verifyError}</p>}
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
                <p className="text-[0.625rem] font-black text-blue-400 uppercase tracking-widest">Cliente</p>
                <p className="font-bold">{customerName}</p>
                {workspaceInfo && <p className="text-xs font-black text-[#0057a5] mt-1 uppercase">{workspaceInfo}</p>}
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                {cart.map(item => (
                  <div key={item.product_id} className="text-sm flex justify-between font-bold">
                    <span>{item.product.name} x{item.quantity}</span>
                    <span>$ {Math.round(Number((item.product.price * item.quantity))).toLocaleString('es-AR')}</span>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t flex justify-between font-black text-[#0057a5]">
                  <span>TOTAL:</span>
                  <span>$ {Math.round(Number(getCartTotal())).toLocaleString('es-AR')}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowCheckout(false)} disabled={isCreatingOrder} className="rounded-xl font-bold uppercase text-[0.625rem]">Cancelar</Button>
              <Button onClick={handleCheckout} disabled={isCreatingOrder} className="flex-1 bg-[#0057a5] rounded-xl font-black uppercase tracking-widest text-[0.625rem]">
                {isCreatingOrder ? 'Enviando...' : 'Confirmar'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {myOrdersDialog}

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
    </>
  )

  if (currentView === 'categories') {
    return (
      <>
        <MarketCategoriesScreen myOrdersCount={myOrders.length} activeOrders={activeOrders} onMyOrders={() => setShowMyOrders(true)}
          searchBox={<div className="space-y-3">{saldoCard}{searchBox}</div>}
          searchResults={q ? (
            filteredProducts.length === 0 ? noResults : (
              <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3">
                {filteredProducts.map((product) => (
                  <div key={product.id}>
                    {renderCompact(product)}
                    {product.category && <p className="text-[0.6875rem] text-slate-400 font-semibold mt-1 ml-1">{product.category}</p>}
                  </div>
                ))}
              </div>
            )
          ) : null} />
        {cart.length > 0 && (
          <div className="sticky bottom-[4.5rem] z-30 px-4 pb-3">
            <button onClick={() => setShowCartModal(true)} className="w-full md:max-w-md md:mx-auto md:block h-14 rounded-2xl bg-[#0057a5] text-white font-black uppercase tracking-[0.15em] shadow-lg">
              Ver carrito ({cart.length}) · $ {Math.round(Number(getCartTotal())).toLocaleString('es-AR')}
            </button>
          </div>
        )}
        {sharedModals}
      </>
    )
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
          <button onClick={() => setShowMyOrders(true)}
            className="h-10 px-3 rounded-xl border-2 border-[#0057a5] text-[#0057a5] text-sm font-bold flex items-center gap-1.5">
            <List className="w-4 h-4" />Mis pedidos
            {activeOrders > 0 && <span className="min-w-[20px] h-5 px-1 rounded-full bg-amber-500 text-white text-[0.6875rem] flex items-center justify-center">{activeOrders}</span>}
          </button>
          <div className="relative">
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#0057a5] text-white text-[0.625rem] rounded-full w-5 h-5 flex items-center justify-center font-black">
                {cart.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mb-4 md:max-w-md space-y-3">{saldoCard}{searchBox}</div>
        {q && filteredProducts.length === 0 ? noResults : selectedCategory ? (
          <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
            {filteredProducts.map(product => (
              <Card key={product.id} className="p-4 border-0 shadow-sm rounded-2xl">
                <div className="flex gap-4">
                  {product.image_url && <img src={product.image_url} alt={product.name} className="w-24 h-24 object-cover rounded-xl" />}
                  <div className="flex-1">
                    <h3 className="font-bold leading-tight">{product.name}</h3>
                    <p className="text-sm font-black text-[#0057a5] mt-1">$ {Math.round(Number(product.price)).toLocaleString('es-AR')}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <input
                        type="number"
                        min="1"
                        value={selectedQuantities[product.id] || 1}
                        onChange={(e) => setSelectedQuantities(prev => ({ ...prev, [product.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                        className="w-12 h-8 border border-border rounded-lg text-center text-sm font-bold"
                      />
                      <Button size="sm" onClick={() => handleAddToCart(product.id)} className="bg-[#0057a5] hover:bg-[#004080] rounded-lg text-[0.625rem] font-black uppercase">
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
                <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3">
                  {categoryProducts.map(product => (
                    renderCompact(product)
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {cartFooter}

      {sharedModals}
    </div>
  )
}
