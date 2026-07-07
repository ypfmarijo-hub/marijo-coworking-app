-- Migration: Add hora_inicio and estado columns to reservations table

-- Add hora_inicio column (integer representing hour: 8 for 08:00, 9 for 09:00, etc.)
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS hora_inicio INTEGER;

-- Add estado column with values: 'confirmada', 'cancelada', 'pendiente'
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'confirmada' CHECK (estado IN ('confirmada', 'cancelada', 'pendiente'));

-- Create index on estado for faster filtering
CREATE INDEX IF NOT EXISTS idx_reservations_estado 
  ON public.reservations(estado);

-- Create index on hora_inicio and date for availability queries
CREATE INDEX IF NOT EXISTS idx_reservations_hora_inicio 
  ON public.reservations(date, hora_inicio, estado);
