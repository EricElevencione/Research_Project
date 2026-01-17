const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'Masterlist',
    password: process.env.DB_PASSWORD || 'postgresadmin',
    port: process.env.DB_PORT || 5432,
});

// ============================================================================
// GET /api/spatial/validate-parcel/:id - Validate if parcel is within barangay
// ============================================================================
router.get('/validate-parcel/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT 
                lp.id,
                lp.surname || ', ' || lp.first_name as farmer_name,
                lp.barangay as claimed_barangay,
                bb.name as actual_barangay,
                CASE 
                    WHEN bb.name IS NULL THEN 'No boundary data'
                    WHEN ST_Within(lp.geometry_postgis, bb.geometry) THEN 'Valid'
                    ELSE 'Outside boundary'
                END as validation_status,
                CASE 
                    WHEN bb.geometry IS NOT NULL AND lp.geometry_postgis IS NOT NULL 
                    THEN ST_Distance(lp.geometry_postgis::geography, bb.geometry::geography)
                    ELSE NULL
                END as distance_to_boundary_meters
            FROM land_plots lp
            LEFT JOIN barangay_boundaries bb ON lp.barangay = bb.name
            WHERE lp.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Parcel not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error validating parcel:', error);
        res.status(500).json({ message: 'Validation failed', error: error.message });
    }
});

// ============================================================================
// GET /api/spatial/overlapping-parcels - Find overlapping land parcels
// ============================================================================
router.get('/overlapping-parcels', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                p1.id as parcel1_id,
                p1.surname || ', ' || p1.first_name as farmer1,
                p1.barangay as barangay1,
                p2.id as parcel2_id,
                p2.surname || ', ' || p2.first_name as farmer2,
                p2.barangay as barangay2,
                ST_Area(ST_Intersection(p1.geometry_postgis, p2.geometry_postgis)::geography) / 10000 as overlap_area_ha,
                (ST_Area(ST_Intersection(p1.geometry_postgis, p2.geometry_postgis)::geography) / 
                 ST_Area(p1.geometry_postgis::geography)) * 100 as overlap_percent
            FROM land_plots p1
            INNER JOIN land_plots p2 ON p1.id < p2.id
            WHERE p1.geometry_postgis IS NOT NULL 
              AND p2.geometry_postgis IS NOT NULL
              AND ST_Intersects(p1.geometry_postgis, p2.geometry_postgis)
            ORDER BY overlap_area_ha DESC
        `);

        res.json({
            count: result.rows.length,
            overlaps: result.rows
        });
    } catch (error) {
        console.error('Error finding overlapping parcels:', error);
        res.status(500).json({ message: 'Query failed', error: error.message });
    }
});

// ============================================================================
// GET /api/spatial/parcels-near - Find parcels near a point
// ============================================================================
router.get('/parcels-near', async (req, res) => {
    try {
        const { lng, lat, radius = 1000 } = req.query;

        if (!lng || !lat) {
            return res.status(400).json({ message: 'Missing lng or lat parameters' });
        }

        const result = await pool.query(`
            SELECT 
                id,
                surname || ', ' || first_name as farmer_name,
                barangay,
                area,
                ST_Distance(
                    geometry_postgis::geography,
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                ) as distance_meters
            FROM land_plots
            WHERE geometry_postgis IS NOT NULL
              AND ST_DWithin(
                  geometry_postgis::geography,
                  ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                  $3
              )
            ORDER BY distance_meters
        `, [parseFloat(lng), parseFloat(lat), parseFloat(radius)]);

        res.json({
            search_point: { lng: parseFloat(lng), lat: parseFloat(lat) },
            radius_meters: parseFloat(radius),
            count: result.rows.length,
            parcels: result.rows
        });
    } catch (error) {
        console.error('Error finding nearby parcels:', error);
        res.status(500).json({ message: 'Query failed', error: error.message });
    }
});

// ============================================================================
// GET /api/spatial/barangay-stats - Get statistics by barangay
// ============================================================================
router.get('/barangay-stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                barangay,
                COUNT(id) as total_parcels,
                SUM(area) as total_user_entered_area_ha,
                AVG(area) as avg_user_entered_area_ha,
                SUM(ST_Area(geometry_postgis::geography) / 10000) as total_calculated_area_ha,
                AVG(ST_Area(geometry_postgis::geography) / 10000) as avg_calculated_area_ha,
                COUNT(DISTINCT surname || first_name) as unique_farmers
            FROM land_plots
            WHERE geometry_postgis IS NOT NULL
            GROUP BY barangay
            ORDER BY total_parcels DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Error getting barangay stats:', error);
        res.status(500).json({ message: 'Query failed', error: error.message });
    }
});

// ============================================================================
// POST /api/spatial/calculate-area - Calculate actual area of a geometry
// ============================================================================
router.post('/calculate-area', async (req, res) => {
    try {
        const { geometry } = req.body;

        if (!geometry) {
            return res.status(400).json({ message: 'Missing geometry' });
        }

        const result = await pool.query(`
            SELECT 
                ST_Area(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography) / 10000 as area_ha,
                ST_Perimeter(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography) as perimeter_m
        `, [JSON.stringify(geometry)]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error calculating area:', error);
        res.status(500).json({ message: 'Calculation failed', error: error.message });
    }
});

module.exports = router;
