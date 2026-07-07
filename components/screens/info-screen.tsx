'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useReservation } from '@/lib/reservation-context'
import { SPACE_DETAILS, WORKSPACE_PRICES, WorkspaceType } from '@/lib/types'
import {
  ArrowLeft,
  Users,
  Maximize2,
  ChevronRight,
} from 'lucide-react'

const SPACE_IMAGES: Record<WorkspaceType, string> = {
  escritorio: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ESCRITORIO%20COMPARTIDO.JPG-O2aUt3KbEjwKQHy3wQP79Vf7vvB9nG.jpeg',
  'sala-a': 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SALA%20DE%20REUNION.JPG-jMVDRza9mXvRskRHWBuQn4iLFVLKGw.jpeg',
  'sala-b': 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SALA%20DE%20REUNION%20B.JPG-5Ror8yDZ0ID42l9T5uCeonOlrOcTEI.jpeg',
  'sala-grande': 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SALA%20DE%20REUNION%20A%2BB.JPG-E9hUi68bJZlLHybUeNpIgW7kRsnR4p.jpeg',
  'oficina-c': 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/OFICINA%20C.JPG-acA11cDi9rldX8TGn0S5P2Ripy5rXe.jpeg',
  'oficina-d': 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/OFICINA%20D.JPG-AA15R1pTgYRSHVuYxTkHbiA6uR6ggg.jpeg',
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(price)
}

interface SpaceCardProps {
  spaceId: WorkspaceType
  name: string
  capacity: string
  surface?: string
  price: number
  image: string
  onClick: () => void
}

function SpaceCard({ spaceId, name, capacity, surface, price, image, onClick }: SpaceCardProps) {
  return (
    <Card
      className="overflow-hidden border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.99]"
      onClick={onClick}
    >
      <div className="h-36 overflow-hidden">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm leading-snug text-balance">
              {name}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                {capacity}
              </span>
              {surface && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Maximize2 className="w-3.5 h-3.5" />
                  {surface}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              <p className="text-sm font-bold text-primary">{formatPrice(price)}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </Card>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h2>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

export function InfoScreen() {
  const { setCurrentScreen, setSelectedSpaceId, setSelectedDesk } = useReservation()
  const [salaExpanded, setSalaExpanded] = useState(false)

  const handleOpenSpace = (id: WorkspaceType) => {
    setSelectedSpaceId(id)
    setSelectedDesk(null) // reset desk on every new space selection
    setCurrentScreen('space-detail')
  }

  const escritorio = SPACE_DETAILS.find(s => s.id === 'escritorio')!
  const salaA = SPACE_DETAILS.find(s => s.id === 'sala-a')!
  const salaB = SPACE_DETAILS.find(s => s.id === 'sala-b')!
  const salaGrande = SPACE_DETAILS.find(s => s.id === 'sala-grande')!
  const oficinaC = SPACE_DETAILS.find(s => s.id === 'oficina-c')!
  const oficinaD = SPACE_DETAILS.find(s => s.id === 'oficina-d')!

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary px-4 pt-12 pb-6">
        <button
          onClick={() => setCurrentScreen('home')}
          className="flex items-center gap-2 text-primary-foreground/90 hover:text-primary-foreground mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Volver</span>
        </button>
        <h1 className="text-2xl font-bold text-primary-foreground">Fullwork</h1>
        <p className="text-primary-foreground/80 mt-1">Conoce nuestros espacios</p>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Escritorio */}
        <SectionHeader title="Escritorio" />
        <SpaceCard
          spaceId="escritorio"
          name={escritorio.name}
          capacity={escritorio.capacity}
          price={WORKSPACE_PRICES['escritorio']}
          image={SPACE_IMAGES['escritorio']}
          onClick={() => handleOpenSpace('escritorio')}
        />

        {/* Salas de reunión */}
        <SectionHeader title="Salas de reunión" />

        {/* Main "Salas" expandable card */}
        <Card className="overflow-hidden border-0 shadow-md">
          <button
            className="w-full h-36 overflow-hidden relative"
            onClick={() => setSalaExpanded(v => !v)}
          >
            <img
              src={SPACE_IMAGES['sala-a']}
              alt="Salas de reunión"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-primary/40 flex items-center justify-center">
              <span className="text-primary-foreground text-lg font-bold">
                Salas de reunión
              </span>
            </div>
          </button>
          <button
            className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
            onClick={() => setSalaExpanded(v => !v)}
          >
            <span className="text-sm text-muted-foreground">
              {salaExpanded ? 'Ocultar opciones' : 'Ver 3 opciones disponibles'}
            </span>
            <ChevronRight
              className={`w-4 h-4 text-muted-foreground transition-transform ${salaExpanded ? 'rotate-90' : ''}`}
            />
          </button>

          {salaExpanded && (
            <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
              {[salaA, salaB, salaGrande].map(sala => (
                <button
                  key={sala.id}
                  onClick={() => handleOpenSpace(sala.id as WorkspaceType)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{sala.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {sala.capacity}
                      </span>
                      {sala.surface && (
                        <span className="text-xs text-muted-foreground">
                          · {sala.surface}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-primary">
                      {formatPrice(WORKSPACE_PRICES[sala.id as WorkspaceType])}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Oficinas */}
        <SectionHeader title="Oficinas privadas" />
        <SpaceCard
          spaceId="oficina-c"
          name={oficinaC.name}
          capacity={oficinaC.capacity}
          surface={oficinaC.surface}
          price={WORKSPACE_PRICES['oficina-c']}
          image={SPACE_IMAGES['oficina-c']}
          onClick={() => handleOpenSpace('oficina-c')}
        />
        <SpaceCard
          spaceId="oficina-d"
          name={oficinaD.name}
          capacity={oficinaD.capacity}
          surface={oficinaD.surface}
          price={WORKSPACE_PRICES['oficina-d']}
          image={SPACE_IMAGES['oficina-d']}
          onClick={() => handleOpenSpace('oficina-d')}
        />
      </div>

      <div className="h-8" />
    </div>
  )
}
