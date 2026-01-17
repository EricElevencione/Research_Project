-- Create barangay_boundaries table to store municipal boundary data
-- This allows spatial validation and queries against administrative boundaries

CREATE TABLE IF NOT EXISTS barangay_boundaries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_alt VARCHAR(100),
    municipality VARCHAR(100) DEFAULT 'Dumangas',
    province VARCHAR(100) DEFAULT 'Iloilo',
    gid_3 VARCHAR(50) UNIQUE,
    area_sqkm DECIMAL(10, 4),
    geometry GEOMETRY(MultiPolygon, 4326),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create spatial index for fast spatial queries
CREATE INDEX IF NOT EXISTS idx_barangay_boundaries_geometry 
ON barangay_boundaries USING GIST(geometry);

-- Create index for name lookups
CREATE INDEX IF NOT EXISTS idx_barangay_boundaries_name 
ON barangay_boundaries(name);

-- Add comment
COMMENT ON TABLE barangay_boundaries IS 'Stores administrative boundary polygons for barangays in Dumangas municipality';

-- Add constraint to ensure geometry is valid
ALTER TABLE barangay_boundaries 
ADD CONSTRAINT check_valid_geometry 
CHECK (ST_IsValid(geometry));

-- Example: Import data from Dumangas_map.json (manual step)
-- You would need to parse the JSON and insert each feature like this:

-- INSERT INTO barangay_boundaries (name, name_alt, gid_3, geometry)
-- SELECT 
--     properties->>'NAME_3' as name,
--     properties->>'NAME_3_ALT' as name_alt,
--     properties->>'GID_3' as gid_3,
--     ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)
-- FROM your_json_data;

-- Useful spatial validation queries after both tables have PostGIS geometry:

-- 1. Check if land plots are within their claimed barangay
-- SELECT 
--     lp.id,
--     lp.surname || ', ' || lp.first_name as farmer,
--     lp.barangay as claimed_barangay,
--     bb.name as actual_barangay,
--     CASE 
--         WHEN ST_Within(lp.geometry_postgis, bb.geometry) THEN '✅ Valid'
--         ELSE '❌ Outside boundary'
--     END as validation_status
-- FROM land_plots lp
-- LEFT JOIN barangay_boundaries bb ON lp.barangay = bb.name
-- WHERE lp.geometry_postgis IS NOT NULL;

-- 2. Find which barangay a plot actually belongs to (auto-correction)
-- SELECT 
--     lp.id,
--     lp.barangay as user_entered,
--     bb.name as actual_barangay,
--     ST_Distance(lp.geometry_postgis::geography, bb.geometry::geography) as distance_meters
-- FROM land_plots lp
-- CROSS JOIN barangay_boundaries bb
-- WHERE ST_Intersects(lp.geometry_postgis, bb.geometry)
-- ORDER BY lp.id, distance_meters;

-- 3. Get barangay statistics
-- SELECT 
--     bb.name as barangay,
--     COUNT(lp.id) as total_parcels,
--     SUM(lp.area) as total_area_ha,
--     AVG(lp.area) as avg_parcel_size_ha,
--     bb.area_sqkm * 100 as barangay_area_ha
-- FROM barangay_boundaries bb
-- LEFT JOIN land_plots lp ON ST_Within(lp.geometry_postgis, bb.geometry)
-- GROUP BY bb.name, bb.area_sqkm
-- ORDER BY total_parcels DESC;
