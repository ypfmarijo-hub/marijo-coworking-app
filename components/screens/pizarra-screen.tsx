'use client'

import { SaldoCard, type Saldo } from '@/components/saldo-card'
import { YpfPointsTip, YPF_POINTS_TEXT, YPF_POINTS_STAFF } from '@/components/ypf-points-tip'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, Bell, Coffee, Gift, Loader2, LogOut, Pencil, Search, X } from 'lucide-react'
import { useReservation } from '@/lib/reservation-context'
import { BenefitCard, type ClientBenefit } from '@/components/benefit-card'
import { lastLocalCode, saveLocalCode } from '@/lib/local-codes'
import { FeedbackForm, Stars } from '@/components/feedback-form'
import { enablePush, pushEnabled, pushSupport } from '@/lib/push-client'

// ---------- tipos de lo que devuelve /api/pizarra/state
interface Person { id: string; name: string; rubro: string; offers: string[]; seeks: string[]; location: string; isOpen: boolean; whatsapp: string | null }
interface PzState {
  serverNow: number
  active: boolean
  ended: boolean
  me: { name: string; code: string; location: string; isOpen: boolean; timeFrom: string; timeTo: string; endMs: number; needsProfile: boolean; myRating: number | null
    saldo?: Saldo
    profile: { rubro: string; offers: string[]; seeks: string[]; showWhatsapp: boolean } | null }
  people: Person[]
  extend: { canExtend: boolean; maxHours: number; pricePerHour: number; pending: { hours: number; method: string } | null }
  cafe: { enabled: boolean; price: number | null; name?: string | null; options?: string[]; messages?: string[]; incoming: { id: string; fromName: string; fromLocation: string; message: string }[]
    saved: { id: string; fromName: string; message: string }[]; replies: { toName: string; reply: string }[] }
  benefit: ClientBenefit | null
}

const SUGERENCIAS = ['Marketing digital', 'Diseño web', 'Contabilidad', 'Impuestos', 'Asesoría legal', 'Desarrollo de software',
  'Ventas B2B', 'Inversión', 'Financiamiento', 'Asesoría agro', 'Red de productores', 'Logística', 'Fotografía', 'Recursos humanos']
const LUGARES = [...Array.from({ length: 12 }, (_, i) => `Escritorio N.° ${i + 1}`), 'Sala de reunión A', 'Sala de reunión B', 'Sala grande (A + B)', 'Oficina C', 'Oficina D']
const RESPUESTAS = ['¡Muchas gracias por el café!', '¡Gracias! Ahora voy y charlamos.', '¡Gracias! Lo tomamos después y charlamos.']

const pesos = (n: number) => '$ ' + Math.round(n).toLocaleString('es-AR')
const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const fmtLeft = (s: number) => s > 600
  ? `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min`
  : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const initials = (n: string) => n.split(' ').map((w) => w[0]).join('').replace('.', '').slice(0, 2).toUpperCase()
const HUES = ['#7C3AED', '#15803D', '#C2410C', '#0E7490', '#BE185D', '#4D7C0F', '#1D4ED8', '#9333EA']
const hue = (id: string) => HUES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length]

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo completar. Reintentá.')
  return data
}

/* ======================================================================= */
export function PizarraScreen() {
  const { phone: savedPhone, setPhone } = useReservation()
  const [phase, setPhase] = useState<'checking' | 'login' | 'profile' | 'board'>('checking')
  const [st, setSt] = useState<PzState | null>(null)
  const [toast, setToast] = useState('')
  const offset = useRef(0)
  const prevPending = useRef<PzState['extend']['pending']>(null)

  const showToast = useCallback((t: string) => {
    setToast(t)
    window.clearTimeout((showToast as any)._t)
    ;(showToast as any)._t = window.setTimeout(() => setToast(''), 4500)
  }, [])

  const load = useCallback(async () => {
    const res = await fetch('/api/pizarra/state', { cache: 'no-store' })
    if (res.status === 401) { setPhase('login'); setSt(null); return }
    if (!res.ok) return
    const data: PzState = await res.json()
    offset.current = data.serverNow - Date.now()
    // si estaba esperando la confirmación de una extensión y ya no, el staff resolvió
    if (prevPending.current && !data.extend.pending) {
      showToast(data.me.endMs > Date.now() ? `Extensión confirmada: tu estadía va hasta las ${data.me.timeTo}. La pagás en caja antes de irte.` : 'El staff revisó tu pedido de extensión.')
    }
    prevPending.current = data.extend.pending
    for (const r of data.cafe.replies) showToast(`${r.toName} te respondió: "${r.reply}"`)
    setSt(data)
    setPhase((p) => (data.me.needsProfile ? 'profile' : p === 'profile' ? 'profile' : 'board'))
  }, [showToast])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (phase !== 'board') return
    const t = window.setInterval(load, 10000)
    return () => window.clearInterval(t)
  }, [phase, load])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {phase === 'checking' && <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#0057a5]" /></div>}
      {phase === 'login' && <Login defaultPhone={savedPhone} onDone={(p) => { if (p) setPhone(p); setPhase('checking'); load() }} />}
      {phase === 'profile' && st && <Profile st={st} onSaved={() => { setPhase('board'); load() }} />}
      {phase === 'board' && st && <Board st={st} offset={offset.current} reload={load} toast={showToast} onEdit={() => setPhase('profile')}
        onLogout={async () => { await fetch('/api/pizarra/logout', { method: 'POST' }); setPhase('login'); setSt(null) }} />}
      {toast && (
        <div role="status" className="fixed left-4 right-4 top-4 z-[60] mx-auto max-w-md bg-slate-900 text-white rounded-2xl px-4 py-3 text-sm shadow-xl">{toast}</div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- ingreso */
function Login({ defaultPhone, onDone }: { defaultPhone: string; onDone: (phone: string) => void }) {
  const [phone, setPhone] = useState(defaultPhone || '')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [help, setHelp] = useState(false)
  useEffect(() => { setCode(lastLocalCode()) }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const data = await postJson('/api/pizarra/login', { phone, code })
      if (data.reservationId && data.code) saveLocalCode(data.reservationId, data.code)
      const clean = phone.replace(/\D/g, '')
      try { localStorage.setItem('user_phone', clean) } catch { /* sin almacenamiento */ }
      onDone(clean)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <>
      <div className="bg-[#0057a5] text-white px-5 pt-12 pb-6 space-y-2">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-blue-100">YPF MARIJO · Fullwork</p>
        <h1 className="text-2xl font-bold leading-tight">Bienvenido a la sala Fullwork</h1>
        <p className="text-sm text-blue-50">Completá tus datos y conectá con el resto de las personas que están en la sala.</p>
      </div>
      <div className="p-4 space-y-3 md:max-w-lg md:mx-auto md:w-full">
        <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <label htmlFor="pz-phone" className="block text-sm font-bold text-slate-600">Tu WhatsApp (el de tu reserva)</label>
          <input id="pz-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="358 576 9421"
            className="w-full h-12 rounded-xl border border-slate-300 px-3 text-base" />
          <label htmlFor="pz-code" className="block text-sm font-bold text-slate-600">Código de tu reserva</label>
          <input id="pz-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="F23" autoCapitalize="characters"
            className="w-full h-12 rounded-xl border border-slate-300 px-3 text-base font-mono tracking-wider" />
          {err && <p role="alert" className="text-sm font-semibold text-red-600">{err}</p>}
          <button type="submit" disabled={busy} className="w-full h-12 rounded-xl bg-[#0057a5] text-white font-bold disabled:opacity-60">
            {busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Entrar'}
          </button>
          <button type="button" onClick={() => setHelp(!help)} className="text-sm font-bold text-[#0057a5] underline">No me acuerdo el código</button>
          {help && (
            <div className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 space-y-1">
              <p>Pedíselo al staff: te lo dan en la caja o te lo mandan por WhatsApp. Lo buscan por tu nombre.</p>
            </div>
          )}
          <p className="text-xs text-slate-500">Solo entra quien tiene una reserva pagada y en curso. Cuando termina el horario, la pizarra se cierra.</p>
        </form>
      </div>
    </>
  )
}

/* ---------------------------------------------------------------- perfil */
function Profile({ st, onSaved }: { st: PzState; onSaved: () => void }) {
  const p = st.me.profile
  const [rubro, setRubro] = useState(p?.rubro || '')
  const [loc, setLoc] = useState(st.me.location)
  const [offers, setOffers] = useState<string[]>(p?.offers || [])
  const [seeks, setSeeks] = useState<string[]>(p?.seeks || [])
  const [wa, setWa] = useState(!!p?.showWhatsapp)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const lugares = LUGARES.includes(st.me.location) ? LUGARES : [st.me.location, ...LUGARES]

  const save = async () => {
    setBusy(true); setErr('')
    try { await postJson('/api/pizarra/profile', { rubro, offers, seeks, showWhatsapp: wa, location: loc }); onSaved() }
    catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <>
      <div className="bg-[#0057a5] text-white px-5 pt-12 pb-5 space-y-1">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-blue-100">{p ? 'Editar mi perfil' : 'Primera vez en la pizarra'}</p>
        <h1 className="text-2xl font-bold">Hola, {st.me.name.split(' ')[0]}</h1>
        <p className="text-sm text-blue-50">Se guarda para tus próximas visitas.</p>
      </div>
      <div className="p-4 space-y-3 pb-28 md:max-w-2xl md:mx-auto md:w-full">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <label htmlFor="pz-rubro" className="block text-sm font-bold text-slate-600">¿A qué te dedicás?</label>
          <input id="pz-rubro" value={rubro} onChange={(e) => setRubro(e.target.value)} maxLength={80} placeholder="Ej: Contadora, estudio propio"
            className="w-full h-12 rounded-xl border border-slate-300 px-3" />
          <label htmlFor="pz-loc" className="block text-sm font-bold text-slate-600 pt-1">¿Dónde estás sentado?</label>
          <select id="pz-loc" value={loc} onChange={(e) => setLoc(e.target.value)} className="w-full h-12 rounded-xl border border-slate-300 px-3 bg-white">
            {lugares.map((l) => <option key={l}>{l}</option>)}
          </select>
          <p className="text-xs text-slate-500">Lo completa la app con el lugar de tu reserva. Cambialo si te moviste.</p>
        </div>
        <TagPicker title="Qué ofrecés" values={offers} onChange={setOffers} placeholder="Otro (ej: Traducciones)" id="ofrece" />
        <TagPicker title="Qué buscás" values={seeks} onChange={setSeeks} placeholder="Otro (ej: Socio para un proyecto)" id="busca" />
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="font-bold text-sm">Mostrar mi WhatsApp (opcional)</p>
            <p className="text-xs text-slate-500">Aparece en tu tarjeta para que te escriban.</p>
          </div>
          <button type="button" role="switch" aria-checked={wa} aria-label="Mostrar mi WhatsApp" onClick={() => setWa(!wa)}
            className={`relative w-[52px] h-8 rounded-full transition-colors ${wa ? 'bg-[#0057a5]' : 'bg-slate-300'}`}>
            <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${wa ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
        {err && <p role="alert" className="text-sm font-semibold text-red-600">{err}</p>}
        <button onClick={save} disabled={busy} className="w-full h-12 rounded-xl bg-[#0057a5] text-white font-bold disabled:opacity-60">
          {busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : p ? 'Guardar cambios' : 'Entrar a la pizarra'}
        </button>
      </div>
    </>
  )
}

function TagPicker({ title, values, onChange, placeholder, id }: { title: string; values: string[]; onChange: (v: string[]) => void; placeholder: string; id: string }) {
  const [other, setOther] = useState('')
  const all = [...SUGERENCIAS, ...values.filter((v) => !SUGERENCIAS.includes(v))]
  const toggle = (t: string) => onChange(values.includes(t) ? values.filter((x) => x !== t) : [...values, t])
  const add = () => { const v = other.trim(); if (v && !values.some((x) => norm(x) === norm(v))) onChange([...values, v]); setOther('') }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
      <p className="text-sm font-bold text-slate-600">{title}</p>
      <p className="text-xs text-slate-500">Tocá las que correspondan o escribí la tuya.</p>
      <div className="flex flex-wrap gap-2">
        {all.map((t) => (
          <button key={t} type="button" aria-pressed={values.includes(t)} onClick={() => toggle(t)}
            className={`min-h-[38px] px-3 rounded-full border text-sm ${values.includes(t) ? 'bg-[#0057a5] border-[#0057a5] text-white font-bold' : 'bg-white border-slate-300 text-slate-700'}`}>{t}</button>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <input id={`otro-${id}`} aria-label={`Otro: ${title}`} value={other} onChange={(e) => setOther(e.target.value)} placeholder={placeholder} maxLength={40}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} className="flex-1 min-w-0 h-11 rounded-xl border border-slate-300 px-3 text-sm" />
        <button type="button" onClick={add} className="h-11 px-4 rounded-xl bg-[#0057a5] text-white text-sm font-bold">Agregar</button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- pizarra */
function Board({ st, offset, reload, toast, onEdit, onLogout }: { st: PzState; offset: number; reload: () => Promise<void>; toast: (t: string) => void; onEdit: () => void; onLogout: () => void }) {
  const { setCurrentScreen } = useReservation()
  const goToBar = () => { setCurrentScreen('market'); window.scrollTo(0, 0) }
  const [now, setNow] = useState(Date.now() + offset)
  const [q, setQ] = useState('')
  const [sheet, setSheet] = useState<null | 'extend' | 'cafe' | 'gifts' | 'opinion'>(null)
  const [rated, setRated] = useState<number | null>(st.me.myRating ?? null)
  const [cafeFor, setCafeFor] = useState<Person | null>(null)
  const [hours, setHours] = useState(1)
  const [pushState, setPushState] = useState<'on' | 'off'>(pushEnabled() ? 'on' : 'off')
  const warned = useRef(false)

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now() + offset), 1000); return () => window.clearInterval(t) }, [offset])
  const left = Math.max(0, Math.round((st.me.endMs - now) / 1000))
  const ended = st.ended || left === 0
  const low = left > 0 && left <= 600
  // no se ofrece extender mientras hay un pedido esperando confirmación del staff
  const canExtend = st.extend.canExtend && st.extend.maxHours > 0 && !st.extend.pending
  useEffect(() => {
    if (low && !warned.current) { warned.current = true; toast('Te quedan 10 minutos. Si querés quedarte más, tocá "Extender".'); navigator.vibrate?.(200) }
    if (!low) warned.current = false
  }, [low, toast])

  const people = useMemo(() => {
    const t = norm(q.trim())
    return t ? st.people.filter((p) => norm([p.name, p.rubro, p.location, ...p.offers, ...p.seeks].join(' ')).includes(t)) : st.people
  }, [q, st.people])

  // Abierto / En foco: cambia en pantalla al instante y se guarda por detrás (si falla, vuelve atrás y avisa)
  const [isOpen, setIsOpen] = useState(st.me.isOpen)
  const statusSeq = useRef(0)
  useEffect(() => { if (statusSeq.current === 0) setIsOpen(st.me.isOpen) }, [st.me.isOpen])
  const toggle = async () => {
    const next = !isOpen
    setIsOpen(next)
    navigator.vibrate?.(30)
    toast(next ? 'Listo: los demás ven que estás disponible para charlar.' : 'Listo: los demás ven que estás concentrado y no te van a interrumpir.')
    const mySeq = ++statusSeq.current
    try {
      await postJson('/api/pizarra/status', { isOpen: next })
      if (mySeq === statusSeq.current) { statusSeq.current = 0; reload() }
    } catch (e: any) {
      if (mySeq === statusSeq.current) { statusSeq.current = 0; setIsOpen(!next); toast(e.message || 'No se pudo cambiar. Probá de nuevo.') }
    }
  }
  const activatePush = async () => {
    const err = await enablePush('/api/pizarra/push')
    if (err) toast(err); else { setPushState('on'); toast('Listo: te vamos a avisar 10 minutos antes de que termine tu horario.') }
  }
  const incoming = st.cafe.incoming[0]

  return (
    <>
      <div className="bg-[#0057a5] text-white px-4 pt-10 pb-4 space-y-3 md:px-8 md:pt-8 md:grid md:grid-cols-[minmax(0,1fr)_26rem] md:gap-6 md:items-end md:space-y-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-blue-100">{ended ? 'Pizarra cerrada' : `En la sala ahora · ${st.people.length + 1} ${st.people.length === 0 ? 'persona' : 'personas'}`}</p>
            <h1 className="text-[1.375rem] font-bold">Pizarra Fullwork</h1>
          </div>
          <button onClick={onLogout} aria-label="Salir de la pizarra" className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center"><LogOut className="w-5 h-5" /></button>
        </div>
        <div className="bg-white text-slate-900 rounded-2xl p-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#0057a5] text-white font-bold flex items-center justify-center flex-shrink-0">{initials(st.me.name)}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold">Vos · {st.me.name}</p>
              <p className="text-xs text-slate-500 truncate">{st.me.location}</p>
              {!ended && (
                <button onClick={onEdit} aria-label="Editar mi info"
                  className="mt-1.5 h-9 px-3 rounded-full border-2 border-[#0057a5] text-[#0057a5] font-bold text-sm inline-flex items-center gap-1.5 active:bg-blue-50">
                  <Pencil className="w-4 h-4" strokeWidth={2.5} />Editar info
                </button>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[0.6875rem] text-slate-500">Te quedan</p>
              <p className={`font-bold tabular-nums ${low || ended ? 'text-red-600' : 'text-[#0057a5]'}`}>{fmtLeft(left)}</p>
              <p className="text-[0.6875rem] text-slate-500">hasta las {st.me.timeTo}</p>
            </div>
          </div>
          {!ended && (
            <button onClick={toggle} aria-pressed={isOpen}
              className={`w-full min-h-[3rem] rounded-xl flex items-center gap-3 px-3 font-bold text-left select-none touch-manipulation active:scale-[0.98] transition-transform ${isOpen ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>
              <span className={`w-3 h-3 flex-shrink-0 ${isOpen ? 'rounded-full bg-green-600' : 'rounded-sm bg-red-600'}`} />
              {isOpen ? 'Abierto a charlar' : 'En foco · no molestar'}
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-current bg-white/75 px-2.5 py-1 text-[0.8125rem] font-black">
                <ArrowLeftRight className="w-3.5 h-3.5" />Cambiar
              </span>
            </button>
          )}
          {st.cafe.saved.length > 0 && !ended && (
            <button onClick={() => setSheet('gifts')} className="w-full min-h-[2.75rem] rounded-xl border border-slate-200 flex items-center gap-2 px-3 text-left">
              <Gift className="w-4 h-4 text-[#0057a5]" /><span className="font-bold text-sm">Mis regalos ({st.cafe.saved.length})</span>
              <span className="text-xs text-slate-500">cafés para cuando quieras</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3 pb-28 md:px-8 md:pt-6">
        {st.extend.pending && <p role="status" className="text-sm bg-amber-50 text-amber-900 rounded-xl p-3">Le pediste al staff {st.extend.pending.hours} h más. Te avisamos acá cuando lo confirme.</p>}
        {ended ? (
          <div className="bg-white rounded-2xl border-2 border-red-300 p-4 space-y-2 md:max-w-xl">
            <p className="font-bold">Se terminó tu horario</p>
            <p className="text-sm text-slate-600">La pizarra se cerró: ya no ves a las demás personas ni te ven a vos.{canExtend ? ' Si querés seguir, extendé tu estadía.' : ''}</p>
            {canExtend && <button onClick={() => { setHours(1); setSheet('extend') }} className="w-full h-12 rounded-xl bg-[#0057a5] text-white font-bold">Extender estadía</button>}
            <div className="pt-3 border-t border-slate-200">
              {rated
                ? <p className="text-sm text-emerald-700 flex items-center gap-2"><Stars value={rated} /> ¡Gracias por tu opinión!</p>
                : <FeedbackForm onDone={(r) => { setRated(r); toast('¡Gracias! Tu opinión nos ayuda a mejorar.') }} />}
            </div>
          </div>
        ) : (
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-[22rem_minmax(0,1fr)] md:gap-6 md:items-start">
            {/* En la compu: columna izquierda fija con lo personal, a la derecha la gente de la sala */}
            <aside className="space-y-3 md:sticky md:top-4">
            {low && (
              <div role="status" className="flex items-center gap-3 bg-red-50 text-red-900 rounded-xl px-3 py-2">
                <span className="flex-1 text-sm font-medium">Te quedan menos de 10 minutos.</span>
                {canExtend && <button onClick={() => { setHours(1); setSheet('extend') }} className="h-10 px-3 rounded-lg bg-[#0057a5] text-white text-sm font-bold">Extender</button>}
              </div>
            )}
            {!low && canExtend && (
              <button onClick={() => { setHours(1); setSheet('extend') }} className="text-sm font-bold text-[#0057a5] underline">¿Te querés quedar más? Extender estadía</button>
            )}
            {pushState === 'off' && pushSupport() !== 'sin-config' && (
              <button onClick={activatePush} className="w-full flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-3 text-left">
                <Bell className="w-5 h-5 text-[#0057a5] flex-shrink-0" />
                <span className="text-sm"><b>Activar avisos</b> · te avisamos 10 minutos antes de que termine tu horario</span>
              </button>
            )}
            {st.me.saldo && st.me.saldo.valor > 0 && <SaldoCard s={st.me.saldo} onClick={ended ? undefined : goToBar} showYpf={!low && !ended} />}
            {(ended || low) && <YpfPointsTip text="Antes de irte, pasá por la caja y cargá tus puntos en la App YPF: tu espacio y tu consumo también suman." />}
            {st.benefit && <BenefitLine b={st.benefit} />}
            </aside>
            <section className="space-y-3 min-w-0">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: contador, diseño, agro…" aria-label="Buscar en la pizarra"
                className="w-full h-12 rounded-xl border border-slate-300 bg-white pl-9 pr-3" />
            </div>
            {people.length === 0 && <p className="text-center text-sm text-slate-500 py-6">{q ? 'Nadie coincide con esa búsqueda.' : 'Todavía no hay nadie más en la pizarra.'}</p>}
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {people.map((p) => (
              <article key={p.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full text-white font-bold flex items-center justify-center flex-shrink-0" style={{ background: hue(p.id) }}>{initials(p.name)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">{p.name}</p>
                    <p className="text-sm text-slate-700">{p.rubro}</p>
                    <p className="text-xs text-slate-500">{p.location}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${p.isOpen ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>
                    <span className={`w-2 h-2 ${p.isOpen ? 'rounded-full bg-green-600' : 'rounded-sm bg-red-600'}`} />{p.isOpen ? 'Abierto' : 'En foco'}
                  </span>
                </div>
                {p.offers.length > 0 && <TagRow label="Ofrece" tags={p.offers} />}
                {p.seeks.length > 0 && <TagRow label="Busca" tags={p.seeks} />}
                {p.whatsapp && <p className="text-sm text-slate-600">WhatsApp: <b className="select-all tabular-nums text-slate-900">{p.whatsapp}</b></p>}
                {p.isOpen ? (
                  st.cafe.enabled && <button onClick={() => { setCafeFor(p); setSheet('cafe') }} className="w-full h-11 rounded-xl border-[1.5px] border-[#0057a5] text-[#0057a5] font-bold flex items-center justify-center gap-2"><Coffee className="w-4 h-4" />Invitar un café</button>
                ) : (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5">Ahora está concentrado.{st.cafe.enabled ? ' Cuando vuelva a "Abierto" vas a poder invitarle un café.' : ''}</p>
                )}
              </article>
            ))}
            </div>
            <button onClick={() => setSheet('opinion')} className="w-full rounded-2xl border-2 border-[#0057a5]/30 bg-white text-center text-base font-bold text-[#0057a5] py-4 hover:bg-blue-50">
              {rated ? '¡Gracias por tu opinión! Cambiarla' : '¿Cómo te está yendo? Dejanos tu opinión'}
            </button>
            </section>
          </div>
        )}
      </div>

      {sheet === 'extend' && <ExtendSheet st={st} hours={hours} setHours={setHours} onClose={() => setSheet(null)}
        onNext={async () => {
          try { await postJson('/api/pizarra/extend', { hours }); setSheet(null); toast('Le avisamos al staff. Cuando lo confirme, te avisamos acá.'); reload() }
          catch (e: any) { toast(e.message) }
        }} />}
      {sheet === 'cafe' && cafeFor && <CafeSheet person={cafeFor} price={st.cafe.price} cafeName={st.cafe.name || 'Café'} messages={st.cafe.messages || []} onClose={() => setSheet(null)}
        onSent={(name) => { setSheet(null); toast(`${name} recibió tu invitación.`); reload() }} toast={toast} />}
      {sheet === 'opinion' && (
        <Sheet title="Tu opinión" onClose={() => setSheet(null)}>
          <p className="text-sm text-slate-600 -mt-2">Nos ayuda a mejorar el espacio. Solo la lee el equipo de MARIJO.</p>
          <FeedbackForm compact onDone={(r) => { setRated(r); setSheet(null); toast('¡Gracias! Tu opinión nos ayuda a mejorar.') }} />
        </Sheet>
      )}
      {sheet === 'gifts' && <GiftsSheet gifts={st.cafe.saved} options={st.cafe.options || []} onClose={() => setSheet(null)} onRedeemed={() => { setSheet(null); toast('Pedido enviado a la barra.'); reload() }} toast={toast} />}
      {!sheet && incoming && !ended && <IncomingSheet invite={incoming} options={st.cafe.options || []} onDone={(msg) => { toast(msg); reload() }} toast={toast} />}
    </>
  )
}

function TagRow({ label, tags }: { label: string; tags: string[] }) {
  return (
    <div>
      <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1.5 mt-1.5">{tags.map((t) => <span key={t} className="px-2.5 py-1 rounded-full text-xs bg-slate-100 border border-slate-200">{t}</span>)}</div>
    </div>
  )
}

function BenefitLine({ b }: { b: NonNullable<PzState['benefit']> }) {
  return <BenefitCard b={b} />
}

/* ---------------------------------------------------------------- hojas */
function Sheet({ title, onClose, children }: { title: string; onClose?: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex flex-col justify-end">
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-white rounded-t-3xl p-4 pb-8 space-y-3 max-h-[88vh] overflow-y-auto w-full max-w-lg mx-auto">
        <div className="flex items-start gap-3">
          <h2 className="flex-1 text-lg font-bold">{title}</h2>
          {onClose && <button onClick={onClose} aria-label="Cerrar" className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center"><X className="w-5 h-5" /></button>}
        </div>
        {children}
      </div>
    </div>
  )
}

function Opt({ pressed, onClick, disabled, children }: { pressed: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} disabled={disabled} onClick={onClick}
      className={`w-full min-h-[52px] rounded-xl px-4 flex items-center gap-3 text-left border disabled:opacity-50 ${pressed ? 'border-2 border-[#0057a5] bg-blue-50' : 'border-slate-300 bg-white'}`}>{children}</button>
  )
}

function ExtendSheet({ st, hours, setHours, onClose, onNext }: { st: PzState; hours: number; setHours: (h: number) => void; onClose: () => void; onNext: () => void }) {
  const [busy, setBusy] = useState(false)
  const price = st.extend.pricePerHour
  return (
    <Sheet title="Extender estadía" onClose={onClose}>
      <p className="text-sm text-slate-600">{st.me.location} · {pesos(price)} por hora. Tu lugar está libre por {st.extend.maxHours} h más.</p>
      {[1, 2, 3, 4].map((h) => (
        <Opt key={h} pressed={hours === h} disabled={h > st.extend.maxHours} onClick={() => setHours(h)}>
          <span className="flex-1"><b>+{h} hora{h > 1 ? 's' : ''}</b><span className="block text-xs text-slate-500">{h <= st.extend.maxHours ? 'Tu lugar está libre' : 'No disponible: hay una reserva después o cierra'}</span></span>
          <b className="tabular-nums">{pesos(price * h)}</b>
        </Opt>
      ))}
      <div className="flex justify-between font-bold"><span>Se suma a tu cuenta</span><span className="tabular-nums">{pesos(price * hours)}</span></div>
      <p className="text-xs text-slate-500">El staff confirma la extensión y lo pagás en caja antes de irte, junto con lo que consumas.</p>
      <button disabled={busy} onClick={async () => { setBusy(true); await onNext(); setBusy(false) }} className="w-full h-12 rounded-xl bg-[#0057a5] text-white font-bold disabled:opacity-60">
        {busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Pedir extensión'}
      </button>
    </Sheet>
  )
}

function CafeSheet({ person, price, cafeName, messages, onClose, onSent, toast }: { person: Person; price: number | null; cafeName: string; messages: string[]; onClose: () => void; onSent: (name: string) => void; toast: (t: string) => void }) {
  const [msg, setMsg] = useState(messages[0] || '¡Hola! Me gustaría charlar con vos, te invito un café.')
  const [busy, setBusy] = useState(false)
  return (
    <Sheet title={`Invitar un café a ${person.name}`} onClose={onClose}>
      <p className="text-sm text-slate-500 -mt-2">Se lo llevan a {person.location}</p>
      {price != null && <div className="flex justify-between"><span>1 {cafeName.toLowerCase()}</span><b className="tabular-nums">{pesos(price)}</b></div>}
      <p className="text-xs text-slate-500 -mt-1">{person.name.split(' ')[0]} elige cómo lo quiere (común, cortado, latte…).</p>
      <label htmlFor="cafe-msg" className="block text-sm font-bold text-slate-600">Mensaje</label>
      {messages.length > 1 && (
        <div className="flex flex-col gap-2" role="group" aria-label="Mensajes ya escritos">
          {messages.map((m) => (
            <button key={m} type="button" aria-pressed={msg === m} onClick={() => setMsg(m)}
              className={`text-left px-3 py-2 rounded-xl border text-sm ${msg === m ? 'bg-[#0057a5] border-[#0057a5] text-white font-semibold' : 'bg-white border-slate-300 text-slate-700'}`}>{m}</button>
          ))}
        </div>
      )}
      <textarea id="cafe-msg" rows={3} maxLength={200} value={msg} onChange={(e) => setMsg(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
      <p className="text-xs text-slate-500">Se suma a tu cuenta del día y se paga en caja.</p>
      <button disabled={busy} onClick={async () => { setBusy(true); try { const d = await postJson('/api/pizarra/cafe', { toId: person.id, message: msg }); onSent(d.toName || person.name) } catch (e: any) { toast(e.message) } finally { setBusy(false) } }}
        className="w-full h-12 rounded-xl bg-[#0057a5] text-white font-bold disabled:opacity-60">{busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Enviar invitación'}</button>
    </Sheet>
  )
}

function IncomingSheet({ invite, options, onDone, toast }: { invite: PzState['cafe']['incoming'][number]; options: string[]; onDone: (msg: string) => void; toast: (t: string) => void }) {
  const [reply, setReply] = useState(RESPUESTAS[0])
  const [kind, setKind] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const respond = async (action: 'ahora' | 'guardar') => {
    if (action === 'ahora' && !kind) { toast('Elegí cómo querés el café.'); return }
    setBusy(true)
    try { await postJson('/api/pizarra/cafe/respond', { inviteId: invite.id, action, reply, kind }); onDone(action === 'ahora' ? `Te lo llevan a tu lugar. ${invite.fromName} recibió tu respuesta.` : `Guardado en "Mis regalos". ${invite.fromName} recibió tu respuesta.`) }
    catch (e: any) { toast(e.message) } finally { setBusy(false) }
  }
  return (
    <Sheet title={`${invite.fromName} te invitó un café`}>
      <p className="text-sm bg-slate-50 rounded-xl p-3">"{invite.message}"</p>
      <p className="text-xs text-slate-500">{invite.fromName} · {invite.fromLocation}</p>
      <p className="text-sm font-bold text-slate-600">Respondele</p>
      <div className="flex flex-wrap gap-2">
        {RESPUESTAS.map((r) => <button key={r} aria-pressed={reply === r} onClick={() => setReply(r)}
          className={`min-h-[38px] px-3 rounded-full border text-sm ${reply === r ? 'bg-[#0057a5] border-[#0057a5] text-white font-bold' : 'bg-white border-slate-300'}`}>{r}</button>)}
      </div>
      <textarea aria-label="Tu respuesta" rows={2} maxLength={200} value={reply} onChange={(e) => setReply(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
      <KindPicker options={options} value={kind} onChange={setKind} />
      <button disabled={busy} onClick={() => respond('ahora')} className="w-full h-12 rounded-xl bg-[#0057a5] text-white font-bold disabled:opacity-60">Tomarlo ahora y responder</button>
      <button disabled={busy} onClick={() => respond('guardar')} className="w-full h-12 rounded-xl border-[1.5px] border-[#0057a5] text-[#0057a5] font-bold disabled:opacity-60">Guardarlo para después y responder</button>
      <p className="text-xs text-slate-500">Si lo guardás, queda en "Mis regalos" para pedirlo cuando quieras, hoy u otro día.</p>
    </Sheet>
  )
}

// "¿Cómo lo querés?": común, cortado, latte, descremado… (las opciones las arma el staff en Ajustes)
function KindPicker({ options, value, onChange }: { options: string[]; value: string | null; onChange: (v: string) => void }) {
  if (!options.length) return null
  return (
    <div>
      <p className="text-sm font-bold text-slate-600 mb-1.5">¿Cómo lo querés?</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Cómo querés el café">
        {options.map((o) => (
          <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)}
            className={`min-h-[2.5rem] px-3.5 rounded-full border text-sm font-semibold ${value === o ? 'bg-[#0057a5] border-[#0057a5] text-white' : 'bg-white border-slate-300 text-slate-700'}`}>{o}</button>
        ))}
      </div>
    </div>
  )
}

function GiftsSheet({ gifts, options, onClose, onRedeemed, toast }: { gifts: PzState['cafe']['saved']; options: string[]; onClose: () => void; onRedeemed: () => void; toast: (t: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [kinds, setKinds] = useState<Record<string, string>>({})
  return (
    <Sheet title="Mis regalos" onClose={onClose}>
      {gifts.map((g) => (
        <div key={g.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
          <p className="font-bold">Café de {g.fromName}</p>
          <p className="text-sm text-slate-600">"{g.message}"</p>
          <KindPicker options={options} value={kinds[g.id] ?? null} onChange={(v) => setKinds({ ...kinds, [g.id]: v })} />
          <button disabled={busy === g.id} onClick={async () => { if (!kinds[g.id]) { toast('Elegí cómo querés el café.'); return } setBusy(g.id); try { await postJson('/api/pizarra/cafe/redeem', { inviteId: g.id, kind: kinds[g.id] }); onRedeemed() } catch (e: any) { toast(e.message) } finally { setBusy(null) } }}
            className="w-full h-11 rounded-xl bg-[#0057a5] text-white font-bold text-sm">Pedirlo ahora</button>
        </div>
      ))}
    </Sheet>
  )
}

