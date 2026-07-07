'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react'
import { Reservation, ReservationStatus, WorkspaceType, timeRangesOverlap, getBlockedWorkspaces } from './types'
import { createClient } from './supabase/client'

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

interface PendingReservation {
  workspace: WorkspaceType
  date: Date
  timeFrom: string
  timeTo: string
  deskNumber?: number
  phone: string
  firstName: string
  lastName: string
}

export type Screen = 'home' | 'info' | 'space-detail' | 'date' | 'time-range' | 'confirmation' | 'payment' | 'payment-success' | 'my-reservations' | 'market'

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
  reservations: Reservation[]
  reservationsLoading: boolean
  pendingReservation: PendingReservation | null
  addReservation: (reservation: Omit<Reservation, 'id' | 'createdAt' | 'status' | 'receiptUrl' | 'reservationCode' | 'cancelledAt'>) => { success: boolean; error?: string }
  completeBookingWithPayment: (receiptUrl: string) => Promise<{ success: boolean; reservationId: string | null }>
  confirmPayment: (reservationId: string, receiptUrl: string) => Promise<boolean>
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
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [reservationsLoading, setReservationsLoading] = useState(true)
  const [pendingReservation, setPendingReservation] = useState<PendingReservation | null>(null)
  const [hiddenReservationIds, setHiddenReservationIds] = useState<Set<string>>(new Set())

  // Load all reservations from Supabase
  const loadReservations = useCallback(async () => {
    setReservationsLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .order('date', { ascending: false })

    if (!error && data) {
      setReservations((data ?? []).map(rowToReservation))
    }
    setReservationsLoading(false)
  }, [])

  // Mount effect: load phone from localStorage and reservations from Supabase
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = localStorage.getItem('fullwork_user_phone')
      if (p) setPhoneState(p)
    }
    loadReservations()
    setIsMounted(true)
  }, [loadReservations])

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
    })

    return { success: true }
  }

  // COMPLETES the booking: The ONLY function that inserts to Supabase after payment confirmation
  // This is the SINGLE POINT of entry to the database for mobile reservations
  const completeBookingWithPayment = async (receiptUrl: string): Promise<{ success: boolean; reservationId: string | null }> => {
    try {
      // VALIDATION 1: Check pendingReservation exists
      if (!pendingReservation) {
        throw new Error('No hay datos de reserva pendiente')
      }

      // VALIDATION 2: Check receipt URL is valid (mandatory for mobile reservations)
      if (!receiptUrl || receiptUrl.trim() === '') {
        throw new Error('El comprobante de pago es obligatorio')
      }

      // VALIDATION 3: Check ALL required fields have valid values
      const { workspace, date, timeFrom, timeTo, phone, firstName, lastName } = pendingReservation
      if (!workspace) throw new Error('Falta el espacio de trabajo')
      if (!date) throw new Error('Falta la fecha')
      if (!timeFrom) throw new Error('Falta la hora de inicio')
      if (!timeTo) throw new Error('Falta la hora de fin')
      if (!phone || phone.trim() === '') throw new Error('Falta el telefono')
      if (!firstName || firstName.trim() === '') throw new Error('Falta el nombre')
      if (!lastName || lastName.trim() === '') throw new Error('Falta el apellido')

      const supabase = createClient()
      const dateKey = formatDateKey(date)
      if (!dateKey) {
        throw new Error('Fecha invalida')
      }

      // Generate unique reservation code
      const code = `FW-${String(Math.floor(Math.random() * 9000) + 1000)}`

      // Final conflict check before insert
      if (workspace === 'escritorio' && pendingReservation.deskNumber != null) {
        if (isDeskBooked(date, timeFrom, timeTo, pendingReservation.deskNumber)) {
          throw new Error('Este escritorio ya fue reservado.')
        }
      } else {
        if (isRangeConflict(date, timeFrom, timeTo, workspace)) {
          throw new Error('Este espacio ya fue reservado.')
        }
      }

      // INSERT: Single point of entry to database for mobile reservations
      // All fields are validated above, receipt_url is mandatory
      const { data: insertData, error: insertError } = await supabase
        .from('reservations')
        .insert({
          workspace: workspace,
          date: dateKey,
          time_from: timeFrom,
          time_to: timeTo,
          desk_number: pendingReservation.deskNumber ?? null,
          phone: phone.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          status: 'confirmed',
          receipt_url: receiptUrl,
          reservation_code: code,
          is_present: false,
        })
        .select()
        .single()

      if (insertError) {
        throw new Error(`Insert error: ${insertError.message}`)
      }

      const reservationId = insertData?.id
      if (!reservationId) {
        throw new Error('No reservation ID returned from insert')
      }

      setCurrentReservationId(reservationId)
      setPendingReservation(null)

      // Small delay to let Supabase confirm and state sync
      await new Promise(r => setTimeout(r, 500))
      await loadReservations()

      return { success: true, reservationId }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Error unknown'
      console.error('[v0] Error in completeBookingWithPayment:', errMsg)
      return { success: false, reservationId: null }
    }
  }

  // Confirms payment for existing reservation
  const confirmPayment = async (reservationId: string, receiptUrl: string): Promise<boolean> => {
    if (!reservationId) {
      return false
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('reservations')
      .update({ receipt_url: receiptUrl, status: 'confirmed' })
      .eq('id', reservationId)
      .select()

    if (error) {
      return false
    }

    await loadReservations()
    return true
  }

  // Soft-cancels a reservation
  const cancelReservation = async (id: string): Promise<boolean> => {
    const supabase = createClient()
    const { error } = await supabase
      .from('reservations')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', id)
      .select()

    if (error) {
      return false
    }

    await loadReservations()
    return true
  }

  const resetBooking = () => {
    setSelectedDate(null)
    setSelectedTimeFrom(null)
    setSelectedTimeTo(null)
    setSelectedWorkspace(null)
    setSelectedDesk(null)
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
        reservations,
        reservationsLoading,
        pendingReservation,
        addReservation,
        completeBookingWithPayment,
        confirmPayment,
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
