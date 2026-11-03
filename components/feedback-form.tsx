'use client'

import { useState } from 'react'
import { Loader2, Star } from 'lucide-react'

// Formulario corto de opinión: estrellas + comentario opcional.
// Se usa en "Mis reservas" (con teléfono) y al terminar la pizarra (con la sesión).
export function FeedbackForm({ reservationId, phone, onDone, compact }: { reservationId?: string; phone?: string; onDone: (rating: number) => void; compact?: boolean }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const labels = ['', 'Mala', 'Regular', 'Buena', 'Muy buena', 'Excelente']

  const send = async () => {
    if (!rating) { setError('Tocá las estrellas para puntuar.'); return }
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment, reservationId, phone }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar.')
      onDone(rating)
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-2">
      {!compact && <p className="text-sm font-semibold text-foreground">¿Cómo fue tu visita?</p>}
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Puntuación">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} de 5`} onClick={() => setRating(n)}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-amber-50">
            <Star className={`w-7 h-7 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
          </button>
        ))}
        {rating > 0 && <span className="ml-1 text-sm font-semibold text-slate-600">{labels[rating]}</span>}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={600} aria-label="Comentario (opcional)"
        placeholder="Contanos qué te gustó o qué mejorarías (opcional)"
        className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" />
      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      <button type="button" onClick={send} disabled={busy}
        className="w-full h-11 rounded-xl bg-[#0057a5] text-white font-bold text-sm disabled:opacity-60">
        {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Enviar opinión'}
      </button>
    </div>
  )
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`w-4 h-4 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}
    </span>
  )
}
