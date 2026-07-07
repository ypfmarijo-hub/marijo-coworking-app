'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Reservation, WorkspaceType, WORKSPACE_LABELS, WORKSPACE_PRICES, ReservationStatus, timeRangesOverlap, getBlockedWorkspaces } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, Clock, User, Building2, CalendarDays, Plus, X, Trash2, AlertTriangle, Paperclip, DollarSign, Bell, ShoppingBag, Volume2, VolumeX } from 'lucide-react'
import { MenuAdminModal } from '@/components/staff/menu-admin-modal'
import { OrdersSidebar } from '@/components/staff/orders-sidebar'

// ─── Constants ───────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  }
}

// ─── Mini Calendar Picker ─────────────────────────────────────────────────────

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
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
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

// ─── Quick Reservation Modal ─────────────────────────────────────────────────

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
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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
  const [timeFrom, setTimeFrom] = useState(initialFrom); const [timeTo, setTimeTo] = useState(initialTo); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState('')
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
      <Card className="p-6 max-w-sm w-full border-0 shadow-2xl text-center">
        <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
        <h3 className="font-bold text-lg mb-2 uppercase">Cancelar Reserva</h3>
        <p className="text-sm text-muted-foreground mb-6">¿Estás seguro de cancelar la reserva de <b>{reservation.firstName}</b>?</p>
        <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={onClose}>Volver</Button><Button variant="destructive" className="flex-1" onClick={async () => { setCancelling(true); await onConfirm(); setCancelling(false) }} disabled={cancelling}>{cancelling ? '...' : 'Confirmar'}</Button></div>
      </Card>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function StaffPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })
  const [reservations, setReservations] = useState<Reservation[]>([]); const [loading, setLoading] = useState(true)
  const [quickReservation, setQuickReservation] = useState<{ workspace: WorkspaceType; hour: number } | null>(null); const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null)
  const [showCalendar, setShowCalendar] = useState(false); const [workspaceFilter, setWorkspaceFilter] = useState<'escritorio' | 'sala' | 'oficina' | null>(null)
  const alertedIdsRef = useRef<Set<string>>(new Set()); const [activeAlerts, setActiveAlerts] = useState<Set<string>>(new Set()); const [liveStatus, setLiveStatus] = useState<Record<string, 'pending' | 'en_curso' | 'finalizada'>>({})
  const [toasts, setToasts] = useState<{ id: string; code: string }[]>([]); const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [marketProducts, setMarketProducts] = useState<{ id: string; name: string; price: number; image_url: string | null }[]>([])

  // --- NUEVA LÓGICA DE SONIDO ---
  const [audioEnabled, setAudioEnabled] = useState(false); const audioRef = useRef<HTMLAudioElement | null>(null)
  const playAlertSound = useCallback(() => {
    if (audioRef.current && audioEnabled) { audioRef.current.currentTime = 0; audioRef.current.play().catch(e => console.log("Audio block:", e)) }
  }, [audioEnabled])

  const dismissToast = useCallback((id: string) => { setToasts(prev => prev.filter(t => t.id !== id)) }, [])

  const handleManualFinish = useCallback(async (r: Reservation, e: React.MouseEvent) => {
    e.stopPropagation(); const supabase = createClient(); const { error } = await supabase.from('reservations').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', r.id)
    if (!error) setReservations(prev => prev.map(res => res.id === r.id ? { ...res, status: 'cancelled', cancelledAt: new Date() } : res))
  }, [])

  useEffect(() => { if ('Notification' in window) setNotifPermission(Notification.permission); else setNotifPermission('unsupported') }, [])
  const requestNotificationPermission = useCallback(async () => { if ('Notification' in window) { const result = await Notification.requestPermission(); setNotifPermission(result) } }, [])

  const loadMarketProducts = useCallback(async () => { try { const res = await fetch('/api/market/products'); if (res.ok) setMarketProducts(await res.json()) } catch (error) { console.error(error) } }, [])
  useEffect(() => { loadMarketProducts() }, [loadMarketProducts])

  const sendBrowserNotification = useCallback((code: string) => { if ('Notification' in window && Notification.permission === 'granted') new Notification('Fullwork - Alerta', { body: `Reserva ${code} finaliza en 10 min.`, tag: code, requireInteraction: true }) }, [])

  useEffect(() => {
    function check() {
      const now = new Date(); const todayKey = formatDateKey(now); const isViewingToday = formatDateKey(selectedDate) === todayKey
      const newAlerts = new Set<string>(); const newLiveStatus: Record<string, 'pending' | 'en_curso' | 'finalizada'> = {}
      reservations.forEach(r => {
        if (r.status === 'cancelled') return
        const [startH, startM] = r.timeFrom.split(':').map(Number); const [endH, endM] = r.timeTo.split(':').map(Number)
        const startTime = new Date(now); startTime.setHours(startH, startM, 0, 0); const endTime = new Date(now); endTime.setHours(endH, endM, 0, 0)
        const nowMs = now.getTime(), startMs = startTime.getTime(), endMs = endTime.getTime()
        if (nowMs >= endMs) newLiveStatus[r.id] = 'finalizada'; else if (nowMs >= startMs) newLiveStatus[r.id] = 'en_curso'; else newLiveStatus[r.id] = 'pending'
        if (isViewingToday) { const diffMin = (endMs - nowMs) / 60000; if (diffMin > 0 && diffMin <= 10) { newAlerts.add(r.id); if (!alertedIdsRef.current.has(r.id)) { alertedIdsRef.current.add(r.id); setToasts(prev => [...prev, { id: r.id, code: r.reservationCode ?? r.id }]); playAlertSound(); sendBrowserNotification(r.reservationCode ?? r.id) } } }
      })
      setActiveAlerts(newAlerts); setLiveStatus(newLiveStatus)
    }
    check(); const interval = setInterval(check, 15000); return () => clearInterval(interval)
  }, [reservations, selectedDate, playAlertSound, sendBrowserNotification])

  const loadForDate = useCallback(async (date: Date) => { setLoading(true); const supabase = createClient(); const { data, error } = await supabase.from('reservations').select('*').eq('date', formatDateKey(date)).order('time_from', { ascending: true }); if (!error && data) setReservations(data.map(rowToReservation)); setLoading(false) }, [])
  useEffect(() => { loadForDate(selectedDate) }, [selectedDate, loadForDate])

  useEffect(() => { const supabase = createClient(); const channel = supabase.channel('staff_reservations').on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => loadForDate(selectedDate)).subscribe(); return () => { supabase.removeChannel(channel) } }, [selectedDate, loadForDate])

  const addReservation = async (data: any): Promise<boolean> => {
    const supabase = createClient(); const { data: existing } = await supabase.from('reservations').select('*').eq('date', formatDateKey(data.date)).in('status', ['confirmed', 'payment_pending'])
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

  return (
    <div className="min-h-screen bg-background">
      {/* Elemento de Audio Oculto */}
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      {/* MODALES */}
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

      {/* HEADER PROFESIONAL AZUL #0057a5 */}
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
            {/* BOTÓN ACTIVADOR DE SONIDO - CRUCIAL */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setAudioEnabled(!audioEnabled)
                if (!audioEnabled && audioRef.current) {
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
            <MenuAdminModal products={marketProducts} onProductAdded={loadMarketProducts} onProductDeleted={loadMarketProducts} />
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-72px)] overflow-hidden">
        {/* AREA CENTRAL AGENDA */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
          
          {/* 1. RESUMEN SUPERIOR */}
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

          {/* 2. LISTA DETALLADA DE RESERVAS */}
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
              
              const marketConsumption = Array.isArray(r.market_orders) 
                ? r.market_orders.filter((o: any) => o.status === 'entregado').reduce((acc: number, curr: any) => acc + (curr.total_price || 0), 0)
                : 0;

              const isPresencial = !r.receiptUrl;
              const pagadoApp = isPresencial ? 0 : Math.round(reservationPrice * 0.5);
              const saldoPendiente = isPresencial ? (reservationPrice + marketConsumption) : (reservationPrice - pagadoApp + marketConsumption);

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
                          <span className="text-right text-slate-800"> {formatPrice(reservationPrice)}</span>
                          
                          {!isPresencial && (
                            <>
                              <span className="text-green-600">Seña Abonada (App):</span>
                              <span className="text-right text-green-600">- $ {formatPrice(pagadoApp)}</span>
                            </>
                          )}
                          
                          {marketConsumption > 0 && (
                            <>
                              <span className="text-blue-600">Consumo Market:</span>
                              <span className="text-right text-blue-600">+ $ {formatPrice(marketConsumption)}</span>
                            </>
                          )}

                          <div className="col-span-2 pt-2 mt-1 border-t border-slate-200 flex justify-between text-[11px] text-slate-900 font-black">
                            <span>SALDO A COBRAR:</span>
                            <span className="text-[#0057a5] text-sm font-black"> {formatPrice(saldoPendiente)}</span>
                          </div>
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
                      {!isCancelled && (
                        <Button size="icon" variant="ghost" className="text-slate-300 hover:text-red-500 transition-colors h-8 w-8" onClick={() => setCancelTarget(r)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* 3. FILTROS RÁPIDOS */}
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

          {/* 4. Grilla de Agenda */}
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
                          const isAlerted = activeAlerts.has(r.id)
                          return (
                            <div 
                              key={r.id} 
                              className={`absolute inset-x-1 rounded-lg border-l-4 px-3 py-2 shadow-sm transition-all ${colors.bg} ${colors.border} ${isAlerted ? 'ring-2 ring-orange-500 animate-pulse' : ''}`}
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
        </main>

        {/* SIDEBAR DE PEDIDOS CONECTADO AL SONIDO */}
        <OrdersSidebar 
          reservations={reservations} 
          onNewOrder={playAlertSound} 
        />
      </div>

      {/* ALERTAS TOASTS */}
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
  )
}
