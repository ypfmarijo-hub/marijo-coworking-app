'use client'

import { useReservation, ReservationProvider, Screen } from '@/lib/reservation-context'
import { MarketProvider } from '@/lib/market-context'
import { HomeScreen } from './screens/home-screen'
import { InfoScreen } from './screens/info-screen'
import { SpaceDetailScreen } from './screens/space-detail-screen'
import { DateScreen } from './screens/date-screen'
import { TimeRangeScreen } from './screens/time-range-screen'
import { PaymentScreen } from './screens/payment-screen' // Este ahora maneja ambos estados
import { MyReservationsScreen } from './screens/my-reservations-screen'
import { MarketScreen } from './screens/market-screen'

function AppContent() {
  const { currentScreen } = useReservation()

  // Eliminamos el import de PaymentSuccessScreen porque su lógica 
  // ahora vive dentro de PaymentScreen
  const screens: Record<Screen, React.ReactNode> = {
    'home': <HomeScreen />,
    'info': <InfoScreen />,
    'space-detail': <SpaceDetailScreen />,
    'date': <DateScreen />,
    'time-range': <TimeRangeScreen />,
    'payment': <PaymentScreen />,
    'success': <PaymentScreen />, // Apuntamos 'success' también a PaymentScreen
    'my-reservations': <MyReservationsScreen />,
    'market': <MarketScreen />
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-background shadow-2xl text-slate-800">
      {screens[currentScreen]}
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