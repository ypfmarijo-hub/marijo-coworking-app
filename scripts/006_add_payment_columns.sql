-- Add payment-related columns to reservations table
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'payment_pending', 'confirmed', 'cancelled'));
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS reservation_code TEXT UNIQUE;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('mercado_pago', 'transfer', NULL));
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS amount_paid INTEGER;

-- Create storage bucket for payment receipts if it doesn't exist
-- Note: This needs to be done manually in Supabase Storage UI or via API

-- Update RLS policy to allow UPDATE (needed for payment confirmation)
DROP POLICY IF EXISTS "reservations_update_all" ON public.reservations;
CREATE POLICY "reservations_update_all"
ON public.reservations
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);
