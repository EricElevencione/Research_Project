-- ============================================================
-- ADD CURRENT OWNER FLAG TO RSBSA_FARM_PARCELS
-- ============================================================
-- This allows us to hide transferred parcels from RSBSA Page
-- Run this in Supabase SQL Editor.
-- ============================================================

-- Step 1: Add is_current_owner column
ALTER TABLE rsbsa_farm_parcels 
ADD COLUMN IF NOT EXISTS is_current_owner BOOLEAN DEFAULT true;

-- Step 2: Set all existing records to true (they are current owners)
UPDATE rsbsa_farm_parcels 
SET is_current_owner = true 
WHERE is_current_owner IS NULL;

-- Step 3: Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_farm_parcels_current_owner 
ON rsbsa_farm_parcels(is_current_owner) 
WHERE is_current_owner = true;

-- Step 4: Verify
SELECT 
    submission_id,
    parcel_number,
    farm_location_barangay,
    is_current_owner
FROM rsbsa_farm_parcels
LIMIT 10;
