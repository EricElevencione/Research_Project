-- Add farming activity columns to rsbsa_submission table
-- This allows storing specific crop types and farming activities

ALTER TABLE rsbsa_submission
ADD COLUMN IF NOT EXISTS "FARMER_RICE" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "FARMER_CORN" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "FARMER_OTHER_CROPS" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "FARMER_OTHER_CROPS_TEXT" TEXT,
ADD COLUMN IF NOT EXISTS "FARMER_LIVESTOCK" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "FARMER_LIVESTOCK_TEXT" TEXT,
ADD COLUMN IF NOT EXISTS "FARMER_POULTRY" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "FARMER_POULTRY_TEXT" TEXT;

-- Add comments for clarity
COMMENT ON COLUMN rsbsa_submission."FARMER_RICE" IS 'Indicates if farmer grows rice';
COMMENT ON COLUMN rsbsa_submission."FARMER_CORN" IS 'Indicates if farmer grows corn';
COMMENT ON COLUMN rsbsa_submission."FARMER_OTHER_CROPS" IS 'Indicates if farmer grows other crops';
COMMENT ON COLUMN rsbsa_submission."FARMER_OTHER_CROPS_TEXT" IS 'Specific other crops grown';
COMMENT ON COLUMN rsbsa_submission."FARMER_LIVESTOCK" IS 'Indicates if farmer raises livestock';
COMMENT ON COLUMN rsbsa_submission."FARMER_LIVESTOCK_TEXT" IS 'Specific livestock types';
COMMENT ON COLUMN rsbsa_submission."FARMER_POULTRY" IS 'Indicates if farmer raises poultry';
COMMENT ON COLUMN rsbsa_submission."FARMER_POULTRY_TEXT" IS 'Specific poultry types';

-- Create indexes for frequently queried farming activity fields
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_farmer_rice ON rsbsa_submission("FARMER_RICE");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_farmer_corn ON rsbsa_submission("FARMER_CORN");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_farmer_other_crops ON rsbsa_submission("FARMER_OTHER_CROPS");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_farmer_livestock ON rsbsa_submission("FARMER_LIVESTOCK");
CREATE INDEX IF NOT EXISTS idx_rsbsa_submission_farmer_poultry ON rsbsa_submission("FARMER_POULTRY");

COMMENT ON TABLE rsbsa_submission IS 'Structured RSBSA submission table with farming activity tracking';
