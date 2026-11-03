'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react'
import { Reservation, ReservationStatus, WorkspaceType, timeRangesOverlap, getBlockedWorkspaces, WORKSPACE_PRICES } from './types'
import { saveLocalCode } from './local-codes'

function formatDateKey(date: Date | string | null | undefined): string {
  if (!date) return ''
  try {
    const d = new Date(date)
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]
  } catch {
    return ''
  }
}

function toLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export interface Combo { id: string; name: string; workspace: WorkspaceType; hours: number; price: number; active: boolean }

interface PendingReservation {
  comboId?: string | null
  workspace: WorkspaceType
  date: Date
  timeFrom: string
  timeTo: string
  deskNumber?: number
  phone: string
  firstName: string
  lastName: string
  dni?: string | null
}

export type Screen = 'home' | 'info' | 'space-detail' | 'date' | 'time-range' | 'payment' | 'success' | 'my-reservations' | 'market' | 'pizarra'

import type { ClientBenefit } from '@/components/benefit-card'
export type MyBenefit = ClientBenefit

interface ReservationContextType {
  isMounted: boolean
  currentScreen: Screen
  setCurrentScreen: (screen: Screen) => void
  currentReservationId: string | null
  setCurrentReservationId: (id: string | null) => void
  selectedSpaceId: WorkspaceType | null
  setSelectedSpaceId: (id: WorkspaceType | null) => void
  selectedDate: Date | null
  setSelectedDate: (date: Date | null) => void
  selectedTimeFrom: string | null
  setSelectedTimeFrom: (time: string | null) => void
  selectedTimeTo: string | null
  setSelectedTimeTo: (time: string | null) => void
  selectedWorkspace: WorkspaceType | null
  setSelectedWorkspace: (workspace: WorkspaceType | null) => void
  selectedDesk: number | null
  setSelectedDesk: (desk: number | null) => void
  phone: string
  setPhone: (phone: string) => void
  firstName: string
  setFirstName: (name: string) => void
  lastName: string
  setLastName: (name: string) => void
  dni: string
  setDni: (dni: string) => void
  askDni: boolean
  reservations: Reservation[]
  reservationsLoading: boolean
  myBenefit: MyBenefit | null
  prices: Record<WorkspaceType, number>
  combos: Combo[]
  selectedComboId: string | null
  setSelectedComboId: (id: string | null) => void
  /** Total de la reserva elegida: precio del combo o precio por hora × horas */
  quoteTotal: (workspace: WorkspaceType | null, from: string | null, to: string | null, comboId?: string | null) => number
  lastReservationCode: string | null
  reloadReservations: () => Promise<void>
  pendingReservation: PendingReservation | null
  addReservation: (reservation: Omit<Reservation, 'id' | 'createdAt' | 'status' | 'receiptUrl' | 'reservationCode' | 'cancelledAt'>) => { success: boolean; error?: string }
  completeBookingWithPayment: (receipt: File | null) => Promise<{ success: boolean; reservationId: string | null; error?: string }>
  /** ¿Hay que pagar la seña para este espacio? (salas y oficinas sí; escritorios según Ajustes) */
  depositRequiredFor: (workspace: WorkspaceType | null) => boolean
  lastBookingHadDeposit: boolean
  cancelReservation: (id: string) => Promise<boolean>
  resetBooking: () => void
  hideFromHistory: (id: string) => void
  hiddenReservationIds: Set<string>
  activeUserReservation: Reservation | null
  isRangeConflict: (date: Date, timeFrom: string, timeTo: string, workspace: WorkspaceType) => boolean
  isDeskBooked: (date: Date, timeFrom: string, timeTo: string, deskNumber: number) => boolean
  isWorkspaceAvailable: (date: Date, timeFrom: string, timeTo: string, workspace: WorkspaceType) => boolean
}

const ReservationContext = createContext<ReservationContextType | undefined>(undefined)

/** Maps a Supabase row (snake_case) to a Reservation (camelCase) */
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
    status: (row.status as ReservationStatus) ?? 'pending',
    receiptUrl: row.receipt_url as string | undefined,
    reservationCode: row.reservation_code as string | undefined,
    isPresent: row.is_present as boolean | undefined,
    createdAt: new Date(row.created_at as string),
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at as string) : undefined,
    comboName: (row.combo_name as string | null) ?? null,
    myRating: (row.my_rating as number | null) ?? null,
  }
}

export function ReservationProvider({ children }: { children: ReactNode }) {
  const [isMounted, setIsMounted] = useState(false)
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [currentReservationId, setCurrentReservationId] = useState<string | null>(null)
  const [selectedSpaceId, setSelectedSpaceId] = useState<WorkspaceType | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTimeFrom, setSelectedTimeFrom] = useState<string | null>(null)
  const [selectedTimeTo, setSelectedTimeTo] = useState<string | null>(null)
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceType | null>(null)
  const [selectedDesk, setSelectedDesk] = useState<number | null>(null)
  const [phone, setPhoneState] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dni, setDni] = useState('') // opcional: para la base de clientes (rango de edad)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [reservationsLoading, setReservationsLoading] = useState(true)
  const [myBenefit, setMyBenefit] = useState<MyBenefit | null>(null)
  const [prices, setPrices] = useState<Record<WorkspaceType, number>>({ ...WORKSPACE_PRICES })
  const [combos, setCombos] = useState<Combo[]>([])
  const [selectedComboId, setSelectedComboId] = useState<string | null>(null)
  const [deskDepositRequired, setDeskDepositRequired] = useState(false)
  const [askDni, setAskDni] = useState(false) // ¿el staff pide el DNI (una sola vez) al reservar?
  const [lastBookingHadDeposit, setLastBookingHadDeposit] = useState(true)
  const depositRequiredFor = useCallback((w: WorkspaceType | null) => w !== 'escritorio' || deskDepositRequired, [deskDepositRequired])

  // Precios y combos que fija el staff (si falla, quedan los precios de siempre)
  useEffect(() => {
    fetch('/api/public/pricing', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d?.prices) setPrices(d.prices)
      if (Array.isArray(d?.combos)) setCombos(d.combos)
      if (typeof d?.deskDepositRequired === 'boolean') setDeskDepositRequired(d.deskDepositRequired)
      if (typeof d?.askDni === 'boolean') setAskDni(d.askDni)
    }).catch(() => {})
  }, [])

  const quoteTotal = useCallback((workspace: WorkspaceType | null, from: string | null, to: string | null, comboId?: string | null) => {
    if (!workspace) return 0
    const combo = comboId ? combos.find((c) => c.id === comboId && c.workspace === workspace) : null
    if (combo) return combo.price
    if (!from || !to) return 0
    const [h1, m1] = from.split(':').map(Number), [h2, m2] = to.split(':').map(Number)
    return Math.round((prices[workspace] ?? 0) * Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60))
  }, [combos, prices])
  const [lastReservationCode, setLastReservationCode] = useState<string | null>(null)
  const [pendingReservation, setPendingReservation] = useState<PendingReservation | null>(null)
  const [hiddenReservationIds, setHiddenReservationIds] = useState<Set<string>>(new Set())

  // Carga la ocupación (sin datos personales, para calcular disponibilidad)
  // + las reservas propias del teléfono guardado en este dispositivo.
  const loadReservations = useCallback(async (forPhone?: string) => {
    setReservationsLoading(true)
    try {
      const [occupancyRes, mineRes] = await Promise.all([
        fetch('/api/public/occupancy', { cache: 'no-store' }),
        forPhone
          ? fetch('/api/reservations/mine', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone: forPhone }),
            })
          : Promise.resolve(null),
      ])
      const occupancy: Record<string, unknown>[] = occupancyRes.ok ? await occupancyRes.json() : []
      const mineBody = mineRes && mineRes.ok ? await mineRes.json() : null
      const mine: Record<string, unknown>[] = mineBody?.reservations ?? []
      setMyBenefit(mineBody?.benefit ?? null)

      const byId = new Map<string, Reservation>()
      for (const row of occupancy) byId.set(row.id as string, rowToReservation(row))
      // Las propias pisan a las de ocupación (traen nombre y se les asigna el teléfono del usuario)
      for (const row of mine) byId.set(row.id as string, rowToReservation({ ...row, phone: forPhone }))
      setReservations([...byId.values()])
    } catch (error) {
      console.error('[reservations] error al cargar:', error)
    }
    setReservationsLoading(false)
  }, [])

  // Al montar: recuperar el teléfono guardado en este dispositivo
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = localStorage.getItem('fullwork_user_phone')
      if (p) setPhoneState(p)
    }
    setIsMounted(true)
  }, [])

  // Recargar cuando cambia el teléfono (con una pequeña espera mientras se escribe)
  useEffect(() => {
    if (!isMounted) return
    const t = setTimeout(() => loadReservations(phone || undefined), phone ? 400 : 0)
    return () => clearTimeout(t)
  }, [isMounted, phone, loadReservations])

  // Wrapper for setPhone that also saves to localStorage
  const setPhone = (val: string) => {
    setPhoneState(val)
    if (typeof window !== 'undefined') {
      localStorage.setItem('fullwork_user_phone', val)
    }
  }

  // Availability check functions
  const isRangeConflict = useCallback((date: Date, timeFrom: string, timeTo: string, workspace: WorkspaceType): boolean => {
    const dateKey = formatDateKey(date)
    return reservations.some(r => {
      if (r.status === 'cancelled') return false
      if (formatDateKey(r.date) !== dateKey) return false
      if (r.workspace !== workspace && !getBlockedWorkspaces(workspace).includes(r.workspace)) return false
      return timeRangesOverlap(timeFrom, timeTo, r.timeFrom, r.timeTo)
    })
  }, [reservations])

  const isDeskBooked = useCallback((date: Date, timeFrom: string, timeTo: string, deskNumber: number): boolean => {
    const dateKey = formatDateKey(date)
    return reservations.some(r => {
      if (r.status === 'cancelled') return false
      if (formatDateKey(r.date) !== dateKey) return false
      if (r.workspace !== 'escritorio') return false
      if (r.deskNumber !== deskNumber) return false
      return timeRangesOverlap(timeFrom, timeTo, r.timeFrom, r.timeTo)
    })
  }, [reservations])

  const isWorkspaceAvailable = useCallback((date: Date, timeFrom: string, timeTo: string, workspace: WorkspaceType): boolean => {
    return !isRangeConflict(date, timeFrom, timeTo, workspace)
  }, [isRangeConflict])

  // SYNCHRONOUS: Saves reservation locally (not in Supabase yet)
  // Returns { success: boolean, error?: string } to indicate if reservation was saved
  const addReservation = (
    reservation: Omit<Reservation, 'id' | 'createdAt' | 'status' | 'receiptUrl' | 'reservationCode' | 'cancelledAt'>
  ): { success: boolean; error?: string } => {
    // Check for conflicts - return error message instead of navigating
    if (reservation.workspace === 'escritorio' && reservation.deskNumber != null) {
      if (isDeskBooked(reservation.date, reservation.timeFrom, reservation.timeTo, reservation.deskNumber)) {
        return { success: false, error: 'Este escritorio ya tiene una reserva en ese rango de horario. Por favor elige otro.' }
      }
    } else {
      if (isRangeConflict(reservation.date, reservation.timeFrom, reservation.timeTo, reservation.workspace)) {
        return { success: false, error: 'Este espacio ya tiene una reserva en ese rango de horario. Por favor elige otro.' }
      }
    }

    // Save locally without inserting to Supabase yet
    setPendingReservation({
      workspace: reservation.workspace,
      date: reservation.date,
      timeFrom: reservation.timeFrom,
      timeTo: reservation.timeTo,
      deskNumber: reservation.deskNumber,
      phone: reservation.phone,
      firstName: reservation.firstName,
      lastName: reservation.lastName,
      dni: reservation.dni ?? null,
      comboId: combos.some((c) => c.id === selectedComboId && c.workspace === reservation.workspace) ? selectedComboId : null,
    })

    return { success: true }
  }

  // Completa la reserva: el servidor valida, sube el comprobante a un lugar privado y guarda.
  const completeBookingWithPayment = async (
    receipt: File | null
  ): Promise<{ success: boolean; reservationId: string | null; error?: string }> => {
    try {
      if (!pendingReservation) throw new Error('No hay datos de reserva pendiente')
      if (!receipt && depositRequiredFor(pendingReservation.workspace)) throw new Error('El comprobante de pago es obligatorio')

      const { workspace, date, timeFrom, timeTo, phone: resPhone, firstName: fn, lastName: ln, deskNumber } =
        pendingReservation
      const dateKey = formatDateKey(date)
      if (!dateKey) throw new Error('Fecha invalida')

      const form = new FormData()
      form.append(
        'data',
        JSON.stringify({
          workspace,
          date: dateKey,
          timeFrom,
          timeTo,
          deskNumber: deskNumber ?? null,
          comboId: pendingReservation.comboId ?? null,
          phone: resPhone,
          firstName: fn,
          lastName: ln,
          dni: pendingReservation.dni || null,
        })
      )
      if (receipt) form.append('receipt', receipt)

      const res = await fetch('/api/reservations', { method: 'POST', body: form })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || !result.id) {
        throw new Error(result.error || 'No se pudo guardar la reserva')
      }

      setCurrentReservationId(result.id)
      setLastBookingHadDeposit(!!receipt)
      if (result.timeTo) setSelectedTimeTo(result.timeTo) // con combo, la hora de fin la fija el servidor
      if (result.reservationCode) {
        saveLocalCode(result.id, result.reservationCode)
        setLastReservationCode(result.reservationCode)
      }
      setPendingReservation(null)
      await loadReservations(resPhone)
      return { success: true, reservationId: result.id }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Error desconocido'
      console.error('[completeBookingWithPayment]', errMsg)
      return { success: false, reservationId: null, error: errMsg }
    }
  }

  // Cancela una reserva propia (el servidor verifica que el teléfono coincida)
  const cancelReservation = async (id: string): Promise<boolean> => {
    const res = await fetch('/api/reservations/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, phone }),
    })
    if (!res.ok) return false
    await loadReservations(phone || undefined)
    return true
  }

  const resetBooking = () => {
    setSelectedDate(null)
    setSelectedTimeFrom(null)
    setSelectedTimeTo(null)
    setSelectedWorkspace(null)
    setSelectedDesk(null)
    setSelectedComboId(null)
    setPendingReservation(null)
    setFirstName('')
    setLastName('')
  }

  // Helper to normalize phone numbers
  const normalizePhone = (p: string): string => {
    if (!p) return ''
    return p.replace(/\s|-|\(|\)/g, '')
  }

  // ACTIVE USER RESERVATION: Detects if user has a confirmed reservation for today
  const activeUserReservation = useMemo(() => {
    if (!isMounted || !phone) return null
    if (reservations.length === 0) return null

    const now = new Date()
    const today = formatDateKey(now)
    const normalizedUserPhone = normalizePhone(phone)

    return (
      reservations.find(r => {
        if (r.status !== 'confirmed') return false
        if (normalizePhone(r.phone) !== normalizedUserPhone) return false

        const resDate = formatDateKey(r.date)
        if (resDate !== today) return false

        const currentMinutes = now.getHours() * 60 + now.getMinutes()
        const [startH, startM] = r.timeFrom.split(':').map(Number)
        const [endH, endM] = r.timeTo.split(':').map(Number)
        const startMinutes = startH * 60 + startM
        const endMinutes = endH * 60 + endM

        return currentMinutes >= startMinutes && currentMinutes <= endMinutes
      }) || null
    )
  }, [isMounted, phone, reservations])

  // Always render Provider to avoid "fewer hooks" error, but conditionally render children
  return (
    <ReservationContext.Provider
      value={{
        isMounted,
        currentScreen,
        setCurrentScreen,
        currentReservationId,
        setCurrentReservationId,
        selectedSpaceId,
        setSelectedSpaceId,
        selectedDate,
        setSelectedDate,
        selectedTimeFrom,
        setSelectedTimeFrom,
        selectedTimeTo,
        setSelectedTimeTo,
        selectedWorkspace,
        setSelectedWorkspace,
        selectedDesk,
        setSelectedDesk,
        phone,
        setPhone,
        firstName,
        setFirstName,
        lastName,
        setLastName,
        dni,
        setDni,
        askDni,
        reservations,
        reservationsLoading,
        myBenefit,
        prices,
        combos,
        selectedComboId,
        setSelectedComboId,
        quoteTotal,
        lastReservationCode,
        reloadReservations: () => loadReservations(phone || undefined),
        pendingReservation,
        addReservation,
        completeBookingWithPayment,
        depositRequiredFor,
        lastBookingHadDeposit,
        cancelReservation,
        resetBooking,
        hideFromHistory: (id) => setHiddenReservationIds(prev => new Set([...prev, id])),
        hiddenReservationIds,
        activeUserReservation,
        isRangeConflict,
        isDeskBooked,
        isWorkspaceAvailable,
      }}
    >
      {isMounted ? children : null}
    </ReservationContext.Provider>
  )
}

export const useReservation = () => {
  const context = useContext(ReservationContext)
  if (!context) throw new Error('useReservation must be used within ReservationProvider')
  return context
}
