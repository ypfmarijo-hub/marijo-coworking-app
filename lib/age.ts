// Edad APROXIMADA a partir del número de DNI argentino.
// Los DNI se dan en orden a medida que nacen las personas, así que el número da una idea del año de nacimiento.
// Es una estimación (puede errar unos años): sirve para estadísticas, no para verificar la edad de nadie.
// No sirve para DNI de extranjeros (empiezan en 90 millones o más) ni para números muy viejos.

// [DNI en millones, año de nacimiento aproximado]
const TABLA: [number, number][] = [
  [4, 1935], [10, 1950], [14, 1959], [17, 1964], [20, 1968], [23, 1972], [25, 1976], [28, 1980],
  [30, 1983], [33, 1987], [35, 1990], [38, 1994], [40, 1997], [42, 1999], [44, 2002], [46, 2004],
  [48, 2007], [50, 2010], [55, 2015], [60, 2020],
]

export function estimateBirthYear(dni: string | number | null | undefined): number | null {
  const n = Number(String(dni ?? '').replace(/\D/g, ''))
  if (!n || n < 1_000_000 || n >= 90_000_000) return null
  const m = n / 1_000_000
  if (m <= TABLA[0][0]) return TABLA[0][1]
  for (let i = 1; i < TABLA.length; i++) {
    const [m1, y1] = TABLA[i - 1], [m2, y2] = TABLA[i]
    if (m <= m2) return Math.round(y1 + ((m - m1) / (m2 - m1)) * (y2 - y1))
  }
  return null
}

export const AGE_RANGES = ['Menos de 18', '18 a 24', '25 a 34', '35 a 44', '45 a 54', '55 a 64', '65 o más'] as const

/** Rango de edad aproximado ("25 a 34"), o null si no hay DNI o no se puede estimar. */
export function ageRange(dni: string | number | null | undefined, now = new Date()): string | null {
  const y = estimateBirthYear(dni)
  if (y == null) return null
  const age = now.getFullYear() - y
  if (age < 18) return AGE_RANGES[0]
  if (age < 25) return AGE_RANGES[1]
  if (age < 35) return AGE_RANGES[2]
  if (age < 45) return AGE_RANGES[3]
  if (age < 55) return AGE_RANGES[4]
  if (age < 65) return AGE_RANGES[5]
  return AGE_RANGES[6]
}

/** Edad para estadísticas: la del DNI si lo hay (más precisa); si no, la que estimó el staff a ojo. */
export function resolveAgeRange(dni: string | null | undefined, staffRange: string | null | undefined): string | null {
  return ageRange(dni) || (staffRange && (AGE_RANGES as readonly string[]).includes(staffRange) ? staffRange : null)
}
