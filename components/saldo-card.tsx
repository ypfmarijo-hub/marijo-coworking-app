'use client'

// Saldo a favor para consumo (Plan FULL), como lo ve el cliente: cuánto le queda, si se pasó cuánto es el extra,
// y cuánto tiene que pagar en caja al irse.
import { Coffee } from 'lucide-react'

export interface Saldo { valor: number; consumo: number; restante: number; excedente: number; total?: number; pagado?: number; aPagar?: number }

const $ = (n: number) => '$ ' + Math.round(n).toLocaleString('es-AR')

export function SaldoCard({ s, onClick, showYpf = true }: { s: Saldo; onClick?: () => void; showYpf?: boolean }) {
  const over = s.excedente > 0
  const aPagar = s.aPagar ?? Math.max(s.valor, s.consumo)
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={`block w-full text-left rounded-2xl border-2 px-4 py-3 ${over ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-bold text-slate-800 flex items-center gap-1.5"><Coffee className="w-4 h-4 text-[#0057a5] flex-shrink-0" />{over ? 'Ya usaste todo tu saldo para consumo' : 'Tu saldo a favor para consumo'}</span>
        <span className={`text-xl font-black whitespace-nowrap ${over ? 'text-amber-700' : 'text-green-700'}`}>{$(over ? 0 : s.restante)}</span>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-sm text-slate-700">
        <span>Tu espacio vale</span><span className="text-right">{$(s.valor)}</span>
        <span>Consumiste</span><span className="text-right">{s.consumo > 0 ? `- ${$(s.consumo)}` : $(0)}</span>
        {over
          ? <><span className="font-bold text-amber-800">Extra a pagar (te pasaste del saldo)</span><span className="text-right font-bold text-amber-800">+ {$(s.excedente)}</span></>
          : <><span className="font-bold text-green-800">Te queda para consumir</span><span className="text-right font-bold text-green-800">{$(s.restante)}</span></>}
        {(s.pagado ?? 0) > 0 && <><span className="text-slate-500">Ya pagaste</span><span className="text-right text-slate-500">- {$(s.pagado!)}</span></>}
      </div>
      <div className="mt-2 pt-2 border-t border-black/10 flex items-baseline justify-between gap-3">
        <span className="font-black text-slate-900 uppercase text-sm">A pagar en caja al irte</span>
        <span className="text-2xl font-black text-[#0057a5] whitespace-nowrap">{$(aPagar)}</span>
      </div>
      <p className="text-xs text-slate-600 mt-1">
        {over ? `Pagás lo que consumiste (${$(s.consumo)}): el espacio te sale sin costo.` : 'Si no usás el saldo, igual se paga el valor del espacio.'}
        {onClick ? ' Tocá para pedir.' : ''}
      </p>
      {showYpf && <p className="text-xs text-[#0057a5] font-semibold mt-1">Y al pagar, cargá tus puntos en la App YPF.</p>}
    </Tag>
  )
}
