import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { PWAInstallPrompt } from '@/components/pwa-install-prompt'
import './globals.css'

// La letra Roboto se carga desde Google Fonts cuando se abre la página (no al armar la app en Vercel),
// así el armado no depende de poder descargar las fuentes en ese momento.

export const metadata: Metadata = {
  title: 'MARIJO - Fullwork Coworking',
  description: 'Reserva tu espacio de coworking en Fullwork, dentro de la Estación de Servicio MARIJO en Río Cuarto, Córdoba.',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Fullwork',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0057A5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
        <PWAInstallPrompt />
        <Analytics />
      </body>
    </html>
  )
}
