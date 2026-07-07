'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useReservation } from '@/lib/reservation-context'
import { WORKSPACE_LABELS } from '@/lib/types'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Building2,
  CalendarPlus,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Trash2,
} from 'lucide-react'


const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function hoursUntilReservation(date: Date, timeFrom: string): number {
  const [h, m] = timeFrom.split(':').map(Number)
  // Create a new date preserving local date values
  const reservationDateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0)
  return (reservationDateTime.getTime() - Date.now()) / (1000 * 60 * 60)
}

// Check if reservation is in the past (before today)
function isPastReservation(date: Date, timeTo: string): boolean {
  const [h, m] = timeTo.split(':').map(Number)
  const endDateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0)
  return endDateTime.getTime() < Date.now()
}

// Swipeable card component for past reservations
function SwipeableCard({ 
  children, 
  onDelete, 
  canSwipe 
}: { 
  children: React.ReactNode
  onDelete: () => void
  canSwipe: boolean
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [offsetX, setOffsetX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!canSwipe) return
    startXRef.current = e.touches[0].clientX
    setIsDragging(true)
  }, [canSwipe])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !canSwipe) return
    const diff = e.touches[0].clientX - startXRef.current
    // Only allow left swipe (negative values)
    if (diff < 0) {
      setOffsetX(Math.max(diff, -130))
    }
  }, [isDragging, canSwipe])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    if (offsetX < -70) {
      // Keep revealed for delete button
      setOffsetX(-130)
    } else {
      setOffsetX(0)
    }
  }, [offsetX])

  const confirmDelete = () => {
    onDelete()
    setOffsetX(0)
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Delete background - red button with text */}
      {canSwipe && (
        <div 
          className="absolute inset-y-0 right-0 w-32 bg-red-500 flex items-center justify-center"
          style={{ opacity: Math.min(Math.abs(offsetX) / 60, 1) }}
        >
          <button onClick={confirmDelete} className="flex flex-col items-center gap-1 p-3 text-white">
            <Trash2 className="w-5 h-5" />
            <span className="text-xs font-medium whitespace-nowrap">Eliminar del historial</span>
          </button>
        </div>
      )}
      {/* Card content */}
      <div
        ref={cardRef}
        style={{ transform: `translateX(${offsetX}px)`, transition: isDragging ? 'none' : 'transform 0.2s ease-out' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative bg-card"
      >
        {children}
      </div>
    </div>
  )
}

export function MyReservationsScreen() {
  const { setCurrentScreen, reservations, reservationsLoading, phone, cancelReservation, hideFromHistory, hiddenReservationIds } = useReservation()
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null)
  const [showDepositWarning, setShowDepositWarning] = useState(false)

  // Filter reservations by user's phone and exclude hidden ones
  const myReservations = phone
    ? reservations.filter(r => r.phone === phone && !hiddenReservationIds.has(r.id))
    : []

  // Sort: future reservations first (closest first), then past reservations (most recent first)
  const now = Date.now()
  const sortedReservations = [...myReservations].sort((a, b) => {
    const [hA, mA] = a.timeFrom.split(':').map(Number)
    const [hB, mB] = b.timeFrom.split(':').map(Number)
    const dateTimeA = new Date(a.date.getFullYear(), a.date.getMonth(), a.date.getDate(), hA, mA).getTime()
    const dateTimeB = new Date(b.date.getFullYear(), b.date.getMonth(), b.date.getDate(), hB, mB).getTime()
    
    const aIsFuture = dateTimeA >= now
    const bIsFuture = dateTimeB >= now
    
    // Future reservations come first
    if (aIsFuture && !bIsFuture) return -1
    if (!aIsFuture && bIsFuture) return 1
    
    // Both future: closest first (ascending)
    if (aIsFuture && bIsFuture) return dateTimeA - dateTimeB
    
    // Both past: most recent first (descending)
    return dateTimeB - dateTimeA
  })

  const handleCancelPress = (id: string, date: Date, timeFrom: string) => {
    const hours = hoursUntilReservation(date, timeFrom)
    setPendingCancelId(id)
    if (hours < 24) {
      setShowDepositWarning(true)
    } else {
      setShowDepositWarning(false)
      confirmCancel(id)
    }
  }

  const confirmCancel = async (id: string) => {
    setShowDepositWarning(false)
    setCancellingId(id)
    await cancelReservation(id)
    setCancellingId(null)
    setPendingCancelId(null)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-primary px-4 pt-12 pb-6">
        <button
          onClick={() => setCurrentScreen('home')}
          className="flex items-center gap-2 text-primary-foreground/90 hover:text-primary-foreground mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Volver</span>
        </button>
        <h1 className="text-2xl font-bold text-primary-foreground">Mis reservas</h1>
        <p className="text-primary-foreground/80 mt-1">
          {myReservations.length > 0
            ? `${myReservations.length} ${myReservations.length === 1 ? 'reserva' : 'reservas'}`
            : 'Sin reservas activas'}
        </p>
      </div>

      {/* 24h deposit-loss warning dialog */}
      {showDepositWarning && pendingCancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <Card className="p-6 max-w-sm w-full border-0 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">Atencion</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Segun nuestras politicas de servicio, las cancelaciones realizadas con menos de 24 horas de antelacion no tendran reembolso de seña. ¿Deseas proceder con la cancelacion?
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowDepositWarning(false); setPendingCancelId(null) }}
              >
                Volver
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => confirmCancel(pendingCancelId)}
              >
                Confirmar Cancelacion
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-4 py-6">
        {reservationsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="p-4 border-0 shadow-md">
                <Skeleton className="h-5 w-40 mb-3" />
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </Card>
            ))}
          </div>
        ) : sortedReservations.length === 0 ? (
          <Card className="p-8 border-0 shadow-md text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Sin reservas</h3>
            <p className="text-muted-foreground text-sm mb-6">
              {phone 
                ? 'No tienes reservas activas. Reserva tu espacio de trabajo en Fullwork.'
                : 'Realiza tu primera reserva para comenzar a usar Fullwork.'}
            </p>
            <Button className="gap-2" onClick={() => setCurrentScreen('info')}>
              <CalendarPlus className="w-4 h-4" />
              Hacer una reserva
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedReservations.map(reservation => {
              const isCancelled = reservation.status === 'cancelled'
              const isCancelling = cancellingId === reservation.id
              const isPast = isPastReservation(reservation.date, reservation.timeTo)

              return (
                <SwipeableCard
                  key={reservation.id}
                  canSwipe={isPast}
                  onDelete={() => hideFromHistory(reservation.id)}
                >
                  <Card className={`p-4 border-0 shadow-md transition-opacity ${isCancelled ? 'opacity-60' : ''}`}>
                  <div className="space-y-3">
                    {/* Status badge and code */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {reservation.date.getDate()} de{' '}
                            {MONTHS[reservation.date.getMonth()]}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {reservation.date.getFullYear()}
                          </p>
                        </div>
                      </div>
                      {isCancelled ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2 py-1 rounded-full">
                          <XCircle className="w-3 h-3" />
                          Cancelada
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Confirmada
                        </span>
                      )}
                    </div>

                    {/* Reservation code (if confirmed) */}
                    {!isCancelled && reservation.reservationCode && (
                      <div className="bg-primary/5 px-3 py-2 rounded border border-primary/10">
                        <p className="text-xs text-muted-foreground mb-1">Código:</p>
                        <p className="font-mono font-bold text-primary">{reservation.reservationCode}</p>
                      </div>
                    )}

                    {/* Time & Space */}
                    <div className="flex flex-wrap items-center gap-4 pl-1">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">
                          {reservation.timeFrom} a {reservation.timeTo}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">
                          {WORKSPACE_LABELS[reservation.workspace]}
                          {reservation.deskNumber ? ` — N.° ${reservation.deskNumber}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Cancel button — only for confirmed future reservations */}
                    {!isCancelled && !isPast && hoursUntilReservation(reservation.date, reservation.timeFrom) > 0 && (
                      <div className="pt-1 border-t border-border">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 h-8 px-2"
                          disabled={isCancelling}
                          onClick={() => handleCancelPress(reservation.id, reservation.date, reservation.timeFrom)}
                        >
                          <XCircle className="w-4 h-4" />
                          {isCancelling ? 'Cancelando...' : 'Cancelar reserva'}
                        </Button>
                      </div>
                    )}

                    {/* Hint for past reservations */}
                    {isPast && (
                      <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                        Desliza para eliminar del historial
                      </p>
                    )}
                  </div>
                  </Card>
                </SwipeableCard>
              )
            })}
          </div>
        )}
      </div>

      {/* New Reservation - show if user has phone (has reserved before) */}
      {phone && myReservations.length > 0 && (
        <div className="px-4 pb-8">
          <Button
            className="w-full h-14 text-base font-medium gap-3"
            onClick={() => setCurrentScreen('info')}
          >
            <CalendarPlus className="w-5 h-5" />
            Nueva reserva
          </Button>
        </div>
      )}
    </div>
  )
}
