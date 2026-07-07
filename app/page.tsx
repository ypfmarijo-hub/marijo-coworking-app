'use client'

import dynamic from 'next/dynamic'

// Force client-side only rendering to prevent hydration errors
const MarijoApp = dynamic(
  () => import('@/components/marijo-app').then(mod => mod.MarijoApp),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }
)

export default function Page() {
  return <MarijoApp />
}
