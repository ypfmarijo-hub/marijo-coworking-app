'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Product {
  id: string
  name: string
  price: number
  category?: string
  image_url: string | null
  options?: Array<{ label: string; choices: string[] }> | null
  notes_label?: string | null
  max_notes_chars?: number
  created_at: string
  updated_at: string
}

export interface CartItem {
  product_id: string
  product: Product
  quantity: number
  selectedOptions?: Record<string, string>
  customerNotes?: string
}

export interface Order {
  id: string
  customer_name: string
  workspace: string | null
  products: CartItem[]
  total_price: number
  status: string
  notes: string | null
  created_at: string
}

interface MarketContextType {
  products: Product[]
  cart: CartItem[]
  productsLoading: boolean
  currentView: 'categories' | 'products'
  selectedCategory: string | null
  
  addToCart: (product: Product, quantity: number, selectedOptions?: Record<string, string>, customerNotes?: string) => void
  removeFromCart: (productId: string) => void
  updateCartQuantity: (productId: string, quantity: number) => void
  updateCartItem: (productId: string, updates: Partial<CartItem>) => void
  mergeCartItems: (items: any[], merge?: 'replace' | 'add') => void
  clearCart: () => void
  getCartTotal: () => number
  createOrder: (customerName: string, workspace: string | null, reservationId: string, phone?: string) => Promise<boolean>
  setCurrentView: (view: 'categories' | 'products', category?: string | null) => void
}

const MarketContext = createContext<MarketContextType | undefined>(undefined)

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [currentView, setCurrentViewState] = useState<'categories' | 'products'>('categories')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Load products on mount
  useEffect(() => {
    loadProducts()
  }, [])

  const setCurrentView = useCallback((view: 'categories' | 'products', category?: string | null) => {
    setCurrentViewState(view)
    if (view === 'products') {
      setSelectedCategory(category || null)
    }
  }, [])

  const loadProducts = useCallback(async () => {
    setProductsLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setProducts(data)
    }
    setProductsLoading(false)
  }, [])

  const addToCart = useCallback((product: Product, quantity: number, selectedOptions?: Record<string, string>, customerNotes?: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id)
      if (existing) {
        return prev.map(item =>
          item.product_id === product.id
            ? { 
                ...item, 
                quantity: item.quantity + quantity,
                selectedOptions: selectedOptions || item.selectedOptions,
                customerNotes: customerNotes || item.customerNotes
              }
            : item
        )
      }
      return [...prev, { 
        product_id: product.id, 
        product, 
        quantity,
        selectedOptions,
        customerNotes
      }]
    })
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.product_id !== productId))
  }, [])

  const updateCartQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId)
    } else {
      setCart(prev =>
        prev.map(item =>
          item.product_id === productId
            ? { ...item, quantity }
            : item
        )
      )
    }
  }, [removeFromCart])

  const updateCartItem = useCallback((productId: string, updates: Partial<CartItem>) => {
    setCart(prev =>
      prev.map(item =>
        item.product_id === productId
          ? { ...item, ...updates }
          : item
      )
    )
  }, [])

  const mergeCartItems = useCallback((items: any[], merge: 'replace' | 'add' = 'add') => {
    if (merge === 'replace') {
      // Clear cart and add new items
      setCart([])
      items.forEach(item => {
        // Find the product in our products list
        const product = products.find(p => p.name === item.name)
        if (product) {
          addToCart(product, item.quantity, item.selectedOptions, item.customerNotes)
        }
      })
    } else {
      // Add to existing cart
      items.forEach(item => {
        const product = products.find(p => p.name === item.name)
        if (product) {
          addToCart(product, item.quantity, item.selectedOptions, item.customerNotes)
        }
      })
    }
  }, [products, addToCart])

  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  const getCartTotal = useCallback(() => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
  }, [cart])

const createOrder = useCallback(async (
  customerName: string,
  workspace: string | null,
  reservationId: string,   // ← UUID directo
  phone?: string
) => {
  if (cart.length === 0) return false
  if (!reservationId) {
    alert('Error: No se encontró el ID de tu reserva.')
    return false
  }

  const productsData = cart.map(item => ({
    name: item.product.name,
    price: item.product.price,
    quantity: item.quantity,
    subtotal: item.product.price * item.quantity,
    selectedOptions: item.selectedOptions || {},
    customerNotes: item.customerNotes || null,
  }))

  try {
    const response = await fetch('/api/market/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phone,   // El API busca la reserva activa por teléfono + horario
        products: productsData,
        total_amount: getCartTotal(),
        table_number: workspace || null,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      alert(`Error al crear pedido: ${err.error || 'Error desconocido'}`)
      return false
    }

    clearCart()
    return true
  } catch (error) {
    console.error('[createOrder] network error:', error)
    alert('Error de red. Verificá tu conexión.')
    return false
  }
}, [cart, getCartTotal, clearCart])

  return (
    <MarketContext.Provider
      value={{
        products,
        cart,
        productsLoading,
        currentView,
        selectedCategory,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        updateCartItem,
        mergeCartItems,
        clearCart,
        getCartTotal,
        createOrder,
        setCurrentView,
      }}
    >
      {children}
    </MarketContext.Provider>
  )
}

export function useMarket() {
  const context = useContext(MarketContext)
  if (!context) {
    throw new Error('useMarket must be used within MarketProvider')
  }
  return context
}
