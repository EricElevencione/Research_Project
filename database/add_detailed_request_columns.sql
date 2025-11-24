-- Migration: Add detailed fertilizer and seed request columns to farmer_requests table
-- Date: 2025-11-24
-- Purpose: Store specific amounts requested for each fertilizer type and seed variety

-- Add fertilizer request columns (in bags)
ALTER TABLE farmer_requests
ADD COLUMN IF NOT EXISTS requested_urea_bags NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS requested_complete_14_bags NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS requested_complete_16_bags NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS requested_ammonium_sulfate_bags NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS requested_ammonium_phosphate_bags NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS requested_muriate_potash_bags NUMERIC(10,2) DEFAULT 0;

-- Add seed variety request columns (in kg)
ALTER TABLE farmer_requests
ADD COLUMN IF NOT EXISTS requested_jackpot_kg NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS requested_us88_kg NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS requested_th82_kg NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS requested_rh9000_kg NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS requested_lumping143_kg NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS requested_lp296_kg NUMERIC(10,2) DEFAULT 0;

-- Verify the new columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'farmer_requests'
AND column_name LIKE 'requested_%'
ORDER BY ordinal_position;

-- Show sample of updated table structure
\d farmer_requests
