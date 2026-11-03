'use client'

import { Home, LayoutGrid, Coffee, CalendarCheck } from 'lucide-react'
import { useReservation, Screen } from '@/lib/reservation-context'

// Barra de abajo: permite ir y volver entre la pizarra, el bar y las reservas sin perder nada.
const ITEMS: { screen: Screen; label: string; Icon: typeof Home }[] = [
  { screen: 'home', label: 'Inicio', Icon: Home },
  { screen: 'pizarra', label: 'Pizarra', Icon: LayoutGrid },
  { screen: 'market', label: 'Pedir al bar', Icon: Coffee },
  { screen: 'my-reservations', label: 'Mis reservas', Icon: CalendarCheck },
]

export const NAV_SCREENS: Screen[] = ITEMS.map((i) => i.screen)

export function BottomNav({ full = false }: { full?: boolean }) {
  const { currentScreen, setCurrentScreen } = useReservation()
  return (
    <nav aria-label="Navegación principal"
      className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md ${full ? 'md:max-w-none' : 'md:max-w-5xl'} z-40 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]`}>
      {/* los 4 botones siempre en una fila; en la compu quedan centrados con un ancho cómodo */}
      <div className="grid grid-cols-4 w-full max-w-xl mx-auto">
      {ITEMS.map(({ screen, label, Icon }) => {
        const active = currentScreen === screen
        return (
          <button key={screen} onClick={() => { setCurrentScreen(screen); window.scrollTo(0, 0) }} aria-current={active ? 'page' : undefined}
            className={`min-h-[3.75rem] flex flex-col items-center justify-center gap-1 text-[0.6875rem] font-bold ${active ? 'text-[#0057a5]' : 'text-slate-500'}`}>
            <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
            {label}
          </button>
        )
      })}
      </div>
    </nav>
  )
}
