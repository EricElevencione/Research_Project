-- Remove the JSONB column and clean up the rsbsa_submission table
-- This will make it store data only in structured columns

-- First, let's see what data we have
SELECT COUNT(*) as total_records FROM rsbsa_submission;

-- Check current structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'rsbsa_submission' 
ORDER BY ordinal_position;

-- Drop the JSONB column since we're not using it anymore
ALTER TABLE rsbsa_submission DROP COLUMN IF EXISTS data;

-- Add a comment to clarify the new structure
COMMENT ON TABLE rsbsa_submission IS 'Stores RSBSA submissions in structured columns only';

-- Verify the new structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'rsbsa_submission' 
ORDER BY ordinal_position;

-- Show sample data to verify it's working
SELECT 
    id,
    "LAST NAME",
    "FIRST NAME", 
    "MIDDLE NAME",
    "FARMER ADDRESS 2" as barangay,
    "PARCEL NO.",
    "PARCEL ADDRESS",
    status,
    submitted_at
FROM rsbsa_submission 
ORDER BY submitted_at DESC 
LIMIT 5;
