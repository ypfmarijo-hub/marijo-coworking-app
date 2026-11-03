'use client'

// Herramientas nuevas del panel del staff:
//  - Extensiones de estadía (pedidos que llegan desde la pizarra) para confirmar o rechazar
//  - Ajustes: café de la pizarra y beneficio por horas
//  - Validar beneficio (código BN-XXXX o teléfono)
//  - Buscar reserva por nombre, teléfono o código (para dar el código a quien lo olvidó)
//  - Activar avisos en este celular

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WORKSPACE_LABELS, WorkspaceType } from '@/lib/types'
import { enablePush, pushEnabled } from '@/lib/push-client'
import { Bell, BellRing, Clock, Gift, Loader2, Search, Settings, Star, Users, X } from 'lucide-react'

const pesos = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className={`bg-white w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center gap-3">
          <h2 className="flex-1 text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ extensiones */
export interface ExtensionRequest {
  id: string; hours: number; amount: number; method: string; status: 'pendiente' | 'confirmada' | 'rechazada'
  createdAt: string; customer: string; place: string; code: string; timeTo: string
}

/** Lee los pedidos de extensión cada 10 s. `onNew` se llama cuando entra uno pendiente nuevo (para sonar). */
export function useExtensions(onNew: () => void) {
  const [items, setItems] = useState<ExtensionRequest[]>([])
  const seen = useRef<Set<string> | null>(null)
  const onNewRef = useRef(onNew)
  onNewRef.current = onNew
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/staff/extensions', { cache: 'no-store' })
      if (!res.ok) return
      const data: ExtensionRequest[] = await res.json()
      const pendingIds = data.filter((x) => x.status === 'pendiente').map((x) => x.id)
      if (seen.current && pendingIds.some((id) => !seen.current!.has(id))) onNewRef.current()
      seen.current = new Set(pendingIds)
      setItems(data)
    } catch { /* sin conexión: se reintenta en 10 s */ }
  }, [])
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t) }, [load])
  return { items, reload: load, pending: items.filter((x) => x.status === 'pendiente').length }
}

export function ExtensionsModal({ items, reload, onClose, onConfirmed }: { items: ExtensionRequest[]; reload: () => Promise<void>; onClose: () => void; onConfirmed: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const act = async (id: string, action: 'confirmar' | 'rechazar') => {
    setBusy(id); setError('')
    try {
      const res = await fetch(`/api/staff/extensions/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data.error || 'No se pudo completar.')
      else if (action === 'confirmar') onConfirmed()
      await reload()
    } finally { setBusy(null) }
  }
  const pending = items.filter((x) => x.status === 'pendiente')
  const done = items.filter((x) => x.status !== 'pendiente')
  return (
    <Modal title="Extensiones de estadía" onClose={onClose}>
      <p className="text-sm text-slate-600">Los clientes piden más horas desde la pizarra. Al confirmar, se extiende el horario y esas horas se suman a lo que paga en caja al irse.</p>
      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      {pending.length === 0 && <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4 text-center">No hay pedidos pendientes.</p>}
      {pending.map((x) => (
        <div key={x.id} className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 space-y-2">
          <div className="flex justify-between gap-3">
            <div>
              <p className="font-bold text-slate-900">{x.customer} · {x.code}</p>
              <p className="text-sm text-slate-600">{x.place} · hoy hasta las {x.timeTo}</p>
            </div>
            <div className="text-right">
              <p className="font-bold">+{x.hours} h</p>
              <p className="text-sm font-bold text-[#0057a5]">{pesos(x.amount)}</p>
            </div>
          </div>
          <p className="text-sm text-slate-700">Se suma a su cuenta: <b>{pesos(x.amount)}</b> (lo paga en caja al irse).</p>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy === x.id} onClick={() => act(x.id, 'confirmar')} className="h-11 px-4 rounded-lg bg-green-600 text-white text-sm font-bold disabled:opacity-60">
              {busy === x.id ? <Loader2 className="w-4 h-4 animate-spin" /> : `Confirmar extensión hasta las ${addH(x.timeTo, x.hours)}`}
            </button>
            <button disabled={busy === x.id} onClick={() => act(x.id, 'rechazar')} className="h-11 px-4 rounded-lg border border-red-300 text-red-700 bg-white text-sm font-bold disabled:opacity-60">Rechazar</button>
          </div>
        </div>
      ))}
      {done.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Resueltos (últimas 24 h)</p>
          {done.map((x) => (
            <div key={x.id} className="flex justify-between text-sm rounded-lg bg-slate-50 px-3 py-2">
              <span>{x.customer} · +{x.hours} h · {pesos(x.amount)}</span>
              <b className={x.status === 'confirmada' ? 'text-green-700' : 'text-red-700'}>{x.status === 'confirmada' ? 'Confirmada' : 'Rechazada'}</b>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
function addH(t: string, h: number) {
  if (!t) return ''
  const [hh, mm] = t.split(':').map(Number)
  const m = hh * 60 + mm + h * 60
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/* ------------------------------------------------------------ ajustes */
interface ComboRow { id: string; name: string; workspace: WorkspaceType; hours: number; price: number; active: boolean }
interface TierRow { id: string; hours: number; text: string }
interface SettingsData { cafeEnabled: boolean; benefitsEnabled: boolean; deskDepositRequired: boolean; askDni?: boolean; benefitTiers: TierRow[]; benefitHours: number; benefitText: string; cafeGiftName: string; cafeGiftPrice: number; cafeGiftOptions: string[]; cafeGiftMessages: string[]; cafeMenuPrice?: number | null
  prices: Record<WorkspaceType, number>; combos: ComboRow[] }
const SPACE_ORDER: WorkspaceType[] = ['escritorio', 'sala-a', 'sala-b', 'sala-grande', 'oficina-c', 'oficina-d']

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative w-[52px] h-8 rounded-full flex-shrink-0 transition-colors ${on ? 'bg-[#0057a5]' : 'bg-slate-300'}`}>
      <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<SettingsData | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { fetch('/api/staff/settings', { cache: 'no-store' }).then((r) => r.json()).then(setS).catch(() => setMsg('No se pudieron cargar los ajustes.')) }, [])
  const save = async (state?: SettingsData, okMsg?: string) => {
    const cur = state || s
    if (!cur) return
    setSaving(true); setMsg('')
    const res = await fetch('/api/staff/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cafeEnabled: cur.cafeEnabled, benefitsEnabled: cur.benefitsEnabled, benefitTiers: cur.benefitTiers.filter((t) => t.hours >= 1 && t.text.trim()), deskDepositRequired: !!cur.deskDepositRequired, askDni: cur.askDni !== false, cafeGiftName: cur.cafeGiftName, cafeGiftPrice: cur.cafeGiftPrice || 0, cafeGiftOptions: cur.cafeGiftOptions, cafeGiftMessages: cur.cafeGiftMessages,
        prices: cur.prices, combos: cur.combos }) })
    setSaving(false)
    if (res.ok) { const d = await res.json().catch(() => null); if (d) setS((prev) => prev ? { ...prev, prices: d.prices, combos: d.combos, benefitTiers: d.benefitTiers ?? prev.benefitTiers } : prev); setUnsaved([]) }
    setMsg(res.ok ? (okMsg || 'Guardado. Los clientes ven el cambio al instante. Las reservas ya hechas mantienen su precio.') : 'No se pudo guardar.')
  }
  // combo nuevo
  const [unsaved, setUnsaved] = useState<string[]>([])
  const [newOpt, setNewOpt] = useState('') // nueva opción del café de regalo
  const [nc, setNc] = useState<{ name: string; workspace: WorkspaceType; hours: number; price: string }>({ name: '', workspace: 'escritorio', hours: 4, price: '' })
  const addCombo = () => {
    if (!s || !nc.name.trim() || !Number(nc.price) || !(nc.hours >= 1)) { setMsg('Para agregar un combo completá nombre, horas y precio.'); return }
    const id = `c${Date.now().toString(36)}`
    const next = { ...s, combos: [...s.combos, { id, name: nc.name.trim(), workspace: nc.workspace, hours: nc.hours, price: Math.round(Number(nc.price)), active: true }] }
    setS(next)
    setUnsaved((u) => [...u, id])
    setNc({ name: '', workspace: nc.workspace, hours: 4, price: '' })
    setMsg(`Combo "${nc.name.trim()}" agregado a la lista, SIN GUARDAR. Los clientes no lo ven hasta que toques "Guardar ajustes".`)
  }
  const setCombo = (id: string, patch: Partial<ComboRow>) => s && setS({ ...s, combos: s.combos.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  return (
    <Modal title="Ajustes" onClose={onClose}>
      {!s ? <Loader2 className="w-6 h-6 animate-spin text-[#0057a5] mx-auto" /> : (
        <>
          <div className="rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-bold">Invitar un café (pizarra)</p>
                <p className="text-sm text-slate-500">Los clientes pueden invitarle un café a otra persona de la sala.</p>
              </div>
              <Switch on={s.cafeEnabled} onChange={(v) => setS({ ...s, cafeEnabled: v })} label="Invitar un café" />
            </div>
            {s.cafeEnabled && (
              <div className="space-y-3 pt-1">
                <p className="text-sm text-slate-600">Siempre es el mismo café. Lo paga quien invita (se suma a su cuenta) y quien lo recibe elige cómo lo quiere.</p>
                <div className="grid grid-cols-[1fr_120px] gap-2">
                  <label className="text-sm font-bold text-slate-600">Qué café es
                    <input value={s.cafeGiftName} maxLength={60} onChange={(e) => setS({ ...s, cafeGiftName: e.target.value })}
                      className="mt-1 w-full h-11 rounded-lg border border-slate-300 px-3 font-normal" placeholder="Café chico" />
                  </label>
                  <label className="text-sm font-bold text-slate-600">Precio
                    <span className="mt-1 relative block">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-normal">$</span>
                      <input type="number" min={0} step={100} value={s.cafeGiftPrice || ''} onChange={(e) => setS({ ...s, cafeGiftPrice: Number(e.target.value) })}
                        className="w-full h-11 rounded-lg border border-slate-300 pl-7 pr-2 font-normal" placeholder="0" />
                    </span>
                  </label>
                </div>
                {!(s.cafeGiftPrice > 0) && (s.cafeMenuPrice
                  ? <p className="text-sm bg-blue-50 text-slate-700 rounded-lg p-2.5">Sin precio acá, se usa el del menú: <b>{pesos(s.cafeMenuPrice)}</b> (producto "{s.cafeGiftName}"). Si querés otro precio para el regalo, escribilo arriba.</p>
                  : <p className="text-sm bg-amber-50 text-amber-900 rounded-lg p-2.5">Poné el precio del café: hasta que tenga precio, el botón "Invitar un café" no aparece.</p>)}
                <div>
                  <p className="text-sm font-bold text-slate-600 mb-1.5">Cómo lo puede pedir quien lo recibe</p>
                  <div className="flex flex-wrap gap-2">
                    {s.cafeGiftOptions.map((o) => (
                      <span key={o} className="inline-flex items-center gap-1 h-9 pl-3 pr-1 rounded-full bg-blue-50 border border-[#0057a5]/30 text-sm font-semibold text-[#0057a5]">
                        {o}
                        <button type="button" aria-label={`Quitar ${o}`} disabled={s.cafeGiftOptions.length <= 1}
                          onClick={() => setS({ ...s, cafeGiftOptions: s.cafeGiftOptions.filter((x) => x !== o) })}
                          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-blue-100 disabled:opacity-30"><X className="w-3.5 h-3.5" /></button>
                      </span>
                    ))}
                  </div>
                  <form className="flex gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); const v = newOpt.trim(); if (v && !s.cafeGiftOptions.includes(v) && s.cafeGiftOptions.length < 10) setS({ ...s, cafeGiftOptions: [...s.cafeGiftOptions, v] }); setNewOpt('') }}>
                    <input value={newOpt} maxLength={40} onChange={(e) => setNewOpt(e.target.value)} placeholder="Agregar otra (ej. Con leche de almendras)"
                      className="flex-1 min-w-0 h-10 rounded-lg border border-slate-300 px-3 text-sm" aria-label="Nueva opción de café" />
                    <button type="submit" className="h-10 px-3 rounded-lg border-2 border-[#0057a5] text-[#0057a5] text-sm font-bold">Agregar</button>
                  </form>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-600 mb-1">Mensajes ya escritos para quien invita</p>
                  <p className="text-xs text-slate-500 mb-2">El primero aparece puesto; los otros se eligen con un toque. Quien invita lo puede cambiar antes de enviar.</p>
                  <div className="space-y-2">
                    {s.cafeGiftMessages.map((m, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <textarea value={m} rows={3} maxLength={200} aria-label={`Mensaje ${i + 1}`}
                          onChange={(e) => setS({ ...s, cafeGiftMessages: s.cafeGiftMessages.map((x, j) => (j === i ? e.target.value : x)) })}
                          className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                        <button type="button" aria-label={`Quitar mensaje ${i + 1}`} disabled={s.cafeGiftMessages.length <= 1}
                          onClick={() => setS({ ...s, cafeGiftMessages: s.cafeGiftMessages.filter((_, j) => j !== i) })}
                          className="h-10 px-3 rounded-lg border border-slate-300 text-sm font-bold text-slate-600 disabled:opacity-40">Quitar</button>
                      </div>
                    ))}
                  </div>
                  {s.cafeGiftMessages.length < 8 && (
                    <button type="button" onClick={() => setS({ ...s, cafeGiftMessages: [...s.cafeGiftMessages, '¡Hola! '] })}
                      className="mt-2 h-10 px-3 rounded-lg border-2 border-dashed border-[#0057a5]/40 text-[#0057a5] text-sm font-bold">+ Agregar otro mensaje</button>
                  )}
                </div>
                <p className="text-xs text-slate-500">Se guarda con "Guardar ajustes".</p>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-bold">Beneficio por horas del mes</p>
                <p className="text-sm text-slate-500">Al llegar a las horas, el cliente recibe un código para usar en la caja.</p>
              </div>
              <Switch on={s.benefitsEnabled} onChange={(v) => setS({ ...s, benefitsEnabled: v })} label="Beneficio por horas" />
            </div>
            {s.benefitsEnabled && (
              <>
                <p className="text-sm text-slate-600">Podés poner varios (ej: 10, 15 y 20 horas). El cliente elige cuál usar; <b>al usar uno, sus horas vuelven a cero</b>. Si no usa ninguno, sigue sumando.</p>
                <div className="space-y-2">
                  {s.benefitTiers.map((t, i) => (
                    <div key={t.id} className="grid grid-cols-[76px_1fr_auto] gap-2 items-center">
                      <label className="relative">
                        <span className="sr-only">Horas del beneficio {i + 1}</span>
                        <input type="number" min={1} max={300} value={t.hours} onChange={(e) => setS({ ...s, benefitTiers: s.benefitTiers.map((x) => x.id === t.id ? { ...x, hours: Number(e.target.value) } : x) })}
                          className="w-full h-11 rounded-lg border border-slate-300 pl-3 pr-6" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">h</span>
                      </label>
                      <input value={t.text} maxLength={120} aria-label={`Qué gana con el beneficio ${i + 1}`} placeholder="Ej: 10% de descuento"
                        onChange={(e) => setS({ ...s, benefitTiers: s.benefitTiers.map((x) => x.id === t.id ? { ...x, text: e.target.value } : x) })}
                        className="w-full min-w-0 h-11 rounded-lg border border-slate-300 px-3" />
                      <button type="button" disabled={s.benefitTiers.length <= 1} onClick={() => setS({ ...s, benefitTiers: s.benefitTiers.filter((x) => x.id !== t.id) })}
                        className="h-11 px-3 rounded-lg border border-slate-300 text-sm font-bold text-slate-600 disabled:opacity-40">Quitar</button>
                    </div>
                  ))}
                </div>
                {s.benefitTiers.length < 10 && (
                  <button type="button" onClick={() => {
                    const last = s.benefitTiers[s.benefitTiers.length - 1]
                    setS({ ...s, benefitTiers: [...s.benefitTiers, { id: `b${Date.now().toString(36)}`, hours: (last?.hours || 5) + 5, text: '' }] })
                  }} className="h-10 px-3 rounded-lg border-2 border-dashed border-[#0057a5]/40 text-[#0057a5] text-sm font-bold">+ Agregar otro beneficio</button>
                )}
                <p className="text-xs text-slate-500">Cuentan las horas de reservas del mes calendario. Los cambios se guardan con "Guardar ajustes".</p>
              </>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-bold">Seña del 50% en escritorios</p>
                <p className="text-sm text-slate-500">{s.deskDepositRequired
                  ? 'Activado: para reservar un escritorio compartido el cliente tiene que subir el comprobante de la seña.'
                  : 'Apagado: los escritorios se reservan sin seña y se paga todo en el lugar.'}</p>
              </div>
              <Switch on={!!s.deskDepositRequired} onChange={(v) => setS({ ...s, deskDepositRequired: v })} label="Seña del 50% en escritorios" />
            </div>
            <p className="text-xs text-slate-500">Las salas y oficinas siempre piden la seña del 50% como compromiso.</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-bold">Pedir DNI al reservar</p>
                <p className="text-sm text-slate-500">{s.askDni !== false
                  ? 'Activado: al reservar por la app se pide el DNI una sola vez (es opcional). Sirve para saber la edad aproximada.'
                  : 'Apagado: no se pide DNI. Las chicas pueden marcar la edad aproximada en la tarjeta de la reserva.'}</p>
              </div>
              <Switch on={s.askDni !== false} onChange={(v) => setS({ ...s, askDni: v })} label="Pedir DNI al reservar" />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div>
              <p className="font-bold">Precio por hora</p>
              <p className="text-sm text-slate-500">Lo que se cobra cuando el cliente reserva "por horas". Las reservas ya hechas no cambian.</p>
            </div>
            <div className="grid gap-2">
              {SPACE_ORDER.map((w) => (
                <label key={w} className="flex items-center gap-2 text-sm border-b border-slate-100 pb-2 last:border-0">
                  <span className="flex-1 min-w-0">{WORKSPACE_LABELS[w]}</span>
                  <span className="text-slate-500">$</span>
                  <input type="number" min={0} step={500} id={`precio-${w}`} value={s.prices[w] ?? 0}
                    onChange={(e) => setS({ ...s, prices: { ...s.prices, [w]: Number(e.target.value) } })}
                    className="w-28 h-10 rounded-lg border border-slate-300 px-2 tabular-nums" aria-label={`Precio por hora de ${WORKSPACE_LABELS[w]}`} />
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div>
              <p className="font-bold">Combos</p>
              <p className="text-sm text-slate-500">Una cantidad fija de horas de un espacio a un precio especial. El cliente lo elige al reservar; si después quiere quedarse más, extiende a precio por hora.</p>
            </div>
            {s.combos.length === 0 && <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">Todavía no hay combos.</p>}
            {s.combos.map((c) => {
              const save = (s.prices[c.workspace] ?? 0) * c.hours - c.price
              return (
                <div key={c.id} className={`rounded-lg border p-3 flex flex-wrap items-center gap-3 ${c.active ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
                  <div className="flex-1 min-w-[160px]">
                    <p className="font-bold">{c.name} {unsaved.includes(c.id) && <span className="ml-1 text-[10px] font-black uppercase bg-amber-500 text-white px-1.5 py-0.5 rounded align-middle">Sin guardar</span>}</p>
                    <p className="text-sm text-slate-600">{WORKSPACE_LABELS[c.workspace]} · {c.hours} h · {pesos(c.price)}</p>
                    {save > 0 && <p className="text-xs font-bold text-green-700">El cliente ahorra {pesos(save)}</p>}
                  </div>
                  <Switch on={c.active} onChange={(v) => setCombo(c.id, { active: v })} label={`Combo ${c.name} activo`} />
                  <button type="button" onClick={() => setS({ ...s, combos: s.combos.filter((x) => x.id !== c.id) })} className="h-9 px-3 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600">Quitar</button>
                </div>
              )
            })}
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 grid grid-cols-2 gap-2 items-end">
              <label className="col-span-2 text-xs font-bold text-slate-600 grid gap-1 min-w-0">Nombre
                <input id="combo-nombre" value={nc.name} maxLength={40} onChange={(e) => setNc({ ...nc, name: e.target.value })} placeholder="Ej: Medio día" className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-2 bg-white text-sm font-normal" /></label>
              <label className="col-span-2 text-xs font-bold text-slate-600 grid gap-1 min-w-0">Espacio
                <select id="combo-espacio" value={nc.workspace} onChange={(e) => setNc({ ...nc, workspace: e.target.value as WorkspaceType })} className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-2 bg-white text-sm font-normal">
                  {SPACE_ORDER.map((w) => <option key={w} value={w}>{WORKSPACE_LABELS[w]}</option>)}
                </select></label>
              <label className="text-xs font-bold text-slate-600 grid gap-1 min-w-0">Horas
                <input id="combo-horas" type="number" min={1} max={15} value={nc.hours} onChange={(e) => setNc({ ...nc, hours: Number(e.target.value) })} className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-2 bg-white text-sm font-normal" /></label>
              <label className="text-xs font-bold text-slate-600 grid gap-1 min-w-0">Precio ($)
                <input id="combo-precio" type="number" min={0} step={500} value={nc.price} onChange={(e) => setNc({ ...nc, price: e.target.value })} placeholder="24000" className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-2 bg-white text-sm font-normal" /></label>
              <button type="button" onClick={addCombo} className="col-span-2 h-10 rounded-lg border-2 border-[#0057a5] text-[#0057a5] font-bold text-sm">Agregar combo</button>
            </div>
          </div>
          {msg && <p role="status" className="text-sm font-semibold text-slate-700">{msg}</p>}
          <button onClick={() => save()} disabled={saving} className="w-full h-12 rounded-xl bg-[#0057a5] text-white font-bold disabled:opacity-60">{saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Guardar ajustes'}</button>
        </>
      )}
    </Modal>
  )
}

/* ------------------------------------------------------------ validar beneficio */
interface BenefitRow { id: string; code: string; description: string; customer: string; period: string; hours: number; usedAt: string | null; options?: { id: string; hours: number; text: string }[] }

export function BenefitModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<BenefitRow[] | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const search = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setBusy(true); setErr('')
    const res = await fetch('/api/staff/benefits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setErr(data.error || 'No se pudo buscar.'); setRows(null); return }
    setRows(data)
  }
  const [done, setDone] = useState('')
  const use = async (id: string, tierId: string, text: string) => {
    const res = await fetch('/api/staff/benefits/use', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, tierId }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) setErr(data.error || 'Ese beneficio ya fue usado.')
    else setDone(`Listo: se aplicó "${text}". Las horas del cliente vuelven a contar desde cero.`)
    search()
  }
  return (
    <Modal title="Validar beneficio" onClose={onClose}>
      <form onSubmit={search} className="flex gap-2">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código BN-XXXX o teléfono" aria-label="Código o teléfono"
          className="flex-1 min-w-0 h-12 rounded-xl border border-slate-300 px-3" />
        <button className="h-12 px-4 rounded-xl bg-[#0057a5] text-white font-bold" disabled={busy}>{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buscar'}</button>
      </form>
      {err && <p role="alert" className="text-sm font-semibold text-red-600">{err}</p>}
      {done && <p role="status" className="text-sm font-semibold text-green-700">{done}</p>}
      {rows && rows.length === 0 && <p className="text-sm text-slate-500">No hay beneficios con ese dato.</p>}
      {rows?.map((b) => (
        <div key={b.id} className={`rounded-xl border-2 p-4 space-y-1 ${b.usedAt ? 'border-slate-200 bg-slate-50' : 'border-green-300 bg-green-50'}`}>
          <p className="font-bold">{b.customer} · <span className="font-mono">{b.code}</span></p>
          <p className="text-sm">{b.description}</p>
          <p className="text-xs text-slate-500">Ganado en {b.period} con {b.hours.toLocaleString('es-AR')} h</p>
          {b.usedAt
            ? <p className="text-sm font-bold text-slate-600">Ya usado el {new Date(b.usedAt).toLocaleDateString('es-AR')}</p>
            : (b.options && b.options.length > 0 ? (
              <div className="pt-1 space-y-2">
                <p className="text-sm font-bold text-slate-700">{b.options.length > 1 ? `Tiene ${b.hours.toLocaleString('es-AR')} h: ¿cuál usa?` : `Tiene ${b.hours.toLocaleString('es-AR')} h:`}</p>
                {b.options.map((t) => (
                  <button key={t.id} onClick={() => use(b.id, t.id, t.text)} className="w-full min-h-11 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-bold text-left">
                    Usar {t.text} <span className="font-normal opacity-90">({t.hours} h)</span>
                  </button>
                ))}
                <p className="text-xs text-slate-500">Al usar uno, sus horas vuelven a cero. Si prefiere esperar, sigue sumando para el siguiente.</p>
              </div>
            ) : <p className="text-sm text-slate-500">Todavía no llegó a las horas de ningún beneficio.</p>)}
        </div>
      ))}
    </Modal>
  )
}

/* ------------------------------------------------------------ buscar reserva */
interface FoundReservation { id: string; date: string; time_from: string; time_to: string; first_name: string; last_name: string; phone: string; reservation_code: string; workspace: WorkspaceType; desk_number: number | null; status: string }

export function SearchModal({ onClose, onGoToDate }: { onClose: () => void; onGoToDate: (d: Date) => void }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<FoundReservation[] | null>(null)
  const [busy, setBusy] = useState(false)
  const search = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const term = q.trim().replace(/[,()%*\\]/g, ' ').trim()
    if (term.length < 2) return
    setBusy(true)
    const words = term.split(/\s+/).slice(0, 3)
    let query = createClient().from('reservations')
      .select('id, date, time_from, time_to, first_name, last_name, phone, reservation_code, workspace, desk_number, status')
    // cada palabra tiene que aparecer en el nombre, apellido, teléfono o código
    // sin importar tildes ni ñ: "sofia" encuentra "Sofía" (cada vocal/ñ vale por cualquier letra)
    const loose = (w: string) => w.replace(/[aeiouáéíóúüñ]/gi, '_').replace(/n/gi, '_')
    for (const raw of words) { const w = /^fw-?\d+$/i.test(raw) ? raw.replace(/^fw-?/i, '') : /^\d/.test(raw) ? raw : loose(raw); query = query.or(`first_name.ilike.%${w}%,last_name.ilike.%${w}%,phone.ilike.%${w}%,reservation_code.ilike.%${w}%`) }
    // solo las activas: confirmadas de hoy en adelante (las terminadas y canceladas no aparecen)
    const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)
    const { data } = await query.eq('status', 'confirmed').gte('date', today).order('date', { ascending: true }).order('time_from', { ascending: true }).limit(20)
    setRows((data as FoundReservation[]) ?? [])
    setBusy(false)
  }
  return (
    <Modal title="Buscar reserva" onClose={onClose} wide>
      <p className="text-sm text-slate-600">Por nombre, teléfono o código. Muestra solo las reservas activas (de hoy en adelante). Sirve para darle el código a un cliente que lo olvidó.</p>
      <form onSubmit={search} className="flex gap-2">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej: Martín Gómez, 3585…, F23" aria-label="Buscar reserva"
          className="flex-1 min-w-0 h-12 rounded-xl border border-slate-300 px-3" />
        <button className="h-12 px-4 rounded-xl bg-[#0057a5] text-white font-bold" disabled={busy}>{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buscar'}</button>
      </form>
      {rows && rows.length === 0 && <p className="text-sm text-slate-500">No hay reservas activas con ese dato.</p>}
      {rows?.map((r) => {
        const [y, m, d] = r.date.split('-').map(Number)
        const place = r.workspace === 'escritorio' && r.desk_number ? `Escritorio N.° ${r.desk_number}` : WORKSPACE_LABELS[r.workspace] || r.workspace
        return (
          <div key={r.id} className={`rounded-xl border p-3 flex flex-wrap items-center gap-3 ${r.status === 'cancelled' ? 'opacity-60' : ''}`}>
            <div className="flex-1 min-w-[180px]">
              <p className="font-bold">{r.first_name} {r.last_name}</p>
              <p className="text-sm text-slate-600">{d} {MONTHS[m - 1]} {y} · {r.time_from} a {r.time_to} · {place}</p>
              <p className="text-xs text-slate-500">{r.phone}{r.status === 'cancelled' ? ' · Cancelada' : ''}</p>
            </div>
            <span className="font-mono font-black text-lg text-[#0057a5] select-all">{r.reservation_code}</span>
            <button onClick={() => { onGoToDate(new Date(y, m - 1, d)); onClose() }} className="h-10 px-3 rounded-lg border border-slate-300 text-sm font-bold">Ver en la agenda</button>
          </div>
        )
      })}
    </Modal>
  )
}

/* ------------------------------------------------------------ opiniones */
interface FeedbackItem { id: string; rating: number; comment: string | null; customer: string; createdAt: string; read: boolean; visit: string }

/** Cuántas opiniones nuevas hay (se revisa cada minuto). */
export function useFeedbackCount() {
  const [unread, setUnread] = useState(0)
  const reload = useCallback(async () => {
    try { const r = await fetch('/api/staff/feedback', { cache: 'no-store' }); if (r.ok) setUnread((await r.json()).unread || 0) } catch { /* reintenta */ }
  }, [])
  useEffect(() => { reload(); const t = setInterval(reload, 60000); return () => clearInterval(t) }, [reload])
  return { unread, reload }
}

function StarsRow({ value }: { value: number }) {
  return <span className="text-amber-500 tracking-tight" aria-label={`${value} de 5 estrellas`}>{'★'.repeat(value)}<span className="text-slate-300">{'★'.repeat(5 - value)}</span></span>
}

export function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<{ items: FeedbackItem[]; average: number | null } | null>(null)
  useEffect(() => {
    fetch('/api/staff/feedback', { cache: 'no-store' }).then((r) => r.json()).then((d) => {
      setData(d)
      if (d?.unread) fetch('/api/staff/feedback', { method: 'POST' }).catch(() => {}) // al abrir, quedan como leídas
    }).catch(() => setData({ items: [], average: null }))
  }, [])
  return (
    <Modal title="Opiniones de los clientes" onClose={onClose} wide>
      {!data ? <Loader2 className="w-6 h-6 animate-spin text-[#0057a5] mx-auto" /> : data.items.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4 text-center">Todavía no hay opiniones. Los clientes pueden dejarla desde "Mis reservas" o al terminar su horario en la pizarra.</p>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3">
            <span className="text-3xl font-black text-amber-600 tabular-nums">{data.average?.toLocaleString('es-AR')}</span>
            <span className="text-sm text-slate-700">{data.items.length === 1 ? "de 1 opinión" : `promedio de ${data.items.length} opiniones`}<br /><StarsRow value={Math.round(data.average || 0)} /></span>
          </div>
          {data.items.map((f) => (
            <div key={f.id} className={`rounded-xl border p-3 space-y-1 ${f.read ? 'border-slate-200' : 'border-amber-300 bg-amber-50/40'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <StarsRow value={f.rating} />
                <b className="text-sm">{f.customer}</b>
                {!f.read && <span className="text-[10px] font-black uppercase bg-amber-500 text-white px-1.5 py-0.5 rounded">Nueva</span>}
                <span className="ml-auto text-xs text-slate-500">{new Date(f.createdAt).toLocaleDateString('es-AR')}</span>
              </div>
              {f.comment && <p className="text-sm text-slate-800">"{f.comment}"</p>}
              <p className="text-xs text-slate-500">{f.visit}</p>
            </div>
          ))}
        </>
      )}
    </Modal>
  )
}

/* ------------------------------------------------------------ barra de herramientas */
export function StaffToolbar({ pendingExtensions, onExtensions, onSettings, onBenefit, onSearch, unreadFeedback = 0, onFeedback, onClients }: {
  pendingExtensions: number; onExtensions: () => void; onSettings: () => void; onBenefit: () => void; onSearch: () => void
  unreadFeedback?: number; onFeedback?: () => void; onClients?: () => void
}) {
  const [push, setPush] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { setPush(pushEnabled()) }, [])
  const btn = 'h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 flex items-center gap-2 whitespace-nowrap'
  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
        <button onClick={onSearch} className={btn}><Search className="w-4 h-4" />Buscar reserva</button>
        <button onClick={onExtensions} className={`${btn} ${pendingExtensions > 0 ? '!border-amber-400 !bg-amber-50 !text-amber-900' : ''}`}>
          <Clock className="w-4 h-4" />Extensiones
          {pendingExtensions > 0 && <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">{pendingExtensions}</span>}
        </button>
        <button onClick={onBenefit} className={btn}><Gift className="w-4 h-4" />Validar beneficio</button>
        {onFeedback && (
          <button onClick={onFeedback} className={`${btn} ${unreadFeedback > 0 ? '!border-amber-400 !bg-amber-50 !text-amber-900' : ''}`}>
            <Star className="w-4 h-4" />Opiniones
            {unreadFeedback > 0 && <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">{unreadFeedback}</span>}
          </button>
        )}
        {onClients && <button onClick={onClients} className={btn}><Users className="w-4 h-4" />Clientes</button>}
        <button onClick={onSettings} className={btn}><Settings className="w-4 h-4" />Ajustes</button>
        <button onClick={async () => { const e = await enablePush('/api/staff/push'); if (e) setMsg(e); else { setPush(true); setMsg('Listo: este celular recibe avisos de pedidos, reservas y extensiones.') } }}
          className={`${btn} ${push ? '!border-green-300 !bg-green-50 !text-green-800' : ''}`}>
          {push ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}{push ? 'Avisos activos' : 'Activar avisos en este celular'}
        </button>
      </div>
      {msg && <p role="status" className="max-w-7xl mx-auto px-4 pb-2 text-sm text-slate-700">{msg} <button className="underline font-bold" onClick={() => setMsg('')}>OK</button></p>}
    </div>
  )
}

/* ------------------------------------------------------------ pagos registrados en caja */
export interface CashPayment { id: string; reservation_id: string; amount: number; method: string; note: string | null; created_by: string | null; created_at: string }
const PAY_METHODS: { id: string; label: string }[] = [
  { id: 'efectivo', label: 'Efectivo' }, { id: 'transferencia', label: 'Transferencia' },
  { id: 'mercadopago', label: 'MercadoPago' }, { id: 'tarjeta', label: 'Tarjeta' },
]
export const payMethodLabel = (m: string) => PAY_METHODS.find((x) => x.id === m)?.label || m

/** Lista de pagos de una reserva + formulario "Registrar pago". */
export function CashPayments({ reservationId, payments, suggested, onChange }: { reservationId: string; payments: CashPayment[]; suggested: number; onChange: () => void }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('efectivo')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const start = () => { setAmount(suggested > 0 ? String(suggested) : ''); setMethod('efectivo'); setNote(''); setErr(''); setOpen(true) }
  const save = async () => {
    setBusy(true); setErr('')
    const res = await fetch('/api/staff/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reservationId, amount: Number(amount), method, note }) })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setErr(d.error || 'No se pudo registrar.'); return }
    setOpen(false); onChange()
  }
  const remove = async (id: string) => { await fetch(`/api/staff/payments/${id}`, { method: 'DELETE' }); onChange() }
  return (
    <div className="mt-2 space-y-1.5 normal-case">
      {payments.map((p) => (
        <div key={p.id} className="flex items-center gap-2 text-[11px] font-semibold text-green-700">
          <span className="flex-1">Pagó en caja · {payMethodLabel(p.method)} · {new Date(p.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}{p.note ? ` · ${p.note}` : ''}</span>
          <span>- {pesos(p.amount)}</span>
          <button type="button" onClick={() => remove(p.id)} className="text-[10px] font-bold text-slate-400 underline hover:text-red-600">Anular</button>
        </div>
      ))}
      {!open ? (
        <button type="button" onClick={start} className="w-full h-9 rounded-lg border border-[#0057a5] text-[#0057a5] text-[12px] font-bold">Registrar pago</button>
      ) : (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <label htmlFor={`monto-${reservationId}`} className="text-[11px] font-bold text-slate-600">Monto $</label>
            <input id={`monto-${reservationId}`} type="number" min={1} step={100} value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-32 h-9 rounded-lg border border-slate-300 px-2 text-sm tabular-nums bg-white" />
          </div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cómo pagó">
            {PAY_METHODS.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)}
                className={`h-8 px-2.5 rounded-full text-[11px] font-bold border ${method === m.id ? 'bg-[#0057a5] text-white border-[#0057a5]' : 'bg-white text-slate-600 border-slate-300'}`}>{m.label}</button>
            ))}
          </div>
          <input aria-label="Nota (opcional)" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional): ej. pagó la mitad"
            className="w-full h-9 rounded-lg border border-slate-300 px-2 text-[12px] bg-white" />
          {err && <p role="alert" className="text-[11px] font-semibold text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 h-9 rounded-lg border border-slate-300 text-[12px] font-bold text-slate-600 bg-white">Cancelar</button>
            <button type="button" onClick={save} disabled={busy} className="flex-1 h-9 rounded-lg bg-green-600 text-white text-[12px] font-bold disabled:opacity-60">{busy ? '...' : 'Guardar pago'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
