-- Test script to check if all required tables and columns exist

-- Check if rsbsa_submission table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'rsbsa_submission'
) as rsbsa_submission_exists;

-- Check if rsbsa_farm_parcels table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'rsbsa_farm_parcels'
) as rsbsa_farm_parcels_exists;

-- Check if TOTAL FARM AREA column exists in rsbsa_submission
SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'rsbsa_submission' 
    AND column_name = 'TOTAL FARM AREA'
) as total_farm_area_column_exists;

-- Show sample data from rsbsa_submission
SELECT id, "LAST NAME", "FIRST NAME", "TOTAL FARM AREA" 
FROM rsbsa_submission 
LIMIT 5;

-- Show sample data from rsbsa_farm_parcels
SELECT id, submission_id, parcel_number, farm_location_barangay, total_farm_area_ha 
FROM rsbsa_farm_parcels 
LIMIT 5;

-- Create land_history table with appropriate data types
CREATE TABLE land_history (
    id SERIAL PRIMARY KEY,
    "Land_Owner_Name" VARCHAR(100),
    "Tenant_Name" VARCHAR(100),
    "Lessee_Name" VARCHAR(100),
    "Is_LandOwner" BOOLEAN,
    "Is_Tenant" BOOLEAN,
    "Is_Lessee" BOOLEAN,
    "Date_Created" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

