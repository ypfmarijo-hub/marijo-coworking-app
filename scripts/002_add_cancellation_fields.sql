-- Add status and cancelled_at fields to reservations table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Create index for cancelled reservations queries
CREATE INDEX IF NOT EXISTS idx_reservations_status_phone 
  ON public.reservations(status, phone);
