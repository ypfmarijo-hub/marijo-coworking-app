'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useReservation } from '@/lib/reservation-context'
import { WORKSPACE_LABELS } from '@/lib/types'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function DateScreen() {
  const {
    setCurrentScreen,
    selectedDate,
    setSelectedDate,
    selectedWorkspace,
    setSelectedTimeFrom,
    setSelectedTimeTo,
  } = useReservation()
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: (Date | null)[] = []

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null)
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }
    return days
  }

  const days = getDaysInMonth(currentMonth)

  const goToPrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const isDateSelectable = (date: Date) => date >= today

  const isSelected = (date: Date) =>
    selectedDate?.toDateString() === date.toDateString()

  const handleDateSelect = (date: Date) => {
    if (isDateSelectable(date)) {
      setSelectedDate(date)
      // Reset time range when date changes
      setSelectedTimeFrom(null)
      setSelectedTimeTo(null)
    }
  }

  const isPrevDisabled =
    currentMonth.getMonth() === today.getMonth() &&
    currentMonth.getFullYear() === today.getFullYear()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-primary px-4 pt-12 pb-6">
        <button
          onClick={() => setCurrentScreen('space-detail')}
          className="flex items-center gap-2 text-primary-foreground/90 hover:text-primary-foreground mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Volver</span>
        </button>
        <h1 className="text-2xl font-bold text-primary-foreground">Seleccionar fecha</h1>
        {selectedWorkspace && (
          <p className="text-primary-foreground/80 mt-1">
            {WORKSPACE_LABELS[selectedWorkspace]}
          </p>
        )}
      </div>

      {/* Calendar */}
      <div className="flex-1 px-4 py-6">
        <Card className="p-4 border-0 shadow-lg">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={goToPrevMonth}
              disabled={isPrevDisabled}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <h2 className="text-lg font-semibold text-foreground">
              {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h2>
            <button
              onClick={goToNextMonth}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted"
            >
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map(day => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="aspect-square" />
              }

              const selectable = isDateSelectable(date)
              const selected = isSelected(date)
              const isToday = date.toDateString() === today.toDateString()

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => handleDateSelect(date)}
                  disabled={!selectable}
                  className={`
                    aspect-square rounded-full flex items-center justify-center text-sm font-medium transition-all
                    ${selected
                      ? 'bg-primary text-primary-foreground'
                      : selectable
                        ? 'hover:bg-muted text-foreground'
                        : 'text-muted-foreground/40 cursor-not-allowed'
                    }
                    ${isToday && !selected ? 'ring-2 ring-primary ring-offset-2' : ''}
                  `}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
        </Card>

        {selectedDate && (
          <p className="text-center mt-4 text-muted-foreground">
            Fecha seleccionada:{' '}
            <span className="font-semibold text-foreground">
              {selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()]}
            </span>
          </p>
        )}
      </div>

      {/* Next Button */}
      <div className="px-4 pb-8">
        <Button
          className="w-full h-14 text-base font-medium"
          disabled={!selectedDate}
          onClick={() => setCurrentScreen('time-range')}
        >
          Siguiente
        </Button>
      </div>
    </div>
  )
}
