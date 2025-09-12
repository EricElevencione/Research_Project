-- Alter the existing rsbsa_submission table to have individual columns instead of JSONB
-- This will "section" the data into proper columns like the masterlist

-- First, let's add all the individual columns to the existing table
ALTER TABLE rsbsa_submission 
ADD COLUMN IF NOT EXISTS "LAST NAME" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "FIRST NAME" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "MIDDLE NAME" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "EXT NAME" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "GENDER" VARCHAR(10),
ADD COLUMN IF NOT EXISTS "BIRTHDATE" DATE,
ADD COLUMN IF NOT EXISTS "FARMER ADDRESS 1" VARCHAR(255),  -- House/Lot/Bldg. No./Purok
ADD COLUMN IF NOT EXISTS "FARMER ADDRESS 2" VARCHAR(255),  -- Barangay
ADD COLUMN IF NOT EXISTS "FARMER ADDRESS 3" VARCHAR(255),  -- Municipality, Province
ADD COLUMN IF NOT EXISTS "PARCEL NO." VARCHAR(50),
ADD COLUMN IF NOT EXISTS "PARCEL ADDRESS" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "PARCEL AREA" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "MOBILE NUMBER" VARCHAR(20),
ADD COLUMN IF NOT EXISTS "MAIN LIVELIHOOD" VARCHAR(100),
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Submitted';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_last_name ON rsbsa_submission("LAST NAME");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_first_name ON rsbsa_submission("FIRST NAME");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_barangay ON rsbsa_submission("FARMER ADDRESS 2");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_status ON rsbsa_submission(status);

-- Add comments for clarity
COMMENT ON COLUMN rsbsa_submission."FARMER ADDRESS 1" IS 'House/Lot/Bldg. No./Purok';
COMMENT ON COLUMN rsbsa_submission."FARMER ADDRESS 2" IS 'Barangay';
COMMENT ON COLUMN rsbsa_submission."FARMER ADDRESS 3" IS 'Municipality, Province';
COMMENT ON COLUMN rsbsa_submission."PARCEL AREA" IS 'Area in hectares';

-- Now migrate existing data from JSONB to the new columns
UPDATE rsbsa_submission 
SET 
    "LAST NAME" = data->>'surname',
    "FIRST NAME" = data->>'firstName',
    "MIDDLE NAME" = data->>'middleName',
    "EXT NAME" = data->>'extensionName',
    "GENDER" = data->>'gender',
    "BIRTHDATE" = CASE 
        WHEN data->>'dateOfBirth' IS NOT NULL AND data->>'dateOfBirth' != '' 
        THEN (data->>'dateOfBirth')::date 
        ELSE NULL 
    END,
    "FARMER ADDRESS 1" = data->>'houseNumber',
    "FARMER ADDRESS 2" = data->>'barangay',
    "FARMER ADDRESS 3" = CONCAT(
        COALESCE(data->>'municipality', ''), 
        CASE WHEN data->>'municipality' IS NOT NULL AND data->>'province' IS NOT NULL THEN ', ' ELSE '' END,
        COALESCE(data->>'province', '')
    ),
    "PARCEL NO." = CASE 
        WHEN jsonb_array_length(data->'farmlandParcels') > 0 
        THEN (data->'farmlandParcels'->0->>'parcelNo') 
        ELSE '1' 
    END,
    "PARCEL ADDRESS" = CASE 
        WHEN jsonb_array_length(data->'farmlandParcels') > 0 
        THEN CONCAT(
            COALESCE(data->'farmlandParcels'->0->>'farmLocationBarangay', ''),
            CASE WHEN data->'farmlandParcels'->0->>'farmLocationBarangay' IS NOT NULL AND data->'farmlandParcels'->0->>'farmLocationMunicipality' IS NOT NULL THEN ', ' ELSE '' END,
            COALESCE(data->'farmlandParcels'->0->>'farmLocationMunicipality', '')
        )
        ELSE NULL 
    END,
    "PARCEL AREA" = CASE 
        WHEN jsonb_array_length(data->'farmlandParcels') > 0 AND data->'farmlandParcels'->0->>'totalFarmAreaHa' IS NOT NULL
        THEN (data->'farmlandParcels'->0->>'totalFarmAreaHa')::decimal
        ELSE NULL 
    END,
    "MOBILE NUMBER" = data->>'mobileNumber',
    "MAIN LIVELIHOOD" = data->>'mainLivelihood',
    status = 'Submitted'
WHERE data IS NOT NULL;

-- Show the count of updated records
SELECT COUNT(*) as updated_records FROM rsbsa_submission WHERE "LAST NAME" IS NOT NULL;
