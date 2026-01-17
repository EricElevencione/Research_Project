-- Migration: Convert land_plots geometry from JSONB to PostGIS GEOMETRY
-- This enables proper spatial queries and analysis

-- Step 1: Enable PostGIS extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Step 2: Add new geometry column with proper PostGIS type
-- Using SRID 4326 (WGS84) which is standard for lat/lng coordinates
ALTER TABLE land_plots 
ADD COLUMN IF NOT EXISTS geometry_postgis GEOMETRY(Geometry, 4326);

-- Step 3: Migrate existing JSONB geometry data to PostGIS geometry
-- This converts GeoJSON JSONB to PostGIS geometry
UPDATE land_plots 
SET geometry_postgis = ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)
WHERE geometry IS NOT NULL AND geometry_postgis IS NULL;

-- Step 4: Create spatial index for fast spatial queries
CREATE INDEX IF NOT EXISTS idx_land_plots_geometry_postgis 
ON land_plots USING GIST(geometry_postgis);

-- Step 5: Verify migration
SELECT 
    COUNT(*) as total_plots,
    COUNT(geometry) as plots_with_jsonb,
    COUNT(geometry_postgis) as plots_with_postgis,
    COUNT(CASE WHEN geometry IS NOT NULL AND geometry_postgis IS NULL THEN 1 END) as failed_migrations
FROM land_plots;

-- Step 6: Optional - Drop old JSONB geometry column (ONLY after verifying migration worked)
-- UNCOMMENT THESE LINES ONLY AFTER CONFIRMING DATA IS MIGRATED CORRECTLY
-- ALTER TABLE land_plots DROP COLUMN geometry;
-- ALTER TABLE land_plots RENAME COLUMN geometry_postgis TO geometry;

-- Helpful spatial queries you can now run:

-- Calculate actual area of parcels
COMMENT ON COLUMN land_plots.geometry_postgis IS 
'PostGIS geometry column storing spatial data. Enables spatial queries like area calculation, overlap detection, and proximity analysis.';

-- Example queries after migration:

-- 1. Get actual area in hectares (more accurate than user input)
-- SELECT id, surname, 
--        ST_Area(geometry_postgis::geography) / 10000 as calculated_area_ha,
--        area as user_entered_area_ha
-- FROM land_plots;

-- 2. Find overlapping parcels (potential duplicates)
-- SELECT p1.id as parcel1, p2.id as parcel2, 
--        p1.surname as owner1, p2.surname as owner2
-- FROM land_plots p1, land_plots p2
-- WHERE p1.id < p2.id 
--   AND ST_Intersects(p1.geometry_postgis, p2.geometry_postgis);

-- 3. Find parcels within a certain distance of a point
-- SELECT id, surname, barangay,
--        ST_Distance(geometry_postgis::geography, 
--                    ST_SetSRID(ST_MakePoint(122.709, 10.823), 4326)::geography) as distance_meters
-- FROM land_plots
-- WHERE ST_DWithin(geometry_postgis::geography, 
--                  ST_SetSRID(ST_MakePoint(122.709, 10.823), 4326)::geography, 
--                  1000)  -- within 1km
-- ORDER BY distance_meters;

-- 4. Check if parcels are within barangay boundaries (requires barangay_boundaries table)
-- SELECT lp.id, lp.surname, lp.barangay, 
--        CASE WHEN ST_Within(lp.geometry_postgis, bb.geometry) THEN 'Valid' ELSE 'Outside boundary' END as status
-- FROM land_plots lp
-- LEFT JOIN barangay_boundaries bb ON lp.barangay = bb.name;
