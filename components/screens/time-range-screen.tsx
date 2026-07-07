'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useReservation } from '@/lib/reservation-context'
import { TIME_SLOTS, WORKSPACE_LABELS, WORKSPACE_PRICES, calculateDuration } from '@/lib/types'
import {
  ArrowLeft,
  Clock,
  User,
  Phone,
  AlertCircle,
  ChevronDown,
} from 'lucide-react'

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(price)
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Returns TIME_SLOTS that are after the given `from` time */
function getValidToSlots(from: string | null): string[] {
  if (!from) return []
  const fromMin = toMinutes(from)
  return TIME_SLOTS.filter(t => toMinutes(t) > fromMin)
}

export function TimeRangeScreen() {
  const {
    setCurrentScreen,
    selectedDate,
    selectedWorkspace,
    selectedTimeFrom,
    setSelectedTimeFrom,
    selectedTimeTo,
    setSelectedTimeTo,
    phone,
    setPhone,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    addReservation,
    selectedDesk,
    isRangeConflict,
  } = useReservation()

  const [conflictError, setConflictError] = useState<string | null>(null)
  const [showFromDropdown, setShowFromDropdown] = useState(false)
  const [showToDropdown, setShowToDropdown] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isError, setIsError] = useState(false)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isToday =
    selectedDate?.toDateString() === today.toDateString()

  /** Filter "from" slots: if today, exclude past times */
  const validFromSlots = TIME_SLOTS.filter(t => {
    if (!isToday) return true
    const now = new Date()
    const slotMin = toMinutes(t)
    const nowMin = now.getHours() * 60 + now.getMinutes()
    return slotMin > nowMin
  })

  const validToSlots = getValidToSlots(selectedTimeFrom)

  const isValidPhone = (p: string) => p.replace(/\D/g, '').length >= 10

  const isFormComplete =
    selectedTimeFrom &&
    selectedTimeTo &&
    phone &&
    firstName &&
    lastName &&
    isValidPhone(phone)

  const handleSelectFrom = (slot: string) => {
    setSelectedTimeFrom(slot)
    setSelectedTimeTo(null) // reset "to" when "from" changes
    setShowFromDropdown(false)
    setConflictError(null)
  }

  const handleSelectTo = (slot: string) => {
    setSelectedTimeTo(slot)
    setShowToDropdown(false)
    setConflictError(null)
  }

  const handleConfirm = () => {
    if (
      !selectedDate ||
      !selectedTimeFrom ||
      !selectedTimeTo ||
      !selectedWorkspace ||
      !phone ||
      !firstName ||
      !lastName
    ) {
      setConflictError('Por favor completa todos los campos')
      return
    }

    setIsError(false)
    setConflictError(null)

    startTransition(() => {
      try {
        // addReservation returns { success, error } - only navigate if successful
        const result = addReservation({
          date: selectedDate,
          timeFrom: selectedTimeFrom,
          timeTo: selectedTimeTo,
          workspace: selectedWorkspace,
          deskNumber: selectedDesk ?? undefined,
          phone,
          firstName,
          lastName,
        })
        
        // Only navigate if reservation was saved successfully
        if (result.success) {
          setCurrentScreen('payment')
        } else {
          // Show error in this screen, do NOT navigate
          setIsError(true)
          setConflictError(result.error || 'Este horario no esta disponible. Por favor elige otro.')
        }
      } catch (error) {
        console.error('[v0] Error in handleConfirm:', error)
        setIsError(true)
        setConflictError('Error inesperado. Por favor intenta de nuevo.')
      }
    })
  }

  const pricePerHour = selectedWorkspace ? WORKSPACE_PRICES[selectedWorkspace] : 0
  const duration = selectedTimeFrom && selectedTimeTo ? calculateDuration(selectedTimeFrom, selectedTimeTo) : 0
  const price = Math.round(pricePerHour * duration)
  const seña = Math.round(price * 0.5)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-primary px-4 pt-12 pb-6">
        <button
          onClick={() => setCurrentScreen('date')}
          className="flex items-center gap-2 text-primary-foreground/90 hover:text-primary-foreground mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Volver</span>
        </button>
        <h1 className="text-2xl font-bold text-primary-foreground">Elegir horario</h1>
        {selectedDate && (
          <p className="text-primary-foreground/80 mt-1">
            {selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()]}
            {selectedWorkspace && (
              <> &mdash; {WORKSPACE_LABELS[selectedWorkspace]}</>
            )}
          </p>
        )}
      </div>

      <div className="flex-1 px-4 py-5 space-y-5 overflow-auto">
        {/* Time Range */}
        <Card className="p-4 border-0 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Horario</h2>
              <p className="text-xs text-muted-foreground">
                Selecciona desde y hasta en intervalos de 30 min
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* From */}
            <div className="flex-1 relative">
              <label className="text-xs text-muted-foreground mb-1 block font-medium">
                Desde
              </label>
              <button
                onClick={() => {
                  setShowFromDropdown(v => !v)
                  setShowToDropdown(false)
                }}
                className="w-full h-12 px-4 rounded-lg border-2 border-border flex items-center justify-between text-sm font-medium bg-background hover:border-primary/50 transition-colors"
              >
                <span className={selectedTimeFrom ? 'text-foreground' : 'text-muted-foreground'}>
                  {selectedTimeFrom ?? 'Hora inicio'}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              {showFromDropdown && (
                <div className="absolute z-20 top-full mt-1 w-full max-h-52 overflow-y-auto bg-background border border-border rounded-xl shadow-xl">
                  {validFromSlots.map(slot => (
                    <button
                      key={slot}
                      onClick={() => handleSelectFrom(slot)}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors ${
                        selectedTimeFrom === slot
                          ? 'bg-primary/10 font-semibold text-primary'
                          : 'text-foreground'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="text-muted-foreground font-medium mt-4">→</span>

            {/* To */}
            <div className="flex-1 relative">
              <label className="text-xs text-muted-foreground mb-1 block font-medium">
                Hasta
              </label>
              <button
                onClick={() => {
                  if (!selectedTimeFrom) return
                  setShowToDropdown(v => !v)
                  setShowFromDropdown(false)
                }}
                disabled={!selectedTimeFrom}
                className="w-full h-12 px-4 rounded-lg border-2 border-border flex items-center justify-between text-sm font-medium bg-background hover:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={selectedTimeTo ? 'text-foreground' : 'text-muted-foreground'}>
                  {selectedTimeTo ?? 'Hora fin'}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              {showToDropdown && (
                <div className="absolute z-20 top-full mt-1 w-full max-h-52 overflow-y-auto bg-background border border-border rounded-xl shadow-xl">
                  {validToSlots.map(slot => (
                    <button
                      key={slot}
                      onClick={() => handleSelectTo(slot)}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors ${
                        selectedTimeTo === slot
                          ? 'bg-primary/10 font-semibold text-primary'
                          : 'text-foreground'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedTimeFrom && selectedTimeTo && (
            <p className="text-sm text-primary font-medium mt-3">
              Duración: {duration.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} horas ({selectedTimeFrom} a {selectedTimeTo})
            </p>
          )}
        </Card>

        {/* Conflict error */}
        {conflictError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{conflictError}</p>
          </div>
        )}

        {/* Pricing summary */}
        {selectedWorkspace && (
          <Card className="p-4 border-0 shadow-md bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {WORKSPACE_LABELS[selectedWorkspace]}
              </span>
              <span className="font-semibold text-foreground">{formatPrice(price)}</span>
            </div>
            <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border">
              <span className="text-sm font-medium text-foreground">Seña (50%)</span>
              <span className="font-bold text-primary">{formatPrice(seña)}</span>
            </div>
          </Card>
        )}

        {/* User data */}
        <Card className="p-4 border-0 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-semibold text-foreground">Tus datos</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nombre</label>
              <Input
                placeholder="Ingresa tu nombre"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="h-12"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Apellido</label>
              <Input
                placeholder="Ingresa tu apellido"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="h-12"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                WhatsApp
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="+54 9 358 123 4567"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="h-12 pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Te enviaremos la confirmación por WhatsApp
              </p>
            </div>
          </div>
        </Card>

        {/* Policy */}
        <Card className="p-4 border-0 shadow-md">
          <h2 className="font-semibold text-foreground mb-3">
            Política de reservas y cancelaciones
          </h2>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
              Para confirmar una reserva se debe pagar una seña del 50% del valor del alquiler.
            </li>
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
              Si la cancelación se realiza con menos de 24 horas de anticipación, la seña no se devuelve.
            </li>
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
              Las reservas son únicas: cada horario y espacio puede ser ocupado por una persona a la vez.
            </li>
          </ul>
        </Card>
      </div>

      {/* Confirm Button */}
      <div className="px-4 pb-8 pt-2 border-t border-border bg-background">
        <Button
          className="w-full h-14 text-base font-semibold"
          disabled={!isFormComplete || isPending}
          onClick={handleConfirm}
        >
          {isPending ? 'Guardando...' : 'Confirmar reserva'}
        </Button>
      </div>
    </div>
  )
}
