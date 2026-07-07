export type WorkspaceType =
  | 'escritorio'
  | 'sala-a'
  | 'sala-b'
  | 'sala-grande'
  | 'oficina-c'
  | 'oficina-d'

export type ReservationStatus = 'pending' | 'payment_pending' | 'confirmed' | 'cancelled'

export interface Reservation {
  id: string
  date: Date
  timeFrom: string
  timeTo: string
  workspace: WorkspaceType
  deskNumber?: number // only for 'escritorio'
  phone: string
  firstName: string
  lastName: string
  status: ReservationStatus
  receiptUrl?: string
  reservationCode?: string
  paymentMethod?: 'mercado_pago' | 'transfer'
  amountPaid?: number
  isPresent?: boolean // true = presencial (staff), false = desde celular
  createdAt: Date
  cancelledAt?: Date
  market_orders?: any[] // Array of market orders
}

export const WORKSPACE_LABELS: Record<WorkspaceType, string> = {
  'escritorio': 'Escritorio compartido',
  'sala-a': 'Sala de reunión A',
  'sala-b': 'Sala de reunión B',
  'sala-grande': 'Sala grande (A + B)',
  'oficina-c': 'Oficina C',
  'oficina-d': 'Oficina D',
}

export const WORKSPACE_PRICES: Record<WorkspaceType, number> = {
  'escritorio': 7000,
  'sala-a': 80000,
  'sala-b': 60000,
  'sala-grande': 120000,
  'oficina-c': 30000,
  'oficina-d': 30000,
}

/** Calculates deposit amount (50% of hourly rate) based on workspace and duration */
export function calculateDeposit(workspace: WorkspaceType, hours: number): number {
  const hourlyRate = WORKSPACE_PRICES[workspace]
  const totalCost = hourlyRate * hours
  return Math.round(totalCost * 0.5) // 50% deposit
}

export interface SpaceDetail {
  id: WorkspaceType
  name: string
  price: number
  capacity: string
  surface?: string
  description: string[]
  equipment: string[]
  deskCount?: number // only for escritorio
}

export const SPACE_DETAILS: SpaceDetail[] = [
  {
    id: 'escritorio',
    name: 'Escritorio compartido',
    price: 7000,
    capacity: '1 persona',
    description: [
      'Espacio de trabajo individual dentro de un área de coworking compartida, ideal para disfrutar de un ambiente tranquilo, ordenado y profesional.',
      'Los escritorios están ubicados en un área abierta diseñada para favorecer la concentración y la productividad, con acceso a todos los servicios necesarios para trabajar cómodamente.',
    ],
    equipment: [
      'Escritorios fijos',
      'Conexión a internet de alta velocidad',
      'Lockers para pertenencias personales',
      'Espacio climatizado',
      'Acceso a áreas comunes',
    ],
    deskCount: 12,
  },
  {
    id: 'sala-a',
    name: 'Sala de reunión A',
    price: 80000,
    capacity: '6 a 8 personas',
    surface: '12 m²',
    description: [
      'Sala de reuniones amplia pensada para encuentros profesionales, presentaciones, capacitaciones o reuniones de equipo.',
      'Cuenta con una mesa central y una distribución cómoda que permite trabajar entre seis y ocho personas en un entorno profesional, silencioso y confortable.',
      'Su tamaño permite realizar reuniones con clientes, presentaciones de proyectos o sesiones de trabajo colaborativo.',
    ],
    equipment: [
      'Mesa de reuniones',
      'Sillas ergonómicas',
      'Pantalla / TV para presentaciones',
      'Conexión a internet de alta velocidad',
      'Espacio climatizado',
    ],
  },
  {
    id: 'sala-b',
    name: 'Sala de reunión B',
    price: 60000,
    capacity: '4 personas',
    surface: '8 m²',
    description: [
      'Sala de reuniones privada ideal para encuentros más reducidos, entrevistas laborales o reuniones de trabajo en grupos pequeños.',
      'Ofrece un ambiente cómodo y profesional que favorece la concentración y la comunicación.',
      'Es perfecta para reuniones uno a uno, entrevistas o sesiones de trabajo con equipos pequeños.',
    ],
    equipment: [
      'Mesa de reuniones',
      'Sillas',
      'Conexión a internet de alta velocidad',
      'Espacio climatizado',
    ],
  },
  {
    id: 'sala-grande',
    name: 'Sala grande (A + B)',
    price: 120000,
    capacity: 'hasta 12 personas',
    description: [
      'Sala de reuniones ampliada que surge de la unión de la Sala A y la Sala B, generando un espacio más amplio ideal para encuentros de mayor capacidad.',
      'Es una opción pensada para capacitaciones, presentaciones, reuniones de equipo o encuentros corporativos que requieran mayor espacio y comodidad para los participantes.',
    ],
    equipment: [
      'Mesa de reuniones',
      'Sillas',
      'Pantalla / TV para presentaciones',
      'Conexión a internet de alta velocidad',
      'Espacio climatizado',
    ],
  },
  {
    id: 'oficina-c',
    name: 'Oficina C',
    price: 30000,
    capacity: '3 personas',
    surface: '7 m²',
    description: [
      'Oficina privada ideal para pequeños equipos de trabajo o profesionales que necesitan un espacio cerrado para desarrollar sus actividades con mayor privacidad.',
      'Permite trabajar cómodamente hasta tres personas en un entorno tranquilo y profesional.',
    ],
    equipment: [
      'Escritorios de trabajo',
      'Sillas',
      'Conexión a internet de alta velocidad',
      'Espacio climatizado',
    ],
  },
  {
    id: 'oficina-d',
    name: 'Oficina D',
    price: 30000,
    capacity: '3 personas',
    surface: '7 m²',
    description: [
      'Oficina privada diseñada para pequeños equipos o profesionales que buscan un espacio tranquilo y cerrado para trabajar con mayor privacidad.',
      'Permite realizar reuniones internas o desarrollar tareas laborales en un ambiente cómodo y profesional.',
    ],
    equipment: [
      'Escritorios',
      'Sillas',
      'Conexión a internet de alta velocidad',
      'Espacio climatizado',
    ],
  },
]

// Generate 30-minute intervals from 07:00 to 22:00
export function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = 7; h <= 22; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 22) slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

export const TIME_SLOTS = generateTimeSlots()

export const CONTACT_INFO = {
  address: 'San Martín 1883, Río Cuarto, Córdoba, Argentina',
  whatsapp: '+54 9 3585 76-9421',
  whatsappLink: 'https://wa.me/5493585769421'
}

/** Returns true if two time ranges [fromA, toA) and [fromB, toB) overlap */
export function timeRangesOverlap(
  fromA: string, toA: string,
  fromB: string, toB: string
): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const startA = toMinutes(fromA)
  const endA = toMinutes(toA)
  const startB = toMinutes(fromB)
  const endB = toMinutes(toB)
  return startA < endB && endA > startB
}

/** Calculates duration in hours between two time strings (HH:MM format) */
export function calculateDuration(from: string, to: string): number {
  // Safe parsing with fallback
  const toMinutes = (t: string): number => {
    if (!t || typeof t !== 'string' || !t.includes(':')) return 0
    const parts = t.split(':')
    const h = parseInt(parts[0], 10) || 0
    const m = parseInt(parts[1], 10) || 0
    return h * 60 + m
  }
  const fromMin = toMinutes(from)
  const toMin = toMinutes(to)
  const diff = (toMin - fromMin) / 60
  // Return at least 1 hour to prevent NaN or division issues
  return diff > 0 ? diff : 1
}

/** Workspaces that block each other (sala grande blocks A and B, and vice versa) */
export function getBlockedWorkspaces(workspace: WorkspaceType): WorkspaceType[] {
  if (workspace === 'sala-grande') return ['sala-a', 'sala-b']
  if (workspace === 'sala-a' || workspace === 'sala-b') return ['sala-grande']
  return []
}
