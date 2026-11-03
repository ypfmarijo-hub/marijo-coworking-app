'use client'

// Precios del menú con Excel: se baja el menú, se cambian los precios en Excel y se sube.
// Antes de aplicar se ve qué cambia. Se reconoce cada producto por la columna "ID" (o por el nombre).

import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { fillMenuSheet, readMenuSheet, type MenuPreview, type MenuProd } from '@/lib/menu-excel'

const pesos = (n: number) => '$ ' + Math.round(n).toLocaleString('es-AR')

export function MenuExcel({ products, onDone }: { products: MenuProd[]; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'' | 'bajar' | 'leer' | 'aplicar'>('')
  const [msg, setMsg] = useState('')
  const [preview, setPreview] = useState<MenuPreview | null>(null)
  const [addNew, setAddNew] = useState(false)

  const download = async () => {
    setBusy('bajar'); setMsg('')
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      fillMenuSheet(wb.addWorksheet('Menú'), products)
      const buf = await wb.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a'); a.href = url; a.download = `menu-fullwork-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch { setMsg('No se pudo armar el Excel. Probá de nuevo.') }
    setBusy('')
  }

  const read = async (file: File) => {
    setBusy('leer'); setMsg(''); setPreview(null)
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())
      const ws = wb.worksheets[0]
      if (!ws) throw new Error('vacío')
      const result = readMenuSheet(ws, products)
      if ('error' in result) { setMsg(result.error); setBusy(''); return }
      setPreview(result)
    } catch { setMsg('No pude leer ese archivo. Tiene que ser un Excel (.xlsx).') }
    setBusy('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const apply = async () => {
    if (!preview) return
    setBusy('aplicar'); setMsg('')
    const res = await fetch('/api/staff/products/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: preview.changes.map((c) => ({ id: c.id, price: c.to })), creates: addNew ? preview.news : [] }) })
    const d = await res.json().catch(() => ({}))
    setBusy('')
    if (!res.ok) { setMsg('No se pudieron guardar los cambios.'); return }
    setMsg(`Listo: ${d.updated} precios actualizados${d.created ? ` y ${d.created} productos nuevos` : ''}.${d.failed ? ` ${d.failed} no se pudieron guardar.` : ''}`)
    setPreview(null); setAddNew(false); onDone()
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 mb-6">
      <div className="flex items-start gap-2">
        <FileSpreadsheet className="w-5 h-5 text-green-700 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-sm">Cambiar precios con Excel</p>
          <p className="text-xs text-slate-600">1) Bajá el menú en Excel. Viene agrupado por categoría, como en la app. 2) Cambiá los precios (no toques la columna ID). 3) Subilo: antes de guardar te muestro qué cambia.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={download} disabled={!!busy} className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
          {busy === 'bajar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}Bajar menú en Excel
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy} className="h-10 px-3 rounded-lg bg-green-700 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
          {busy === 'leer' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}Subir Excel con precios nuevos
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" aria-label="Excel con precios"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f) }} />
      </div>
      {msg && <p role="status" className="text-sm font-semibold text-slate-700">{msg}</p>}
      {preview && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
          <p className="text-sm font-bold">{preview.changes.length === 0 ? 'No hay precios distintos para cambiar.' : `${preview.changes.length} precios van a cambiar`}<span className="font-normal text-slate-500"> · {preview.same} quedan igual</span></p>
          {preview.changes.length > 0 && (
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-sm">
              {preview.changes.map((c) => (
                <div key={c.id} className="flex justify-between gap-3 py-1.5">
                  <span className="min-w-0 truncate">{c.name}</span>
                  <span className="whitespace-nowrap"><span className="text-slate-400 line-through mr-2">{pesos(c.from)}</span><b className={c.to > c.from ? 'text-red-700' : 'text-green-700'}>{pesos(c.to)}</b></span>
                </div>
              ))}
            </div>
          )}
          {preview.news.length > 0 && (
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={addNew} onChange={(e) => setAddNew(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#0057a5]" />
              <span>Agregar también {preview.news.length} {preview.news.length === 1 ? 'producto nuevo' : 'productos nuevos'} que no están en el menú <span className="text-slate-500">({preview.news.slice(0, 3).map((n) => n.name).join(', ')}{preview.news.length > 3 ? '…' : ''})</span></span></label>
          )}
          {preview.unknown.length > 0 && <p className="text-xs text-amber-800 bg-amber-50 rounded p-2">No se tomaron {preview.unknown.length} filas: {preview.unknown.slice(0, 3).join('; ')}{preview.unknown.length > 3 ? '…' : ''}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setPreview(null)} className="h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold">Cancelar</button>
            <button type="button" onClick={apply} disabled={!!busy || (preview.changes.length === 0 && !(addNew && preview.news.length))} className="h-10 px-4 rounded-lg bg-[#0057a5] text-white text-sm font-bold disabled:opacity-50">
              {busy === 'aplicar' ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
