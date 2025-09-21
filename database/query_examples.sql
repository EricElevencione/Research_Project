-- Query Examples for Retrieving Farm Parcels by Farmer

-- 1. Get all parcels for a specific farmer by submission ID
SELECT 
    fp.*,
    rs."LAST NAME",
    rs."FIRST NAME", 
    rs."MIDDLE NAME"
FROM rsbsa_farm_parcels fp
JOIN rsbsa_submission rs ON fp.submission_id = rs.id
WHERE rs.id = 1;  -- Replace 1 with the actual submission ID

-- 2. Get all parcels for a specific farmer by name
SELECT 
    fp.*,
    rs."LAST NAME",
    rs."FIRST NAME", 
    rs."MIDDLE NAME"
FROM rsbsa_farm_parcels fp
JOIN rsbsa_submission rs ON fp.submission_id = rs.id
WHERE rs."LAST NAME" = 'Smith' 
  AND rs."FIRST NAME" = 'John';

-- 3. Get all parcels for farmers from a specific barangay
SELECT 
    fp.*,
    rs."LAST NAME",
    rs."FIRST NAME", 
    rs."MIDDLE NAME",
    rs."BARANGAY"
FROM rsbsa_farm_parcels fp
JOIN rsbsa_submission rs ON fp.submission_id = rs.id
WHERE rs."BARANGAY" = 'Barangay Name';

-- 4. Count parcels per farmer
SELECT 
    rs.id as submission_id,
    CONCAT(rs."FIRST NAME", ' ', rs."LAST NAME") as farmer_name,
    COUNT(fp.id) as total_parcels,
    SUM(fp.total_farm_area_ha) as total_farm_area
FROM rsbsa_submission rs
LEFT JOIN rsbsa_farm_parcels fp ON rs.id = fp.submission_id
GROUP BY rs.id, rs."FIRST NAME", rs."LAST NAME"
ORDER BY total_parcels DESC;

-- 5. Get farmer details with all their parcels in one query
SELECT 
    rs.id as submission_id,
    rs."LAST NAME",
    rs."FIRST NAME", 
    rs."MIDDLE NAME",
    rs."BARANGAY",
    rs."MUNICIPALITY",
    fp.parcel_number,
    fp.farm_location_barangay,
    fp.farm_location_municipality,
    fp.total_farm_area_ha,
    fp.ownership_type_registered_owner,
    fp.ownership_type_tenant,
    fp.ownership_type_lessee
FROM rsbsa_submission rs
LEFT JOIN rsbsa_farm_parcels fp ON rs.id = fp.submission_id
WHERE rs.id = 1  -- Replace with specific submission ID
ORDER BY fp.parcel_number;

-- 6. Find farmers with more than X parcels
SELECT 
    rs.id as submission_id,
    CONCAT(rs."FIRST NAME", ' ', rs."LAST NAME") as farmer_name,
    COUNT(fp.id) as parcel_count
FROM rsbsa_submission rs
JOIN rsbsa_farm_parcels fp ON rs.id = fp.submission_id
GROUP BY rs.id, rs."FIRST NAME", rs."LAST NAME"
HAVING COUNT(fp.id) > 2;  -- Farmers with more than 2 parcels

-- 7. Get parcels within a specific area
SELECT 
    fp.*,
    rs."LAST NAME",
    rs."FIRST NAME", 
    rs."MIDDLE NAME"
FROM rsbsa_farm_parcels fp
JOIN rsbsa_submission rs ON fp.submission_id = rs.id
WHERE fp.farm_location_barangay = 'Specific Barangay'
  AND fp.farm_location_municipality = 'Specific Municipality';
