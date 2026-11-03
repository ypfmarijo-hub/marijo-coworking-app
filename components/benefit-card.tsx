'use client'

// Tarjeta de beneficios por horas (la usan la pizarra y "Mis reservas").
// Puede haber varios beneficios: el cliente ve cuáles ya ganó, cuál le falta y su código para la caja.

export interface ClientBenefit {
  hours: number
  threshold: number
  text: string
  tiers?: { id: string; hours: number; text: string; unlocked: boolean }[]
  available?: { id: string; hours: number; text: string }[]
  next?: { id: string; hours: number; text: string; missing: number } | null
  lastUsed?: { description: string; usedAt: string } | null
  code: string | null
  won: boolean
  used: boolean
}

const h = (n: number) => n.toLocaleString('es-AR')

export function BenefitCard({ b }: { b: ClientBenefit }) {
  const tiers = b.tiers && b.tiers.length ? b.tiers : [{ id: 'b1', hours: b.threshold, text: b.text, unlocked: b.won }]
  const top = tiers[tiers.length - 1].hours
  const target = b.next ? b.next.hours : top
  const pct = Math.min(100, (b.hours / Math.max(1, target)) * 100)
  const available = b.available ?? tiers.filter((t) => t.unlocked)
  return (
    <div className="bg-blue-50 rounded-xl p-3 space-y-2">
      <div className="flex justify-between items-baseline text-sm gap-2">
        <span className="font-bold">{available.length > 1 ? `¡Tenés ${available.length} beneficios para elegir!` : available.length === 1 ? '¡Ganaste un beneficio!' : 'Tus horas de este mes'}</span>
        <b className="whitespace-nowrap">{h(b.hours)} h</b>
      </div>
      <div className="h-2.5 rounded-full bg-white overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.round(b.hours)}>
        <div className="h-full bg-[#0057a5] rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-1">
        {tiers.map((t) => (
          <li key={t.id} className={`flex items-start gap-2 text-sm rounded-lg px-2 py-1.5 ${t.unlocked ? 'bg-green-100 text-green-900' : 'bg-white text-slate-600'}`}>
            <span className="font-bold whitespace-nowrap">{h(t.hours)} h</span>
            <span className="flex-1">{t.text}</span>
            <span className="text-xs font-bold whitespace-nowrap">{t.unlocked ? '✓ Lo podés usar' : `faltan ${h(Math.round((t.hours - b.hours) * 10) / 10)} h`}</span>
          </li>
        ))}
      </ul>
      {b.code && available.length > 0 && (
        <p className="text-sm">Mostrá en la caja el código <b className="font-mono tracking-wider select-all text-[#0057a5]">{b.code}</b>{available.length > 1 ? ' y elegí cuál usar' : ''}.</p>
      )}
      <p className="text-xs text-slate-600">
        {available.length > 0 && b.next
          ? 'Al usar uno, tus horas vuelven a cero. Si esperás, seguís sumando para uno mejor.'
          : available.length > 0 ? 'Al usarlo, tus horas vuelven a cero.' : b.next ? `Te faltan ${h(b.next.missing)} h para ${b.next.text}.` : ''}
        {b.lastUsed ? ` (Contamos desde que usaste "${b.lastUsed.description}" el ${new Date(b.lastUsed.usedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })}.)` : ''}
      </p>
    </div>
  )
}
