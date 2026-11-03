'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useReservation } from '@/lib/reservation-context'
import { TIME_SLOTS, WORKSPACE_LABELS, calculateDuration, SHOW_DATA_CONSENT, getBlockedWorkspaces } from '@/lib/types'
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
    dni,
    setDni,
    askDni,
    addReservation,
    selectedDesk,
    setSelectedDesk,
    reservations,
    isDeskBooked,
    isRangeConflict,
    prices,
    combos,
    selectedComboId,
    setSelectedComboId,
    quoteTotal,
    depositRequiredFor,
  } = useReservation()
  // DNI: se pide una sola vez. Si este teléfono ya lo dejó en otra reserva, no se muestra el campo.
  const [dniNeeded, setDniNeeded] = useState(true)
  useEffect(() => {
    if (!askDni) return
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) { setDniNeeded(true); return }
    const t = setTimeout(() => {
      fetch('/api/public/dni-needed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
        .then((r) => (r.ok ? r.json() : { needed: true })).then((d) => setDniNeeded(d.needed !== false)).catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [phone, askDni])
  const needsDeposit = depositRequiredFor(selectedWorkspace)
  const spaceCombos = combos.filter((c) => c.workspace === selectedWorkspace)
  const combo = spaceCombos.find((c) => c.id === selectedComboId) || null

  const [conflictError, setConflictError] = useState<string | null>(null)
  const [showFromDropdown, setShowFromDropdown] = useState(false)
  const [showToDropdown, setShowToDropdown] = useState(false)
  const [isPending, startTransition] = useTransition()

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

  // ---- Disponibilidad: qué horarios ya están tomados para este escritorio / espacio ese día
  const busy = (from: string, to: string) => {
    if (!selectedDate || !selectedWorkspace) return false
    return selectedWorkspace === 'escritorio' && selectedDesk != null
      ? isDeskBooked(selectedDate, from, to, selectedDesk)
      : isRangeConflict(selectedDate, from, to, selectedWorkspace)
  }
  const plus30 = (t: string) => { const m = toMinutes(t) + 30; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
  const plusH = (t: string, h: number) => { const m = toMinutes(t) + h * 60; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
  // Con combo, el inicio tiene que dejar lugar a todas las horas del combo (libres y antes de las 22)
  const fromBusy = (slot: string) => combo
    ? toMinutes(slot) + combo.hours * 60 > 22 * 60 || busy(slot, plusH(slot, combo.hours))
    : busy(slot, plus30(slot))
  // "Hasta": se puede elegir hasta donde empieza la próxima reserva (no se puede pasar por encima de otra)
  const allToSlots = getValidToSlots(selectedTimeFrom)
  const firstBlocked = selectedTimeFrom ? allToSlots.findIndex((t) => busy(selectedTimeFrom, t)) : -1
  const validToSlots = allToSlots
  const toBusy = (i: number) => firstBlocked !== -1 && i >= firstBlocked

  const dayKey = selectedDate ? `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}` : ''
  const takenRanges = selectedDate && selectedWorkspace
    ? reservations
        .filter((r) => r.status !== 'cancelled' && `${r.date.getFullYear()}-${r.date.getMonth()}-${r.date.getDate()}` === dayKey)
        .filter((r) => selectedWorkspace === 'escritorio' && selectedDesk != null
          ? r.workspace === 'escritorio' && r.deskNumber === selectedDesk
          : r.workspace === selectedWorkspace || getBlockedWorkspaces(selectedWorkspace).includes(r.workspace))
        .sort((a, b) => a.timeFrom.localeCompare(b.timeFrom))
        .map((r) => `${r.timeFrom} a ${r.timeTo}`)
    : []
  // Escritorios sin ninguna reserva ese día (para cambiar rápido si el elegido está ocupado)
  const freeDesks = selectedDate && selectedWorkspace === 'escritorio'
    ? Array.from({ length: 12 }, (_, i) => i + 1).filter((n) => n !== selectedDesk && !reservations.some((r) =>
        r.status !== 'cancelled' && r.workspace === 'escritorio' && r.deskNumber === n &&
        `${r.date.getFullYear()}-${r.date.getMonth()}-${r.date.getDate()}` === dayKey))
    : []

  const isValidPhone = (p: string) => p.replace(/\D/g, '').length >= 10
  const [consentAccepted, setConsentAccepted] = useState(false)

  const isFormComplete =
    selectedTimeFrom &&
    selectedTimeTo &&
    phone &&
    firstName &&
    lastName &&
    isValidPhone(phone) &&
    (!SHOW_DATA_CONSENT || consentAccepted)

  const chooseMode = (id: string | null) => {
    setSelectedComboId(id)
    setSelectedTimeFrom(null)
    setSelectedTimeTo(null)
    setConflictError(null)
  }

  const handleSelectFrom = (slot: string) => {
    setSelectedTimeFrom(slot)
    setSelectedTimeTo(combo ? plusH(slot, combo.hours) : null) // con combo, la hora de fin sale sola
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
          dni: askDni && dniNeeded ? dni.replace(/\D/g, '') || null : null,
        })
        
        // Only navigate if reservation was saved successfully
        if (result.success) {
          setCurrentScreen('payment')
        } else {
          // Show error in this screen, do NOT navigate
          setConflictError(result.error || 'Este horario no esta disponible. Por favor elige otro.')
        }
      } catch (error) {
        console.error('[reserva] Error al confirmar:', error)
        setConflictError('Error inesperado. Por favor intenta de nuevo.')
      }
    })
  }

  const pricePerHour = selectedWorkspace ? prices[selectedWorkspace] : 0
  const duration = selectedTimeFrom && selectedTimeTo ? calculateDuration(selectedTimeFrom, selectedTimeTo) : 0
  const price = quoteTotal(selectedWorkspace, selectedTimeFrom, selectedTimeTo, combo?.id)
  const seña = Math.round(price * 0.5)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-primary px-4 pt-12 pb-6 md:px-8 md:pt-8">
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

      <div className="flex-1 px-4 py-5 space-y-5 overflow-auto md:max-w-2xl md:mx-auto md:w-full">
        {/* Por horas o combo */}
        {spaceCombos.length > 0 && (
          <Card className="p-4 border-0 shadow-md space-y-2">
            <h2 className="font-semibold text-foreground">¿Cómo querés reservar?</h2>
            <button type="button" aria-pressed={!combo} onClick={() => chooseMode(null)}
              className={`w-full rounded-xl px-4 py-3 flex items-center gap-3 text-left border ${!combo ? 'border-2 border-primary bg-primary/5' : 'border-border'}`}>
              <span className="flex-1"><span className="block font-semibold">Por horas</span><span className="block text-xs text-muted-foreground">Elegís desde y hasta</span></span>
              <span className="font-bold whitespace-nowrap">{formatPrice(pricePerHour)} <span className="text-xs font-medium">/h</span></span>
            </button>
            {spaceCombos.map((c) => {
              const save = pricePerHour * c.hours - c.price
              return (
                <button key={c.id} type="button" aria-pressed={combo?.id === c.id} onClick={() => chooseMode(c.id)}
                  className={`w-full rounded-xl px-4 py-3 flex items-center gap-3 text-left border ${combo?.id === c.id ? 'border-2 border-primary bg-primary/5' : 'border-border'}`}>
                  <span className="flex-1">
                    <span className="block font-semibold">Combo {c.name}</span>
                    <span className="block text-xs text-muted-foreground">{c.hours} horas{save > 0 && <span className="ml-1 font-bold text-green-700">· ahorrás {formatPrice(save)}</span>}</span>
                  </span>
                  <span className="font-bold whitespace-nowrap">{formatPrice(c.price)}</span>
                </button>
              )
            })}
          </Card>
        )}

        {/* Time Range */}
        <Card className="p-4 border-0 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Horario</h2>
              <p className="text-xs text-muted-foreground">
                {combo ? `Elegí a qué hora empezás: el combo dura ${combo.hours} horas` : 'Selecciona desde y hasta en intervalos de 30 min'}
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
                  {validFromSlots.map(slot => {
                    const taken = fromBusy(slot)
                    return (
                      <button
                        key={slot}
                        disabled={taken}
                        onClick={() => handleSelectFrom(slot)}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex justify-between ${
                          taken ? 'text-muted-foreground/60 cursor-not-allowed bg-muted/40'
                            : selectedTimeFrom === slot ? 'bg-primary/10 font-semibold text-primary' : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <span className={taken ? 'line-through' : ''}>{slot}</span>
                        {taken && <span className="text-xs font-semibold text-red-500">Ocupado</span>}
                      </button>
                    )
                  })}
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
                  if (!selectedTimeFrom || combo) return
                  setShowToDropdown(v => !v)
                  setShowFromDropdown(false)
                }}
                disabled={!selectedTimeFrom || !!combo}
                className="w-full h-12 px-4 rounded-lg border-2 border-border flex items-center justify-between text-sm font-medium bg-background hover:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={selectedTimeTo ? 'text-foreground' : 'text-muted-foreground'}>
                  {selectedTimeTo ?? 'Hora fin'}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              {showToDropdown && (
                <div className="absolute z-20 top-full mt-1 w-full max-h-52 overflow-y-auto bg-background border border-border rounded-xl shadow-xl">
                  {validToSlots.map((slot, i) => {
                    const taken = toBusy(i)
                    return (
                      <button
                        key={slot}
                        disabled={taken}
                        onClick={() => handleSelectTo(slot)}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex justify-between ${
                          taken ? 'text-muted-foreground/60 cursor-not-allowed bg-muted/40'
                            : selectedTimeTo === slot ? 'bg-primary/10 font-semibold text-primary' : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <span className={taken ? 'line-through' : ''}>{slot}</span>
                        {taken && <span className="text-xs font-semibold text-red-500">Ocupado</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {takenRanges.length > 0 && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-sm font-semibold text-amber-900">
                Ya reservado ese día{selectedWorkspace === 'escritorio' && selectedDesk ? ` (escritorio N.° ${selectedDesk})` : ''}:
              </p>
              <p className="text-sm text-amber-900">{takenRanges.join(' · ')}</p>
              {selectedWorkspace === 'escritorio' && freeDesks.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-amber-800 mb-1.5">¿Necesitás ese horario? Estos escritorios están libres todo el día:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {freeDesks.map((n) => (
                      <button key={n} type="button"
                        onClick={() => { setSelectedDesk(n); setSelectedTimeFrom(null); setSelectedTimeTo(null); setConflictError(null) }}
                        className="min-w-[40px] h-9 px-2 rounded-lg bg-white border border-amber-300 text-sm font-semibold text-amber-900">
                        N.° {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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
                {WORKSPACE_LABELS[selectedWorkspace]}{combo ? ` · Combo ${combo.name}` : ''}
              </span>
              <span className="font-semibold text-foreground">{formatPrice(price)}</span>
            </div>
            <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border">
              <span className="text-sm font-medium text-foreground">{needsDeposit ? 'Seña (50%)' : 'Seña'}</span>
              <span className="font-bold text-primary">{needsDeposit ? formatPrice(seña) : 'No hace falta: pagás en el lugar'}</span>
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
            {askDni && dniNeeded && (
            <div>
              <label className="text-sm text-muted-foreground mb-1 block" htmlFor="dni-cliente">
                DNI <span className="text-xs">(te lo pedimos una sola vez)</span>
              </label>
              <Input
                id="dni-cliente"
                inputMode="numeric"
                placeholder="Ej: 35123456"
                value={dni}
                onChange={e => setDni(e.target.value.replace(/[^\d.]/g, '').slice(0, 10))}
                className="h-12"
              />
              <p className="text-xs text-muted-foreground mt-1">Solo para estadísticas internas (rango de edad). No se muestra a nadie. Si preferís, dejalo vacío.</p>
            </div>
            )}
            {SHOW_DATA_CONSENT && (
              <label className="flex items-start gap-3 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={e => setConsentAccepted(e.target.checked)}
                  className="mt-0.5 w-5 h-5 accent-[#0057a5] flex-shrink-0"
                />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  Acepto que MARIJO S.A. guarde mi nombre y teléfono para gestionar mis reservas y
                  contactarme sobre ellas. Puedo pedir que se modifiquen o borren escribiendo por WhatsApp
                  (Ley 25.326).
                </span>
              </label>
            )}
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
              {needsDeposit ? 'Para confirmar una reserva se debe pagar una seña del 50% del valor del alquiler.' : 'Los escritorios se reservan sin seña: se paga todo en el lugar.'}
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
      <div className="px-4 pb-8 pt-2 border-t border-border bg-background md:px-[calc(50%-336px)]">
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
