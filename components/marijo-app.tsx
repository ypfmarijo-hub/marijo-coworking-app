'use client'

import { useEffect } from 'react'
import { useReservation, ReservationProvider, Screen } from '@/lib/reservation-context'
import { MarketProvider } from '@/lib/market-context'
import { HomeScreen } from './screens/home-screen'
import { InfoScreen } from './screens/info-screen'
import { SpaceDetailScreen } from './screens/space-detail-screen'
import { DateScreen } from './screens/date-screen'
import { TimeRangeScreen } from './screens/time-range-screen'
import { PaymentScreen } from './screens/payment-screen' // maneja el pago y también la pantalla de éxito
import { MyReservationsScreen } from './screens/my-reservations-screen'
import { MarketScreen } from './screens/market-screen'
import { PizarraScreen } from './screens/pizarra-screen'
import { BottomNav, NAV_SCREENS } from './bottom-nav'

function AppContent() {
  const { currentScreen, setCurrentScreen } = useReservation()

  // Un link directo (por ejemplo el del aviso en el celular) puede abrir una pantalla: /?pantalla=pizarra
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('pantalla')
    const map: Record<string, Screen> = { pizarra: 'pizarra', bar: 'market', reservas: 'my-reservations' }
    if (p && map[p]) {
      setCurrentScreen(map[p])
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [setCurrentScreen])

  // En la compu todo se ve más grande (letra y espacios), sin tocar cómo se ve en el celular. El panel del staff no cambia.
  useEffect(() => {
    document.documentElement.classList.add('fw-cliente')
    return () => document.documentElement.classList.remove('fw-cliente')
  }, [])

  const screens: Record<Screen, React.ReactNode> = {
    'home': <HomeScreen />,
    'info': <InfoScreen />,
    'space-detail': <SpaceDetailScreen />,
    'date': <DateScreen />,
    'time-range': <TimeRangeScreen />,
    'payment': <PaymentScreen />,
    'success': <PaymentScreen />,
    'my-reservations': <MyReservationsScreen />,
    'market': <MarketScreen />,
    'pizarra': <PizarraScreen />,
  }
  const withNav = NAV_SCREENS.includes(currentScreen)
  // En la compu la app se acomoda sola a lo ancho (según el tamaño de la pantalla); en el celular queda igual.
  // La pizarra usa todo el ancho, como el panel del staff.
  const full = currentScreen === 'pizarra'

  return (
    <div className={`max-w-md mx-auto min-h-screen bg-background shadow-2xl text-slate-800 ${full ? 'md:max-w-none md:shadow-none' : 'md:max-w-5xl'} ${withNav ? 'pb-[4.5rem]' : ''}`}>
      {screens[currentScreen]}
      {withNav && <BottomNav full={full} />}
    </div>
  )
}

export function MarijoApp() {
  return (
    <ReservationProvider>
      <MarketProvider>
        <AppContent />
      </MarketProvider>
    </ReservationProvider>
  )
}
