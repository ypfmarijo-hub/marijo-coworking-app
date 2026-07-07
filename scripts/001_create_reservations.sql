-- Create reservations table for the coworking booking system
-- All users can see and create reservations (no auth required)

CREATE TABLE IF NOT EXISTS public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace TEXT NOT NULL,
  date DATE NOT NULL,
  time_from TEXT NOT NULL,
  time_to TEXT NOT NULL,
  desk_number INTEGER,
  phone TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS but allow public access (no auth required for this app)
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read all reservations (for availability checking)
CREATE POLICY "reservations_select_all" ON public.reservations
  FOR SELECT USING (true);

-- Allow anyone to insert reservations (public booking)
CREATE POLICY "reservations_insert_all" ON public.reservations
  FOR INSERT WITH CHECK (true);

-- Create index for faster availability queries
CREATE INDEX IF NOT EXISTS idx_reservations_date_workspace 
  ON public.reservations(date, workspace);

CREATE INDEX IF NOT EXISTS idx_reservations_date_desk 
  ON public.reservations(date, desk_number) 
  WHERE workspace = 'escritorio';
