'use client'

import { PaymentSuccessScreen } from './payment-success-screen'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useReservation } from '@/lib/reservation-context'
import { WORKSPACE_PRICES, calculateDuration } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { Copy, Upload, ExternalLink, CreditCard } from 'lucide-react'

export function PaymentScreen() {
  const {
    currentScreen,
    setCurrentScreen,
    selectedTimeFrom,
    selectedTimeTo,
    selectedWorkspace,
    completeBookingWithPayment,
  } = useReservation()

  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'mercadopago' | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const duration = selectedTimeFrom && selectedTimeTo ? calculateDuration(selectedTimeFrom, selectedTimeTo) : 0
  const totalAmount = selectedWorkspace ? Math.round(WORKSPACE_PRICES[selectedWorkspace] * duration) : 0
  const senaAmount = Math.round(totalAmount * 0.5)

  if (currentScreen === 'success') { 
    return <PaymentSuccessScreen /> 
  }

  const handleMercadoPago = () => {
    const mpLink = "https://link.mercadopago.com.ar/fullwork";
    window.open(mpLink, '_blank', 'noopener,noreferrer');
  }

  const handleUploadReceipt = async () => {
    if (!receiptFile) {
      setError('Por favor, sube el comprobante para finalizar.')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const fileName = `comprobante-${Date.now()}.png`
      await supabase.storage.from('comprobantes').upload(fileName, receiptFile)
      const { data } = supabase.storage.from('comprobantes').getPublicUrl(fileName)
      
      const result = await completeBookingWithPayment(data.publicUrl)
      if (result.success) setCurrentScreen('success')
    } catch (err: any) {
      setError('Error al procesar el pago. Reintenta.')
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Copiado al portapapeles')
  }

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col space-y-6">
      <div className="text-center space-y-2 pt-4">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight uppercase">Abonar Seña (50%)</h2>
        <p className="text-gray-500 text-sm">Seleccioná tu método de pago preferido</p>
      </div>
      
      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
        <p className="text-[#0057a5] text-xs font-bold uppercase tracking-wider text-center mb-1">Monto a señar:</p>
        <p className="text-4xl font-black text-[#0057a5] text-center">
          $ {senaAmount.toLocaleString('es-AR')}
        </p>
      </div>

      <div className="space-y-4">
        {/* Mercado Pago */}
        <div className="space-y-2">
          <Button 
            variant="outline"
            className={`w-full h-16 justify-between px-6 rounded-xl border-gray-200 transition-all ${paymentMethod === 'mercadopago' ? 'border-[#0057a5] bg-blue-50/50' : 'bg-white'}`}
            onClick={() => setPaymentMethod('mercadopago')}
          >
            <span className={`font-bold text-lg ${paymentMethod === 'mercadopago' ? 'text-[#0057a5]' : 'text-gray-700'}`}>Mercado Pago</span>
            <ExternalLink className="w-5 h-5 text-gray-400" />
          </Button>

          {paymentMethod === 'mercadopago' && (
            <Button 
              className="w-full bg-[#009EE3] hover:bg-[#0086c3] text-white font-bold h-12 rounded-xl shadow-md animate-in fade-in slide-in-from-top-2"
              onClick={handleMercadoPago}
            >
              <CreditCard className="mr-2 w-5 h-5" /> Ir a pagar con Mercado Pago
            </Button>
          )}
        </div>

        {/* Transferencia */}
        <div className="space-y-2">
          <Button 
            variant="outline"
            className={`w-full h-16 justify-between px-6 rounded-xl border-gray-200 transition-all ${paymentMethod === 'transfer' ? 'border-[#0057a5] bg-blue-50/50' : 'bg-white'}`}
            onClick={() => setPaymentMethod('transfer')}
          >
            <span className={`font-bold text-lg ${paymentMethod === 'transfer' ? 'text-[#0057a5]' : 'text-gray-700'}`}>Transferencia Bancaria</span>
            <div className="w-5 h-5 rounded-full border-2 border-gray-200" />
          </Button>

          {paymentMethod === 'transfer' && (
            <Card className="p-5 bg-white border-slate-200 border rounded-xl space-y-3 shadow-sm animate-in fade-in zoom-in-95">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest text-center">Datos para transferir</p>
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border border-slate-100">
                <div className="text-left">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Alias de la cuenta</p>
                  <p className="text-[#0057a5] font-bold text-sm uppercase">C.CTE.MARIJO.GALICIA</p>
                </div>
                <Button variant="ghost" size="icon" className="hover:bg-orange-50" onClick={() => copyToClipboard('C.CTE.MARIJO.GALICIA')}>
                  <Copy className="w-5 h-5 text-orange-500" />
                </Button>
              </div>
              <p className="text-center text-[11px] text-gray-500 font-bold uppercase">MARIJO S.A.</p>
            </Card>
          )}
        </div>
      </div>

      <div className="pt-2">
        <Input type="file" id="receipt" className="hidden" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
        <label 
          htmlFor="receipt" 
          className={`cursor-pointer flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 transition-all ${receiptFile ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-slate-50'}`}
        >
          <Upload className={`w-10 h-10 mb-2 ${receiptFile ? 'text-green-600' : 'text-slate-400'}`} />
          <span className="text-xs text-gray-600 font-bold uppercase tracking-tight text-center">
            {receiptFile ? receiptFile.name : 'Subir comprobante de pago'}
          </span>
        </label>
      </div>

      {error && <p className="text-red-500 text-xs text-center font-bold">{error}</p>}

      <Button 
        className="w-full h-16 bg-[#0057a5] hover:bg-[#004a8d] text-white text-lg font-extrabold rounded-xl shadow-xl transition-all active:scale-95 disabled:opacity-50" 
        disabled={loading || !receiptFile} 
        onClick={handleUploadReceipt}
      >
        {loading ? (
          <div className="flex items-center">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            PROCESANDO...
          </div>
        ) : 'FINALIZAR RESERVA'}
      </Button>
    </div>
  )
}