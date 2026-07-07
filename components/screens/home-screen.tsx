'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { GoogleMap } from '@/components/google-map'
import { useReservation } from '@/lib/reservation-context'
import { CONTACT_INFO } from '@/lib/types'
import { MapPin, Calendar, List, MessageCircle, ShoppingCart } from 'lucide-react'

export function HomeScreen() {
  const { setCurrentScreen } = useReservation()

  return (
    <div className="min-h-screen bg-background">
      {/* Header with gas station image */}
      <div className="relative">
        <div className="h-48 overflow-hidden">
          <img 
            src="/portada-ypf.jpg"
            alt="Estación de Servicio MARIJO"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        <Card className="p-6 shadow-lg border-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
              <img 
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Foto%20de%20Perfil%20Whatsap%20%281%29-giBv1JD2RtJOF349UCTcI3vHPfcCHa.png"
                alt="Logo MARIJO"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">YPF MARIJO</h2>
              <p className="text-sm text-muted-foreground">Espacio de coworking</p>
            </div>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Bienvenido a Fullwork, el espacio de coworking de MARIJO pensado para trabajar, reunirse y conectar.
          </p>
        </Card>

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          <Button 
            className="w-full h-14 text-base font-medium gap-3"
            onClick={() => setCurrentScreen('info')}
          >
            <Calendar className="w-5 h-5" />
            Reservar espacio
          </Button>
          
          <Button 
            variant="outline"
            className="w-full h-14 text-base font-medium gap-3 border-2"
            onClick={() => setCurrentScreen('my-reservations')}
          >
            <List className="w-5 h-5" />
            Mis reservas
          </Button>

          <Button 
            variant="outline"
            className="w-full h-14 text-base font-medium gap-3 border-2 border-[#0057a5] text-[#0057a5] hover:bg-[#0057a5]/10"
            onClick={() => setCurrentScreen('market')}
          >
            <ShoppingCart className="w-5 h-5" />
            Market - Comprar
          </Button>
          
          <Button 
            variant="secondary"
            className="w-full h-14 text-base font-medium gap-3"
            asChild
          >
            <a 
              href={CONTACT_INFO.whatsappLink} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <MessageCircle className="w-5 h-5" />
              Contactar por WhatsApp
            </a>
          </Button>
        </div>

        {/* Location */}
        <Card className="mt-8 p-4 bg-muted/50 border-0">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Ubicación</p>
              <p className="text-sm text-muted-foreground mt-1">{CONTACT_INFO.address}</p>
            </div>
          </div>
          <GoogleMap className="h-48" />
        </Card>
      </div>

      {/* Footer spacer */}
      <div className="h-8" />
    </div>
  )
}
