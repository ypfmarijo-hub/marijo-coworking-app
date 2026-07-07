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
  Wifi,
  Monitor,
  Wind,
  Lock,
  UtensilsCrossed,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Armchair,
  Zap,
  Printer,
} from 'lucide-react'

const SPACE_IMAGES: Record<WorkspaceType, string[]> = {
  escritorio: ['https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ESCRITORIO%20COMPARTIDO.JPG-O2aUt3KbEjwKQHy3wQP79Vf7vvB9nG.jpeg'],
  'sala-a': ['https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SALA%20DE%20REUNION.JPG-jMVDRza9mXvRskRHWBuQn4iLFVLKGw.jpeg'],
  'sala-b': ['https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SALA%20DE%20REUNION%20B.JPG-5Ror8yDZ0ID42l9T5uCeonOlrOcTEI.jpeg'],
  'sala-grande': ['https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SALA%20DE%20REUNION%20A%2BB.JPG-E9hUi68bJZlLHybUeNpIgW7kRsnR4p.jpeg'],
  'oficina-c': ['https://hebbkx1anhila5yf.public.blob.vercel-storage.com/OFICINA%20C.JPG-acA11cDi9rldX8TGn0S5P2Ripy5rXe.jpeg'],
  'oficina-d': ['https://hebbkx1anhila5yf.public.blob.vercel-storage.com/OFICINA%20D.JPG-AA15R1pTgYRSHVuYxTkHbiA6uR6ggg.jpeg'],
}

const EQUIPMENT_ICONS: Record<string, typeof Wifi> = {
  'Conexión a internet de alta velocidad': Wifi,
  'Pantalla / TV para presentaciones': Monitor,
  'Espacio climatizado': Wind,
  'Lockers para pertenencias personales': Lock,
  'Acceso a áreas comunes': UtensilsCrossed,
  'Escritorios fijos': Armchair,
  'Escritorios de trabajo': Armchair,
  'Escritorios': Armchair,
  'Mesa de reuniones': Armchair,
  'Sillas ergonómicas': Armchair,
  'Sillas': Armchair,
  'Impresora': Printer,
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(price)
}

interface PhotoGalleryProps {
  images: string[]
  spaceName: string
}

function PhotoGallery({ images, spaceName }: PhotoGalleryProps) {
  const [current, setCurrent] = useState(0)

  const prev = () => setCurrent(i => (i - 1 + images.length) % images.length)
  const next = () => setCurrent(i => (i + 1) % images.length)

  return (
    <div className="relative w-full h-64 bg-muted overflow-hidden">
      <img
        src={images[current]}
        alt={`${spaceName} - foto ${current + 1}`}
        className="w-full h-full object-cover"
      />
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 flex items-center justify-center shadow"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 flex items-center justify-center shadow"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === current ? 'bg-primary-foreground w-4' : 'bg-primary-foreground/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

interface DeskSelectorProps {
  total: number
  selectedDesk: number | null
  onSelect: (desk: number) => void
}

function DeskSelector({ total, selectedDesk, onSelect }: DeskSelectorProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {Array.from({ length: total }, (_, i) => i + 1).map(n => (
        <button
          key={n}
          onClick={() => onSelect(n)}
          className={`
            h-12 rounded-lg text-sm font-semibold transition-all border-2
            ${selectedDesk === n
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted'
            }
          `}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

interface FullBenefitProps {
  price: number
  spaceName: string
}

function FullBenefit({ price, spaceName }: FullBenefitProps) {
  return (
    <Card className="p-4 border border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Zap className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-semibold text-foreground text-sm">Beneficio Plan FULL</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Si el consumo realizado dentro del espacio alcanza el valor del alquiler (
        <span className="font-medium text-foreground">{formatPrice(price)}</span>), el uso
        queda <span className="font-medium text-foreground">sin costo</span>.
      </p>
      <ul className="mt-3 space-y-1.5">
        <li className="flex items-start gap-2 text-sm text-muted-foreground">
          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          Si el consumo es mayor, se paga únicamente la diferencia.
        </li>
        <li className="flex items-start gap-2 text-sm text-muted-foreground">
          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          Si el consumo es menor, se abona la diferencia restante.
        </li>
      </ul>
      <p className="text-xs text-muted-foreground mt-3 italic">
        El consumo se refiere a pedidos realizados dentro del espacio FULL.
      </p>
    </Card>
  )
}

export function SpaceDetailScreen() {
  const {
    selectedSpaceId,
    setCurrentScreen,
    setSelectedWorkspace,
    selectedDesk,
    setSelectedDesk,
  } = useReservation()

  const space = SPACE_DETAILS.find(s => s.id === selectedSpaceId)

  if (!space) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Espacio no encontrado.</p>
      </div>
    )
  }

  const images = SPACE_IMAGES[space.id]
  const price = WORKSPACE_PRICES[space.id]
  const seña = Math.round(price * 0.5)

  const handleReserve = () => {
    setSelectedWorkspace(space.id)
    setCurrentScreen('date')
  }

  const canReserve =
    space.id !== 'escritorio' || selectedDesk !== null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Photo Gallery (full-bleed, header overlaid) */}
      <div className="relative">
        <PhotoGallery images={images} spaceName={space.name} />
        {/* Back button over image */}
        <button
          onClick={() => setCurrentScreen('info')}
          className="absolute top-12 left-4 flex items-center gap-2 bg-background/80 backdrop-blur-sm text-foreground rounded-full px-3 py-1.5 shadow text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-5 space-y-5 overflow-auto">
        {/* Title + Price */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground text-balance">{space.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                {space.capacity}
              </span>
              {space.surface && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Maximize2 className="w-4 h-4" />
                  {space.surface}
                </span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-bold text-primary">{formatPrice(price)}</p>
            <p className="text-xs text-muted-foreground">por reserva</p>
          </div>
        </div>

        {/* Description */}
        <div>
          <h2 className="text-base font-semibold text-foreground mb-2">Descripción</h2>
          <div className="space-y-2">
            {space.description.map((para, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                {para}
              </p>
            ))}
          </div>
        </div>

        {/* Equipment */}
        <div>
          <h2 className="text-base font-semibold text-foreground mb-3">Equipamiento</h2>
          <div className="space-y-2">
            {space.equipment.map(item => {
              const Icon = EQUIPMENT_ICONS[item] ?? CheckCircle
              return (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm text-foreground">{item}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Desk Selector (only for escritorio) */}
        {space.id === 'escritorio' && space.deskCount && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-1">
              Selecciona tu escritorio
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              Hay {space.deskCount} escritorios disponibles. Elige el número de tu preferencia.
            </p>
            <DeskSelector
              total={space.deskCount}
              selectedDesk={selectedDesk}
              onSelect={setSelectedDesk}
            />
          </div>
        )}

        {/* FULL Benefit */}
        <FullBenefit price={price} spaceName={space.name} />
      </div>

      {/* CTA */}
      <div className="px-4 pb-8 pt-4 border-t border-border bg-background">
        <Card className="p-3 bg-amber-50 border border-amber-200 mb-4">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Seña del 50%:</span>{' '}
            {formatPrice(seña)} para confirmar la reserva.
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Cancelaciones con menos de 24 h de anticipacion no tienen reembolso.
          </p>
        </Card>
        <Button
          className="w-full h-14 text-base font-semibold"
          onClick={handleReserve}
          disabled={!canReserve}
        >
          Reservar
        </Button>
        {space.id === 'escritorio' && !selectedDesk && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            Selecciona un escritorio para continuar
          </p>
        )}
      </div>
    </div>
  )
}

