'use client'

import { YpfPointsTip, YPF_POINTS_TEXT, YPF_POINTS_STAFF } from '@/components/ypf-points-tip'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { pickFreeCode } from '@/lib/codes'
import { Reservation, WorkspaceType, WORKSPACE_LABELS, WORKSPACE_PRICES, ReservationStatus, timeRangesOverlap, getBlockedWorkspaces } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, Clock, User, CalendarDays, Plus, X, Trash2, AlertTriangle, Paperclip, Bell, ShoppingBag, Volume2, VolumeX, Minus, FileBarChart, Download, Loader2, LogOut, ChevronDown, Search, Pencil } from 'lucide-react'
import { MenuAdminModal } from '@/components/staff/menu-admin-modal'
import { OrdersSidebar } from '@/components/staff/orders-sidebar'
import { StaffToolbar, ExtensionsModal, SettingsModal, BenefitModal, SearchModal, FeedbackModal, CashPayments, useExtensions, useFeedbackCount, type CashPayment } from '@/components/staff/staff-tools'
import { ClientsModal, AgeSelect } from '@/components/staff/clients-modal'
import { AGE_RANGES, ageRange as ageFromDni } from '@/lib/age'

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

function formatHours(decimalHours: number): string {
  const totalMinutes = Math.round(decimalHours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
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
    actualTimeTo: row.actual_time_to as string | undefined,
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    market_orders: Array.isArray(row.market_orders) ? row.market_orders : undefined,
    extraHours: Number(row.extra_hours || 0),
    extraPaid: Number(row.extra_paid || 0),
    extraAmount: Number(row.extra_amount || 0),
    isPresent: row.is_present as boolean | undefined,
    autoFinalized: !!row.auto_finalized,
    dni: (row.dni as string | null) ?? null,
    ageRangeStaff: (row.age_range_staff as string | null) ?? null,
    priceTotal: row.price_total != null ? Number(row.price_total) : null,
    comboName: (row.combo_name as string | null) ?? null,
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
  onSubmit: (data: { firstName: string; lastName: string; phone: string; timeFrom: string; timeTo: string; deskNumber?: number; dni?: string; ageRangeStaff?: string }) => Promise<true | string>
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

function QuickReservationModal({ workspace, hour, onClose, onSubmit }: QuickReservationModalProps) {
  const [firstName, setFirstName] = useState(''); const [lastName, setLastName] = useState(''); const [phone, setPhone] = useState(''); const [dni, setDni] = useState(''); const [ageStaff, setAgeStaff] = useState<string | null>(null); const [deskNumber, setDeskNumber] = useState<number>(1)
  const initialFrom = `${String(hour).padStart(2, '0')}:00`; const initialTo = `${String(Math.min(hour + 1, END_HOUR)).padStart(2, '0')}:00`
  const [timeFrom, setTimeFrom] = useState(initialFrom); const [timeTo, setTimeTo] = useState(initialTo);
  const [submitting, setSubmitting] = useState(false); const [error, setError] = useState('')
  const fromSlots = buildSlots(START_HOUR, END_HOUR - 1); const toSlots = buildSlots(START_HOUR, END_HOUR).filter(s => s > timeFrom)

  // Autocompletar: al escribir el teléfono (o el nombre) busca clientes que ya vinieron y completa los datos
  const [lookup, setLookup] = useState('')
  const [suggestions, setSuggestions] = useState<{ firstName: string; lastName: string; phone: string; lastDate: string; visits: number; dni?: string | null; ageRangeStaff?: string | null }[]>([])
  const [picked, setPicked] = useState(false)
  useEffect(() => {
    const q = lookup.trim()
    const digits = q.replace(/\D/g, '')
    if (picked || (digits.length < 4 && q.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/g, '').length < 2)) { setSuggestions([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/staff/clients?q=${encodeURIComponent(q)}`, { signal: ctrl.signal, cache: 'no-store' })
        .then(r => r.ok ? r.json() : { clients: [] }).then(d => setSuggestions(d.clients || [])).catch(() => {})
    }, 250)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [lookup, picked])
  const pickClient = (c: { firstName: string; lastName: string; phone: string; dni?: string | null; ageRangeStaff?: string | null }) => {
    setFirstName(c.firstName); setLastName(c.lastName); setPhone(c.phone); if (c.dni) setDni(c.dni); if (c.ageRangeStaff) setAgeStaff(c.ageRangeStaff); setPicked(true); setSuggestions([])
  }
  const typing = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { setter(e.target.value); setLookup(e.target.value); setPicked(false) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !phone.trim()) { setError('Nombre y telefono son obligatorios'); return }
    setSubmitting(true); setError('')
    const res = await onSubmit({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), timeFrom, timeTo, deskNumber: workspace === 'escritorio' ? deskNumber : undefined, dni: dni.replace(/\D/g, '') || undefined, ageRangeStaff: ageStaff || undefined })
    setSubmitting(false); if (res === true) onClose(); else setError(res)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <Card className="p-6 max-w-md w-full border-0 shadow-2xl">
        <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><Plus className="w-5 h-5 text-primary" /><h3 className="font-semibold text-foreground">Reserva Rápida</h3></div><button onClick={onClose} className="text-muted-foreground"><X className="w-5 h-5" /></button></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {workspace === 'escritorio' && (<div className="grid grid-cols-6 gap-2">{Array.from({ length: 12 }, (_, i) => i + 1).map(num => (<button key={num} type="button" onClick={() => setDeskNumber(num)} className={['h-10 rounded-lg text-sm font-semibold border-2', deskNumber === num ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-transparent'].join(' ')}>{num}</button>))}</div>)}
          <div className="grid grid-cols-2 gap-3"><TimeCombo label="Desde" value={timeFrom} onChange={v => { setTimeFrom(v); if (timeTo <= v) setTimeTo(buildSlots(START_HOUR, END_HOUR).find(s => s > v) || v) }} slots={fromSlots} /><TimeCombo label="Hasta" value={timeTo} onChange={setTimeTo} slots={toSlots} /></div>
          <div>
            <Input value={phone} onChange={typing(setPhone)} placeholder="Teléfono * (si ya vino, se completa solo)" type="tel" autoComplete="off" aria-label="Teléfono" />
            <p className="text-[11px] text-slate-500 mt-1">Escribí el teléfono o el nombre: si el cliente ya vino, aparece abajo para elegirlo.</p>
          </div>
          {suggestions.length > 0 && (
            <div className="rounded-xl border border-[#0057a5]/30 bg-blue-50/60 p-2 space-y-1" role="listbox" aria-label="Clientes que ya vinieron">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#0057a5] px-1">Ya vinieron · tocá para completar</p>
              {suggestions.map(c => (
                <button key={c.phone + c.firstName} type="button" role="option" aria-selected={false} onClick={() => pickClient(c)}
                  className="w-full flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-left hover:ring-2 hover:ring-[#0057a5]">
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-800 truncate">{c.firstName} {c.lastName}</span>
                    <span className="block text-xs text-slate-500">{c.phone}</span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 text-right flex-shrink-0">{c.visits} {c.visits === 1 ? 'reserva' : 'reservas'}<br />última {c.lastDate.split('-').reverse().slice(0, 2).join('/')}</span>
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input value={firstName} onChange={typing(setFirstName)} placeholder="Nombre *" autoComplete="off" aria-label="Nombre" />
            <Input value={lastName} onChange={typing(setLastName)} placeholder="Apellido" autoComplete="off" aria-label="Apellido" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1.5">Edad aprox. <span className="font-normal text-slate-500">(la estimás vos, no hace falta preguntar)</span></p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Edad aproximada">
              {AGE_RANGES.filter(r => r !== 'Menos de 18').map(r => (
                <button key={r} type="button" aria-pressed={ageStaff === r} onClick={() => setAgeStaff(ageStaff === r ? null : r)}
                  className={`h-8 px-2.5 rounded-full text-xs font-bold border ${ageStaff === r ? 'bg-[#0057a5] text-white border-[#0057a5]' : 'bg-white text-slate-600 border-slate-200'}`}>{r}</button>
              ))}
            </div>
          </div>
          <Input value={dni} onChange={e => setDni(e.target.value)} placeholder="DNI (opcional, si el cliente lo da)" inputMode="numeric" autoComplete="off" aria-label="DNI" />
          {picked && <p className="text-xs font-semibold text-green-700">✓ Datos completados de una reserva anterior. Podés corregirlos si hace falta.</p>}
          {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2"><Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button><Button type="submit" className="flex-1" disabled={submitting}>Guardar</Button></div>
        </form>
      </Card>
    </div>
  )
}

interface CreatedInfo { code: string; firstName: string; lastName: string; phone: string; place: string; date: Date; timeFrom: string; timeTo: string }

// Cartel que aparece al cargar una reserva desde el staff: el código bien grande para dárselo al cliente
function CreatedReservationModal({ info, onClose }: { info: CreatedInfo; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const fecha = `${DAYS[info.date.getDay()].toLowerCase()} ${info.date.getDate()}/${info.date.getMonth() + 1}`
  const msg = `¡Hola ${info.firstName}! Tu reserva en Fullwork quedó confirmada: ${info.place}, ${fecha} de ${info.timeFrom} a ${info.timeTo}. Tu código para entrar a la pizarra es ${info.code}. Al pagar en caja, cargá tus puntos en la App YPF: tu consumo también suma.`
  const digits = info.phone.replace(/\D/g, '').slice(-10)
  const wa = digits.length === 10 ? `https://wa.me/549${digits}?text=${encodeURIComponent(msg)}` : null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-label="Reserva cargada">
      <Card className="p-6 max-w-sm w-full border-0 shadow-2xl text-center">
        <p className="text-xs font-black uppercase tracking-widest text-green-700">✓ Reserva cargada</p>
        <p className="text-lg font-bold text-slate-900 mt-2">{info.firstName} {info.lastName}</p>
        <p className="text-sm text-[#0057a5] font-bold">{info.phone}</p>
        <p className="text-sm text-slate-600 mt-1">{info.place} · {fecha} · {info.timeFrom} a {info.timeTo}</p>
        <div className="my-5 rounded-2xl bg-[#0057a5] text-white py-5">
          <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">Código de reserva</p>
          <p className="text-6xl font-black tracking-wider mt-1" data-testid="codigo-creado">{info.code}</p>
        </div>
        <p className="text-xs text-slate-500 mb-4">Dáselo al cliente: lo usa para entrar a la pizarra.</p>
        <div className="grid gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold flex items-center justify-center">Enviar por WhatsApp</a>
          )}
          <Button type="button" variant="outline" onClick={() => { navigator.clipboard?.writeText(msg).then(() => setCopied(true)).catch(() => {}) }}>
            {copied ? '✓ Mensaje copiado' : 'Copiar mensaje'}
          </Button>
          <Button type="button" onClick={onClose}>Listo</Button>
        </div>
      </Card>
    </div>
  )
}

// Nombre del cliente con lápiz para corregirlo si se cargó mal (en esta y en todas sus reservas)
function EditableName({ r, onSaved }: { r: Reservation; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [first, setFirst] = useState(r.firstName)
  const [last, setLast] = useState(r.lastName)
  const [all, setAll] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (!editing) return (
    <div className="flex items-center gap-1.5">
      <User className="w-3.5 h-3.5 text-slate-400" /> {r.firstName} {r.lastName}
      <button type="button" onClick={() => { setFirst(r.firstName); setLast(r.lastName); setEditing(true) }} title="Corregir el nombre" aria-label="Corregir el nombre"
        className="ml-0.5 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-[#0057a5] hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
    </div>
  )
  const save = async () => {
    setBusy(true); setErr('')
    const res = await fetch('/api/staff/client-name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reservationId: r.id, firstName: first, lastName: last, all }) })
    setBusy(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || 'No se pudo guardar'); return }
    setEditing(false); onSaved()
  }
  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-2 space-y-2 normal-case font-normal">
      <div className="grid grid-cols-2 gap-2">
        <Input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Nombre" aria-label="Nombre" className="h-9" />
        <Input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Apellido" aria-label="Apellido" className="h-9" />
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="w-4 h-4 accent-[#0057a5]" /> Corregirlo en todas sus reservas (mismo teléfono)</label>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
        <Button type="button" size="sm" onClick={save} disabled={busy || !first.trim()}>{busy ? 'Guardando…' : 'Guardar nombre'}</Button>
      </div>
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

function FinalizeModal({ reservation, onClose, onConfirm }: { reservation: Reservation; onClose: () => void; onConfirm: (time: string) => Promise<void> }) {
  const [time, setTime] = useState(reservation.timeTo)
  const [saving, setSaving] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <Card className="p-6 max-w-sm w-full border-0 shadow-2xl text-center">
        <Clock className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <h3 className="font-bold text-lg mb-2 uppercase">Finalizar Reserva</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Confirmá la hora real de salida de <b>{reservation.firstName}</b>.
        </p>
        <div className="mb-6 text-left">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Hora de salida</label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Volver</Button>
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            onClick={async () => { setSaving(true); await onConfirm(time); setSaving(false) }}
            disabled={saving}
          >
            {saving ? '...' : 'Finalizar'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

interface ManualOrderModalProps {
  reservation: Reservation
  products: { id: string; name: string; price: number; image_url: string | null; category?: string | null }[]
  onClose: () => void
  onSubmit: (items: { name: string; price: number; quantity: number; subtotal: number }[]) => Promise<boolean>
}

function ManualOrderModal({ reservation, products, onClose, onSubmit }: ManualOrderModalProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // buscador: por nombre o categoría, sin importar tildes ni mayúsculas
  const [search, setSearch] = useState('')
  const normText = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const sq = normText(search.trim())
  const shownProducts = sq ? products.filter((p: any) => normText(`${p.name} ${p.category || ''}`).includes(sq)) : products

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

        {products.length > 0 && (
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto: café, tostado…" aria-label="Buscar producto" className="pl-9 h-11" />
          </div>
        )}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No hay productos cargados en el Market todavía.</p>
          ) : sq && shownProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Ningún producto coincide con "{search.trim()}".</p>
          ) : shownProducts.map(p => (
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

        {selectedItems.length > 0 && (
          <p className="text-xs text-slate-600 mt-3"><b>Elegido:</b> {selectedItems.map(i => `${i.quantity}x ${i.name}`).join(', ')}</p>
        )}
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
    total: number; confirmed: number; completed: number; cancelled: number; other: number; revenue: number; totalHours: number
    bySource: { app: { count: number; hours: number }; staff: { count: number; hours: number } }
  }
  market: {
    orderCount: number; revenue: number
    bySource: { app: { count: number; revenue: number }; staff: { count: number; revenue: number } }
    products: { name: string; quantity: number; revenue: number }[]
  }
  totalRevenue: number
  planFullTotal?: number
  insights?: any
  byAge?: { range: string; reservations: number; clients: number; hours: number; espacio: number; market: number }[]
  cashPayments?: { total: number; count: number; byMethod: { method: string; total: number }[] }
  feedback?: {
    count: number; average: number | null; byStars: { stars: number; count: number }[]
    items: { date: string; customer: string; rating: number; comment: string; visitDate: string; workspace: string; deskNumber: number | string }[]
  }
  reservationsDetail: {
    date: string; code: string; workspace: string; deskNumber: number | string
    timeFrom: string; timeTo: string; hours: number
    firstName: string; lastName: string; phone: string; ageRange?: string
    source: 'app' | 'staff'; status: string
    espacioRevenue: number; marketConsumption: number; total: number
  }[]
}

// "Resumen para decidir": lo que le sirve al dueño para tomar decisiones
function InsightsView({ ins }: { ins: any }) {
  const pctTxt = (n: number | null) => (n == null ? 'sin datos antes' : `${n > 0 ? '+' : ''}${n.toLocaleString('es-AR')}%`)
  const money = new Set(['espacio', 'market', 'planFull', 'avgConsumo'])
  const maxHour = Math.max(1, ...ins.byHour.map((h: any) => h.people))
  const maxDay = Math.max(1, ...ins.byWeekday.map((d: any) => d.hours))
  const maxDesk = Math.max(1, ...ins.desks.map((d: any) => d.hours))
  const Bar = ({ value, max, color = 'bg-[#0057a5]' }: { value: number; max: number; color?: string }) => (
    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden flex-1"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>
  )
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-[#0057a5] p-4 bg-blue-50/40">
        <p className="text-xs font-black uppercase tracking-widest text-[#0057a5] mb-2">Resumen para decidir</p>
        <ul className="space-y-1.5 text-sm text-slate-800 list-disc pl-5">
          {ins.tips.map((t: string, i: number) => <li key={i}>{t}</li>)}
        </ul>
      </div>

      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Contra el período anterior <span className="normal-case font-semibold tracking-normal">({ins.comparison.previousRange.from.split('-').reverse().join('/')} al {ins.comparison.previousRange.to.split('-').reverse().join('/')})</span></p>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1 text-xs">
          <span className="font-bold text-slate-500">Qué</span><span className="font-bold text-slate-500 text-right">Antes</span><span className="font-bold text-slate-500 text-right">Ahora</span><span className="font-bold text-slate-500 text-right">Cambio</span>
          {ins.comparison.rows.map((r: any) => (
            <React.Fragment key={r.key}>
              <span className="text-slate-700">{r.label}</span>
              <span className="text-right text-slate-500">{money.has(r.key) ? formatPrice(r.previous) : r.previous.toLocaleString('es-AR')}</span>
              <span className="text-right font-bold">{money.has(r.key) ? formatPrice(r.current) : r.current.toLocaleString('es-AR')}</span>
              <span className={`text-right font-bold ${r.change == null ? 'text-slate-400' : (r.key === 'cancelled' ? r.change <= 0 : r.change >= 0) ? 'text-green-700' : 'text-red-600'}`}>{pctTxt(r.change)}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Ocupación por espacio</p>
          <div className="space-y-1.5">
            {ins.occupancy.map((o: any) => (
              <div key={o.workspace} className="flex items-center gap-2 text-xs">
                <span className="w-36 text-slate-700 truncate">{o.label}</span>
                <Bar value={o.percent} max={100} color={o.percent >= 60 ? 'bg-green-600' : o.percent >= 25 ? 'bg-[#0057a5]' : 'bg-amber-500'} />
                <span className="w-12 text-right font-bold">{o.percent.toLocaleString('es-AR')}%</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{ins.note}</p>
        </div>
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Escritorios más pedidos (horas)</p>
          <div className="space-y-1">
            {ins.desks.map((d: any) => (
              <div key={d.desk} className="flex items-center gap-2 text-xs">
                <span className="w-10 text-slate-700">N.° {d.desk}</span>
                <Bar value={d.hours} max={maxDesk} />
                <span className="w-10 text-right font-bold">{d.hours.toLocaleString('es-AR')} h</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Gente por hora (promedio)</p>
          <div className="flex items-end gap-1 h-24">
            {ins.byHour.map((h: any) => (
              <div key={h.hour} className="flex-1 flex flex-col items-center justify-end h-full" title={`${h.hour} a ${h.hour + 1} h: ${h.people} personas`}>
                <div className="w-full rounded-t bg-[#0057a5]" style={{ height: `${(h.people / maxHour) * 100}%`, minHeight: h.people > 0 ? 2 : 0 }} />
                <span className="text-[9px] text-slate-500 mt-0.5">{h.hour}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Horas por día de la semana</p>
          <div className="space-y-1">
            {[1, 2, 3, 4, 5, 6, 0].map((i) => ins.byWeekday[i]).map((d: any) => (
              <div key={d.day} className="flex items-center gap-2 text-xs">
                <span className="w-20 text-slate-700 capitalize">{d.day}</span>
                <Bar value={d.hours} max={maxDay} />
                <span className="w-10 text-right font-bold">{d.hours.toLocaleString('es-AR')} h</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3 text-xs">
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
          <p className="font-black text-slate-400 uppercase tracking-widest mb-1">Lo más consumido</p>
          {ins.topProducts.length === 0 ? <p className="text-slate-500">Sin consumo.</p> : ins.topProducts.map((p: any, i: number) => (
            <p key={p.name}><b>{i + 1}.</b> {p.name} <span className="text-slate-500">· {p.quantity} u · {formatPrice(p.revenue)}</span></p>
          ))}
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
          <p className="font-black text-slate-400 uppercase tracking-widest mb-1">Clientes</p>
          <p><b>{ins.clients.total}</b> distintos · <b>{ins.clients.new}</b> nuevos · <b>{ins.clients.returning}</b> volvieron</p>
          <p className="text-slate-500">{ins.clients.visitsPerClient.toLocaleString('es-AR')} {ins.clients.visitsPerClient === 1 ? 'visita' : 'visitas'} por cliente</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
          <p className="font-black text-slate-400 uppercase tracking-widest mb-1">Consumo (Plan FULL)</p>
          <p><b>{ins.consumption.percentWithConsumption.toLocaleString('es-AR')}%</b> de las visitas pidió algo</p>
          <p><b>{ins.consumption.percentOverSpace.toLocaleString('es-AR')}%</b> consumió más que su espacio</p>
          <p className="text-slate-500">Saldo sin usar: {formatPrice(ins.consumption.unusedCredit)}</p>
        </div>
        {ins.combos.length > 0 && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <p className="font-black text-slate-400 uppercase tracking-widest mb-1">Combos usados</p>
            {ins.combos.map((c: any) => <p key={c.name}>{c.name}: <b>{c.count}</b></p>)}
          </div>
        )}
        {ins.benefitsUsed.length > 0 && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <p className="font-black text-slate-400 uppercase tracking-widest mb-1">Beneficios entregados</p>
            {ins.benefitsUsed.map((b: any) => <p key={b.description}>{b.description}: <b>{b.count}</b></p>)}
          </div>
        )}
      </div>
    </div>
  )
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

  // PDF con los colores de YPF (se arma en el navegador)
  const [pdfBusy, setPdfBusy] = useState(false)
  const downloadPdf = async () => {
    if (!summary) return
    setPdfBusy(true); setError('')
    try {
      const { downloadReportPdf } = await import('@/components/staff/report-pdf')
      await downloadReportPdf(summary, { price: formatPrice, hours: formatHours, workspace: (w) => WORKSPACE_LABELS[w as WorkspaceType] || w })
    } catch (e) {
      console.error(e); setError('No se pudo armar el PDF. Probá de nuevo o descargá el Excel.')
    } finally { setPdfBusy(false) }
  }

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

    const ins = summary.insights
    if (ins) {
      rows += section('RESUMEN PARA DECIDIR')
      ins.tips.forEach((t: string) => { rows += `<tr><td colspan="15" style="padding:4px 10px;font-size:12px;">• ${escHtml(t)}</td></tr>` })
      rows += blankRow
      rows += section(`CONTRA EL PERÍODO ANTERIOR (${ins.comparison.previousRange.from} a ${ins.comparison.previousRange.to})`)
      rows += headerRow(['Qué', 'Antes', 'Ahora', 'Cambio'])
      const money = new Set(['espacio', 'market', 'planFull', 'avgConsumo'])
      ins.comparison.rows.forEach((x: any) => { rows += dataRow([x.label, money.has(x.key) ? formatPrice(x.previous) : x.previous, money.has(x.key) ? formatPrice(x.current) : x.current, x.change == null ? '-' : `${x.change > 0 ? '+' : ''}${x.change}%`]) })
      rows += blankRow
      rows += section('OCUPACIÓN POR ESPACIO')
      rows += headerRow(['Espacio', 'Reservas', 'Horas reservadas', 'Ocupación %'])
      ins.occupancy.forEach((o: any) => { rows += dataRow([o.label, o.reservations, o.hours, `${o.percent}%`]) })
      rows += `<tr><td colspan="15" style="padding:2px 10px;font-size:10px;color:#64748b;">${escHtml(ins.note)}</td></tr>`
      rows += blankRow
      rows += section('ESCRITORIOS MÁS PEDIDOS')
      rows += headerRow(['Escritorio', 'Reservas', 'Horas'])
      ins.desks.forEach((d: any) => { rows += dataRow([`N° ${d.desk}`, d.reservations, d.hours]) })
      rows += blankRow
      rows += section('GENTE POR HORA (promedio) Y POR DÍA')
      rows += headerRow(['Franja', 'Personas en promedio'])
      ins.byHour.forEach((h: any) => { rows += dataRow([`${h.hour} a ${h.hour + 1} h`, h.people]) })
      rows += headerRow(['Día', 'Reservas', 'Horas'])
      ;[1, 2, 3, 4, 5, 6, 0].forEach((i) => { const d = ins.byWeekday[i]; rows += dataRow([d.day, d.reservations, d.hours]) })
      rows += blankRow
      rows += section('CLIENTES Y CONSUMO')
      rows += dataRow(['Clientes distintos', ins.clients.total]); rows += dataRow(['Nuevos', ins.clients.new]); rows += dataRow(['Volvieron', ins.clients.returning])
      rows += dataRow(['Visitas por cliente', ins.clients.visitsPerClient])
      rows += dataRow(['% visitas que pidieron algo', `${ins.consumption.percentWithConsumption}%`])
      rows += dataRow(['% visitas que consumieron más que el espacio', `${ins.consumption.percentOverSpace}%`])
      rows += dataRow(['Saldo a favor sin usar', formatPrice(ins.consumption.unusedCredit)])
      ins.combos.forEach((c: any) => { rows += dataRow([`Combo ${c.name}`, c.count]) })
      ins.benefitsUsed.forEach((b: any) => { rows += dataRow([`Beneficio: ${b.description}`, b.count]) })
      rows += blankRow
    }

    rows += section('RESERVAS')
    rows += headerRow(['Total', 'Confirmadas', 'Canceladas', 'Reservas App', 'Horas App', 'Reservas Staff', 'Horas Staff', 'Horas Totales', 'Facturado Espacios'])
    rows += dataRow([
      summary.reservations.total, summary.reservations.confirmed, summary.reservations.cancelled,
      summary.reservations.bySource.app.count, formatHours(summary.reservations.bySource.app.hours),
      summary.reservations.bySource.staff.count, formatHours(summary.reservations.bySource.staff.hours),
      formatHours(summary.reservations.totalHours), formatPrice(summary.reservations.revenue),
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

    rows += `<tr><td colspan="2" style="background:#0057a5;color:#fff;font-weight:bold;padding:8px;">TOTAL GENERAL (espacio + market)</td><td style="background:#0057a5;color:#fff;font-weight:bold;padding:8px;">${escHtml(formatPrice(summary.totalRevenue))}</td></tr>`
    if (summary.planFullTotal != null) rows += `<tr><td colspan="2" style="background:#e6f0fa;font-weight:bold;padding:8px;">TOTAL CON PLAN FULL (el consumo cubre el espacio)</td><td style="background:#e6f0fa;font-weight:bold;padding:8px;">${escHtml(formatPrice(summary.planFullTotal))}</td></tr>`
    rows += blankRow

    rows += section('DETALLE DE RESERVAS')
    rows += headerRow(['Fecha', 'Código', 'Espacio', 'N° Escritorio', 'Desde', 'Hasta', 'Horas', 'Nombre', 'Apellido', 'Teléfono', 'Edad aprox.', 'Origen', 'Estado', 'Facturado Espacio', 'Consumo Market', 'Total'])
    summary.reservationsDetail.forEach(r => {
      const workspaceLabel = WORKSPACE_LABELS[r.workspace as WorkspaceType] || r.workspace
      const origen = r.source === 'app' ? 'App' : 'Staff'
        const estado = r.status === 'confirmed' ? 'Confirmada' : r.status === 'completed' ? 'Completada' : r.status === 'cancelled' ? 'Cancelada' : r.status
      rows += dataRow([
        r.date, r.code, workspaceLabel, r.deskNumber, r.timeFrom, r.timeTo, formatHours(r.hours),
        r.firstName, r.lastName, r.phone, r.ageRange || 'Sin dato', origen, estado,
        formatPrice(r.espacioRevenue), formatPrice(r.marketConsumption), formatPrice(r.total),
      ])
    })

    if (summary.byAge && summary.byAge.length > 0) {
      rows += blankRow
      rows += section('POR RANGO DE EDAD (aprox., según DNI)')
      rows += headerRow(['Rango de edad', 'Clientes', 'Reservas', 'Horas', 'Valor espacios', 'Consumo Market'])
      summary.byAge.forEach((a) => { rows += dataRow([a.range, a.clients, a.reservations, formatHours(a.hours), formatPrice(a.espacio), formatPrice(a.market)]) })
    }

    if (summary.cashPayments && summary.cashPayments.count > 0) {
      rows += blankRow
      rows += section('COBRADO REGISTRADO EN CAJA')
      rows += headerRow(['Pagos', 'Total', 'Efectivo', 'Transferencia', 'MercadoPago', 'Tarjeta'])
      rows += dataRow([summary.cashPayments.count, formatPrice(summary.cashPayments.total), ...summary.cashPayments.byMethod.map((m) => formatPrice(m.total))])
    }
    if (summary.feedback) {
      rows += blankRow
      rows += section('OPINIONES DE LOS CLIENTES')
      rows += headerRow(['Cantidad', 'Promedio (1 a 5)', '5 estrellas', '4', '3', '2', '1'])
      rows += dataRow([summary.feedback.count, summary.feedback.average ?? '-', ...summary.feedback.byStars.map((b) => b.count)])
      rows += blankRow
      rows += headerRow(['Fecha', 'Cliente', 'Estrellas', 'Comentario', 'Visita', 'Espacio'])
      summary.feedback.items.forEach((f) => {
        const ws = (WORKSPACE_LABELS[f.workspace as WorkspaceType] || f.workspace) + (f.deskNumber ? ` N.° ${f.deskNumber}` : '')
        rows += dataRow([f.date, f.customer, '★'.repeat(f.rating), f.comment, f.visitDate, ws])
      })
    }

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
      <Card className="p-6 max-w-3xl w-full border-0 shadow-2xl max-h-[90vh] flex flex-col">
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
            {summary.insights && <InsightsView ins={summary.insights} />}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reservas</p>
                <p className="text-2xl font-black text-[#0057a5]">{summary.reservations.total}</p>
                <p className="text-[10px] text-slate-500 mt-1">{summary.reservations.confirmed} confirmadas · {summary.reservations.completed} completadas · {summary.reservations.cancelled} canceladas</p>
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
                <p className="text-lg font-black text-foreground">{formatHours(summary.reservations.totalHours)}</p>
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
              <span className="text-xs font-black uppercase tracking-widest text-[#0057a5]">Total General <span className="normal-case font-semibold tracking-normal">(espacio + market)</span></span>
              <span className="text-xl font-black text-[#0057a5]">{formatPrice(summary.totalRevenue)}</span>
            </div>
            {summary.planFullTotal != null && (
              <div className="flex justify-between items-center text-sm bg-blue-50 rounded-lg px-3 py-2 -mt-2">
                <span className="text-slate-700">Con <b>Plan FULL</b> (el consumo cubre el espacio)</span>
                <span className="font-black text-[#0057a5]">{formatPrice(summary.planFullTotal)}</span>
              </div>
            )}

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

            {summary.byAge && summary.byAge.length > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Por rango de edad <span className="normal-case font-semibold tracking-normal">(aprox., según DNI)</span></p>
                <div className="space-y-1">
                  {summary.byAge.map((a) => (
                    <div key={a.range} className="flex justify-between items-center text-xs border-b border-slate-100 py-1.5">
                      <span className="text-slate-700"><b>{a.range}</b> · {a.clients} {a.clients === 1 ? 'cliente' : 'clientes'} · {a.reservations} reservas</span>
                      <span className="font-semibold text-slate-800">Market {formatPrice(a.market)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summary.cashPayments && summary.cashPayments.count > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Cobrado registrado en caja</p>
                <p className="text-sm font-bold">{formatPrice(summary.cashPayments.total)} <span className="font-normal text-slate-500">en {summary.cashPayments.count} pagos</span></p>
                <p className="text-xs text-slate-600">{summary.cashPayments.byMethod.filter((m) => m.total > 0).map((m) => `${({ efectivo: 'Efectivo', transferencia: 'Transferencia', mercadopago: 'MercadoPago', tarjeta: 'Tarjeta' } as Record<string, string>)[m.method]}: ${formatPrice(m.total)}`).join(' · ')}</p>
              </div>
            )}

            {summary.feedback && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Opiniones de los clientes</p>
                {summary.feedback.count === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin opiniones en este rango.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm"><b className="text-amber-600 text-lg">{summary.feedback.average?.toLocaleString('es-AR')}</b> de 5 · {summary.feedback.count} {summary.feedback.count === 1 ? 'opinión' : 'opiniones'}</p>
                    {summary.feedback.items.slice(0, 5).map((f, i) => (
                      <div key={i} className="text-xs border-b border-slate-100 pb-1.5">
                        <span className="text-amber-500">{'★'.repeat(f.rating)}</span> <b>{f.customer}</b>{f.comment ? `: "${f.comment}"` : ''}
                      </div>
                    ))}
                    {summary.feedback.count > 5 && <p className="text-[11px] text-slate-500">Todas están en el PDF y en el Excel.</p>}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" onClick={downloadPdf} disabled={pdfBusy} className="w-full bg-[#0057a5] hover:bg-[#004080] text-white">
                {pdfBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileBarChart className="w-4 h-4 mr-2" />} Descargar PDF
              </Button>
              <Button type="button" variant="outline" onClick={downloadExcel} className="w-full">
                <Download className="w-4 h-4 mr-2" /> Descargar Excel
              </Button>
            </div>
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
  const [finalizeTarget, setFinalizeTarget] = useState<Reservation | null>(null)
  const [showCalendar, setShowCalendar] = useState(false); const [workspaceFilter, setWorkspaceFilter] = useState<'escritorio' | 'sala' | 'oficina' | null>(null)
  const alertedIdsRef = useRef<Set<string>>(new Set()); const [activeAlerts, setActiveAlerts] = useState<Set<string>>(new Set());
  const [liveStatus, setLiveStatus] = useState<Record<string, 'pending' | 'en_curso' | 'finalizada'>>({})
  const lastAutoFinalizeRef = useRef(0)
  const [createdReservation, setCreatedReservation] = useState<CreatedInfo | null>(null) // cartel con el código al cargar una reserva
  const loadForDateRef = useRef<((d: Date, silent?: boolean) => any) | null>(null)
  const [showDone, setShowDone] = useState(false) // sección "Ya se fueron" desplegada
  const [openDoneId, setOpenDoneId] = useState<string | null>(null) // reserva terminada abierta en grande
  const [toasts, setToasts] = useState<{ id: string; code: string }[]>([]);
  const [marketProducts, setMarketProducts] = useState<{ id: string; name: string; price: number; image_url: string | null }[]>([])
  const [manualOrderTarget, setManualOrderTarget] = useState<Reservation | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [toolModal, setToolModal] = useState<null | 'extensions' | 'settings' | 'benefit' | 'search' | 'feedback' | 'clients'>(null)
  // Precios por hora actuales (los que fija el staff en Ajustes)
  const [prices, setPrices] = useState<Record<WorkspaceType, number>>({ ...WORKSPACE_PRICES })
  const loadPrices = useCallback(() => { fetch('/api/public/pricing', { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((d) => { if (d?.prices) setPrices(d.prices) }).catch(() => {}) }, [])
  useEffect(() => { loadPrices() }, [loadPrices])

  const [allOrders, setAllOrders] = useState<any[]>([])

  const [audioEnabled, setAudioEnabledState] = useState(false);
  // Se recuerda en esta compu: si el staff dejó el sonido activo, al volver a abrir el panel sigue activo
  useEffect(() => { try { if (localStorage.getItem('fw_staff_sound') === 'on') setAudioEnabledState(true) } catch {} }, [])
  const setAudioEnabled = (v: boolean) => { setAudioEnabledState(v); try { localStorage.setItem('fw_staff_sound', v ? 'on' : 'off') } catch {} }
  // Sonido de alerta generado por el navegador (antes apuntaba a /notification.mp3, que no existía).
  const audioCtxRef = useRef<AudioContext | null>(null)
  const getAudioCtx = useCallback(() => {
    if (typeof window === 'undefined') return null
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return null
      audioCtxRef.current = new Ctx()
    }
    return audioCtxRef.current
  }, [])
  // El navegador solo deja sonar después de un toque: con el primer clic en el panel se "despierta" el audio
  useEffect(() => {
    if (!audioEnabled) return
    const wake = () => { getAudioCtx()?.resume().catch(() => {}) }
    window.addEventListener('pointerdown', wake)
    window.addEventListener('keydown', wake)
    return () => { window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake) }
  }, [audioEnabled, getAudioCtx])
  // Título de la pestaña titilando hasta que el staff vuelve a la pestaña o toca algo
  const flashTitle = useCallback((text: string) => {
    if (typeof document === 'undefined') return
    const original = document.title.replace(/^🔔 .*? · /, '')
    let on = true
    const t = window.setInterval(() => { document.title = on ? `🔔 ${text} · ${original}` : original; on = !on }, 900)
    const stop = () => { window.clearInterval(t); document.title = original; window.removeEventListener('pointerdown', stop); window.removeEventListener('focus', stop) }
    window.setTimeout(() => { window.addEventListener('pointerdown', stop); window.addEventListener('focus', stop) }, 300)
    window.setTimeout(stop, 60000)
  }, [])
  const playAlertSound = useCallback((label: string = 'Aviso nuevo') => {
    try { navigator.vibrate?.([300, 120, 300, 120, 300]) } catch {}
    flashTitle(typeof label === 'string' ? label : 'Aviso nuevo')
    if (!audioEnabled) return
    const ctx = getAudioCtx()
    if (!ctx) return
    ctx.resume().catch(() => {})
    // Más fuerte que antes: tono "cuadrado" (corta el ruido del bar), volumen alto con compresor
    // para que no distorsione, y el "din-don-din" repetido 3 veces (~2,5 segundos).
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -10; comp.ratio.value = 12
    const master = ctx.createGain(); master.gain.value = 1
    comp.connect(master).connect(ctx.destination)
    const notes = [988, 784, 988]
    for (let rep = 0; rep < 3; rep++) {
      notes.forEach((freq, i) => {
        const start = ctx.currentTime + rep * 0.85 + i * 0.2
        ;(['square', 'triangle'] as OscillatorType[]).forEach((type) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = type
          osc.frequency.value = freq
          gain.gain.setValueAtTime(0.0001, start)
          gain.gain.exponentialRampToValueAtTime(type === 'square' ? 0.5 : 0.9, start + 0.015)
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18)
          osc.connect(gain).connect(comp)
          osc.start(start)
          osc.stop(start + 0.19)
        })
      })
    }
  }, [audioEnabled, getAudioCtx, flashTitle])

  const playAlertSoundRef = useRef(playAlertSound)
  useEffect(() => { playAlertSoundRef.current = playAlertSound }, [playAlertSound])

  const extensions = useExtensions(() => playAlertSound('Pedido de extensión'))
  const feedback = useFeedbackCount()

  const dismissToast = useCallback((id: string) => { setToasts(prev => prev.filter(t => t.id !== id)) }, [])

  useEffect(() => { setIsMounted(true) }, [])

  const handleManualFinish = useCallback((r: Reservation, e: React.MouseEvent) => {
    e.stopPropagation()
    setFinalizeTarget(r)
  }, [])

  const confirmFinalize = useCallback(async (r: Reservation, actualTimeTo: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('reservations')
      .update({
        status: 'completed',
        actual_time_to: actualTimeTo,
        completed_at: new Date().toISOString(),
      })
      .eq('id', r.id)

    if (!error) {
      setReservations(prev => prev.map(res =>
        res.id === r.id ? { ...res, status: 'completed', actualTimeTo, completedAt: new Date() } : res
      ))
    }
    setFinalizeTarget(null)
  }, [])


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
        if (isViewingToday) { const diffMin = (endMs - nowMs) / 60000; if (diffMin > 0 && diffMin <= 10) { newAlerts.add(r.id); if (!alertedIdsRef.current.has(r.id)) { alertedIdsRef.current.add(r.id); setToasts(prev => [...prev, { id: r.id, code: r.reservationCode ?? r.id }]); playAlertSound('Termina una reserva'); sendBrowserNotification(r.reservationCode ?? r.id) } } }
      })
      setActiveAlerts(newAlerts); setLiveStatus(newLiveStatus)
      // Finalizar solas las que ya terminaron (pasan a "Ya se fueron"). Como mucho una vez por minuto.
      const someEnded = reservations.some(r => r.status === 'confirmed' && (formatDateKey(selectedDate) < todayKey || (isViewingToday && newLiveStatus[r.id] === 'finalizada')))
      if (someEnded && Date.now() - lastAutoFinalizeRef.current > 60000) {
        lastAutoFinalizeRef.current = Date.now()
        fetch('/api/staff/finalize-due', { method: 'POST' }).then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.finalizadas > 0) loadForDateRef.current?.(selectedDate, true) }).catch(() => {})
      }
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

  // Corregir un consumo mal cargado: restar una unidad o quitar el producto (con confirmación)
  const fixOrderItem = async (orderId: string, index: number, action: 'menos' | 'quitar', label: string) => {
    if (!window.confirm(action === 'quitar' ? `¿Quitar ${label} del consumo?` : `¿Restar ${label}?`)) return
    const res = await fetch(`/api/staff/orders/${orderId}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index, action }) })
    if (!res.ok) { const d = await res.json().catch(() => ({})); window.alert(d.error || 'No se pudo corregir el consumo.') }
    loadOrders()
  }

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
  
  loadForDateRef.current = loadForDate
  useEffect(() => { loadForDate(selectedDate) }, [selectedDate, loadForDate])

  // Pagos que las chicas registran en la caja (opcional), por reserva
  const [payments, setPayments] = useState<Record<string, CashPayment[]>>({})
  const reservationIdsKey = reservations.map((r) => r.id).join(',')
  const loadPayments = useCallback(async () => {
    if (!reservationIdsKey) { setPayments({}); return }
    try {
      const res = await fetch(`/api/staff/payments?ids=${reservationIdsKey}`, { cache: 'no-store' })
      if (!res.ok) return
      const list: CashPayment[] = await res.json()
      const map: Record<string, CashPayment[]> = {}
      for (const p of list) (map[p.reservation_id] ||= []).push(p)
      setPayments(map)
    } catch { /* se reintenta al recargar */ }
  }, [reservationIdsKey])
  useEffect(() => { loadPayments() }, [loadPayments])

  // Respaldo del "tiempo real": cada 10 segundos se vuelve a leer el día y se buscan reservas nuevas
  // hechas por clientes (de cualquier fecha). Así el panel se actualiza y suena aunque el tiempo real
  // de Supabase no esté activo. Cada reserva suena una sola vez, llegue por donde llegue.
  const seenNewResRef = useRef<Set<string>>(new Set())
  const pollSinceRef = useRef<string>(new Date().toISOString())
  const notifyNewReservation = useCallback((id: string | undefined, isPresent: boolean | null | undefined) => {
    if (!id || isPresent !== false || seenNewResRef.current.has(id)) return
    seenNewResRef.current.add(id)
    playAlertSoundRef.current('Nueva reserva')
  }, [])
  useEffect(() => {
    let stop = false
    const poll = async () => {
      loadForDate(selectedDate, true)
      try {
        const { data } = await createClient().from('reservations').select('id, is_present').gte('created_at', pollSinceRef.current).eq('is_present', false).limit(50)
        if (!stop) for (const r of data || []) notifyNewReservation(r.id, r.is_present)
      } catch {}
    }
    const t = setInterval(poll, 10000)
    return () => { stop = true; clearInterval(t) }
  }, [selectedDate, loadForDate, notifyNewReservation])

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
      (payload: any) => {
        loadForDate(selectedDate, true)
        // reserva nueva hecha por un cliente desde la app → suena
        if (payload?.eventType === 'INSERT' && payload?.new) notifyNewReservation(payload.new.id, payload.new.is_present)
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      () => { loadOrders() }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, loadForDate])

  const addReservation = async (data: any): Promise<{ ok: true; code: string } | { ok: false; error: string }> => {
    const supabase = createClient();
    const { data: existing } = await supabase.from('reservations').select('*').eq('date', formatDateKey(data.date)).in('status', ['confirmed', 'payment_pending'])
    const latest = (existing ?? []).map(rowToReservation)
    const conflict = latest.some(r => { if (data.workspace === 'escritorio') return r.workspace === 'escritorio' && r.deskNumber === data.deskNumber && timeRangesOverlap(data.timeFrom, data.timeTo, r.timeFrom, r.timeTo); return [data.workspace, ...getBlockedWorkspaces(data.workspace)].includes(r.workspace) && timeRangesOverlap(data.timeFrom, data.timeTo, r.timeFrom, r.timeTo) })
    if (conflict) return { ok: false, error: 'Ese lugar ya está ocupado en ese horario. Elegí otro escritorio u horario.' }
    let createdCode = ''
    // Si el código al azar ya existe (choque poco probable), se prueba con otro
    let error: { code?: string } | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: dayCodes } = await supabase.from('reservations').select('reservation_code').eq('date', formatDateKey(data.date))
      const code = pickFreeCode((dayCodes ?? []).map((x: any) => x.reservation_code).filter(Boolean))
      ;({ error } = await supabase.from('reservations').insert({ workspace: data.workspace, date: formatDateKey(data.date), time_from: data.timeFrom, time_to: data.timeTo, desk_number: data.deskNumber ?? null, phone: data.phone, first_name: data.firstName, last_name: data.lastName, status: 'confirmed', reservation_code: code, is_present: true, price_total: Math.round((prices[data.workspace as WorkspaceType] || 0) * calculateDuration(data.timeFrom, data.timeTo)), dni: data.dni || null, age_range_staff: data.ageRangeStaff || null }))
      createdCode = code
      if (!error || error.code !== '23505') break
    }
    if (error) return { ok: false, error: 'No se pudo guardar la reserva. Probá de nuevo.' }
    loadForDate(selectedDate)
    return { ok: true, code: createdCode }
  }

  const cancelReservation = async (id: string): Promise<boolean> => { const supabase = createClient(); const { error } = await supabase.from('reservations').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id); if (!error) setReservations(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled', cancelledAt: new Date() } : r)); return !error }

  const hourLabels = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i); const totalHeight = (END_HOUR - START_HOUR + 1) * PX_PER_HOUR

  const matchesFilter = (ws: WorkspaceType, filter: typeof workspaceFilter) => {
    if (!filter) return true
    if (filter === 'escritorio') return ws === 'escritorio'
    if (filter === 'sala') return ws.startsWith('sala')
    if (filter === 'oficina') return ws.startsWith('oficina')
    return true
  }

  const confirmed = reservations.filter(r => r.status === 'confirmed')
  const cancelled = reservations.filter(r => r.status === 'cancelled')
  const completed = reservations.filter(r => r.status === 'completed')
  const filteredConfirmed = confirmed.filter(r => matchesFilter(r.workspace, workspaceFilter))
  const filteredCancelled = cancelled.filter(r => matchesFilter(r.workspace, workspaceFilter))
  const filteredCompleted = completed.filter(r => matchesFilter(r.workspace, workspaceFilter))
  // Arriba: quienes están o van a venir. Abajo y achicadas: las que ya terminaron (finalizadas) y las canceladas.
  const byTime = (a: Reservation, b: Reservation) => a.timeFrom.localeCompare(b.timeFrom)
  const activeList = [...filteredConfirmed].sort(byTime)
  const doneList = [...filteredCompleted.sort((a, b) => (b.actualTimeTo || b.timeTo).localeCompare(a.actualTimeTo || a.timeTo)), ...filteredCancelled.sort(byTime)]

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Tarjeta completa de una reserva (se usa en la lista principal y al abrir una de "Ya se fueron")
  // Cuenta de una reserva (Plan FULL): se usa en la tarjeta y en la lista achicada de "Ya se fueron"
  const computeBill = (r: Reservation) => {
                const effectiveTimeTo = r.status === 'completed' && r.actualTimeTo ? r.actualTimeTo : r.timeTo
                const duration = calculateDuration(r.timeFrom, effectiveTimeTo);
                // Valor: el total con el que se hizo la reserva (por horas o combo) + extensiones; las viejas, precio por hora × horas
                // (por horas: si se fue antes, se cobra lo usado, al precio por hora con el que reservó)
                const bookedBaseHours = Math.max(0.5, calculateDuration(r.timeFrom, r.timeTo) - (r.extraHours || 0))
                // extensiones: costo que se suma (extraAmount) + lo pagado por adelantado en la versión anterior (extraPaid)
                const extensionCost = (r.extraAmount || 0) + (r.extraPaid || 0)
                const baseUsedHours = Math.max(0, duration - (r.extraHours || 0))
                const reservationPrice = (r.priceTotal == null
                  ? Math.round((prices[r.workspace] || 0) * baseUsedHours)
                  : r.comboName
                    ? r.priceTotal
                    : Math.round((r.priceTotal / bookedBaseHours) * baseUsedHours)) + extensionCost;

                // Mostrar pedidos aceptados o entregados para esta reserva
                const deliveredOrders = allOrders.filter(
                  (order: any) =>
                    order.reservation_id === r.id &&
                    (order.status === 'entregado' || order.status === 'aceptado')
                )

                const marketConsumption = deliveredOrders.reduce((acc: number, curr: any) => acc + (Number(curr.total_amount) || 0), 0);

                // ¿Tiene seña? (subió comprobante). El origen (app o staff) sale de is_present: las cargadas por el staff quedan "presentes".
                const isPresencial = !r.receiptUrl;
                const cargadaPorStaff = !!r.isPresent;
                // La seña (50%) es solo sobre las horas reservadas originalmente; las horas extendidas se pagan aparte y completas
                const extraHours = r.extraHours || 0
                const extraPaid = r.extraPaid || 0
                const baseHours = Math.max(0, calculateDuration(r.timeFrom, r.timeTo) - extraHours)
                const pagadoApp = isPresencial ? 0 : Math.round((r.priceTotal != null ? r.priceTotal : (prices[r.workspace] || 0) * baseHours) * 0.5);

                const saldoEspacioBase = Math.max(0, reservationPrice - pagadoApp - extraPaid);
                // Plan FULL: el cliente paga lo MAYOR entre el valor del espacio y lo que consumió (el consumo cubre el espacio)
                const correspondePagar = Math.max(reservationPrice, marketConsumption)
                const cashPayments = payments[r.id] || []
                const pagadoCaja = cashPayments.reduce((a, p) => a + Number(p.amount), 0)
                const yaPagado = pagadoApp + extraPaid + pagadoCaja
                const aCobrar = Math.max(0, correspondePagar - yaPagado)
                const diferencia = marketConsumption - reservationPrice

                return { duration, extensionCost, reservationPrice, deliveredOrders, marketConsumption, isPresencial, cargadaPorStaff, extraHours, extraPaid, pagadoApp, correspondePagar, cashPayments, pagadoCaja, yaPagado, aCobrar, diferencia }
  }

  const renderCard = (r: Reservation) => {
                const colors = WORKSPACE_COLORS[r.workspace] || { border: 'border-slate-200', text: 'text-slate-600', bg: 'bg-slate-50' };
                const isCancelled = r.status === 'cancelled';
                const isCompleted = r.status === 'completed';
                const status = liveStatus[r.id] || 'pending';
                const isAlerted = activeAlerts.has(r.id);
                
                const { duration, reservationPrice, deliveredOrders, marketConsumption, isPresencial, cargadaPorStaff, extraHours, extraPaid, pagadoApp, correspondePagar, cashPayments, pagadoCaja, yaPagado, aCobrar, diferencia } = computeBill(r)

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
                          {r.comboName && <Badge className="text-[9px] font-bold uppercase bg-amber-500 text-white px-2">Combo {r.comboName}</Badge>}
                          
                          {cargadaPorStaff ? (
                            <Badge variant="outline" className="text-[9px] border-blue-200 text-blue-600 font-bold uppercase bg-blue-50/50">Atención Staff</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] border-green-200 text-green-600 font-bold uppercase bg-green-50/50">Reserva App{isPresencial ? ' · sin seña' : ''}</Badge>
                          )}

                          {!isCompleted && !isCancelled && status === 'en_curso' && (
                            <Badge className={`${isAlerted ? 'bg-orange-600' : 'bg-green-500'} text-white text-[9px] uppercase font-black`}>
                              {isAlerted ? '¡FINALIZA EN 10 MIN!' : 'En Curso'}
                            </Badge>
                          )}

                          {!isCompleted && !isCancelled && status === 'finalizada' && (
                            <Badge className="bg-slate-500 text-white text-[9px] uppercase font-black">Terminó su horario · falta finalizar</Badge>
                          )}

                          {isCompleted && (
                            <Badge className="bg-green-600 text-white text-[9px] uppercase font-black">
                              Finalizada{r.actualTimeTo ? ` · ${r.actualTimeTo}` : ''}
                            </Badge>
                          )}
                        </div>

                        <div className="mb-3 max-w-lg space-y-3">
                          {!isCancelled && (
                            <div className="rounded-xl border-2 border-[#0057a5] bg-white p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-[#0057a5] mb-2">Cuenta · Plan FULL</p>
                              <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[12px] font-semibold text-slate-600">
                                <span className="text-slate-800">Valor del espacio ({duration.toLocaleString('es-AR', { maximumFractionDigits: 2 })} hs)</span>
                                <span className="text-right text-slate-800">{formatPrice(reservationPrice)}</span>
                                {(r.extraAmount || 0) + extraPaid > 0 && (
                                  <span className="col-span-2 -mt-0.5 text-[11px] font-normal text-slate-500">Incluye extensión (+{extraHours.toLocaleString('es-AR')} hs): {formatPrice((r.extraAmount || 0) + extraPaid)}</span>
                                )}
                                <span className="text-green-700">Saldo a favor para usar en el Market</span>
                                <span className="text-right text-green-700">{formatPrice(reservationPrice)}</span>
                                <span>Consumo en Market</span>
                                <span className="text-right">{marketConsumption > 0 ? `- ${formatPrice(marketConsumption)}` : formatPrice(0)}</span>
                                <span className="col-span-2 border-t border-slate-200 my-0.5" />
                                {diferencia > 0 ? (
                                  <>
                                    <span className="text-amber-700 font-bold">Consumió más que su saldo</span>
                                    <span className="text-right text-amber-700 font-bold">+ {formatPrice(diferencia)}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-green-700 font-bold">Saldo a favor restante</span>
                                    <span className="text-right text-green-700 font-bold">{formatPrice(reservationPrice - marketConsumption)}</span>
                                  </>
                                )}
                                <span className="col-span-2 border-t border-slate-200 my-0.5" />
                                <span className="text-slate-800">Total de la cuenta <span className="font-normal text-slate-500">(el mayor entre espacio y consumo)</span></span>
                                <span className="text-right text-slate-800">{formatPrice(correspondePagar)}</span>
                                {pagadoApp > 0 && (<><span className="text-green-600">Seña pagada por la app</span><span className="text-right text-green-600">- {formatPrice(pagadoApp)}</span></>)}
                                {extraPaid > 0 && (<><span className="text-green-600">Extensión pagada antes</span><span className="text-right text-green-600">- {formatPrice(extraPaid)}</span></>)}
                              </div>
                              <CashPayments reservationId={r.id} payments={cashPayments} suggested={aCobrar} onChange={loadPayments} />
                              <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between items-baseline">
                                <span className="text-[12px] font-black text-slate-900 uppercase">{aCobrar === 0 && yaPagado > 0 ? 'Pagado' : 'A cobrar en caja'}</span>
                                {aCobrar === 0 && yaPagado > 0
                                  ? <span className="text-sm font-black text-green-600">✓ No debe nada</span>
                                  : <span className="text-xl font-black text-[#0057a5]">{formatPrice(aCobrar)}</span>}
                              </div>
                              <p className="mt-1.5 text-[11px] font-semibold text-slate-600">
                                {diferencia > 0
                                  ? `Se pasó ${formatPrice(diferencia)} de su saldo: paga lo que consumió y el espacio le sale sin costo.`
                                  : diferencia < 0
                                    ? `Le quedan ${formatPrice(-diferencia)} de saldo para pedir en el Market. Si no los usa, igual paga el valor del espacio.`
                                    : 'Usó justo todo su saldo a favor.'}
                                {yaPagado === 0 ? ' No pagó nada antes: se cobra todo en caja.' : ''}
                              </p>
                              {aCobrar > 0 && <p className="mt-1 text-[11px] font-bold text-[#0057a5]">⭐ {YPF_POINTS_STAFF}</p>}
                            </div>
                          )}
                            {deliveredOrders.length > 0 && (
                              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-1.5">
                                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">
                                  Detalle del consumo en Market
                                </p>

                                {deliveredOrders.map((pedido: any) => {
                                  const items = Array.isArray(pedido.items) ? pedido.items : []
                                  return (
                                    <div key={pedido.id} className="bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-2 space-y-1">
                                      {items.length > 0 ? (
                                        items.map((item: any, idx: number) => (
                                          <div key={idx} className="flex justify-between items-center gap-2 text-[11px] text-slate-700">
                                            <span className="flex-1 min-w-0">{item.quantity}x {item.name}</span>
                                            <span className="font-semibold">{formatPrice(Number(item.subtotal) || Number(item.price) * Number(item.quantity))}</span>
                                            {/* corregir un consumo mal cargado */}
                                            {Number(item.quantity) > 1 && (
                                              <button type="button" title="Restar una unidad" aria-label={`Restar una unidad de ${item.name}`}
                                                onClick={() => fixOrderItem(pedido.id, idx, 'menos', `una unidad de ${item.name}`)}
                                                className="w-6 h-6 rounded-md border border-slate-300 bg-white flex items-center justify-center text-slate-500 hover:text-slate-800"><Minus className="w-3 h-3" /></button>
                                            )}
                                            <button type="button" title="Quitar del consumo" aria-label={`Quitar ${item.name} del consumo`}
                                              onClick={() => fixOrderItem(pedido.id, idx, 'quitar', `${item.quantity}x ${item.name}`)}
                                              className="w-6 h-6 rounded-md border border-slate-300 bg-white flex items-center justify-center text-slate-400 hover:text-red-600 hover:border-red-300"><Trash2 className="w-3 h-3" /></button>
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

                        <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 font-bold">
                          <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" /> {r.timeFrom} - {r.timeTo}</div>
                          <EditableName r={r} onSaved={() => loadForDate(selectedDate, true)} />
                          <div className="text-[#0057a5] font-black">{r.phone}</div>
                          {r.dni && ageFromDni(r.dni)
                            ? <span className="text-slate-500">Edad aprox.: {ageFromDni(r.dni)} (DNI)</span>
                            : !isCancelled && <AgeSelect reservationId={r.id} value={r.ageRangeStaff ?? null} onSaved={(nv) => setReservations(prev => prev.map(x => x.id === r.id ? { ...x, ageRangeStaff: nv } : x))} />}
                          
                          {r.receiptUrl && (
                            <button 
                              onClick={() => window.open(`/api/staff/receipt?id=${r.id}`, '_blank')}
                              className="flex items-center gap-1.5 text-green-600 hover:text-green-700 hover:underline transition-all"
                            >
                              <Paperclip className="w-3.5 h-3.5" /> Ver Comprobante
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        {!isCancelled && !isCompleted && (status === 'en_curso' || status === 'finalizada') && (
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
  }

  return (
    <div className="min-h-screen bg-background">

      {quickReservation && (
        <QuickReservationModal
          workspace={quickReservation.workspace}
          date={selectedDate}
          hour={quickReservation.hour}
          onClose={() => setQuickReservation(null)}
          onSubmit={async (data) => {
            const res = await addReservation({ ...data, workspace: quickReservation.workspace, date: selectedDate })
            if (!res.ok) return res.error
            setCreatedReservation({ code: res.code, firstName: data.firstName, lastName: data.lastName, phone: data.phone,
              place: quickReservation.workspace === 'escritorio' && data.deskNumber ? `Escritorio N.° ${data.deskNumber}` : WORKSPACE_LABELS[quickReservation.workspace],
              date: selectedDate, timeFrom: data.timeFrom, timeTo: data.timeTo })
            setQuickReservation(null)
            return true
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

      {createdReservation && <CreatedReservationModal info={createdReservation} onClose={() => setCreatedReservation(null)} />}

      {manualOrderTarget && (
        <ManualOrderModal
          reservation={manualOrderTarget}
          products={marketProducts}
          onClose={() => setManualOrderTarget(null)}
          onSubmit={(items) => submitManualOrder(manualOrderTarget, items)}
        />
      )}

      {finalizeTarget && (
        <FinalizeModal
          reservation={finalizeTarget}
          onClose={() => setFinalizeTarget(null)}
          onConfirm={(time) => confirmFinalize(finalizeTarget, time)}
        />
      )}

      {showReportModal && (
        <ReportModal onClose={() => setShowReportModal(false)} />
      )}

      {toolModal === 'extensions' && (
        <ExtensionsModal items={extensions.items} reload={extensions.reload} onClose={() => setToolModal(null)}
          onConfirmed={() => loadForDate(selectedDate, true)} />
      )}
      {toolModal === 'settings' && <SettingsModal onClose={() => { setToolModal(null); loadPrices() }} />}
      {toolModal === 'feedback' && <FeedbackModal onClose={() => { setToolModal(null); feedback.reload() }} />}
      {toolModal === 'benefit' && <BenefitModal onClose={() => setToolModal(null)} />}
      {toolModal === 'clients' && <ClientsModal onClose={() => setToolModal(null)} />}
      {toolModal === 'search' && (
        <SearchModal onClose={() => setToolModal(null)} onGoToDate={(d) => { d.setHours(0, 0, 0, 0); setSelectedDate(d) }} />
      )}

      <header className="bg-[#0057a5] text-white sticky top-0 z-20 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-6 h-6 opacity-90" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-75">Gestión Administrativa</p>
              <h1 className="text-lg font-bold leading-tight uppercase">Agenda Fullwork</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await createClient().auth.signOut()
                window.location.href = '/staff/login'
              }}
              className="h-10 px-3 rounded-xl border bg-white/10 border-white/20 text-white"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span className="text-[10px] font-black uppercase">Salir</span>
            </Button>

            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setAudioEnabled(!audioEnabled)
                // Al activar, el navegador habilita el audio (requiere un toque del usuario) y suena una prueba
                if (!audioEnabled) { getAudioCtx()?.resume(); setTimeout(() => playAlertSoundRef.current('Prueba de sonido'), 150) }
              }}
              className={`h-10 px-4 rounded-xl border transition-all ${audioEnabled ? 'bg-green-500 text-white border-green-500' : 'bg-amber-400 border-amber-300 text-slate-900 animate-pulse'}`}
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

      <StaffToolbar
        pendingExtensions={extensions.pending}
        onExtensions={() => setToolModal('extensions')}
        onSettings={() => setToolModal('settings')}
        onBenefit={() => setToolModal('benefit')}
        onSearch={() => setToolModal('search')}
        unreadFeedback={feedback.unread}
        onFeedback={() => setToolModal('feedback')}
        onClients={() => setToolModal('clients')}
      />

      <div className="flex h-[calc(100vh-132px)] overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card className="p-4 border-none shadow-sm bg-white">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Confirmadas</p>
                <p className="text-3xl font-black text-[#0057a5]">{filteredConfirmed.length}</p>
              </Card>
              <Card className="p-4 border-none shadow-sm bg-white">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Finalizadas</p>
                <p className="text-3xl font-black text-green-600">{filteredCompleted.length}</p>
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
              ) : [...filteredConfirmed, ...filteredCompleted, ...filteredCancelled].length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No hay reservas para mostrar hoy</p>
                </div>
              ) : (
                <>
                  {activeList.length === 0 && (
                    <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No queda nadie por venir ni en curso</p>
                    </div>
                  )}
                  {activeList.map((r) => renderCard(r))}
                  {doneList.length > 0 && (
                    <div className="pt-4">
                      <button type="button" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}
                        className="w-full flex items-center justify-between rounded-xl bg-slate-200/70 hover:bg-slate-200 px-4 py-3 text-left">
                        <span className="text-xs font-black text-slate-600 uppercase tracking-[0.15em]">Ya se fueron / canceladas ({doneList.length})
                          {(() => { const owe = doneList.filter(x => x.status !== 'cancelled' && computeBill(x).aCobrar > 0).length; return owe > 0 ? <span className="ml-2 normal-case tracking-normal text-white bg-red-600 rounded px-2 py-0.5">{owe} {owe === 1 ? 'debe' : 'deben'} pagar</span> : null })()}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">{showDone ? 'Ocultar' : 'Ver'} <ChevronDown className={`w-4 h-4 transition-transform ${showDone ? 'rotate-180' : ''}`} /></span>
                      </button>
                      {showDone && (
                        <div className="mt-2 space-y-2">
                          {doneList.map((r) => openDoneId === r.id ? (
                            <div key={r.id}>
                              <button type="button" onClick={() => setOpenDoneId(null)} className="text-[11px] font-bold text-slate-500 hover:text-slate-700 mb-1 flex items-center gap-1">
                                <ChevronDown className="w-3.5 h-3.5 rotate-180" /> Achicar
                              </button>
                              {renderCard(r)}
                            </div>
                          ) : (
                            <button key={r.id} type="button" onClick={() => setOpenDoneId(r.id)}
                              className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white ring-1 ring-slate-100 px-4 py-2.5 text-left hover:ring-slate-300">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${r.status === 'cancelled' ? 'bg-slate-200 text-slate-500' : 'bg-green-600 text-white'}`}>
                                {r.status === 'cancelled' ? 'Cancelada' : r.autoFinalized ? `Terminó ${r.actualTimeTo || r.timeTo}` : `Se fue${r.actualTimeTo ? ` ${r.actualTimeTo}` : ''}`}
                              </span>
                              <span className={`text-sm font-bold ${r.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{r.firstName} {r.lastName}</span>
                              <span className="text-xs text-slate-500">{WORKSPACE_LABELS[r.workspace]}{r.deskNumber ? ` N.° ${r.deskNumber}` : ''} · {r.timeFrom} - {r.timeTo}</span>
                              {r.status !== 'cancelled' && (() => { const bill = computeBill(r); return bill.aCobrar > 0
                                ? <span className="text-[11px] font-black text-white bg-red-600 rounded px-2 py-0.5">Debe {formatPrice(bill.aCobrar)}</span>
                                : <span className="text-[11px] font-black text-green-700">✓ Pagado</span> })()}
                              <span className="ml-auto text-[11px] font-bold text-[#0057a5] flex items-center gap-1">Ver detalle <ChevronDown className="w-3.5 h-3.5" /></span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
              {[
                { key: null, label: 'TODOS' },
                { key: 'escritorio', label: 'ESCRITORIOS' },
                { key: 'sala', label: 'SALAS' },
                { key: 'oficina', label: 'OFICINAS' },
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
  onNewOrder={() => playAlertSound('Nuevo pedido')} 
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
