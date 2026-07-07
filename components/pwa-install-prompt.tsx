'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Share, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'pwa-install-prompt-shown'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Check if already shown
    if (typeof window === 'undefined') return
    const alreadyShown = localStorage.getItem(STORAGE_KEY)
    if (alreadyShown === 'true') return

    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    setIsStandalone(standalone)
    if (standalone) return

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream
    setIsIOS(isIOSDevice)

    if (isIOSDevice) {
      // Show iOS prompt after a short delay
      const timer = setTimeout(() => setShowPrompt(true), 1500)
      return () => clearTimeout(timer)
    }

    // Android/Chrome: Listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setTimeout(() => setShowPrompt(true), 1500)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setShowPrompt(false)
  }, [])

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      localStorage.setItem(STORAGE_KEY, 'true')
      
      // Request notification permission after install
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          await Notification.requestPermission()
        } catch (e) {
          console.log('[PWA] Notification permission request failed:', e)
        }
      }
    }
    setDeferredPrompt(null)
    setShowPrompt(false)
  }, [deferredPrompt])

  if (!showPrompt || isStandalone) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-4 animate-in slide-in-from-bottom-8 duration-500">
      <div className="relative mx-auto max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Top branded bar - blue to gray gradient */}
        <div className="h-1.5 bg-gradient-to-r from-[#0057a5] via-[#6B7280] to-[#0057a5]" />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors z-10"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>

        <div className="p-5">
          <div className="flex items-start gap-4">
            {/* MARIJO Brand Logo - CSS M on blue background */}
            <div 
              className="flex-shrink-0 w-16 h-16 rounded-2xl shadow-lg ring-2 ring-[#0057a5]/20 flex items-center justify-center"
              style={{ backgroundColor: '#0057a5' }}
              aria-label="MARIJO Fullwork App"
            >
              <span 
                className="text-white font-bold select-none"
                style={{ 
                  fontSize: '40px', 
                  fontFamily: 'DIN, Arial, Helvetica, sans-serif',
                  lineHeight: 1 
                }}
              >
                M
              </span>
            </div>

            <div className="flex-1 min-w-0 pr-6">
              <p className="text-xs font-semibold text-[#0057a5] uppercase tracking-wide mb-1">MARIJO</p>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Instala Fullwork
              </h3>

              {isIOS ? (
                // iOS Instructions
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 leading-snug">
                    Agrega la app a tu pantalla de inicio para acceder mas rapido.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-[#0057a5] font-medium bg-gray-100 px-3 py-2 rounded-lg">
                    <Share className="w-4 h-4 flex-shrink-0" />
                    <span>
                      Toca <span className="font-bold">Compartir</span> y luego{' '}
                      <span className="font-bold">&quot;Agregar al inicio&quot;</span>
                    </span>
                  </div>
                </div>
              ) : (
                // Android/Chrome
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 leading-snug">
                    Instala la app en tu dispositivo para acceder sin conexion y recibir notificaciones.
                  </p>
                  <Button
                    onClick={handleInstallClick}
                    className="w-full bg-[#0057a5] hover:bg-[#004080] text-white font-semibold h-11"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Instalar App
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Decorative bottom bar - blue to gray gradient */}
        <div className="h-1 bg-gradient-to-r from-[#0057a5] via-[#9CA3AF] to-[#0057a5]" />
      </div>
    </div>
  )
}
