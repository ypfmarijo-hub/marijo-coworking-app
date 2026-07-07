-- Add UPDATE policy for cancellation functionality
-- This policy is required for cancelReservation to work

DROP POLICY IF EXISTS "reservations_public_update" ON public.reservations;
DROP POLICY IF EXISTS "reservations_update_all" ON public.reservations;

CREATE POLICY "reservations_update_all"
ON public.reservations
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Verify all policies are in place
-- You should see: reservations_select_all, reservations_insert_all, reservations_update_all
