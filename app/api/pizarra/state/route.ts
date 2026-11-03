import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadSession, displayName, placeLabel } from '@/lib/pizarra'
import { getSettings } from '@/lib/settings'
import { benefitFor, benefitForClient } from '@/lib/benefits'
import { maxExtensionHours, pricePerHour } from '@/lib/extension'
import { reservationWindow, ENTRY_TOLERANCE_MIN } from '@/lib/time'
import { argentinaNow } from '@/lib/active-reservation'
import { cafeGift } from '@/lib/cafe'
import { saldoFor } from '@/lib/saldo'

// GET /api/pizarra/state — todo lo que muestra la pizarra. Solo con una sesión válida.
export async function GET() {
  const supabase = createServiceClient()
  const s = await loadSession(supabase)
  if (!s) return NextResponse.json({ error: 'Sesión vencida. Volvé a entrar.' }, { status: 401 })
  const { session, reservation: r } = s

  await supabase.from('pizarra_sessions').update({ last_seen: new Date().toISOString() }).eq('id', session.id)

  const [settings, profileRes, pendingExt] = await Promise.all([
    getSettings(supabase),
    supabase.from('pizarra_profiles').select('*').eq('phone_key', session.phone_key).maybeSingle(),
    supabase.from('extension_requests').select('hours, method, status').eq('reservation_id', r.id).eq('status', 'pendiente').maybeSingle(),
  ])
  const profile = profileRes.data
  const myName = displayName(r.first_name, r.last_name)

  // ---- personas en la sala ahora (solo si mi horario sigue vigente)
  let people: any[] = []
  if (s.active) {
    const { today } = argentinaNow()
    const { data: todays } = await supabase.from('reservations').select('id, first_name, last_name, phone, workspace, desk_number, date, time_from, time_to, status')
      .eq('date', today).eq('status', 'confirmed')
    const now = Date.now()
    const liveIds = (todays ?? []).filter((x: any) => {
      const w = reservationWindow(x)
      return now >= w.startMs - ENTRY_TOLERANCE_MIN * 60000 && now <= w.endMs
    }).map((x: any) => x.id)
    if (liveIds.length) {
      const { data: sessions } = await supabase.from('pizarra_sessions').select('id, reservation_id, phone_key, location, is_open, last_seen')
        .in('reservation_id', liveIds).neq('phone_key', session.phone_key).order('last_seen', { ascending: false })
      const latest = new Map<string, any>()
      for (const ss of sessions ?? []) if (!latest.has(ss.phone_key)) latest.set(ss.phone_key, ss)
      const keys = [...latest.keys()]
      const { data: profiles } = keys.length
        ? await supabase.from('pizarra_profiles').select('*').in('phone_key', keys)
        : { data: [] as any[] }
      const profMap = new Map((profiles ?? []).map((p: any) => [p.phone_key, p]))
      people = keys.filter((k) => profMap.has(k)).map((k) => {
        const ss = latest.get(k), p = profMap.get(k)
        return {
          id: ss.id, name: p.display_name, rubro: p.rubro || '', offers: p.offers || [], seeks: p.seeks || [],
          location: ss.location, isOpen: ss.is_open, whatsapp: p.show_whatsapp ? p.whatsapp : null,
        }
      })
    }
  }

  // ---- café
  let cafe: any = { enabled: false, price: null, incoming: [], saved: [], replies: [] }
  if (settings.cafeEnabled) {
    const product = await cafeGift(supabase, settings)
    const [{ data: incoming }, { data: replies }] = await Promise.all([
      supabase.from('cafe_invites').select('id, from_name, from_location, message, status, created_at')
        .eq('to_phone_key', session.phone_key).in('status', ['enviada', 'guardada']).order('created_at', { ascending: false }),
      supabase.from('cafe_invites').select('id, to_name, reply').eq('from_phone_key', session.phone_key)
        .not('reply', 'is', null).eq('reply_seen', false),
    ])
    if (replies?.length) await supabase.from('cafe_invites').update({ reply_seen: true }).in('id', replies.map((x: any) => x.id))
    cafe = {
      enabled: !!product, price: product?.price ?? null, name: product?.name ?? null, options: product?.options ?? [], messages: product?.messages ?? [],
      incoming: (incoming ?? []).filter((x: any) => x.status === 'enviada' && s.active)
        .map((x: any) => ({ id: x.id, fromName: x.from_name, fromLocation: x.from_location, message: x.message })),
      saved: (incoming ?? []).filter((x: any) => x.status === 'guardada')
        .map((x: any) => ({ id: x.id, fromName: x.from_name, message: x.message })),
      replies: (replies ?? []).map((x: any) => ({ toName: x.to_name, reply: x.reply })),
    }
  }

  const benefit = await benefitFor(supabase, r.phone, `${r.first_name} ${r.last_name}`.trim(), settings)
  const canExtend = (s.active || s.canExtendAfterEnd) && !pendingExt.data
  const maxHours = canExtend ? await maxExtensionHours(supabase, r) : 0
  const { data: fb } = await supabase.from('feedback').select('rating').eq('reservation_id', r.id).maybeSingle()

  return NextResponse.json({
    serverNow: Date.now(),
    active: s.active,
    ended: s.ended,
    me: {
      name: myName, code: r.reservation_code, location: session.location || placeLabel(r), isOpen: session.is_open,
      timeFrom: r.time_from, timeTo: r.actual_time_to || r.time_to, endMs: s.endMs,
      needsProfile: !profile,
      myRating: fb?.rating ?? null,
      saldo: await saldoFor(supabase, r),
      profile: profile ? { rubro: profile.rubro || '', offers: profile.offers || [], seeks: profile.seeks || [], showWhatsapp: profile.show_whatsapp } : null,
    },
    people,
    extend: { canExtend, maxHours, pricePerHour: await pricePerHour(supabase, r.workspace), pending: pendingExt.data ? { hours: Number(pendingExt.data.hours), method: pendingExt.data.method } : null },
    cafe,
    benefit: benefitForClient(benefit),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
