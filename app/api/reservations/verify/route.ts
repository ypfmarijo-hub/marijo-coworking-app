import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Credenciales para marijo-reservas (bypass RLS)
const SUPABASE_URL = 'https://coxfxtcpoyssejhnyqyt.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.CLAVE_SECRETA_PEDIDOS!

function getServiceSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()
    
    if (!phone) {
      return NextResponse.json({ error: 'Teléfono requerido' }, { status: 400 })
    }

    const cleanPhone = String(phone).replace(/\D/g, '')
    const supabase = getServiceSupabase()
    
    // Obtener fecha y hora actual en Argentina (UTC-3)
    const now = new Date()
    const argentinaOffset = -3 * 60 // -3 horas en minutos
    const argentinaTime = new Date(now.getTime() + (argentinaOffset - now.getTimezoneOffset()) * 60000)
    
    const today = argentinaTime.toISOString().split('T')[0]
    const currentHour = argentinaTime.getHours()
    const currentMinute = argentinaTime.getMinutes()
    const currentTimeMinutes = currentHour * 60 + currentMinute
    
    console.log('[API verify] Phone:', cleanPhone, 'Today:', today, 'Time:', `${currentHour}:${currentMinute}`)

    // Buscar todas las reservas confirmadas para hoy con ese teléfono
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('date', today)
      .eq('status', 'confirmed')
      .or(`phone.eq.${cleanPhone},phone.ilike.%${cleanPhone}%`)

    console.log('[API verify] Found reservations:', reservations?.length, 'Error:', error)

    if (error || !reservations || reservations.length === 0) {
      return NextResponse.json({ 
        error: 'No encontramos una reserva activa para hoy con ese número.',
        found: false 
      }, { status: 404 })
    }

    // Buscar una reserva que esté activa ahora (dentro del rango horario)
    const TOLERANCE_MINUTES = 15
    
    let activeReservation = null
    let upcomingReservation = null
    
    // Ordenar por hora de inicio para procesar en orden cronológico
    const sortedReservations = reservations.sort((a: any, b: any) => {
      const aStart = a.start_time || a.startTime || '00:00'
      const bStart = b.start_time || b.startTime || '00:00'
      return aStart.localeCompare(bStart)
    })
    
    for (const res of sortedReservations) {
      // Parsear horarios de la reserva (formato "HH:MM")
      const startTime = res.start_time || res.startTime || '00:00'
      const endTime = res.end_time || res.endTime || '23:59'
      
      const [startHour, startMin] = startTime.split(':').map(Number)
      const [endHour, endMin] = endTime.split(':').map(Number)
      
      const startMinutes = startHour * 60 + startMin
      const endMinutes = endHour * 60 + endMin
      
      // Verificar si está DENTRO del horario activo (EN CURSO)
      const isActiveNow = currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes
      
      // Verificar si está por empezar en los próximos 15 minutos
      const isUpcoming = currentTimeMinutes >= startMinutes - TOLERANCE_MINUTES && currentTimeMinutes < startMinutes
      
      // Verificar si terminó hace menos de 15 minutos (tolerancia post-fin)
      const justEnded = currentTimeMinutes > endMinutes && currentTimeMinutes <= endMinutes + TOLERANCE_MINUTES
      
      if (isActiveNow) {
        // Prioridad 1: Reserva activamente EN CURSO
        activeReservation = res
        break
      } else if (isUpcoming && !upcomingReservation) {
        // Prioridad 2: Reserva que está por empezar
        upcomingReservation = res
      } else if (justEnded && !activeReservation && !upcomingReservation) {
        // Prioridad 3: Reserva que acaba de terminar (tolerancia)
        upcomingReservation = res
      }
    }

    // Usar la reserva activa, o la próxima si no hay activa
    const finalReservation = activeReservation || upcomingReservation

    if (finalReservation) {
      return NextResponse.json({ 
        found: true, 
        reservation: finalReservation 
      })
    }

    return NextResponse.json({ 
      error: 'No encontramos una reserva activa para hoy con ese número. Verificá que estés dentro de tu horario reservado.',
      found: false 
    }, { status: 404 })

  } catch (e: any) {
    console.error('[API verify] Error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
