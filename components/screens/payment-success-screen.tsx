'use client'

import { useState } from 'react'
import { useReservation } from '@/lib/reservation-context'
import { WORKSPACE_LABELS, WORKSPACE_PRICES, calculateDuration } from '@/lib/types'
import { CheckCircle } from 'lucide-react'

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

const formatPrice = (amount: number) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(amount)

// v152 - Confirmation Screen with symmetric buttons and no reservation code
export function PaymentSuccessScreen() {
  const {
    setCurrentScreen,
    selectedDate,
    selectedTimeFrom,
    selectedTimeTo,
    selectedWorkspace,
    firstName,
    resetBooking,
  } = useReservation()

  const [homePressed, setHomePressed] = useState(false)

  // Guard: datos mínimos requeridos para renderizar
  if (!selectedDate || !selectedTimeFrom || !selectedTimeTo || !selectedWorkspace) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
        <div className="w-12 h-12 border-4 border-[#0057a5] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 text-center">Cargando tu reserva...</p>
      </div>
    )
  }

  const duration = calculateDuration(selectedTimeFrom, selectedTimeTo)
  const hourlyRate = WORKSPACE_PRICES[selectedWorkspace] || 0
  const total = Math.round(hourlyRate * duration)
  const downPayment = Math.round(total * 0.5)
  const balance = total - downPayment

  const dateDay = selectedDate.getDate()
  const dateMonth = MONTHS[selectedDate.getMonth()] || ''

  const workspaceLabel = WORKSPACE_LABELS[selectedWorkspace] || selectedWorkspace

  const handleWhatsApp = () => {
    const mensaje =
      `Hola ${firstName || ''}!\n` +
      `Tu reserva en Fullwork – MARIJO ha sido confirmada.\n\n` +
      `Fecha: ${dateDay} de ${dateMonth}\n` +
      `Horario: ${selectedTimeFrom} a ${selectedTimeTo}\n` +
      `Espacio: ${workspaceLabel}\n` +
      `Duracion: ${duration} hora${duration !== 1 ? 's' : ''}\n` +
      `Sena a abonar: $${formatPrice(downPayment)}\n\n` +
      `Ubicacion: San Martin 1883, Rio Cuarto, Cordoba, Argentina\n\n` +
      `Te esperamos!\nEquipo MARIJO.`

    const url = `https://wa.me/5493585769421?text=${encodeURIComponent(mensaje)}`
    if (typeof window !== 'undefined') window.open(url, '_blank')
  }

  const handleGoHome = () => {
    resetBooking()
    setCurrentScreen('home')
  }

  return (
    <div className="flex flex-col items-center p-6 space-y-6 bg-white min-h-screen">

      {/* Icono de check */}
      <div className="mt-12">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-[#0057a5]" />
        </div>
      </div>

      {/* Titulo */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">¡RESERVA EXITOSA!</h1>
        <p className="text-gray-600">Tu lugar en Marijo 4 ya esta asegurado.</p>
      </div>

      {/* Detalles de la reserva */}
      <div className="w-full p-5 border border-gray-100 rounded-2xl bg-gray-50 space-y-4">
        <h2 className="font-bold text-gray-800 border-b border-gray-200 pb-2">Detalles de tu reserva:</h2>
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <span className="text-gray-500">Fecha:</span>
          <span className="text-right font-semibold text-gray-900">{dateDay} de {dateMonth}</span>

          <span className="text-gray-500">Horario:</span>
          <span className="text-right font-semibold text-gray-900">{selectedTimeFrom} a {selectedTimeTo}</span>

          <span className="text-gray-500">Espacio:</span>
          <span className="text-right font-semibold text-gray-900">{workspaceLabel}</span>

          <div className="col-span-2 border-t border-gray-200 my-1" />

          <span className="text-gray-600">Valor Total (100%):</span>
          <span className="text-right font-bold text-gray-900">${formatPrice(total)}</span>

          <span className="text-[#0057a5] font-semibold">Sena Abonada (50%):</span>
          <span className="text-right font-bold text-[#0057a5]">${formatPrice(downPayment)}</span>

          <span className="text-gray-600">Saldo Pendiente (50%):</span>
          <span className="text-right font-bold text-gray-800">${formatPrice(balance)}</span>
        </div>
      </div>

      {/* Textos legales sin cursivas */}
      <div className="w-full text-xs sm:text-sm space-y-4 text-gray-600 leading-relaxed">
        <p>Si necesitas <b>Factura A</b>, solicitala al ingresar al local con tus datos fiscales.</p>
        <p><b>Politica de Cancelacion:</b> Reembolsos disponibles cancelando con mas de 24 hs de antelacion. Por favor, contactate con nosotros para solicitarlo.</p>

        <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl">
          <p className="text-yellow-900 text-xs">
            <b>Aviso:</b> Todas las reservas estan sujetas a la validacion del comprobante. En caso de inconsistencias, la reserva sera dada de baja.
          </p>
        </div>
      </div>

      {/* Botones */}
      <div className="w-full flex flex-col space-y-3 pt-4 pb-8">
        <button
          onClick={handleWhatsApp}
          className="w-full py-4 bg-[#25D366] hover:bg-[#1eb959] text-white font-bold rounded-xl shadow-sm transition-all active:scale-95"
        >
          Enviar confirmacion por WhatsApp
        </button>

        <button
          onMouseDown={() => setHomePressed(true)}
          onMouseUp={() => setHomePressed(false)}
          onMouseLeave={() => setHomePressed(false)}
          onTouchStart={() => setHomePressed(true)}
          onTouchEnd={() => { setHomePressed(false); handleGoHome() }}
          onClick={handleGoHome}
          className={`w-full py-4 font-bold rounded-xl shadow-sm border transition-all active:scale-95 ${
            homePressed
              ? 'bg-[#0057a5] text-white border-[#0057a5]'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-[#0057a5] hover:text-white hover:border-[#0057a5]'
          }`}
        >
          Volver al inicio
        </button>
      </div>

    </div>
  )
}
