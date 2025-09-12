-- Migration script to move data from rsbsa_submission (JSONB) to rsbsa_submission_structured
-- This script extracts data from the JSONB column and inserts it into the structured table

INSERT INTO rsbsa_submission_structured (
    "LAST NAME",
    "FIRST NAME", 
    "MIDDLE NAME",
    "EXT NAME",
    "GENDER",
    "BIRTHDATE",
    "FARMER ADDRESS 1",
    "FARMER ADDRESS 2", 
    "FARMER ADDRESS 3",
    "PARCEL NO.",
    "PARCEL ADDRESS",
    "PARCEL AREA",
    "MOBILE NUMBER",
    "MAIN LIVELIHOOD",
    status,
    submitted_at,
    created_at
)
SELECT 
    data->>'surname' as "LAST NAME",
    data->>'firstName' as "FIRST NAME",
    data->>'middleName' as "MIDDLE NAME", 
    data->>'extensionName' as "EXT NAME",
    data->>'gender' as "GENDER",
    CASE 
        WHEN data->>'dateOfBirth' IS NOT NULL AND data->>'dateOfBirth' != '' 
        THEN (data->>'dateOfBirth')::date 
        ELSE NULL 
    END as "BIRTHDATE",
    data->>'houseNumber' as "FARMER ADDRESS 1",
    data->>'barangay' as "FARMER ADDRESS 2",
    CONCAT(
        COALESCE(data->>'municipality', ''), 
        CASE WHEN data->>'municipality' IS NOT NULL AND data->>'province' IS NOT NULL THEN ', ' ELSE '' END,
        COALESCE(data->>'province', '')
    ) as "FARMER ADDRESS 3",
    CASE 
        WHEN jsonb_array_length(data->'farmlandParcels') > 0 
        THEN (data->'farmlandParcels'->0->>'parcelNo') 
        ELSE '1' 
    END as "PARCEL NO.",
    CASE 
        WHEN jsonb_array_length(data->'farmlandParcels') > 0 
        THEN CONCAT(
            COALESCE(data->'farmlandParcels'->0->>'farmLocationBarangay', ''),
            CASE WHEN data->'farmlandParcels'->0->>'farmLocationBarangay' IS NOT NULL AND data->'farmlandParcels'->0->>'farmLocationMunicipality' IS NOT NULL THEN ', ' ELSE '' END,
            COALESCE(data->'farmlandParcels'->0->>'farmLocationMunicipality', '')
        )
        ELSE NULL 
    END as "PARCEL ADDRESS",
    CASE 
        WHEN jsonb_array_length(data->'farmlandParcels') > 0 AND data->'farmlandParcels'->0->>'totalFarmAreaHa' IS NOT NULL
        THEN (data->'farmlandParcels'->0->>'totalFarmAreaHa')::decimal
        ELSE NULL 
    END as "PARCEL AREA",
    data->>'mobileNumber' as "MOBILE NUMBER",
    data->>'mainLivelihood' as "MAIN LIVELIHOOD",
    'Submitted' as status,
    submitted_at,
    created_at
FROM rsbsa_submission
WHERE data IS NOT NULL;

-- Show the count of migrated records
SELECT COUNT(*) as migrated_records FROM rsbsa_submission_structured;
