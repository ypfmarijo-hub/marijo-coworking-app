'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { GoogleMap } from '@/components/google-map'
import { useReservation } from '@/lib/reservation-context'
import { CONTACT_INFO, WORKSPACE_LABELS, WORKSPACE_PRICES, calculateDuration } from '@/lib/types'
import { CheckCircle, MapPin, MessageCircle, Home } from 'lucide-react'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const formatPrice = (amount: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)

export function ConfirmationScreen() {
  const {
    setCurrentScreen,
    selectedDate,
    selectedTimeFrom,
    selectedTimeTo,
    selectedWorkspace,
    selectedDesk,
    phone,
    firstName,
    lastName,
    resetBooking,
  } = useReservation()

  const formatDate = (date: Date) => {
    return `${date.getDate()} de ${MONTHS[date.getMonth()]}`
  }

  const pricePerHour = selectedWorkspace ? WORKSPACE_PRICES[selectedWorkspace] : 0
  const duration = selectedTimeFrom && selectedTimeTo ? calculateDuration(selectedTimeFrom, selectedTimeTo) : 0
  const price = Math.round(pricePerHour * duration)
  const seña = Math.round(price * 0.5)

  const generateWhatsAppMessage = () => {
    if (!selectedDate || !selectedTimeFrom || !selectedTimeTo || !selectedWorkspace) return ''
    
    const deskLine = selectedDesk ? `\nEscritorio N.° ${selectedDesk}` : ''
    const message = `Hola ${firstName}!\nTu reserva en Fullwork – MARIJO ha sido confirmada.\n\nFecha: ${formatDate(selectedDate)}\nHorario: ${selectedTimeFrom} a ${selectedTimeTo}\nEspacio: ${WORKSPACE_LABELS[selectedWorkspace]}${deskLine}\nDuración: ${duration.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} horas\nSeña a abonar: ${formatPrice(seña)}\n\nUbicación: ${CONTACT_INFO.address}\n\n¡Te esperamos!\nEquipo MARIJO`
    
    return encodeURIComponent(message)
  }

  const getCleanPhoneNumber = () => {
    return phone.replace(/\D/g, '')
  }

  const whatsappConfirmationLink = `https://wa.me/${getCleanPhoneNumber()}?text=${generateWhatsAppMessage()}`

  const handleGoHome = () => {
    resetBooking()
    setCurrentScreen('home')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Success Icon */}
      <div className="bg-primary px-4 pt-12 pb-8 text-center">
        <div className="w-20 h-20 rounded-full bg-primary-foreground/20 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-12 h-12 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-primary-foreground">Reserva confirmada</h1>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6">
        <Card className="p-6 border-0 shadow-lg text-center">
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Tu espacio de trabajo ha sido reservado. Te esperamos en Fullwork.
          </p>

          {/* Reservation Details */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-left">
            {firstName && lastName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nombre:</span>
                <span className="font-medium text-foreground">{firstName} {lastName}</span>
              </div>
            )}
            {phone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">WhatsApp:</span>
                <span className="font-medium text-foreground text-sm">{phone}</span>
              </div>
            )}
            {selectedDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fecha:</span>
                <span className="font-medium text-foreground">
                  {selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()]}
                </span>
              </div>
            )}
            {selectedTimeFrom && selectedTimeTo && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Horario:</span>
                <span className="font-medium text-foreground">{selectedTimeFrom} a {selectedTimeTo}</span>
              </div>
            )}
            {selectedWorkspace && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Espacio:</span>
                <span className="font-medium text-foreground">
                  {WORKSPACE_LABELS[selectedWorkspace]}
                  {selectedWorkspace === 'escritorio' && selectedDesk && ` - Escritorio ${selectedDesk}`}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground">Seña a abonar:</span>
              <span className="font-bold text-primary">{formatPrice(seña)}</span>
            </div>
          </div>
        </Card>

        {/* Location Card */}
        <Card className="mt-4 p-4 border-0 shadow-lg">
          <div className="flex items-start gap-3 mb-4">
            <MapPin className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Ubicación</p>
              <p className="text-sm text-muted-foreground">{CONTACT_INFO.address}</p>
            </div>
          </div>
          <GoogleMap className="h-40 rounded-lg" />
        </Card>

        {/* Payment Button - Direct to payment (no WhatsApp yet) */}
        <Button
          className="w-full h-14 text-base gap-2"
          onClick={() => setCurrentScreen('payment')}
        >
          Continuar al Pago
        </Button>

        {/* WhatsApp Button */}
        <a
          href={whatsappConfirmationLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block"
        >
          <Button variant="outline" className="w-full h-14 text-base gap-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]">
            <MessageCircle className="w-5 h-5 text-[#25D366]" />
            Enviar detalles por WhatsApp
          </Button>
        </a>
      </div>

      {/* Go Home */}
      <div className="p-4 border-t border-border">
        <Button
          variant="outline"
          className="w-full h-12 gap-2"
          onClick={handleGoHome}
        >
          <Home className="w-4 h-4" />
          Volver al inicio
        </Button>
      </div>
    </div>
  )
}
