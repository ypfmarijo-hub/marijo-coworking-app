'use client'

interface GoogleMapProps {
  className?: string
}

export function GoogleMap({ className = '' }: GoogleMapProps) {
  // Coordinates for San Martín 1883, Río Cuarto, Córdoba, Argentina
  const lat = -33.1307
  const lng = -64.3498
  const query = encodeURIComponent('San Martín 1883, Río Cuarto, Córdoba, Argentina')
  
  return (
    <div className={`overflow-hidden rounded-xl ${className}`}>
      <iframe
        src={`https://www.google.com/maps?q=${query}&z=16&output=embed`}
        width="100%"
        height="100%"
        style={{ border: 0, minHeight: '200px' }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title="Ubicación de Fullwork - Estación MARIJO"
      />
    </div>
  )
}
