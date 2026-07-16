'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Reservation, WorkspaceType, WORKSPACE_LABELS, WORKSPACE_PRICES, ReservationStatus, timeRangesOverlap, getBlockedWorkspaces } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, Clock, User, Building2, CalendarDays, Plus, X, Trash2, AlertTriangle, Paperclip, DollarSign, Bell, ShoppingBag, Volume2, VolumeX, Minus, FileBarChart, Download, Loader2 } from 'lucide-react'
import { MenuAdminModal } from '@/components/staff/menu-admin-modal'
import { OrdersSidebar } from '@/components/staff/orders-sidebar'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

const START_HOUR = 7
const END_HOUR = 22
const PX_PER_HOUR = 64

const ALL_WORKSPACES: WorkspaceType[] = ['escritorio', 'sala-a', 'sala-b', 'sala-grande', 'oficina-c', 'oficina-d']

const WORKSPACE_COLORS: Record<WorkspaceType, { bg: string; border: string; text: string }> = {
  'escritorio': { bg: 'bg-blue-50', border: 'border-l-blue-500', text: 'text-blue-800' },
  'sala-a': { bg: 'bg-emerald-50', border: 'border-l-emerald-500', text: 'text-emerald-800' },
  'sala-b': { bg: 'bg-violet-50', border: 'border-l-violet-500', text: 'text-violet-800' },
  'sala-grande': { bg: 'bg-amber-50', border: 'border-l-amber-500', text: 'text-amber-800' },
  'oficina-c': { bg: 'bg-rose-50', border: 'border-l-rose-500', text: 'text-rose-800' },
  'oficina-d': { bg: 'bg-cyan-50', border: 'border-l-cyan-500', text: 'text-cyan-800' },
}

function toLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function calculateDuration(timeFrom: string, timeTo: string): number {
  const [hFrom, mFrom] = timeFrom.split(':').map(Number)
  const [hTo, mTo] = timeTo.split(':').map(Number)
  const minutosInicio = hFrom * 60 + mFrom
  const minutosFin = hTo * 60 + mTo
  return (minutosFin - minutosInicio) / 60
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
}

function rowToReservation(row: Record<string, unknown>): Reservation {
  return {
    id: row.id as string,
    workspace: row.workspace as WorkspaceType,
    date: toLocalDate(row.date as string),
    timeFrom: row.time_from as string,
    timeTo: row.time_to as string,
    deskNumber: row.desk_number != null ? (row.desk_number as number) : undefined,
    phone: row.phone as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    status: (row.status as ReservationStatus) ?? 'confirmed',
    receiptUrl: row.receipt_url as string | undefined,
    reservationCode: row.reservation_code as string | undefined,
    createdAt: new Date(row.created_at as string),
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at as string) : undefined,
    market_orders: Array.isArray(row.market_orders) ? row.market_orders : undefined,
  }
}

const DAYS_FULL = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

interface MiniCalendarPickerProps {
  selectedDate: Date
  onSelect: (date: Date) => void
  onClose: () => void
}

function MiniCalendarPicker({ selectedDate, onSelect, onClose }: MiniCalendarPickerProps) {
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div ref={ref} className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-2xl border border-border p-4 w-72">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-muted transition-colors text-foreground">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-muted transition-colors text-foreground">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_FULL.map(d => (<div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const cellDate = new Date(viewYear, viewMonth, day); cellDate.setHours(0, 0, 0, 0)
          const isSelected = formatDateKey(cellDate) === formatDateKey(selectedDate)
          const isToday = formatDateKey(cellDate) === formatDateKey(today)
          return (
            <button key={i} onClick={() => { onSelect(cellDate); onClose() }} className={['w-full aspect-square rounded-lg text-xs font-medium transition-colors flex items-center justify-center', isSelected ? 'bg-primary text-primary-foreground' : isToday ? 'border border-primary text-primary font-bold hover:bg-primary/10' : 'hover:bg-muted text-foreground'].join(' ')}>
              {day}
            </button>
          )
        })}
      </div>
      <button onClick={() => { onSelect(today); onClose() }} className="mt-3 w-full text-xs text-center text-primary font-medium hover:underline">Ir a hoy</button>
    </div>
  )
}

interface QuickReservationModalProps {
  workspace: WorkspaceType
  date: Date
  hour: number
  onClose: () => void
  onSubmit: (data: { firstName: string; lastName: string; phone: string; timeFrom: string; timeTo: string; deskNumber?: number }) => Promise<boolean>
}

function buildSlots(fromHour: number, toHour: number): string[] {
  const slots: string[] = []
  for (let h = fromHour; h <= toHour; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    if (h < toHour) slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

function isValidTime(v: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(v)) return false
  const [h, m] = v.split(':').map(Number)
  return h >= 0 && h <= 23 && (m === 0 || m === 30 || m === 15 || m === 45 || (m >= 0 && m <= 59))
}

interface TimeComboProps {
  label: string
  value: string
  onChange: (v: string) => void
  slots: string[]
}

function TimeCombo({ label, value, onChange, slots }: TimeComboProps) {
  const [open, setOpen] = useState(false)
  const [inputVal, setInputVal] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setInputVal(value) }, [value])
  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    if (typeof document !== 'undefined') {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value; setInputVal(v)
    if (/^\d{4}$/.test(v)) {
      const formatted = `${v.slice(0, 2)}:${v.slice(2)}`; setInputVal(formatted)
      if (isValidTime(formatted)) onChange(formatted)
      return
    }
    if (isValidTime(v)) onChange(v)
  }

  function handleInputBlur() {
    if (isValidTime(inputVal)) onChange(inputVal)
    else setInputVal(value)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <div className="flex items-center border border-input rounded-md bg-background overflow-hidden focus-within:ring-2 focus-within:ring-primary/40">
        <input type="text" value={inputVal} onChange={handleInputChange} onBlur={handleInputBlur} onFocus={() => setOpen(true)} placeholder="HH:MM" maxLength={5} className="flex-1 h-10 px-3 text-sm bg-transparent outline-none text-foreground" />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); setOpen(v => !v) }} className="h-10 w-8 flex items-center justify-center text-muted-foreground border-l border-input bg-muted/30"><ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : 'rotate-90 opacity-50'}`} /></button>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {slots.map(slot => (<button key={slot} type="button" onMouseDown={(e) => { e.preventDefault(); onChange(slot); setInputVal(slot); setOpen(false) }} className={['w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors', slot === value ? 'bg-primary/10 font-semibold text-primary' : 'text-foreground'].join(' ')}>{slot}</button>))}
        </div>
      )}
    </div>
  )
}

function QuickReservationModal({ workspace, date, hour, onClose, onSubmit }: QuickReservationModalProps) {
  const [firstName, setFirstName] = useState(''); const [lastName, setLastName] = useState(''); const [phone, setPhone] = useState(''); const [deskNumber, setDeskNumber] = useState<number>(1)
  const initialFrom = `${String(hour).padStart(2, '0')}:00`; const initialTo = `${String(Math.min(hour + 1, END_HOUR)).padStart(2, '0')}:00`
  const [timeFrom, setTimeFrom] = useState(initialFrom); const [timeTo, setTimeTo] = useState(initialTo);
  const [submitting, setSubmitting] = useState(false); const [error, setError] = useState('')
  const fromSlots = buildSlots(START_HOUR, END_HOUR - 1); const toSlots = buildSlots(START_HOUR, END_HOUR).filter(s => s > timeFrom)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !phone.trim()) { setError('Nombre y telefono son obligatorios'); return }
    setSubmitting(true); const success = await onSubmit({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), timeFrom, timeTo, deskNumber: workspace === 'escritorio' ? deskNumber : undefined })
    setSubmitting(false); if (success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <Card className="p-6 max-w-md w-full border-0 shadow-2xl">
        <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><Plus className="w-5 h-5 text-primary" /><h3 className="font-semibold text-foreground">Reserva Rápida</h3></div><button onClick={onClose} className="text-muted-foreground"><X className="w-5 h-5" /></button></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {workspace === 'escritorio' && (<div className="grid grid-cols-6 gap-2">{Array.from({ length: 12 }, (_, i) => i + 1).map(num => (<button key={num} type="button" onClick={() => setDeskNumber(num)} className={['h-10 rounded-lg text-sm font-semibold border-2', deskNumber === num ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-transparent'].join(' ')}>{num}</button>))}</div>)}
          <div className="grid grid-cols-2 gap-3"><TimeCombo label="Desde" value={timeFrom} onChange={v => { setTimeFrom(v); if (timeTo <= v) setTimeTo(buildSlots(START_HOUR, END_HOUR).find(s => s > v) || v) }} slots={fromSlots} /><TimeCombo label="Hasta" value={timeTo} onChange={setTimeTo} slots={toSlots} /></div>
          <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nombre *" />
          <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Apellido" />
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Teléfono *" type="tel" />
          <div className="flex gap-3 pt-2"><Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button><Button type="submit" className="flex-1" disabled={submitting}>Guardar</Button></div>
        </form>
      </Card>
    </div>
  )
}

function CancelModal({ reservation, onClose, onConfirm }: { reservation: Reservation; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [cancelling, setCancelling] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <Card className="p-6 max-sm w-full border-0 shadow-2xl text-center">
        <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
        <h3 className="font-bold text-lg mb-2 uppercase">Cancelar Reserva</h3>
        <p className="text-sm text-muted-foreground mb-6">¿Estás seguro de cancelar la reserva de <b>{reservation.firstName}</b>?</p>
        <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={onClose}>Volver</Button><Button variant="destructive" className="flex-1" onClick={async () => { setCancelling(true); await onConfirm(); setCancelling(false) }} disabled={cancelling}>{cancelling ? '...' : 'Confirmar'}</Button></div>
      </Card>
    </div>
  )
}

interface ManualOrderModalProps {
  reservation: Reservation
  products: { id: string; name: string; price: number; image_url: string | null }[]
  onClose: () => void
  onSubmit: (items: { name: string; price: number; quantity: number; subtotal: number }[]) => Promise<boolean>
}

function ManualOrderModal({ reservation, products, onClose, onSubmit }: ManualOrderModalProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const setQty = (id: string, delta: number) => {
    setQuantities(prev => {
      const next = Math.max(0, (prev[id] || 0) + delta)
      return { ...prev, [id]: next }
    })
  }

  const selectedItems = products
    .filter(p => (quantities[p.id] || 0) > 0)
    .map(p => ({ name: p.name, price: p.price, quantity: quantities[p.id], subtotal: p.price * quantities[p.id] }))

  const total = selectedItems.reduce((acc, i) => acc + i.subtotal, 0)

  const handleSubmit = async () => {
    if (selectedItems.length === 0) { setError('Elegí al menos un producto'); return }
    setSubmitting(true)
    const success = await onSubmit(selectedItems)
    setSubmitting(false)
    if (success) onClose()
    else setError('No se pudo guardar el pedido, intentá de nuevo')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <Card className="p-6 max-w-md w-full border-0 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Cargar consumo manual</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {reservation.firstName} {reservation.lastName} — {WORKSPACE_LABELS[reservation.workspace]}
        </p>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No hay productos cargados en el Market todavía.</p>
          ) : products.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-3 border border-slate-100 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{formatPrice(p.price)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setQty(p.id, -1)} className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-5 text-center text-sm font-bold">{quantities[p.id] || 0}</span>
                <button type="button" onClick={() => setQty(p.id, 1)} className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
          <span className="text-sm font-black text-foreground">Total: {formatPrice(total)}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting || selectedItems.length === 0}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

interface ReportSummary {
  range: { from: string; to: string }
  reservations: {
    total: number; confirmed: number; cancelled: number; revenue: number; totalHours: number
    bySource: { app: { count: number; hours: number }; staff: { count: number; hours: number } }
  }
  market: {
    orderCount: number; revenue: number
    bySource: { app: { count: number; revenue: number }; staff: { count: number; revenue: number } }
    products: { name: string; quantity: number; revenue: number }[]
  }
  totalRevenue: number
  reservationsDetail: {
    date: string; code: string; workspace: string; deskNumber: number | string
    timeFrom: string; timeTo: string; hours: number
    firstName: string; lastName: string; phone: string
    source: 'app' | 'staff'; status: string
    espacioRevenue: number; marketConsumption: number; total: number
  }[]
}

function ReportModal({ onClose }: { onClose: () => void }) {
  const todayKey = formatDateKey(new Date())
  const [from, setFrom] = useState(todayKey)
  const [to, setTo] = useState(todayKey)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<ReportSummary | null>(null)

  const runReport = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/reports/summary?from=${from}&to=${to}`)
      if (!res.ok) throw new Error('No se pudo generar el informe')
      const data = await res.json()
      setSummary(data)
    } catch (e) {
      setError('No se pudo generar el informe. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { runReport() }, [])

  const downloadExcel = () => {
    if (!summary) return
    const escHtml = (v: string | number) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const section = (title: string) =>
      `<tr><td colspan="15" style="background:#0057a5;color:#ffffff;font-weight:bold;font-size:13px;padding:8px;">${escHtml(title)}</td></tr>`

    const headerRow = (cells: string[]) =>
      `<tr>${cells.map(c => `<th style="background:#eef3f8;border:1px solid #cfd8e3;padding:5px 10px;font-size:11px;text-align:left;white-space:nowrap;">${escHtml(c)}</th>`).join('')}</tr>`

    const dataRow = (cells: (string | number)[]) =>
      `<tr>${cells.map(c => `<td style="border:1px solid #e2e8f0;padding:5px 10px;font-size:11px;white-space:nowrap;">${escHtml(c)}</td>`).join('')}</tr>`

    const blankRow = `<tr><td colspan="15" style="padding:4px;">&nbsp;</td></tr>`

    let rows = ''
    rows += `<tr><td colspan="15" style="font-size:18px;font-weight:bold;padding:10px;">Informe Fullwork — ${escHtml(summary.range.from)} a ${escHtml(summary.range.to)}</td></tr>`
    rows += blankRow

    rows += section('RESERVAS')
    rows += headerRow(['Total', 'Confirmadas', 'Canceladas', 'Reservas App', 'Horas App', 'Reservas Staff', 'Horas Staff', 'Horas Totales', 'Facturado Espacios'])
    rows += dataRow([
      summary.reservations.total, summary.reservations.confirmed, summary.reservations.cancelled,
      summary.reservations.bySource.app.count, summary.reservations.bySource.app.hours,
      summary.reservations.bySource.staff.count, summary.reservations.bySource.staff.hours,
      summary.reservations.totalHours, formatPrice(summary.reservations.revenue),
    ])
    rows += blankRow

    rows += section('MARKET')
    rows += headerRow(['Pedidos', 'Pedidos App', 'Facturado App', 'Pedidos Staff', 'Facturado Staff', 'Facturado Market'])
    rows += dataRow([
      summary.market.orderCount, summary.market.bySource.app.count, formatPrice(summary.market.bySource.app.revenue),
      summary.market.bySource.staff.count, formatPrice(summary.market.bySource.staff.revenue), formatPrice(summary.market.revenue),
    ])
    rows += blankRow

    rows += section('PRODUCTOS CONSUMIDOS')
    rows += headerRow(['Producto', 'Cantidad', 'Total'])
    summary.market.products.forEach(p => { rows += dataRow([p.name, p.quantity, formatPrice(p.revenue)]) })
    rows += blankRow

    rows += `<tr><td colspan="2" style="background:#0057a5;color:#fff;font-weight:bold;padding:8px;">TOTAL GENERAL</td><td style="background:#0057a5;color:#fff;font-weight:bold;padding:8px;">${escHtml(formatPrice(summary.totalRevenue))}</td></tr>`
    rows += blankRow

    rows += section('DETALLE DE RESERVAS')
    rows += headerRow(['Fecha', 'Código', 'Espacio', 'N° Escritorio', 'Desde', 'Hasta', 'Horas', 'Nombre', 'Apellido', 'Teléfono', 'Origen', 'Estado', 'Facturado Espacio', 'Consumo Market', 'Total'])
    summary.reservationsDetail.forEach(r => {
      const workspaceLabel = WORKSPACE_LABELS[r.workspace as WorkspaceType] || r.workspace
      const origen = r.source === 'app' ? 'App' : 'Staff'
      const estado = r.status === 'confirmed' ? 'Confirmada' : r.status === 'cancelled' ? 'Cancelada' : r.status
      rows += dataRow([
        r.date, r.code, workspaceLabel, r.deskNumber, r.timeFrom, r.timeTo, r.hours,
        r.firstName, r.lastName, r.phone, origen, estado,
        formatPrice(r.espacioRevenue), formatPrice(r.marketConsumption), formatPrice(r.total),
      ])
    })

    const html = `<html><head><meta charset="UTF-8"></head><body><table style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">${rows}</table></body></html>`
    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `informe-fullwork-${summary.range.from}-a-${summary.range.to}.xls`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <Card className="p-6 max-w-lg w-full border-0 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Informe de reservas y Market</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Desde</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full h-10 px-3 text-sm border border-input rounded-md bg-background text-foreground" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Hasta</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full h-10 px-3 text-sm border border-input rounded-md bg-background text-foreground" />
          </div>
        </div>

        <Button type="button" onClick={runReport} disabled={loading} className="mb-4">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Generar informe
        </Button>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        {summary && !loading && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reservas</p>
                <p className="text-2xl font-black text-[#0057a5]">{summary.reservations.total}</p>
                <p className="text-[10px] text-slate-500 mt-1">{summary.reservations.confirmed} confirmadas · {summary.reservations.cancelled} canceladas</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pedidos Market</p>
                <p className="text-2xl font-black text-[#0057a5]">{summary.market.orderCount}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pedidos App / Staff</p>
                <p className="text-lg font-black text-foreground">{summary.market.bySource.app.count} <span className="text-[10px] font-normal text-slate-400">app</span> · {summary.market.bySource.staff.count} <span className="text-[10px] font-normal text-slate-400">staff</span></p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reservas por App / Staff</p>
                <p className="text-lg font-black text-foreground">{summary.reservations.bySource.app.count} <span className="text-[10px] font-normal text-slate-400">app</span> · {summary.reservations.bySource.staff.count} <span className="text-[10px] font-normal text-slate-400">staff</span></p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Horas Reservadas</p>
                <p className="text-lg font-black text-foreground">{summary.reservations.totalHours.toLocaleString('es-AR', { maximumFractionDigits: 1 })} hs</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Facturado Espacios</p>
                <p className="text-lg font-black text-foreground">{formatPrice(summary.reservations.revenue)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Facturado Market</p>
                <p className="text-lg font-black text-foreground">{formatPrice(summary.market.revenue)}</p>
              </div>
            </div>

            <div className="bg-[#0057a5]/5 rounded-xl p-3 border border-[#0057a5]/10 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-[#0057a5]">Total General</span>
              <span className="text-xl font-black text-[#0057a5]">{formatPrice(summary.totalRevenue)}</span>
            </div>

            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Productos consumidos</p>
              {summary.market.products.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin consumo de Market en este rango.</p>
              ) : (
                <div className="space-y-1">
                  {summary.market.products.map(p => (
                    <div key={p.name} className="flex justify-between items-center text-xs border-b border-slate-100 py-1.5">
                      <span className="text-slate-700">{p.quantity}x {p.name}</span>
                      <span className="font-semibold text-slate-800">{formatPrice(p.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="button" variant="outline" onClick={downloadExcel} className="w-full">
              <Download className="w-4 h-4 mr-2" /> Descargar Excel
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

export function StaffPageClient() {
  const [isMounted, setIsMounted] = useState(false)
  
  const [selectedDate, setSelectedDate] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true)
  const [quickReservation, setQuickReservation] = useState<{ workspace: WorkspaceType; hour: number } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null)
  const [showCalendar, setShowCalendar] = useState(false); const [workspaceFilter, setWorkspaceFilter] = useState<'escritorio' | 'sala' | 'oficina' | null>(null)
  const alertedIdsRef = useRef<Set<string>>(new Set()); const [activeAlerts, setActiveAlerts] = useState<Set<string>>(new Set());
  const [liveStatus, setLiveStatus] = useState<Record<string, 'pending' | 'en_curso' | 'finalizada'>>({})
  const [toasts, setToasts] = useState<{ id: string; code: string }[]>([]);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [marketProducts, setMarketProducts] = useState<{ id: string; name: string; price: number; image_url: string | null }[]>([])
  const [manualOrderTarget, setManualOrderTarget] = useState<Reservation | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)

  const [allOrders, setAllOrders] = useState<any[]>([])

  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playAlertSound = useCallback(() => {
    if (audioRef.current && audioEnabled) { audioRef.current.currentTime = 0; audioRef.current.play().catch(e => console.log("Audio block:", e)) }
  }, [audioEnabled])

  const dismissToast = useCallback((id: string) => { setToasts(prev => prev.filter(t => t.id !== id)) }, [])

  useEffect(() => { setIsMounted(true) }, [])

  const handleManualFinish = useCallback(async (r: Reservation, e: React.MouseEvent) => {
    e.stopPropagation(); const supabase = createClient(); const { error } = await supabase.from('reservations').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', r.id)
    if (!error) setReservations(prev => prev.map(res => res.id === r.id ? { ...res, status: 'cancelled', cancelledAt: new Date() } : res))
  }, [])

  useEffect(() => { if (typeof window !== 'undefined' && 'Notification' in window) setNotifPermission(Notification.permission); else setNotifPermission('unsupported') }, [])
  const requestNotificationPermission = useCallback(async () => { if (typeof window !== 'undefined' && 'Notification' in window) { const result = await Notification.requestPermission(); setNotifPermission(result) } }, [])

  const loadMarketProducts = useCallback(async () => { try { const res = await fetch('/api/market/products'); if (res.ok) setMarketProducts(await res.json()) } catch (error) { console.error(error) } }, [])
  useEffect(() => { loadMarketProducts() }, [loadMarketProducts])

  const sendBrowserNotification = useCallback((code: string) => { if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') new Notification('Fullwork - Alerta', { body: `Reserva ${code} finaliza en 10 min.`, tag: code, requireInteraction: true }) }, [])

  useEffect(() => {
    function check() {
      const now = new Date(); const todayKey = formatDateKey(now); const isViewingToday = formatDateKey(selectedDate) === todayKey
      const newAlerts = new Set<string>(); const newLiveStatus: Record<string, 'pending' | 'en_curso' | 'finalizada'> = {}
      reservations.forEach(r => {
        if (r.status === 'cancelled') return
        const [startH, startM] = r.timeFrom.split(':').map(Number); const [endH, endM] = r.timeTo.split(':').map(Number)
        const startTime = new Date(now); startTime.setHours(startH, startM, 0, 0); const endTime = new Date(now); endTime.setHours(endH, endM, 0, 0)
        const nowMs = now.getTime(), startMs = startTime.getTime(), endMs = endTime.getTime()
        if (nowMs >= endMs) newLiveStatus[r.id] = 'finalizada';
        else if (nowMs >= startMs) newLiveStatus[r.id] = 'en_curso'; else newLiveStatus[r.id] = 'pending'
        if (isViewingToday) { const diffMin = (endMs - nowMs) / 60000; if (diffMin > 0 && diffMin <= 10) { newAlerts.add(r.id); if (!alertedIdsRef.current.has(r.id)) { alertedIdsRef.current.add(r.id); setToasts(prev => [...prev, { id: r.id, code: r.reservationCode ?? r.id }]); playAlertSound(); sendBrowserNotification(r.reservationCode ?? r.id) } } }
      })
      setActiveAlerts(newAlerts); setLiveStatus(newLiveStatus)
    }
    check(); const interval = setInterval(check, 15000); return () => clearInterval(interval)
  }, [reservations, selectedDate, playAlertSound, sendBrowserNotification])

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/market/orders')
      if (res.ok) {
        const data = await res.json()
        setAllOrders(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('[StaffClient] loadOrders error:', error)
    }
  }, [])

  useEffect(() => { 
    loadOrders()
    // Polling cada 5 segundos para mantener actualizado
    const interval = setInterval(loadOrders, 5000)
    return () => clearInterval(interval)
  }, [loadOrders])

  const submitManualOrder = useCallback(async (reservation: Reservation, items: { name: string; price: number; quantity: number; subtotal: number }[]): Promise<boolean> => {
    try {
      const res = await fetch('/api/market/orders/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservation_id: reservation.id,
          customer_name: `${reservation.firstName} ${reservation.lastName}`.trim(),
          items,
        }),
      })
      if (!res.ok) return false
      await loadOrders()
      return true
    } catch (error) {
      console.error('[StaffClient] submitManualOrder error:', error)
      return false
    }
  }, [loadOrders])

  const loadForDate = useCallback(async (date: Date, silent = false) => { 
    if (!silent) setLoading(true); 
    const supabase = createClient(); 
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('date', formatDateKey(date))
      .order('time_from', { ascending: true }); 
      
    if (!error && data) setReservations(data.map(rowToReservation)); 
    if (!silent) setLoading(false) 
  }, [])
  
  useEffect(() => { loadForDate(selectedDate) }, [selectedDate, loadForDate])

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase.channel('staff_reservations_channel', {
      config: {
        broadcast: { self: true },
        presence: { key: 'staff' }
      }
    })
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reservations' },
      () => { loadForDate(selectedDate, true) }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      () => { loadOrders() }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[v0] Conexión Realtime activa con Supabase');
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, loadForDate])

  const addReservation = async (data: any): Promise<boolean> => {
    const supabase = createClient();
    const { data: existing } = await supabase.from('reservations').select('*').eq('date', formatDateKey(data.date)).in('status', ['confirmed', 'payment_pending'])
    const latest = (existing ?? []).map(rowToReservation)
    const conflict = latest.some(r => { if (data.workspace === 'escritorio') return r.workspace === 'escritorio' && r.deskNumber === data.deskNumber && timeRangesOverlap(data.timeFrom, data.timeTo, r.timeFrom, r.timeTo); return [data.workspace, ...getBlockedWorkspaces(data.workspace)].includes(r.workspace) && timeRangesOverlap(data.timeFrom, data.timeTo, r.timeFrom, r.timeTo) })
    if (conflict) return false
    const code = `FW-${Math.floor(1000 + Math.random() * 9000)}`
    const { error } = await supabase.from('reservations').insert({ workspace: data.workspace, date: formatDateKey(data.date), time_from: data.timeFrom, time_to: data.timeTo, desk_number: data.deskNumber ?? null, phone: data.phone, first_name: data.firstName, last_name: data.lastName, status: 'confirmed', reservation_code: code, is_present: true })
    if (!error) loadForDate(selectedDate); return !error
  }

  const cancelReservation = async (id: string): Promise<boolean> => { const supabase = createClient(); const { error } = await supabase.from('reservations').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id); if (!error) setReservations(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled', cancelledAt: new Date() } : r)); return !error }

  const hourLabels = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i); const totalHeight = (END_HOUR - START_HOUR + 1) * PX_PER_HOUR
  const isToday = formatDateKey(selectedDate) === formatDateKey(new Date())
  const now = new Date(); const nowTop = ((now.getHours() * 60 + now.getMinutes() - START_HOUR * 60) / 60) * PX_PER_HOUR

  const matchesFilter = (ws: WorkspaceType, filter: typeof workspaceFilter) => {
    if (!filter) return true
    if (filter === 'escritorio') return ws === 'escritorio'
    if (filter === 'sala') return ws.startsWith('sala')
    if (filter === 'oficina') return ws.startsWith('oficina')
    return true
  }

  const confirmed = reservations.filter(r => r.status === 'confirmed')
  const cancelled = reservations.filter(r => r.status === 'cancelled')
  const filteredConfirmed = confirmed.filter(r => matchesFilter(r.workspace, workspaceFilter))
  const filteredCancelled = cancelled.filter(r => matchesFilter(r.workspace, workspaceFilter))

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      {quickReservation && (
        <QuickReservationModal
          workspace={quickReservation.workspace}
          date={selectedDate}
          hour={quickReservation.hour}
          onClose={() => setQuickReservation(null)}
          onSubmit={async (data) => {
            const success = await addReservation({ ...data, workspace: quickReservation.workspace, date: selectedDate })
            if (success) setQuickReservation(null)
            return success
          }}
        />
      )}

      {cancelTarget && (
        <CancelModal
          reservation={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={async () => {
            await cancelReservation(cancelTarget.id)
            setCancelTarget(null)
          }}
        />
      )}

      {manualOrderTarget && (
        <ManualOrderModal
          reservation={manualOrderTarget}
          products={marketProducts}
          onClose={() => setManualOrderTarget(null)}
          onSubmit={(items) => submitManualOrder(manualOrderTarget, items)}
        />
      )}

      {showReportModal && (
        <ReportModal onClose={() => setShowReportModal(false)} />
      )}

      <header className="bg-[#0057a5] text-white sticky top-0 z-20 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-6 h-6 opacity-90" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-75">Gestión Administrativa</p>
              <h1 className="text-lg font-bold leading-tight uppercase">Agenda Fullwork</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setAudioEnabled(!audioEnabled)
                if (!audioEnabled && audioRef.current && typeof document !== 'undefined') {
                  audioRef.current.play().then(() => audioRef.current?.pause())
                }
              }}
              className={`h-10 px-4 rounded-xl border transition-all ${audioEnabled ? 'bg-green-500 text-white border-green-500' : 'bg-white/10 border-white/20 text-white'}`}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4 mr-2 animate-pulse" /> : <VolumeX className="w-4 h-4 mr-2" />}
              <span className="text-[10px] font-black uppercase">{audioEnabled ? 'Sonido Activo' : 'Activar Sonido'}</span>
            </Button>

            <div className="flex items-center bg-white/10 rounded-xl p-1 border border-white/10">
              <Button variant="ghost" size="icon" onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1)))}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="relative">
                <button className="px-4 font-bold text-sm uppercase text-center" onClick={() => setShowCalendar(!showCalendar)}>
                  {DAYS[selectedDate.getDay()]} {selectedDate.getDate()} {MONTHS[selectedDate.getMonth()].slice(0, 3)}
                </button>
                {showCalendar && (
                  <MiniCalendarPicker selectedDate={selectedDate} onSelect={setSelectedDate} onClose={() => setShowCalendar(false)} />
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1)))}>
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            <div className="w-px h-6 bg-white/20 mx-1" />
            <Button
              onClick={() => setShowReportModal(true)}
              className="bg-[#0057a5] hover:bg-[#004080] text-white font-semibold gap-2 border border-white/20"
            >
              <Plus className="w-4 h-4" />
              INFORME
            </Button>

            <MenuAdminModal products={marketProducts} onProductAdded={loadMarketProducts} onProductDeleted={loadMarketProducts} />
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-72px)] overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="p-4 border-none shadow-sm bg-white">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Confirmadas</p>
                <p className="text-3xl font-black text-[#0057a5]">{filteredConfirmed.length}</p>
              </Card>
              <Card className="p-4 border-none shadow-sm bg-white">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Canceladas</p>
                <p className="text-3xl font-black text-slate-300">{filteredCancelled.length}</p>
              </Card>
              <Card className="p-4 border-none shadow-sm bg-white">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Espacios en Uso</p>
                <p className="text-3xl font-black text-green-500">
                  {Object.values(liveStatus).filter(s => s === 'en_curso').length}
                </p>
              </Card>
            </div>

            <div className="space-y-4 mb-10">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Detalle de Reservas</h2>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
                </div>
              ) : [...filteredConfirmed, ...filteredCancelled].length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No hay reservas para mostrar hoy</p>
                </div>
              ) : [...filteredConfirmed, ...filteredCancelled].map((r) => {
                const colors = WORKSPACE_COLORS[r.workspace] || { border: 'border-slate-200', text: 'text-slate-600', bg: 'bg-slate-50' };
                const isCancelled = r.status === 'cancelled';
                const status = liveStatus[r.id] || 'pending';
                const isAlerted = activeAlerts.has(r.id);
                
                const duration = calculateDuration(r.timeFrom, r.timeTo);
                const reservationPrice = (WORKSPACE_PRICES[r.workspace] || 0) * duration;

                // Mostrar pedidos aceptados o entregados para esta reserva
                const deliveredOrders = allOrders.filter(
                  (order: any) =>
                    order.reservation_id === r.id &&
                    (order.status === 'entregado' || order.status === 'aceptado')
                )

                const marketConsumption = deliveredOrders.reduce((acc: number, curr: any) => acc + (Number(curr.total_amount) || 0), 0);

                const isPresencial = !r.receiptUrl;
                const pagadoApp = isPresencial ? 0 : Math.round(reservationPrice * 0.5);

                const saldoEspacioBase = reservationPrice - pagadoApp;

                return (
                  <Card key={r.id} className={`p-5 shadow-md border-none transition-all duration-500 ${isCancelled ? 'opacity-50 bg-slate-100' : isAlerted ? 'bg-orange-50 ring-2 ring-orange-500 animate-pulse' : 'bg-white ring-1 ring-slate-100'}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-1.5 self-stretch rounded-full ${isAlerted ? 'bg-orange-500' : colors.border.replace('border-l-', 'bg-')}`} />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className={`text-sm font-black uppercase tracking-tight ${isAlerted ? 'text-orange-700' : colors.text}`}>
                            {WORKSPACE_LABELS[r.workspace]} {r.deskNumber ? `— N.° ${r.deskNumber}` : ''}
                          </span>
                          
                          <Badge className="text-[9px] font-bold uppercase bg-[#003087] text-white tracking-widest px-2">{r.reservationCode}</Badge>
                          
                          {isPresencial ? (
                            <Badge variant="outline" className="text-[9px] border-blue-200 text-blue-600 font-bold uppercase bg-blue-50/50">Atención Staff</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] border-green-200 text-green-600 font-bold uppercase bg-green-50/50">Reserva App</Badge>
                          )}

                          {status === 'en_curso' && (
                            <Badge className={`${isAlerted ? 'bg-orange-600' : 'bg-green-500'} text-white text-[9px] uppercase font-black`}>
                              {isAlerted ? '¡FINALIZA EN 10 MIN!' : 'En Curso'}
                            </Badge>
                          )}
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl mb-3 border border-slate-100 max-w-lg">
                          <div className="grid grid-cols-2 gap-y-1 text-[10px] font-bold uppercase text-slate-500">
                            <span>Valor Espacio ({duration.toLocaleString('es-AR', { maximumFractionDigits: 2 })} hs):</span>
                            <span className="text-right text-slate-800">{formatPrice(reservationPrice)}</span>

                            {!isPresencial && (
                              <>
                                <span className="text-green-600">Seña Abonada (App):</span>
                                <span className="text-right text-green-600">- {formatPrice(pagadoApp)}</span>
                              </>
                            )}

                            <div className="col-span-2 pt-2 mt-1 border-t border-slate-200 flex justify-between text-[11px] text-slate-900 font-black">
                              <span>SALDO A COBRAR (ESPACIO):</span>
                              <span className="text-[#0057a5] text-sm font-black">{formatPrice(saldoEspacioBase)}</span>
                            </div>

                            {deliveredOrders.length > 0 && (
                              <div className="col-span-2 mt-3 pt-3 border-t border-slate-200 animate-in fade-in space-y-1.5">
                                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">
                                  Consumos Market (Entregados)
                                </p>

                                {deliveredOrders.map((pedido: any) => {
                                  const items = Array.isArray(pedido.items) ? pedido.items : []
                                  return (
                                    <div key={pedido.id} className="bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-2 space-y-1">
                                      {items.length > 0 ? (
                                        items.map((item: any, idx: number) => (
                                          <div key={idx} className="flex justify-between items-center text-[10px] text-slate-700">
                                            <span>{item.quantity}x {item.name}</span>
                                            <span className="font-semibold">{formatPrice(Number(item.subtotal) || Number(item.price) * Number(item.quantity))}</span>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-[10px] text-slate-600">{pedido.customer_name}</div>
                                      )}
                                    </div>
                                  )
                                })}

                                <div className="flex justify-between text-[11px] font-black text-blue-700 border-t border-blue-300 pt-2 mt-2 uppercase tracking-wide">
                                  <span>Total Consumido en Market:</span>
                                  <span>{formatPrice(marketConsumption)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 font-bold">
                          <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" /> {r.timeFrom} - {r.timeTo}</div>
                          <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-400" /> {r.firstName} {r.lastName}</div>
                          <div className="text-[#0057a5] font-black">{r.phone}</div>
                          
                          {r.receiptUrl && (
                            <button 
                              onClick={() => window.open(r.receiptUrl, '_blank')}
                              className="flex items-center gap-1.5 text-green-600 hover:text-green-700 hover:underline transition-all"
                            >
                              <Paperclip className="w-3.5 h-3.5" /> Ver Comprobante
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        {!isCancelled && status === 'en_curso' && (
                          <Button 
                            size="sm" 
                            className="bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase h-8 px-3 rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-1"
                            onClick={(e) => handleManualFinish(r, e)}
                          >
                            <X className="w-3.5 h-3.5" />
                            Finalizar
                          </Button>
                        )}
                        <div className="flex items-center justify-end gap-1">
                          {!isCancelled && (
                            <Button
                              size="icon"
                              variant="outline"
                              title="Cargar consumo manual (WhatsApp / mostrador)"
                              className="text-[#0057a5] border-[#0057a5]/30 h-8 w-8"
                              onClick={() => setManualOrderTarget(r)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          )}
                          {!isCancelled && (
                            <Button size="icon" variant="ghost" className="text-slate-300 hover:text-red-500 transition-colors h-8 w-8" onClick={() => setCancelTarget(r)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
              {[
                { key: null, label: 'TODOS' },
                { key: 'escritorio', label: 'ESCRITORIOS' },
                { key: 'sala', label: 'SALAS' },
                { key: 'oficina', label: 'OFINICAS' },
              ].map(f => (
                <button
                  key={String(f.key)}
                  onClick={() => setWorkspaceFilter(f.key as any)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest border whitespace-nowrap transition-all ${workspaceFilter === f.key ? 'bg-[#0057a5] text-white border-[#0057a5] shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-[#0057a5]'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              {ALL_WORKSPACES.filter(ws => matchesFilter(ws, workspaceFilter)).map(workspace => {
                const wsReservations = confirmed.filter(r => r.workspace === workspace)
                const colors = WORKSPACE_COLORS[workspace]
                return (
                  <Card key={workspace} className="border-none shadow-md overflow-hidden bg-white">
                    <div className={`px-4 py-3 flex items-center gap-2 ${colors.bg}`}>
                      <div className={`w-3 h-3 rounded-full ${colors.border.replace('border-l-', 'bg-')}`} />
                      <span className={`text-xs font-black uppercase tracking-wider ${colors.text}`}>{WORKSPACE_LABELS[workspace]}</span>
                    </div>
                    <div className="relative" style={{ height: totalHeight }}>
                      <div className="absolute inset-0 flex">
                        <div className="w-14 border-r border-slate-100 bg-slate-50/50">
                          {hourLabels.map(h => (
                            <div key={h} className="text-[9px] font-bold text-slate-400 text-right pr-2" style={{ height: PX_PER_HOUR, paddingTop: 4 }}>
                              {String(h).padStart(2, '0')}:00
                            </div>
                          ))}
                        </div>
                        <div className="flex-1 relative">
                          {hourLabels.map(h => (
                            <div key={h} className="border-t border-slate-100 w-full cursor-pointer hover:bg-slate-50 transition-colors" 
                                 style={{ height: PX_PER_HOUR }} onClick={() => setQuickReservation({ workspace, hour: h })} />
                          ))}
                          {wsReservations.map(r => {
                            const startMin = toMinutes(r.timeFrom) - START_HOUR * 60
                            const durMin = toMinutes(r.timeTo) - toMinutes(r.timeFrom)
                            const alerted = activeAlerts.has(r.id)
                            return (
                              <div 
                                key={r.id} 
                                className={`absolute inset-x-1 rounded-lg border-l-4 px-3 py-2 shadow-sm transition-all ${colors.bg} ${colors.border} ${alerted ? 'ring-2 ring-orange-500 animate-pulse' : ''}`}
                                style={{ top: (startMin / 60) * PX_PER_HOUR, height: (durMin / 60) * PX_PER_HOUR }}
                                onClick={(e) => { e.stopPropagation(); setCancelTarget(r) }}
                              >
                                <p className={`text-[11px] font-black uppercase truncate ${colors.text}`}>{r.firstName} {r.lastName}</p>
                                <p className="text-[10px] font-bold opacity-60">{r.timeFrom} - {r.timeTo}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        </main>

<OrdersSidebar 
  reservations={reservations} 
  onNewOrder={playAlertSound} 
  onOrderUpdated={() => {
    // Re-fetch orders from the 'orders' table to update deliveredOrders in cards
    loadOrders()
  }} 
/>

      {toasts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4">
          {toasts.map(t => (
            <div key={t.id} className="bg-orange-600 text-white rounded-2xl p-4 shadow-2xl flex items-start gap-3 animate-in slide-in-from-bottom-4">
              <Bell className="w-5 h-5 animate-bounce" />
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase mb-1 tracking-widest">Alerta de Tiempo</p>
                <p className="text-sm font-bold">La reserva {t.code} termina en 10 min.</p>
              </div>
              <button onClick={() => dismissToast(t.id)}><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  )
}
