'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WorkspaceType, WORKSPACE_LABELS, timeRangesOverlap } from '@/lib/types'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Constants ─────────────────────────────────────────────────────────────────

const HOURS: number[] = []
for (let h = 7; h <= 22; h++) HOURS.push(h)

const WORKSPACES: WorkspaceType[] = [
  'escritorio',
  'sala-a',
  'sala-b',
  'sala-grande',
  'oficina-c',
  'oficina-d',
]

const WORKSPACE_SHORT: Record<WorkspaceType, string> = {
  'escritorio':  'Escritorio',
  'sala-a':      'Sala A',
  'sala-b':      'Sala B',
  'sala-grande': 'Sala Grande',
  'oficina-c':   'Oficina C',
  'oficina-d':   'Oficina D',
}

type SlotStatus = 'libre' | 'ocupado'

interface SlotInfo {
  status: SlotStatus
}

type AvailabilityGrid = Record<WorkspaceType, Record<number, SlotInfo>>

// ─── Helper ────────────────────────────────────────────────────────────────────

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

function currentHour(): number {
  return new Date().getHours()
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function DisponibilidadPage() {
  const [grid, setGrid] = useState<AvailabilityGrid | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const buildGrid = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('reservations')
      .select('workspace, time_from, time_to, status')
      .eq('date', todayISO())
      .eq('status', 'confirmed')

    // Initialise all slots as libre
    const g: AvailabilityGrid = {} as AvailabilityGrid
    for (const ws of WORKSPACES) {
      g[ws] = {}
      for (const h of HOURS) {
        g[ws][h] = { status: 'libre' }
      }
    }

    if (!error && data) {
      for (const row of data) {
        const ws = row.workspace as WorkspaceType
        if (!WORKSPACES.includes(ws)) continue
        for (const h of HOURS) {
          const slotFrom = `${String(h).padStart(2, '0')}:00`
          const slotTo   = `${String(h + 1).padStart(2, '0')}:00`
          if (timeRangesOverlap(slotFrom, slotTo, row.time_from, row.time_to)) {
            g[ws][h] = { status: 'ocupado' }
          }
        }
      }
    }

    setGrid(g)
    setLastUpdated(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    buildGrid()

    // Auto-refresh every 60 seconds
    const timer = setInterval(buildGrid, 60_000)

    // Real-time subscription
    const supabase = createClient()
    const channel = supabase
      .channel('disponibilidad_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, buildGrid)
      .subscribe()

    return () => {
      clearInterval(timer)
      supabase.removeChannel(channel)
    }
  }, [buildGrid])

  const now = new Date()
  const dateLabel = now.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-5 shadow-md">
        <div className="max-w-5xl mx-auto flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold leading-tight">Disponibilidad de espacios</h1>
            <p className="text-primary-foreground/80 text-sm mt-0.5 capitalize">{dateLabel}</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0 gap-1.5 text-xs"
            onClick={buildGrid}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
        {lastUpdated && (
          <p className="max-w-5xl mx-auto text-primary-foreground/60 text-xs mt-2">
            Ultima actualizacion: {lastUpdated.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </header>

      {/* Legend */}
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-emerald-500 inline-block" />
          <span className="text-foreground font-medium">Libre</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-red-500 inline-block" />
          <span className="text-foreground font-medium">Ocupado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-muted border border-border inline-block" />
          <span className="text-muted-foreground">Hora pasada</span>
        </div>
      </div>

      {/* Grid */}
      <main className="max-w-5xl mx-auto px-4 pb-12 overflow-x-auto">
        {loading && !grid ? (
          <div className="space-y-2 mt-4">
            {HOURS.slice(0, 6).map(h => (
              <div key={h} className="h-12 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <table className="w-full border-collapse text-sm" style={{ minWidth: 480 }}>
            <thead>
              <tr>
                <th className="py-2 pr-3 text-left text-muted-foreground font-medium w-16">Hora</th>
                {WORKSPACES.map(ws => (
                  <th key={ws} className="py-2 px-1 text-center font-medium text-foreground text-xs">
                    {WORKSPACE_SHORT[ws]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map(h => {
                const isPast = h < currentHour()
                return (
                  <tr key={h} className="border-t border-border">
                    {/* Hour label */}
                    <td className="py-1.5 pr-3 text-muted-foreground font-mono text-xs whitespace-nowrap align-middle">
                      {formatHour(h)}
                    </td>
                    {/* Slots per workspace */}
                    {WORKSPACES.map(ws => {
                      const slot = grid?.[ws][h]
                      const isOcupado = slot?.status === 'ocupado'

                      if (isPast) {
                        return (
                          <td key={ws} className="py-1 px-1 text-center align-middle">
                            <span className="inline-flex items-center justify-center w-full rounded-md py-1.5 px-2 text-xs font-medium bg-muted text-muted-foreground border border-border">
                              —
                            </span>
                          </td>
                        )
                      }

                      return (
                        <td key={ws} className="py-1 px-1 text-center align-middle">
                          <span
                            className={`inline-flex items-center justify-center w-full rounded-md py-1.5 px-2 text-xs font-semibold transition-colors ${
                              isOcupado
                                ? 'bg-red-500 text-white'
                                : 'bg-emerald-500 text-white'
                            }`}
                          >
                            {isOcupado ? 'Ocupado' : 'Libre'}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </main>
    </div>
  )
}
