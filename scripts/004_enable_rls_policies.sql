-- =====================================================
-- RLS POLICIES FOR RESERVATIONS TABLE
-- Run this in Supabase SQL Editor to enable public access
-- =====================================================

-- 1. Enable Row Level Security on reservations table
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public read access" ON public.reservations;
DROP POLICY IF EXISTS "Allow public insert access" ON public.reservations;
DROP POLICY IF EXISTS "Allow public update access" ON public.reservations;
DROP POLICY IF EXISTS "reservations_public_select" ON public.reservations;
DROP POLICY IF EXISTS "reservations_public_insert" ON public.reservations;
DROP POLICY IF EXISTS "reservations_public_update" ON public.reservations;

-- 3. CREATE POLICY: Allow anyone to READ all reservations
CREATE POLICY "reservations_public_select"
ON public.reservations
FOR SELECT
TO public
USING (true);

-- 4. CREATE POLICY: Allow anyone to INSERT new reservations
CREATE POLICY "reservations_public_insert"
ON public.reservations
FOR INSERT
TO public
WITH CHECK (true);

-- 5. CREATE POLICY: Allow anyone to UPDATE reservations (for cancellation)
CREATE POLICY "reservations_public_update"
ON public.reservations
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- =====================================================
-- VERIFICATION: Run this to confirm policies are active
-- =====================================================
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'reservations';
