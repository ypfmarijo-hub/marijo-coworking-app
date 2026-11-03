'use client'

// Base de datos de clientes: un renglón por cliente (por teléfono), con lo que cargó en la pizarra,
// DNI y rango de edad aproximado, visitas, horas y gasto. Se puede buscar, filtrar por edad y bajar en Excel.

import { useEffect, useMemo, useState } from 'react'
import { Check, Download, Loader2, Pencil, Search, Users, X } from 'lucide-react'
import { AGE_RANGES } from '@/lib/age'

interface ClientRow {
  key: string; firstName: string; lastName: string; phone: string; dni: string | null; ageRangeStaff: string | null; ageSource: 'dni' | 'staff' | null
  visits: number; cancelled: number; hours: number; espacio: number; market: number
  firstVisit: string; lastVisit: string | null
  ageRange: string; birthYearApprox: number | null
  rubro: string; offers: string[]; seeks: string[]
}

const pesos = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const dmy = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '')

export function ClientsModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<ClientRow[] | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [age, setAge] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/staff/clients/base', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRows(d.clients || []))
      .catch(() => setError('No se pudo cargar la base de clientes. Probá de nuevo.'))
  }, [])

  const ranges = [...AGE_RANGES, 'Sin dato']
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rows || []) m[r.ageRange] = (m[r.ageRange] || 0) + 1
    return m
  }, [rows])

  const shown = useMemo(() => {
    const t = norm(q.trim())
    return (rows || []).filter((r) => (!age || r.ageRange === age) &&
      (!t || norm([r.firstName, r.lastName, r.phone, r.dni || '', r.rubro, ...r.offers, ...r.seeks].join(' ')).includes(t) ||
        (t.replace(/\D/g, '').length >= 4 && r.phone.replace(/\D/g, '').includes(t.replace(/\D/g, '')))))
  }, [rows, q, age])

  const downloadExcel = () => {
    const esc = (v: string | number) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const th = (c: string) => `<th style="background:#0057a5;color:#fff;border:1px solid #cfd8e3;padding:5px 8px;font-size:11px;text-align:left;white-space:nowrap;">${esc(c)}</th>`
    const td = (c: string | number) => `<td style="border:1px solid #e2e8f0;padding:5px 8px;font-size:11px;">${esc(c)}</td>`
    const head = ['Nombre', 'Apellido', 'Teléfono', 'DNI', 'Rango de edad (aprox.)', 'Año de nacimiento (aprox.)', 'A qué se dedica', 'Qué ofrece', 'Qué busca',
      'Visitas', 'Canceladas', 'Horas', 'Valor espacios', 'Consumo Market', 'Primera visita', 'Última visita']
    const body = shown.map((r) => `<tr>${[r.firstName, r.lastName, r.phone, r.dni || '', r.ageRange, r.birthYearApprox ?? '', r.rubro, r.offers.join(', '), r.seeks.join(', '),
      r.visits, r.cancelled, String(r.hours).replace('.', ','), pesos(r.espacio), pesos(r.market), dmy(r.firstVisit), dmy(r.lastVisit)].map(td).join('')}</tr>`).join('')
    const today = new Date().toISOString().slice(0, 10)
    const html = `<html><head><meta charset="UTF-8"></head><body><table style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">
      <tr><td colspan="16" style="font-size:18px;font-weight:bold;padding:10px;">Base de clientes Fullwork — ${dmy(today)} (${shown.length} clientes)</td></tr>
      <tr><td colspan="16" style="font-size:11px;color:#64748b;padding:0 10px 8px;">La edad es aproximada: se estima por el número de DNI. Uso interno.</td></tr>
      <tr>${head.map(th).join('')}</tr>${body}</table></body></html>`
    const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `clientes-fullwork-${today}.xls`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Base de clientes" onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-6xl rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[92vh] flex flex-col">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-[#0057a5]" />
          <h2 className="flex-1 text-lg font-bold text-slate-900">Base de clientes {rows && <span className="text-slate-400 font-semibold">({rows.length})</span>}</h2>
          {rows && rows.length > 0 && (
            <button onClick={downloadExcel} className="h-10 px-3 rounded-lg bg-[#0057a5] text-white text-sm font-bold flex items-center gap-2"><Download className="w-4 h-4" />Descargar Excel</button>
          )}
          <button onClick={onClose} aria-label="Cerrar" className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!rows && !error && <Loader2 className="w-6 h-6 animate-spin text-[#0057a5] mx-auto" />}

        {rows && (
          <>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, teléfono, DNI, rubro, qué ofrece o qué busca…" aria-label="Buscar cliente"
                className="w-full h-11 rounded-lg border border-slate-300 pl-9 pr-3 text-sm" />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por edad">
              <button onClick={() => setAge(null)} className={`h-8 px-3 rounded-full text-xs font-bold border ${!age ? 'bg-[#0057a5] text-white border-[#0057a5]' : 'bg-white text-slate-600 border-slate-200'}`}>Todas las edades</button>
              {ranges.filter((r) => counts[r]).map((r) => (
                <button key={r} onClick={() => setAge(age === r ? null : r)}
                  className={`h-8 px-3 rounded-full text-xs font-bold border ${age === r ? 'bg-[#0057a5] text-white border-[#0057a5]' : 'bg-white text-slate-600 border-slate-200'}`}>
                  {r} · {counts[r]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 -mt-2">La edad es aproximada: sale del DNI si el cliente lo dejó; si no, la elegís vos a ojo en la columna (no hace falta preguntarle). Lo de "a qué se dedica / ofrece / busca" sale de la pizarra.</p>

            <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-left p-2">Cliente</th><th className="text-left p-2">Edad aprox.</th><th className="text-left p-2">A qué se dedica</th>
                    <th className="text-left p-2">Ofrece</th><th className="text-left p-2">Busca</th>
                    <th className="text-right p-2">Visitas</th><th className="text-right p-2">Horas</th><th className="text-right p-2">Consumo</th><th className="text-left p-2">Última</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-slate-500">No hay clientes que coincidan.</td></tr>}
                  {shown.map((r) => (
                    <tr key={r.key} className="border-t border-slate-100 align-top">
                      <td className="p-2"><ClientNameCell row={r} onSaved={(f, l) => setRows((prev) => prev && prev.map((x) => x.key === r.key ? { ...x, firstName: f, lastName: l } : x))} /><br /><span className="text-xs text-[#0057a5] font-semibold">{r.phone}</span>{r.dni && <span className="text-xs text-slate-400"> · DNI {r.dni}</span>}</td>
                      <td className="p-2 whitespace-nowrap">
                        {r.ageSource === 'dni' ? <>{r.ageRange} <span className="text-[10px] text-slate-400">(DNI)</span></>
                          : <AgeSelect phone={r.phone} value={r.ageRangeStaff} onSaved={(nv) => setRows((prev) => prev && prev.map((x) => x.key === r.key ? { ...x, ageRangeStaff: nv, ageRange: nv || 'Sin dato', ageSource: nv ? 'staff' : null } : x))} />}
                      </td>
                      <td className="p-2">{r.rubro || <span className="text-slate-300">—</span>}</td>
                      <td className="p-2 text-xs">{r.offers.join(', ') || <span className="text-slate-300">—</span>}</td>
                      <td className="p-2 text-xs">{r.seeks.join(', ') || <span className="text-slate-300">—</span>}</td>
                      <td className="p-2 text-right">{r.visits}</td>
                      <td className="p-2 text-right">{String(r.hours).replace('.', ',')}</td>
                      <td className="p-2 text-right whitespace-nowrap">{pesos(r.market)}</td>
                      <td className="p-2 whitespace-nowrap">{dmy(r.lastVisit || r.firstVisit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Selector chico de edad aproximada (la estima el staff a ojo, sin preguntar). Guarda en la reserva o en la última del teléfono. */
export function AgeSelect({ reservationId, phone, value, onSaved, className = '' }: { reservationId?: string; phone?: string; value: string | null; onSaved?: (v: string | null) => void; className?: string }) {
  const [v, setV] = useState(value || '')
  const [state, setState] = useState<'' | 'saving' | 'ok' | 'error'>('')
  useEffect(() => { setV(value || '') }, [value])
  const save = async (nv: string) => {
    setV(nv); setState('saving')
    const res = await fetch('/api/staff/age', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reservationId, phone, range: nv || null }) }).catch(() => null)
    setState(res?.ok ? 'ok' : 'error')
    if (res?.ok) onSaved?.(nv || null)
  }
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <select value={v} onChange={(e) => save(e.target.value)} aria-label="Edad aproximada (la estimás vos)"
        className="h-7 rounded-md border border-slate-300 bg-white px-1.5 text-[11px] font-semibold text-slate-700">
        <option value="">Edad aprox.: elegir</option>
        {AGE_RANGES.map((r) => <option key={r} value={r}>Edad aprox.: {r}</option>)}
      </select>
      {state === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
      {state === 'ok' && <span className="text-[11px] text-green-600 font-bold">✓</span>}
      {state === 'error' && <span className="text-[11px] text-red-600 font-bold">No se guardó</span>}
    </span>
  )
}

/** Nombre del cliente con lápiz: se corrige en todas sus reservas (mismo teléfono). */
function ClientNameCell({ row, onSaved }: { row: { firstName: string; lastName: string; phone: string }; onSaved: (f: string, l: string) => void }) {
  const [edit, setEdit] = useState(false)
  const [f, setF] = useState(row.firstName)
  const [l, setL] = useState(row.lastName)
  const [busy, setBusy] = useState(false)
  if (!edit) return (
    <span className="inline-flex items-center gap-1"><b>{row.firstName} {row.lastName}</b>
      <button type="button" onClick={() => { setF(row.firstName); setL(row.lastName); setEdit(true) }} aria-label="Corregir el nombre" title="Corregir el nombre"
        className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-[#0057a5] hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
    </span>
  )
  const save = async () => {
    setBusy(true)
    const res = await fetch('/api/staff/client-name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: row.phone, firstName: f, lastName: l, all: true }) })
    setBusy(false)
    if (res.ok) { onSaved(f.trim(), l.trim()); setEdit(false) }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <input value={f} onChange={(e) => setF(e.target.value)} aria-label="Nombre" className="w-24 h-8 rounded-md border border-slate-300 px-2 text-sm" />
      <input value={l} onChange={(e) => setL(e.target.value)} aria-label="Apellido" className="w-24 h-8 rounded-md border border-slate-300 px-2 text-sm" />
      <button type="button" onClick={save} disabled={busy || !f.trim()} aria-label="Guardar nombre" className="w-8 h-8 rounded-md bg-[#0057a5] text-white flex items-center justify-center disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}</button>
      <button type="button" onClick={() => setEdit(false)} aria-label="Cancelar" className="w-8 h-8 rounded-md border border-slate-300 flex items-center justify-center"><X className="w-4 h-4" /></button>
    </span>
  )
}
