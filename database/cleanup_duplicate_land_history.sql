-- ============================================================
-- Cleanup: Remove duplicate land_history records
-- The trigger "trigger_create_land_history_on_parcel_insert" was
-- creating extra land_history rows alongside our DB function.
-- This script removes the trigger-created duplicates (type=NEW, land_parcel_id=NULL)
-- and keeps the correct records from our function (type=TRANSFER with proper IDs).
--
-- Run this in Supabase SQL Editor (RLS blocks deletes from the anon key).
-- ============================================================

-- Step 1: Delete the duplicate "NEW" records with NULL land_parcel_id
-- These were created by the trigger, not by our function
DELETE FROM land_history
WHERE land_parcel_id IS NULL
  AND change_type = 'NEW'
  AND id IN (62, 64);

-- Step 2: Verify the cleanup — should show 4 records, no NULLs in land_parcel_id
SELECT id, land_parcel_id, farm_parcel_id, farmer_name, is_current, change_type, previous_history_id
FROM land_history
ORDER BY id;
