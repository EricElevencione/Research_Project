# PostGIS Migration Guide

## What Changed?

Your land parcel spatial data has been upgraded from JSONB storage to native PostGIS geometry types. This enables real spatial queries and analysis capabilities.

## Migration Steps

### 1. Run the Database Migration

Execute the migration script in pgAdmin or psql:

```bash
psql -U postgres -d Masterlist -f database/migrate_land_plots_to_postgis.sql
```

This will:
- ✅ Enable PostGIS extension
- ✅ Add `geometry_postgis` column (GEOMETRY type)
- ✅ Migrate existing JSONB data to PostGIS
- ✅ Create spatial index (GIST)
- ✅ Keep original `geometry` column for backward compatibility

### 2. Verify Migration

Check that data was migrated successfully:

```sql
SELECT 
    COUNT(*) as total_plots,
    COUNT(geometry) as plots_with_jsonb,
    COUNT(geometry_postgis) as plots_with_postgis,
    COUNT(CASE WHEN geometry IS NOT NULL AND geometry_postgis IS NULL THEN 1 END) as failed_migrations
FROM land_plots;
```

Expected result: All counts should match (failed_migrations = 0)

### 3. Restart Backend Server

The backend has been updated to automatically:
- Convert incoming GeoJSON to PostGIS geometry
- Return PostGIS geometry as GeoJSON to frontend
- Calculate actual parcel area using spatial functions

```bash
# In your backend terminal
npm run dev
# or restart your existing server
```

### 4. Test the Application

Frontend should work exactly as before, but now with enhanced capabilities:
- Land plotting page continues to work normally
- Maps display parcels correctly
- **New:** Calculated area is now accurate (returned as `calculated_area_ha`)

## New Spatial Capabilities

### API Endpoints

You now have access to powerful spatial queries:

#### 1. Validate Parcel Location
```http
GET /api/spatial/validate-parcel/:id
```
Checks if a parcel is actually within its claimed barangay boundaries.

#### 2. Find Overlapping Parcels
```http
GET /api/spatial/overlapping-parcels
```
Detects potential duplicate land claims or boundary disputes.

#### 3. Find Nearby Parcels
```http
GET /api/spatial/parcels-near?lng=122.709&lat=10.823&radius=1000
```
Finds all parcels within a radius (meters) of a point.

#### 4. Barangay Statistics
```http
GET /api/spatial/barangay-stats
```
Returns accurate area calculations grouped by barangay.

#### 5. Calculate Geometry Area
```http
POST /api/spatial/calculate-area
Body: { "geometry": { "type": "Polygon", "coordinates": [...] } }
```
Calculates exact area in hectares for any geometry.

### SQL Query Examples

You can now run spatial queries directly in pgAdmin:

#### Find parcels larger than 2 hectares:
```sql
SELECT id, surname, barangay,
       ST_Area(geometry_postgis::geography) / 10000 as actual_area_ha
FROM land_plots
WHERE ST_Area(geometry_postgis::geography) / 10000 > 2
ORDER BY actual_area_ha DESC;
```

#### Find all parcels within 500m of a specific point:
```sql
SELECT id, surname, barangay,
       ST_Distance(geometry_postgis::geography, 
                   ST_SetSRID(ST_MakePoint(122.709, 10.823), 4326)::geography) as distance_m
FROM land_plots
WHERE ST_DWithin(geometry_postgis::geography,
                 ST_SetSRID(ST_MakePoint(122.709, 10.823), 4326)::geography,
                 500)
ORDER BY distance_m;
```

#### Check for overlapping parcels:
```sql
SELECT p1.id as parcel1, p2.id as parcel2,
       p1.surname as owner1, p2.surname as owner2,
       ST_Area(ST_Intersection(p1.geometry_postgis, p2.geometry_postgis)::geography) / 10000 as overlap_ha
FROM land_plots p1, land_plots p2
WHERE p1.id < p2.id
  AND ST_Intersects(p1.geometry_postgis, p2.geometry_postgis);
```

## Optional: Barangay Boundaries

To enable boundary validation, you can import barangay boundaries:

### 1. Create the table:
```bash
psql -U postgres -d Masterlist -f database/create_barangay_boundaries_table.sql
```

### 2. Import boundary data from Dumangas_map.json (manual process)

You would need to write a script to parse the JSON and insert features, or use tools like `ogr2ogr`.

## Benefits for Your Thesis

### Technical Improvements:
- ✅ **Accurate area calculations** - No longer relying on user input
- ✅ **Spatial validation** - Detect data entry errors
- ✅ **Overlap detection** - Identify duplicate claims
- ✅ **Proximity analysis** - Find nearby parcels
- ✅ **Standard GIS format** - Compatible with QGIS, ArcGIS, etc.

### For DA Deployment:
- ✅ **Data quality** - Automatic validation against boundaries
- ✅ **Conflict resolution** - Detect overlapping land claims
- ✅ **Reporting** - Accurate area summaries by barangay
- ✅ **Scalability** - GIST indexes for fast spatial queries

## Rollback (If Needed)

If you need to revert:

```sql
-- System will fall back to JSONB geometry automatically
-- No action needed - both columns are maintained
```

## Testing Checklist

- [ ] Migration script runs without errors
- [ ] All existing parcels have `geometry_postgis` populated
- [ ] Backend server starts without errors
- [ ] Land plotting page works (create/edit/delete parcels)
- [ ] Map displays all parcels correctly
- [ ] New spatial endpoints return data
- [ ] `calculated_area_ha` field is present in API responses

## Support

If you encounter any issues:

1. Check PostgreSQL logs: `SELECT * FROM pg_stat_activity;`
2. Verify PostGIS is installed: `SELECT PostGIS_Version();`
3. Check migration status with verification query above
4. Ensure backend server restarted after code changes
