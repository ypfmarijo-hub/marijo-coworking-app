import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { argentinaNow } from '@/lib/active-reservation'
import { hasConflict, parseNewReservation } from '@/lib/reservation-rules'
import { MAX_RECEIPT_BYTES, RECEIPTS_BUCKET, receiptExtension } from '@/lib/receipts'
import { pushToStaff } from '@/lib/push'
import { WORKSPACE_LABELS } from '@/lib/types'
import { getPricing, quote } from '@/lib/pricing'
import { newReservationCode } from '@/lib/codes'
import { getSettings } from '@/lib/settings'

// POST /api/reservations  (multipart/form-data: "data" = JSON de la reserva, "receipt" = archivo)
// Público. Crea la reserva desde la app con su comprobante de seña.
// Reemplaza el insert directo desde el navegador: ahora valida todo del lado del servidor.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()

    let raw: unknown
    try {
      raw = JSON.parse(String(form.get('data') || ''))
    } catch {
      return NextResponse.json({ error: 'Datos de reserva inválidos' }, { status: 400 })
    }
    const { value: input, error: inputError } = parseNewReservation(raw)
    if (!input) return NextResponse.json({ error: inputError }, { status: 400 })

    // Precio: por horas o combo (el combo fija la hora de fin). Se calcula acá, nunca se confía en el navegador.
    const pricing = await getPricing(createServiceClient())
    const comboId = (raw as any)?.comboId ? String((raw as any).comboId) : null
    const q = quote(pricing, input.workspace, input.timeFrom, input.timeTo, comboId)
    if (!q.ok) return NextResponse.json({ error: q.error }, { status: 400 })
    input.timeTo = q.timeTo

    if (input.date < argentinaNow().today) {
      return NextResponse.json({ error: 'No se puede reservar en una fecha pasada' }, { status: 400 })
    }

    // Seña del 50%: obligatoria para salas y oficinas; para escritorios solo si el staff lo activó en Ajustes
    const settings = await getSettings(createServiceClient())
    const depositRequired = input.workspace !== 'escritorio' || settings.deskDepositRequired
    const receiptRaw = form.get('receipt')
    const receipt = receiptRaw instanceof File && receiptRaw.size > 0 ? receiptRaw : null
    if (depositRequired && !receipt) {
      return NextResponse.json({ error: 'El comprobante de pago es obligatorio' }, { status: 400 })
    }
    const ext = receipt ? receiptExtension(receipt.type) : null
    if (receipt && !ext) {
      return NextResponse.json({ error: 'El comprobante tiene que ser una imagen o un PDF' }, { status: 400 })
    }
    if (receipt && receipt.size > MAX_RECEIPT_BYTES) {
      return NextResponse.json({ error: 'El comprobante supera los 10 MB' }, { status: 400 })
    }

    const supabase = createServiceClient()

    if (await hasConflict(supabase, input)) {
      return NextResponse.json(
        { error: 'Ese horario se acaba de ocupar. Por favor elegí otro.' },
        { status: 409 }
      )
    }

    // Comprobante (si hay) al bucket privado, con un nombre imposible de adivinar
    let objectPath: string | null = null
    if (receipt) {
      objectPath = `${input.date}/${randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(RECEIPTS_BUCKET)
        .upload(objectPath, receipt, { contentType: receipt.type, upsert: false })
      if (uploadError) {
        console.error('[POST /api/reservations] upload error:', uploadError.message)
        return NextResponse.json({ error: 'No se pudo subir el comprobante. Reintentá.' }, { status: 500 })
      }
    }

    // Código de reserva único (reintenta si coincide con uno existente)
    let inserted: any = null
    let lastError: string | null = null
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const code = await newReservationCode(supabase, input.date) // F + 2 números, libre ese día
      const { data, error } = await supabase
        .from('reservations')
        .insert({
          workspace: input.workspace,
          date: input.date,
          time_from: input.timeFrom,
          time_to: input.timeTo,
          desk_number: input.deskNumber,
          phone: input.phone,
          first_name: input.firstName,
          last_name: input.lastName,
          status: 'confirmed',
          receipt_url: objectPath ? `${RECEIPTS_BUCKET}/${objectPath}` : null,
          reservation_code: code,
          is_present: false,
          price_total: q.total,
          combo_name: q.combo ? q.combo.name : null,
          dni: input.dni,
        })
        .select('id, reservation_code')
        .single()
      if (data) inserted = data
      else {
        lastError = error?.message ?? 'desconocido'
        if (error?.code !== '23505') break // 23505 = código repetido; cualquier otro error, cortar
      }
    }

    if (!inserted) {
      console.error('[POST /api/reservations] insert error:', lastError)
      if (objectPath) await supabase.storage.from(RECEIPTS_BUCKET).remove([objectPath])
      return NextResponse.json({ error: 'No se pudo guardar la reserva. Reintentá.' }, { status: 500 })
    }

    const place = input.workspace === 'escritorio' && input.deskNumber ? `Escritorio N.° ${input.deskNumber}` : WORKSPACE_LABELS[input.workspace]
    const sena = Math.round(q.total / 2)
    const what = `${input.firstName} ${input.lastName} · ${place}${q.combo ? ` (combo ${q.combo.name})` : ''} · ${input.date} ${input.timeFrom} a ${input.timeTo}.`
    await pushToStaff(supabase, receipt
      ? { title: 'Nueva reserva con comprobante', body: `${what} Seña $ ${sena.toLocaleString('es-AR')}. Revisá el comprobante.`, tag: 'reserva' }
      : { title: 'Nueva reserva (paga en el lugar)', body: `${what} Total $ ${q.total.toLocaleString('es-AR')}, sin seña.`, tag: 'reserva' })

    return NextResponse.json(
      { success: true, id: inserted.id, reservationCode: inserted.reservation_code, total: q.total, timeTo: input.timeTo, comboName: q.combo?.name ?? null, deposit: !!receipt },
      { status: 201 }
    )
  } catch (e: any) {
    console.error('[POST /api/reservations] error:', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
