-- Check if TOTAL FARM AREA column exists and add it if it doesn't
-- This script is safe to run multiple times

-- First, check if the column exists
DO $$
BEGIN
    -- Check if the column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'rsbsa_submission' 
        AND column_name = 'TOTAL FARM AREA'
    ) THEN
        -- Add the column if it doesn't exist
        ALTER TABLE rsbsa_submission 
        ADD COLUMN "TOTAL FARM AREA" DECIMAL(10,2);
        
        -- Add comment
        COMMENT ON COLUMN rsbsa_submission."TOTAL FARM AREA" IS 'Total farm area in hectares (sum of all parcels for this farmer)';
        
        -- Create index for better performance
        CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_total_farm_area ON rsbsa_submission("TOTAL FARM AREA");
        
        RAISE NOTICE 'TOTAL FARM AREA column added successfully';
    ELSE
        RAISE NOTICE 'TOTAL FARM AREA column already exists';
    END IF;
END $$;

-- Update existing records to calculate total farm area
-- This will sum up all parcel areas for each farmer based on their name
UPDATE rsbsa_submission 
SET "TOTAL FARM AREA" = (
    SELECT COALESCE(SUM("PARCEL AREA"), 0)
    FROM rsbsa_submission rs2 
    WHERE rs2."LAST NAME" = rsbsa_submission."LAST NAME" 
    AND rs2."FIRST NAME" = rsbsa_submission."FIRST NAME"
    AND rs2."PARCEL AREA" IS NOT NULL
)
WHERE "LAST NAME" IS NOT NULL AND "FIRST NAME" IS NOT NULL;

-- Show the count of updated records
SELECT COUNT(*) as updated_records FROM rsbsa_submission WHERE "TOTAL FARM AREA" IS NOT NULL;
