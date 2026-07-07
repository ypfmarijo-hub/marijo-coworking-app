'use client'

import { Product } from '@/lib/market-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'

interface ProductOptionsFormProps {
  product: Product
  onConfirm: (selectedOptions: Record<string, string>, quantity: number, customerNotes?: string) => void
  onClose: () => void
}

export function ProductOptionsForm({ product, onConfirm, onClose }: ProductOptionsFormProps) {
  const [quantity, setQuantity] = useState(1)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [customerNotes, setCustomerNotes] = useState('')

  const handleConfirm = () => {
    onConfirm(selectedOptions, quantity, customerNotes)
  }

  return (
    <div className="space-y-4">
      {/* Quantity */}
      <div>
        <Label className="text-sm font-semibold mb-2 block">Cantidad</Label>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
          >
            −
          </Button>
          <Input
            type="number"
            min="1"
            max="99"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="text-center w-16"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuantity(Math.min(99, quantity + 1))}
          >
            +
          </Button>
        </div>
      </div>

      {/* Options */}
      {product.options && product.options.length > 0 && (
        <div className="space-y-3">
          {product.options.map((option) => (
            <div key={option.label}>
              <Label className="text-sm font-semibold mb-2 block">{option.label}</Label>
              <select
                value={selectedOptions[option.label] || ''}
                onChange={(e) =>
                  setSelectedOptions({
                    ...selectedOptions,
                    [option.label]: e.target.value,
                  })
                }
                className="w-full p-2 border rounded"
              >
                <option value="">Seleccionar...</option>
                {option.choices.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

          {/* Customer Notes */}
          {product.notes_label && (
            <div>
              <Label className="text-sm font-semibold mb-2 block">{product.notes_label}</Label>
              <textarea
                placeholder="Ingresa aquí tus indicaciones..."
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                maxLength={product.max_notes_chars || 150}
                className="w-full p-2 border rounded text-sm"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {customerNotes.length} / {product.max_notes_chars || 150} caracteres
              </p>
            </div>
          )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancelar
        </Button>
        <Button onClick={handleConfirm} className="flex-1 bg-[#0057a5] hover:bg-[#004080]">
          Agregar al carrito
        </Button>
      </div>
    </div>
  )
}
