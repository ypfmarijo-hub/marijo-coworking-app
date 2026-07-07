-- Add source column to track reservation origin (online vs staff)
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'online';

-- Add comment for documentation
COMMENT ON COLUMN reservations.source IS 'Reservation source: online (50% deposit paid) or staff (100% to collect on site)';
