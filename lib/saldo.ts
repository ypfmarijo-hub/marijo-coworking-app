import type { SupabaseClient } from '@supabase/supabase-js'
import { getPricing, reservationBaseTotal } from './pricing'

/**
 * Plan FULL visto por el cliente: el valor del espacio es saldo a favor para consumir en el Market.
 * valor = lo que vale su reserva (con extensiones); consumo = sus pedidos (sin contar cafés regalados).
 */
export async function saldoFor(supabase: SupabaseClient, r: Record<string, any>) {
  const { prices } = await getPricing(supabase)
  const valor = reservationBaseTotal(r as any, prices) + Number(r.extra_amount || 0) + Number(r.extra_paid || 0)
  const { data } = await supabase
    .from('orders')
    .select('total_amount, status')
    .eq('reservation_id', r.id)
    .not('status', 'in', '("regalo_esperando","regalo_guardado","anulado")')
  const consumo = (data ?? []).reduce((a: number, o: any) => a + (Number(o.total_amount) || 0), 0)
  // Lo que ya pagó: la seña (si reservó con comprobante), extensiones pagadas antes y pagos anotados en la caja
  const sena = r.receipt_url ? Math.round(reservationBaseTotal(r as any, prices) * 0.5) : 0
  const { data: pays } = await supabase.from('payments').select('amount').eq('reservation_id', r.id)
  const pagado = sena + Number(r.extra_paid || 0) + (pays ?? []).reduce((a: number, p: any) => a + Number(p.amount || 0), 0)
  // Plan FULL: paga lo mayor entre el espacio y lo consumido
  const total = Math.max(valor, consumo)
  return { valor, consumo, restante: Math.max(0, valor - consumo), excedente: Math.max(0, consumo - valor), total, pagado, aPagar: Math.max(0, total - pagado) }
}
