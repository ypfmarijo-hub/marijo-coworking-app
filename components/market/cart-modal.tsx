'use client'

import { useMarket } from '@/lib/market-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

interface CartModalProps {
  open: boolean
  onClose: () => void
  onCheckout: () => void
  isDisabled: boolean
  disabledMessage?: string
}

export function CartModal({ open, onClose, onCheckout, isDisabled, disabledMessage }: CartModalProps) {
  const { cart, removeFromCart, updateCartItem, getCartTotal } = useMarket()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const toggleExpanded = (productId: string) => {
    const newSet = new Set(expandedItems)
    if (newSet.has(productId)) {
      newSet.delete(productId)
    } else {
      newSet.add(productId)
    }
    setExpandedItems(newSet)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-end md:items-center justify-center">
      <Card className="w-full md:w-96 rounded-t-2xl md:rounded-2xl p-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Carrito ({cart.length} items)</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>

        {cart.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Tu carrito está vacío
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              {cart.map(item => (
                <div key={item.product_id} className="border rounded-lg p-3">
                  <div 
                    className="flex justify-between items-start cursor-pointer"
                    onClick={() => toggleExpanded(item.product_id)}
                  >
                    <div className="flex-1">
                      <p className="font-semibold">{item.product.name}</p>
                      <p className="text-sm text-muted-foreground">x{item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">${(item.product.price * item.quantity).toFixed(2)}</span>
                      {(item.selectedOptions && Object.keys(item.selectedOptions).length > 0) || item.customerNotes ? (
                        expandedItems.has(item.product_id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : null}
                    </div>
                  </div>

                  {expandedItems.has(item.product_id) && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1">Opciones:</p>
                          {Object.entries(item.selectedOptions).map(([key, value]) => (
                            <div key={key} className="text-xs text-muted-foreground">
                              {key}: {value}
                            </div>
                          ))}
                        </div>
                      )}
                      {item.customerNotes && (
                        <div>
                          <p className="text-xs font-semibold mb-1">Notas:</p>
                          <p className="text-xs text-muted-foreground">{item.customerNotes}</p>
                        </div>
                      )}
                      <textarea
                        placeholder="Agregar notas..."
                        value={item.customerNotes || ''}
                        onChange={(e) => updateCartItem(item.product_id, { customerNotes: e.target.value })}
                        className="w-full text-xs p-2 border rounded mt-2"
                        rows={2}
                        maxLength={150}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeFromCart(item.product_id)}
                        className="w-full gap-2"
                      >
                        <Trash2 className="w-3 h-3" />
                        Eliminar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t pt-3">
              <div className="flex justify-between mb-3">
                <span className="font-bold">Total:</span>
                <span className="text-lg font-bold text-[#0057a5]">${getCartTotal().toFixed(2)}</span>
              </div>

              {isDisabled && disabledMessage && (
                <div className="bg-amber-50 border border-amber-200 p-2 rounded text-xs text-amber-800 mb-3">
                  {disabledMessage}
                </div>
              )}

              <Button
                onClick={onCheckout}
                disabled={isDisabled}
                className="w-full bg-[#0057a5] hover:bg-[#004080] disabled:opacity-50"
              >
                Confirmar pedido
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
