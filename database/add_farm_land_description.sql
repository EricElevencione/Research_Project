-- Add Farm Land Description fields to rsbsaform table
-- This script adds the necessary columns to store farm land description data

-- Add farm land description fields
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS farm_land_description TEXT;
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS farm_location_barangay VARCHAR(255);
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS farm_location_city_municipality VARCHAR(255);
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS total_farm_area VARCHAR(50);
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS within_ancestral_domain VARCHAR(10);
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS agrarian_reform_beneficiary VARCHAR(10);
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS ownership_document_no VARCHAR(255);

-- Add ownership type fields
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS ownership_type_registered_owner BOOLEAN DEFAULT FALSE;
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS ownership_type_tenant BOOLEAN DEFAULT FALSE;
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS ownership_type_tenant_land_owner VARCHAR(255);
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS ownership_type_lessee BOOLEAN DEFAULT FALSE;
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS ownership_type_lessee_land_owner VARCHAR(255);
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS ownership_type_others BOOLEAN DEFAULT FALSE;
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS ownership_type_others_specify VARCHAR(255);

-- Add crop and farm details
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS crop_commodity VARCHAR(255);
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS farm_size VARCHAR(50);
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS number_of_head VARCHAR(50);
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS farm_type VARCHAR(255);
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS organic_practitioner VARCHAR(10);
ALTER TABLE rsbsaform ADD COLUMN IF NOT EXISTS farm_remarks TEXT;

-- Create farmer_photos table for storing uploaded photos
CREATE TABLE IF NOT EXISTS farmer_photos (
    id SERIAL PRIMARY KEY,
    farmer_id VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farmer_id) REFERENCES rsbsaform(id) ON DELETE CASCADE
);

-- Add comments to describe the fields
COMMENT ON COLUMN rsbsaform.farm_land_description IS 'Complete farm land description including location and details';
COMMENT ON COLUMN rsbsaform.farm_location_barangay IS 'Barangay where the farm is located';
COMMENT ON COLUMN rsbsaform.farm_location_city_municipality IS 'City or municipality where the farm is located';
COMMENT ON COLUMN rsbsaform.total_farm_area IS 'Total farm area in hectares';
COMMENT ON COLUMN rsbsaform.within_ancestral_domain IS 'Whether the farm is within ancestral domain (Yes/No)';
COMMENT ON COLUMN rsbsaform.agrarian_reform_beneficiary IS 'Whether the farmer is an agrarian reform beneficiary (Yes/No)';
COMMENT ON COLUMN rsbsaform.ownership_document_no IS 'Document number proving ownership';
COMMENT ON COLUMN rsbsaform.ownership_type_registered_owner IS 'Whether the farmer is a registered owner';
COMMENT ON COLUMN rsbsaform.ownership_type_tenant IS 'Whether the farmer is a tenant';
COMMENT ON COLUMN rsbsaform.ownership_type_tenant_land_owner IS 'Name of land owner if tenant';
COMMENT ON COLUMN rsbsaform.ownership_type_lessee IS 'Whether the farmer is a lessee';
COMMENT ON COLUMN rsbsaform.ownership_type_lessee_land_owner IS 'Name of land owner if lessee';
COMMENT ON COLUMN rsbsaform.ownership_type_others IS 'Whether the farmer has other ownership type';
COMMENT ON COLUMN rsbsaform.ownership_type_others_specify IS 'Specification of other ownership type';
COMMENT ON COLUMN rsbsaform.crop_commodity IS 'Type of crop or commodity grown';
COMMENT ON COLUMN rsbsaform.farm_size IS 'Size of the farm parcel';
COMMENT ON COLUMN rsbsaform.number_of_head IS 'Number of livestock/poultry heads';
COMMENT ON COLUMN rsbsaform.farm_type IS 'Type of farming (e.g., Irrigated, Rainfed)';
COMMENT ON COLUMN rsbsaform.organic_practitioner IS 'Whether the farmer is an organic practitioner (Y/N)';
COMMENT ON COLUMN rsbsaform.farm_remarks IS 'Additional remarks about the farm';

-- Add comments for farmer_photos table
COMMENT ON TABLE farmer_photos IS 'Table to store uploaded photos for RSBSA farmers';
COMMENT ON COLUMN farmer_photos.farmer_id IS 'Reference to the RSBSA farmer record';
COMMENT ON COLUMN farmer_photos.file_name IS 'Original name of the uploaded file';
COMMENT ON COLUMN farmer_photos.file_path IS 'Path to the stored file in the uploads directory';
COMMENT ON COLUMN farmer_photos.file_size IS 'Size of the file in bytes';
COMMENT ON COLUMN farmer_photos.upload_time IS 'Timestamp when the file was uploaded';

-- Display the updated table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'rsbsaform' 
AND column_name LIKE '%farm%' OR column_name LIKE '%ownership%'
ORDER BY ordinal_position; 