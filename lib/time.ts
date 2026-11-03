// Horarios de las reservas en hora de Argentina (UTC-3, sin horario de verano).
// En la base, cada reserva tiene fecha (YYYY-MM-DD) y horas en texto ("09:30").

export const CLOSING_TIME = '22:00'
export const ENTRY_TOLERANCE_MIN = 15 // se puede entrar 15 minutos antes del turno

/** Momento exacto (ms) de una fecha + hora de Argentina. */
export function arToMs(date: string, time: string): number {
  return Date.parse(`${date}T${time.length === 5 ? time : time.slice(0, 5)}:00-03:00`)
}

export function reservationWindow(r: { date: string; time_from: string; time_to: string }) {
  return { startMs: arToMs(r.date, r.time_from), endMs: arToMs(r.date, r.time_to) }
}

export function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + Math.round(hours * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function hoursBetween(from: string, to: string): number {
  const [h1, m1] = from.split(':').map(Number)
  const [h2, m2] = to.split(':').map(Number)
  return Math.max(0, (h2 * 60 + m2 - (h1 * 60 + m1)) / 60)
}

/** "2026-10" del momento actual en Argentina. */
export function currentPeriod(): string {
  const d = new Date(Date.now() - 3 * 3600 * 1000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
