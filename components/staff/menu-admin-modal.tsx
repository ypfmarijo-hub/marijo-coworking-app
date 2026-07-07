'use client'

import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Plus, Trash2, Upload, Loader2, ImageIcon, X, Pencil } from 'lucide-react'

interface Product {
  id: string
  name: string
  price: number
  image_url: string | null
  category?: string
}

interface MenuAdminModalProps {
  products: Product[]
  onProductAdded: () => void
  onProductDeleted: () => void
}

export function MenuAdminModal({ products, onProductAdded, onProductDeleted }: MenuAdminModalProps) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null) // Para saber si editamos o creamos
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [categoryInput, setCategoryInput] = useState('')
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [options, setOptions] = useState<Array<{ label: string; choices: string[] }>>([])
  const [notesLabel, setNotesLabel] = useState('')
  const [maxNotesChars, setMaxNotesChars] = useState(150)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cargar categorías existentes
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await fetch('/api/market/products')
        if (res.ok) {
          const data = await res.json()
          const uniqueCategories = [...new Set(data.map((p: any) => p.category).filter(Boolean))]
          setCategories(uniqueCategories as string[])
        }
      } catch (error) {
        console.error('Error loading categories:', error)
      }
    }
    loadCategories()
  }, [])

  const handleEdit = (product: any) => {
    setEditingId(product.id)
    setName(product.name)
    setPrice(product.price.toString())
    setCategoryInput(product.category || '')
    setImageUrl(product.image_url)
    setOptions(product.options || [])
    setNotesLabel(product.notes_label || '')
    setMaxNotesChars(product.max_notes_chars || 150)
    
    // Scroll suave hacia arriba para ver el formulario
    if (typeof document !== 'undefined') {
      const scrollContainer = document.querySelector('.max-h-\\[90vh\\]')
      scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setPrice('')
    setCategoryInput('')
    setImageUrl(null)
    setOptions([])
    setNotesLabel('')
    setMaxNotesChars(150)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/market/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const { url } = await res.json()
      setImageUrl(url)
    } catch (error) {
      alert('Error al subir la imagen')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !price || !categoryInput.trim()) return

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        price: parseFloat(price),
        category: categoryInput.trim(),
        image_url: imageUrl,
        options: options.length > 0 ? options : null,
        notes_label: notesLabel || null,
        max_notes_chars: notesLabel ? maxNotesChars : null,
      }

      // Si hay editingId usamos PATCH, si no POST
      const url = editingId ? `/api/market/products/${editingId}` : '/api/market/products'
      const method = editingId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Failed to save product')

      resetForm()
      onProductAdded()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que quieres eliminar este producto?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/market/products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      onProductDeleted()
    } catch (error) {
      alert('Error al eliminar')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if(!val) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="bg-[#0057a5] hover:bg-[#004080] text-white font-semibold gap-2">
          <Plus className="w-4 h-4" />
          ADMINISTRAR MENU
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#0057a5]">
            {editingId ? 'Editar Producto' : 'Administrar Menu del Market'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 border-b pb-6 mb-6">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              {editingId ? 'Modificando Producto' : 'Agregar Producto'}
            </h3>
            {editingId && (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm} className="text-red-500 hover:text-red-600">
                Cancelar Edición
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Nombre</label>
              <Input placeholder="Ej: Cafe con leche" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Precio ($)</label>
              <Input type="number" step="0.01" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
          </div>

          <div className="relative">
            <label className="text-sm font-medium mb-1 block">Categoría</label>
            <Input 
              placeholder="Ej: Bebidas" 
              value={categoryInput} 
              onChange={(e) => { setCategoryInput(e.target.value); setShowCategoryDropdown(true); }}
              onFocus={() => setShowCategoryDropdown(true)}
              required 
            />
            {showCategoryDropdown && categoryInput.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {categories.filter(cat => cat.toLowerCase().includes(categoryInput.toLowerCase())).map(cat => (
                  <button key={cat} type="button" onClick={() => { setCategoryInput(cat); setShowCategoryDropdown(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0">
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Imagen del producto</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            {imageUrl ? (
              <div className="relative w-32 h-32">
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                <button type="button" onClick={() => setImageUrl(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-[#0057a5] hover:text-[#0057a5] transition-colors">
                {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Upload className="w-6 h-6 mb-1" /><span className="text-xs">Subir imagen</span></>}
              </button>
            )}
          </div>

          <Button type="submit" disabled={saving || !name.trim() || !price} className={`w-full ${editingId ? 'bg-orange-500 hover:bg-orange-600' : ''}`}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : editingId ? (
              <><Pencil className="w-4 h-4 mr-2" /> Guardar Cambios</>
            ) : (
              <><Plus className="w-4 h-4 mr-2" /> Agregar al Menu</>
            )}
          </Button>
        </form>

        <div>
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
            Productos Actuales ({products.length})
          </h3>
          <div className="space-y-2">
            {products.map((product) => (
              <Card key={product.id} className={`p-3 flex items-center gap-3 ${editingId === product.id ? 'border-orange-500 bg-orange-50' : ''}`}>
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-12 h-12 object-cover rounded" />
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center"><ImageIcon className="w-5 h-5 text-gray-400" /></div>
                )}
                <div className="flex-1">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">$ {product.price.toLocaleString('es-AR')}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="text-blue-500 hover:bg-blue-50" onClick={() => handleEdit(product)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => handleDelete(product.id)} disabled={deletingId === product.id}>
                    {deletingId === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
