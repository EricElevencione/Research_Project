-- Add missing ownership type columns to rsbsa_submission table
-- This script adds the ownership type columns that were missing from the original migration

-- First, check if the table has a 'data' column (JSONB) or is already structured
DO $$
BEGIN
    -- Check if 'data' column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rsbsa_submission' AND column_name = 'data'
    ) THEN
        RAISE NOTICE 'Table has JSONB data column - will extract ownership types from JSONB';
        
        -- Add ownership type columns if they don't exist
        ALTER TABLE rsbsa_submission 
        ADD COLUMN IF NOT EXISTS "OWNERSHIP_TYPE_REGISTERED_OWNER" BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "OWNERSHIP_TYPE_TENANT" BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "OWNERSHIP_TYPE_LESSEE" BOOLEAN DEFAULT FALSE;

        -- Update existing records with ownership type data from JSONB
        UPDATE rsbsa_submission 
        SET 
            "OWNERSHIP_TYPE_REGISTERED_OWNER" = CASE 
                WHEN jsonb_array_length(data->'farmlandParcels') > 0 
                THEN (data->'farmlandParcels'->0->>'ownershipTypeRegisteredOwner')::boolean
                ELSE FALSE 
            END,
            "OWNERSHIP_TYPE_TENANT" = CASE 
                WHEN jsonb_array_length(data->'farmlandParcels') > 0 
                THEN (data->'farmlandParcels'->0->>'ownershipTypeTenant')::boolean
                ELSE FALSE 
            END,
            "OWNERSHIP_TYPE_LESSEE" = CASE 
                WHEN jsonb_array_length(data->'farmlandParcels') > 0 
                THEN (data->'farmlandParcels'->0->>'ownershipTypeLessee')::boolean
                ELSE FALSE 
            END
        WHERE data IS NOT NULL;
        
    ELSE
        RAISE NOTICE 'Table is structured - will add ownership type columns with default values';
        
        -- Add ownership type columns if they don't exist
        ALTER TABLE rsbsa_submission 
        ADD COLUMN IF NOT EXISTS "OWNERSHIP_TYPE_REGISTERED_OWNER" BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "OWNERSHIP_TYPE_TENANT" BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "OWNERSHIP_TYPE_LESSEE" BOOLEAN DEFAULT FALSE;
        
        -- For structured table, we'll set some sample data or leave as FALSE
        -- You can manually update specific records later if needed
        RAISE NOTICE 'Ownership type columns added with default FALSE values';
    END IF;
END $$;

-- Show the count of records
SELECT COUNT(*) as total_records FROM rsbsa_submission WHERE "LAST NAME" IS NOT NULL;

-- Show sample of ownership type data
SELECT 
    id,
    "LAST NAME",
    "FIRST NAME",
    "OWNERSHIP_TYPE_REGISTERED_OWNER",
    "OWNERSHIP_TYPE_TENANT", 
    "OWNERSHIP_TYPE_LESSEE"
FROM rsbsa_submission 
WHERE "LAST NAME" IS NOT NULL 
LIMIT 5;
