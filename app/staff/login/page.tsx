'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { supabaseConfigured } from '@/lib/supabase/config'

export default function StaffLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError || !data.user) {
      // Mensaje según la causa real (en la prueba, "incorrectos" escondía un usuario sin confirmar y una URL mal pegada)
      const msg = (authError?.message || '').toLowerCase()
      const code = (authError as { code?: string } | null)?.code || ''
      if (code === 'email_not_confirmed' || msg.includes('not confirmed')) {
        setError('Este usuario no está confirmado. En Supabase: Authentication → Users, o correr el script 008.')
      } else if (code === 'invalid_credentials' || msg.includes('invalid login')) {
        setError('Email o contraseña incorrectos.')
      } else if (!supabaseConfigured || msg.includes('fetch') || msg.includes('api key') || msg.includes('network') || (authError as { status?: number } | null)?.status === 0) {
        setError('No se pudo conectar con la base de datos. Revisá las variables de Supabase en Vercel (ver /api/estado).')
      } else {
        setError(`No se pudo iniciar sesión: ${authError?.message || 'error desconocido'}`)
      }
      setLoading(false)
      return
    }

    if (data.user.app_metadata?.role !== 'staff') {
      await supabase.auth.signOut()
      setError('Este usuario no tiene permiso de staff.')
      setLoading(false)
      return
    }

    router.replace('/staff')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-[#0057a5] text-white">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-75">Gestión Administrativa</p>
          <h1 className="text-lg font-bold leading-tight uppercase">Agenda Fullwork</h1>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Lock className="w-5 h-5 text-[#0057a5]" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Ingreso del staff</h2>
              <p className="text-xs text-slate-500">Acceso exclusivo para el personal de MARIJO</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Contraseña
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-[#0057a5] hover:bg-[#004a8d] text-white font-bold rounded-xl"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ingresar'}
          </Button>
        </form>
      </main>
    </div>
  )
}
