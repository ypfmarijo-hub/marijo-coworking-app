// Recordatorio de puntos de la App YPF (Serviclub): los consumos del lugar también suman puntos al pagar en caja.
export const YPF_POINTS_TEXT = 'Al pagar en caja, cargá tus puntos en la App YPF: tu consumo acá también suma.'
export const YPF_POINTS_STAFF = 'Recordale que cargue sus puntos en la App YPF con lo que paga.'

export function YpfPointsTip({ text = YPF_POINTS_TEXT, className = '' }: { text?: string; className?: string }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border border-[#0057a5]/25 bg-white px-3 py-2.5 ${className}`} role="note">
      <span aria-hidden className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#0057a5] text-[0.625rem] font-black text-white">YPF</span>
      <p className="text-xs text-slate-700"><b className="text-[#0057a5]">Sumá puntos.</b> {text}</p>
    </div>
  )
}
