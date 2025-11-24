-- Add new seed variety columns to regional_allocations table
-- These replace the old rice/corn/vegetable seed columns with specific varieties

ALTER TABLE regional_allocations
ADD COLUMN IF NOT EXISTS jackpot_kg NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS us88_kg NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS th82_kg NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS rh9000_kg NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS lumping143_kg NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS lp296_kg NUMERIC(10,2) DEFAULT 0;

-- Update existing allocations to migrate old seed data to new columns (if any)
-- This is optional and depends on if you want to preserve old data
-- UPDATE regional_allocations 
-- SET jackpot_kg = rice_seeds_nsic_rc160_kg
-- WHERE rice_seeds_nsic_rc160_kg > 0;

-- Check the results
SELECT id, season, 
       jackpot_kg, us88_kg, th82_kg, rh9000_kg, lumping143_kg, lp296_kg,
       rice_seeds_nsic_rc160_kg, rice_seeds_nsic_rc222_kg
FROM regional_allocations
ORDER BY id DESC;
