const express = require('express');
const router = express.Router();

// Import database pool
const { Pool } = require('pg');
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'Masterlist',
    password: process.env.DB_PASSWORD || 'postgresadmin',
    port: process.env.DB_PORT || 5432,
});

// ============================================================================
// LAND HISTORY API ENDPOINTS
// ============================================================================
// These endpoints handle land ownership and tenancy history tracking
// ============================================================================

/**
 * GET /api/land-history/parcel/:parcelId/current
 * Returns the current ownership/tenancy information for a farm parcel
 */
router.get('/parcel/:parcelId/current', async (req, res) => {
    try {
        const { parcelId } = req.params;

        const result = await pool.query(`
            SELECT 
                lh.id,
                lh.farm_parcel_id,
                lh.parcel_number,
                lh.farm_location_barangay,
                lh.farm_location_municipality,
                lh.total_farm_area_ha,
                lh.land_owner_name,
                lh.land_owner_ffrs_code,
                lh.farmer_name,
                lh.farmer_ffrs_code,
                lh.is_registered_owner,
                lh.is_tenant,
                lh.is_lessee,
                lh.tenant_name,
                lh.lessee_name,
                CASE 
                    WHEN lh.is_registered_owner THEN 'Owner'
                    WHEN lh.is_tenant THEN 'Tenant'
                    WHEN lh.is_lessee THEN 'Lessee'
                    ELSE 'Other'
                END as ownership_status,
                lh.period_start_date,
                lh.ownership_document_no,
                lh.agrarian_reform_beneficiary,
                lh.within_ancestral_domain,
                lh.created_at,
                lh.notes
            FROM land_history lh
            WHERE lh.farm_parcel_id = $1
              AND lh.is_current = TRUE
            LIMIT 1
        `, [parcelId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'No current ownership information found for this parcel',
                parcelId: parcelId
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching current land history:', error);
        res.status(500).json({
            error: 'Failed to fetch current land history',
            details: error.message
        });
    }
});

/**
 * GET /api/land-history/parcel/:parcelId/history
 * Returns all historical records (current and past) for a farm parcel
 */
router.get('/parcel/:parcelId/history', async (req, res) => {
    try {
        const { parcelId } = req.params;

        const result = await pool.query(`
            SELECT 
                lh.id,
                lh.land_owner_name,
                lh.farmer_name,
                lh.farmer_ffrs_code,
                CASE 
                    WHEN lh.is_registered_owner THEN 'Owner'
                    WHEN lh.is_tenant THEN 'Tenant'
                    WHEN lh.is_lessee THEN 'Lessee'
                    ELSE 'Other'
                END as relationship_type,
                lh.period_start_date,
                lh.period_end_date,
                lh.is_current,
                CASE 
                    WHEN lh.is_current THEN 'Current'
                    ELSE 'Past'
                END as status,
                CASE 
                    WHEN lh.period_end_date IS NOT NULL THEN 
                        EXTRACT(YEAR FROM AGE(lh.period_end_date, lh.period_start_date)) || ' years'
                    ELSE 
                        EXTRACT(YEAR FROM AGE(CURRENT_DATE, lh.period_start_date)) || ' years (ongoing)'
                END as duration,
                lh.change_type,
                lh.change_reason,
                TO_CHAR(lh.period_start_date, 'Month DD, YYYY') as formatted_start_date,
                CASE 
                    WHEN lh.period_end_date IS NULL THEN 'Present'
                    ELSE TO_CHAR(lh.period_end_date, 'Month DD, YYYY')
                END as formatted_end_date
            FROM land_history lh
            WHERE lh.farm_parcel_id = $1
            ORDER BY lh.is_current DESC, lh.period_start_date DESC
        `, [parcelId]);

        res.json({
            parcelId: parcelId,
            totalRecords: result.rows.length,
            currentRecords: result.rows.filter(r => r.is_current).length,
            historicalRecords: result.rows.filter(r => !r.is_current).length,
            history: result.rows
        });
    } catch (error) {
        console.error('Error fetching land history:', error);
        res.status(500).json({
            error: 'Failed to fetch land history',
            details: error.message
        });
    }
});

/**
 * GET /api/land-history/parcel/:parcelId/tenants
 * Returns list of all tenants/lessees who have farmed this parcel
 * Perfect for populating dropdown menus
 */
router.get('/parcel/:parcelId/tenants', async (req, res) => {
    try {
        const { parcelId } = req.params;

        const result = await pool.query(`
            SELECT 
                lh.id,
                lh.farmer_name as name,
                lh.farmer_ffrs_code as ffrs_code,
                CASE 
                    WHEN lh.is_tenant THEN 'Tenant'
                    WHEN lh.is_lessee THEN 'Lessee'
                    ELSE 'Other'
                END as type,
                TO_CHAR(lh.period_start_date, 'YYYY-MM-DD') as start_date,
                CASE 
                    WHEN lh.period_end_date IS NOT NULL THEN TO_CHAR(lh.period_end_date, 'YYYY-MM-DD')
                    ELSE NULL
                END as end_date,
                lh.is_current,
                CASE 
                    WHEN lh.period_end_date IS NOT NULL THEN 
                        TO_CHAR(lh.period_start_date, 'Mon YYYY') || ' to ' || TO_CHAR(lh.period_end_date, 'Mon YYYY')
                    ELSE 
                        TO_CHAR(lh.period_start_date, 'Mon YYYY') || ' to Present'
                END as period_display,
                CASE 
                    WHEN lh.period_end_date IS NOT NULL THEN 
                        EXTRACT(YEAR FROM AGE(lh.period_end_date, lh.period_start_date))::INTEGER
                    ELSE 
                        EXTRACT(YEAR FROM AGE(CURRENT_DATE, lh.period_start_date))::INTEGER
                END as years_duration
            FROM land_history lh
            WHERE lh.farm_parcel_id = $1
              AND (lh.is_tenant = TRUE OR lh.is_lessee = TRUE)
            ORDER BY lh.is_current DESC, lh.period_start_date DESC
        `, [parcelId]);

        res.json({
            parcelId: parcelId,
            count: result.rows.length,
            tenants: result.rows
        });
    } catch (error) {
        console.error('Error fetching tenant history:', error);
        res.status(500).json({
            error: 'Failed to fetch tenant history',
            details: error.message
        });
    }
});

/**
 * GET /api/land-history/owner/:ownerName
 * Returns all lands where the specified person is the legal owner
 */
router.get('/owner/:ownerName', async (req, res) => {
    try {
        const { ownerName } = req.params;

        const result = await pool.query(`
            SELECT 
                lh.id,
                lh.farm_parcel_id,
                lh.parcel_number,
                lh.farm_location_barangay,
                lh.farm_location_municipality,
                lh.total_farm_area_ha,
                lh.land_owner_name,
                lh.farmer_name,
                lh.farmer_ffrs_code,
                CASE 
                    WHEN lh.farmer_name = lh.land_owner_name THEN 'Self-Farmed'
                    WHEN lh.is_tenant THEN 'Rented to Tenant'
                    WHEN lh.is_lessee THEN 'Leased to Lessee'
                    ELSE 'Other Arrangement'
                END as farming_arrangement,
                lh.period_start_date,
                lh.ownership_document_no,
                lh.total_farm_area_ha,
                EXTRACT(YEAR FROM AGE(CURRENT_DATE, lh.period_start_date))::INTEGER as years_owned
            FROM land_history lh
            WHERE lh.land_owner_name ILIKE $1
              AND lh.is_current = TRUE
            ORDER BY lh.farm_location_barangay, lh.parcel_number
        `, [`%${ownerName}%`]);

        // Calculate summary statistics
        const totalArea = result.rows.reduce((sum, row) => sum + parseFloat(row.total_farm_area_ha || 0), 0);
        const selfFarmedCount = result.rows.filter(r => r.farming_arrangement === 'Self-Farmed').length;
        const rentedOutCount = result.rows.filter(r => r.farming_arrangement.includes('Rented') || r.farming_arrangement.includes('Leased')).length;

        res.json({
            ownerName: ownerName,
            totalParcels: result.rows.length,
            totalArea: totalArea.toFixed(2),
            selfFarmedParcels: selfFarmedCount,
            rentedOutParcels: rentedOutCount,
            parcels: result.rows
        });
    } catch (error) {
        console.error('Error fetching owner lands:', error);
        res.status(500).json({
            error: 'Failed to fetch owner lands',
            details: error.message
        });
    }
});

/**
 * GET /api/land-history/owners
 * Returns unique list of all land owners with summary statistics
 */
router.get('/owners', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                lh.land_owner_name as name,
                lh.land_owner_ffrs_code as ffrs_code,
                COUNT(DISTINCT lh.farm_parcel_id)::INTEGER as parcel_count,
                SUM(lh.total_farm_area_ha)::NUMERIC(10,2) as total_area_ha,
                STRING_AGG(DISTINCT lh.farm_location_barangay, ', ') as barangays,
                MIN(lh.period_start_date) as earliest_ownership_date,
                SUM(CASE WHEN lh.farmer_name = lh.land_owner_name THEN 1 ELSE 0 END)::INTEGER as self_farmed_count,
                SUM(CASE WHEN lh.is_tenant THEN 1 ELSE 0 END)::INTEGER as rented_out_count
            FROM land_history lh
            WHERE lh.is_current = TRUE
              AND lh.land_owner_name IS NOT NULL
              AND lh.land_owner_name != ''
            GROUP BY lh.land_owner_name, lh.land_owner_ffrs_code
            ORDER BY total_area_ha DESC, lh.land_owner_name
        `);

        res.json({
            totalOwners: result.rows.length,
            owners: result.rows
        });
    } catch (error) {
        console.error('Error fetching land owners:', error);
        res.status(500).json({
            error: 'Failed to fetch land owners',
            details: error.message
        });
    }
});

/**
 * GET /api/land-history/summary/barangay
 * Returns statistical summary of land ownership by barangay
 */
router.get('/summary/barangay', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                lh.farm_location_barangay as barangay,
                COUNT(*)::INTEGER as total_parcels,
                SUM(lh.total_farm_area_ha)::NUMERIC(10,2) as total_area_ha,
                SUM(CASE WHEN lh.is_registered_owner THEN 1 ELSE 0 END)::INTEGER as owner_operated,
                SUM(CASE WHEN lh.is_tenant THEN 1 ELSE 0 END)::INTEGER as tenant_operated,
                SUM(CASE WHEN lh.is_lessee THEN 1 ELSE 0 END)::INTEGER as lessee_operated,
                SUM(CASE WHEN lh.agrarian_reform_beneficiary THEN 1 ELSE 0 END)::INTEGER as agrarian_reform_count,
                COUNT(DISTINCT lh.land_owner_name)::INTEGER as unique_owners
            FROM land_history lh
            WHERE lh.is_current = TRUE
              AND lh.farm_location_barangay IS NOT NULL
            GROUP BY lh.farm_location_barangay
            ORDER BY total_area_ha DESC
        `);

        // Calculate totals
        const totals = {
            totalParcels: result.rows.reduce((sum, row) => sum + row.total_parcels, 0),
            totalAreaHa: result.rows.reduce((sum, row) => sum + parseFloat(row.total_area_ha || 0), 0).toFixed(2),
            totalOwnerOperated: result.rows.reduce((sum, row) => sum + row.owner_operated, 0),
            totalTenantOperated: result.rows.reduce((sum, row) => sum + row.tenant_operated, 0),
            totalBarangays: result.rows.length
        };

        res.json({
            totals: totals,
            barangays: result.rows
        });
    } catch (error) {
        console.error('Error fetching barangay summary:', error);
        res.status(500).json({
            error: 'Failed to fetch barangay summary',
            details: error.message
        });
    }
});

/**
 * GET /api/land-history/changes/recent
 * Returns land parcels where ownership/tenancy changed recently
 */
router.get('/changes/recent', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;

        const result = await pool.query(`
            SELECT 
                lh.id,
                lh.farm_parcel_id,
                lh.parcel_number,
                lh.farm_location_barangay,
                lh.change_type,
                lh.land_owner_name,
                lh.farmer_name,
                lh.period_start_date,
                lh.change_reason,
                lh.created_at,
                TO_CHAR(lh.created_at, 'Month DD, YYYY at HH12:MI AM') as formatted_created_at,
                EXTRACT(DAY FROM AGE(CURRENT_TIMESTAMP, lh.created_at))::INTEGER as days_ago
            FROM land_history lh
            WHERE lh.created_at >= CURRENT_TIMESTAMP - INTERVAL '1 day' * $1
              AND lh.change_type IN ('OWNERSHIP_CHANGE', 'TENANT_CHANGE', 'NEW')
            ORDER BY lh.created_at DESC
            LIMIT 100
        `, [days]);

        res.json({
            periodDays: days,
            changesFound: result.rows.length,
            changes: result.rows
        });
    } catch (error) {
        console.error('Error fetching recent changes:', error);
        res.status(500).json({
            error: 'Failed to fetch recent changes',
            details: error.message
        });
    }
});

/**
 * GET /api/land-history/farmer/:farmerId
 * Returns all land history records for a specific farmer
 */
router.get('/farmer/:farmerId', async (req, res) => {
    try {
        const { farmerId } = req.params;
        console.log('Fetching land history for farmer ID:', farmerId);

        const result = await pool.query(`
            SELECT 
                lh.id,
                lh.farm_parcel_id,
                lh.parcel_number,
                lh.farm_location_barangay,
                lh.farm_location_municipality,
                lh.change_type,
                lh.land_owner_name,
                lh.farmer_name,
                lh.farmer_rsbsa_id,
                lh.period_start_date,
                lh.period_end_date,
                lh.is_current,
                lh.is_registered_owner,
                lh.is_tenant,
                lh.is_lessee,
                lh.change_reason,
                lh.created_at,
                TO_CHAR(lh.period_start_date, 'Month DD, YYYY') as formatted_start_date,
                TO_CHAR(lh.period_end_date, 'Month DD, YYYY') as formatted_end_date
            FROM land_history lh
            WHERE lh.farmer_rsbsa_id = $1
            ORDER BY lh.period_start_date DESC, lh.created_at DESC
        `, [farmerId]);

        console.log(`Found ${result.rows.length} history records for farmer ${farmerId}`);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching farmer land history:', error);
        res.status(500).json({
            error: 'Failed to fetch farmer land history',
            details: error.message
        });
    }
});

/**
 * GET /api/land-history/search
 * Search across land owners, farmers, and locations
 */
router.get('/search', async (req, res) => {
    try {
        const searchTerm = req.query.q || '';

        if (!searchTerm || searchTerm.trim().length < 2) {
            return res.status(400).json({
                error: 'Search term must be at least 2 characters'
            });
        }

        const result = await pool.query(`
            SELECT 
                lh.id,
                lh.farm_parcel_id,
                lh.parcel_number,
                lh.farm_location_barangay,
                lh.farm_location_municipality,
                lh.total_farm_area_ha,
                lh.land_owner_name,
                lh.farmer_name,
                CASE 
                    WHEN lh.is_registered_owner THEN 'Owner'
                    WHEN lh.is_tenant THEN 'Tenant'
                    WHEN lh.is_lessee THEN 'Lessee'
                    ELSE 'Other'
                END as ownership_status,
                lh.period_start_date,
                lh.is_current
            FROM land_history lh
            WHERE lh.is_current = TRUE
              AND (
                  lh.land_owner_name ILIKE $1
                  OR lh.farmer_name ILIKE $1
                  OR lh.farm_location_barangay ILIKE $1
                  OR lh.parcel_number ILIKE $1
                  OR lh.farmer_ffrs_code ILIKE $1
              )
            ORDER BY lh.farm_location_barangay, lh.land_owner_name
            LIMIT 50
        `, [`%${searchTerm}%`]);

        res.json({
            searchTerm: searchTerm,
            resultsFound: result.rows.length,
            results: result.rows
        });
    } catch (error) {
        console.error('Error searching land history:', error);
        res.status(500).json({
            error: 'Failed to search land history',
            details: error.message
        });
    }
});

/**
 * GET /api/land-history/owner-profile/:ownerName
 * Complete profile of a land owner including owned and rented lands
 */
router.get('/owner-profile/:ownerName', async (req, res) => {
    try {
        const { ownerName } = req.params;

        // Get owned lands
        const ownedLands = await pool.query(`
            SELECT 
                lh.farm_parcel_id,
                lh.parcel_number,
                lh.farm_location_barangay,
                lh.total_farm_area_ha,
                lh.farmer_name,
                CASE 
                    WHEN lh.farmer_name = lh.land_owner_name THEN 'Self-Farmed'
                    WHEN lh.is_tenant THEN 'Rented Out'
                    WHEN lh.is_lessee THEN 'Leased Out'
                    ELSE 'Other'
                END as status
            FROM land_history lh
            WHERE lh.land_owner_name ILIKE $1
              AND lh.is_current = TRUE
            ORDER BY lh.farm_location_barangay, lh.parcel_number
        `, [`%${ownerName}%`]);

        // Get rented/leased lands
        const rentedLands = await pool.query(`
            SELECT 
                lh.farm_parcel_id,
                lh.parcel_number,
                lh.farm_location_barangay,
                lh.total_farm_area_ha,
                lh.land_owner_name,
                CASE 
                    WHEN lh.is_tenant THEN 'Tenant'
                    WHEN lh.is_lessee THEN 'Lessee'
                    ELSE 'Other'
                END as arrangement_type,
                lh.period_start_date
            FROM land_history lh
            WHERE lh.farmer_name ILIKE $1
              AND (lh.is_tenant = TRUE OR lh.is_lessee = TRUE)
              AND lh.is_current = TRUE
            ORDER BY lh.farm_location_barangay, lh.parcel_number
        `, [`%${ownerName}%`]);

        // Calculate totals
        const ownedAreaTotal = ownedLands.rows.reduce((sum, row) =>
            sum + parseFloat(row.total_farm_area_ha || 0), 0);
        const rentedAreaTotal = rentedLands.rows.reduce((sum, row) =>
            sum + parseFloat(row.total_farm_area_ha || 0), 0);
        const selfFarmedArea = ownedLands.rows
            .filter(r => r.status === 'Self-Farmed')
            .reduce((sum, row) => sum + parseFloat(row.total_farm_area_ha || 0), 0);

        res.json({
            name: ownerName,
            summary: {
                parcelsOwned: ownedLands.rows.length,
                ownedAreaHa: ownedAreaTotal.toFixed(2),
                selfFarmedAreaHa: selfFarmedArea.toFixed(2),
                parcelsRented: rentedLands.rows.length,
                rentedAreaHa: rentedAreaTotal.toFixed(2),
                totalFarmingAreaHa: (selfFarmedArea + rentedAreaTotal).toFixed(2)
            },
            ownedLands: ownedLands.rows,
            rentedLands: rentedLands.rows
        });
    } catch (error) {
        console.error('Error fetching owner profile:', error);
        res.status(500).json({
            error: 'Failed to fetch owner profile',
            details: error.message
        });
    }
});

/**
 * GET /api/land-history/quality-check
 * Checks for data quality issues and orphaned records
 */
router.get('/quality-check', async (req, res) => {
    try {
        // Check for parcels without current history
        const missingHistory = await pool.query(`
            SELECT 
                fp.id as parcel_id,
                fp.parcel_number,
                fp.submission_id,
                fp.created_at
            FROM rsbsa_farm_parcels fp
            LEFT JOIN land_history lh ON fp.id = lh.farm_parcel_id AND lh.is_current = TRUE
            WHERE lh.id IS NULL
            ORDER BY fp.created_at DESC
            LIMIT 20
        `);

        // Check for duplicate current records (should not happen!)
        const duplicateCurrents = await pool.query(`
            SELECT 
                farm_parcel_id,
                COUNT(*)::INTEGER as count
            FROM land_history
            WHERE is_current = TRUE
            GROUP BY farm_parcel_id
            HAVING COUNT(*) > 1
        `);

        // Check for records with invalid dates
        const invalidDates = await pool.query(`
            SELECT 
                id,
                farm_parcel_id,
                period_start_date,
                period_end_date
            FROM land_history
            WHERE period_end_date IS NOT NULL 
              AND period_end_date < period_start_date
            LIMIT 20
        `);

        res.json({
            issues: {
                missingCurrentHistory: missingHistory.rows.length,
                duplicateCurrentRecords: duplicateCurrents.rows.length,
                invalidDateRanges: invalidDates.rows.length
            },
            details: {
                missingHistory: missingHistory.rows,
                duplicateCurrents: duplicateCurrents.rows,
                invalidDates: invalidDates.rows
            },
            status: (missingHistory.rows.length === 0 &&
                duplicateCurrents.rows.length === 0 &&
                invalidDates.rows.length === 0) ? 'HEALTHY' : 'ISSUES_FOUND'
        });
    } catch (error) {
        console.error('Error running quality check:', error);
        res.status(500).json({
            error: 'Failed to run quality check',
            details: error.message
        });
    }
});

/**
 * GET /api/land-history/rights
 * Search land history by farmer name and location (for map popup)
 * Supports: ?surname=&firstName=&barangay= OR ?farmer_name=&barangay=
 */
router.get('/rights', async (req, res) => {
    try {
        const { surname, firstName, barangay, farmer_name } = req.query;

        console.log('Land rights history query:', { surname, firstName, barangay, farmer_name });

        let query;
        let params;

        if (surname && firstName && barangay) {
            // Query by surname, firstName, and barangay
            query = `
                SELECT 
                    lh.id,
                    lh.farm_parcel_id,
                    lh.parcel_number,
                    lh.farm_location_barangay,
                    lh.farm_location_municipality,
                    lh.total_farm_area_ha,
                    lh.land_owner_name,
                    lh.farmer_name,
                    lh.is_registered_owner,
                    lh.is_tenant,
                    lh.is_lessee,
                    lh.ownership_document_type,
                    lh.ownership_document_no,
                    lh.change_type,
                    lh.change_reason,
                    lh.period_start_date,
                    lh.period_end_date,
                    lh.is_current,
                    lh.created_at as changed_at,
                    TO_CHAR(lh.period_start_date, 'Mon DD, YYYY') as formatted_start_date,
                    TO_CHAR(lh.period_end_date, 'Mon DD, YYYY') as formatted_end_date,
                    TO_CHAR(lh.created_at, 'Mon DD, YYYY HH24:MI') as formatted_changed_at,
                    CASE 
                        WHEN lh.is_registered_owner THEN 'Owner'
                        WHEN lh.is_tenant THEN 'Tenant'
                        WHEN lh.is_lessee THEN 'Lessee'
                        ELSE 'Other'
                    END as ownership_status
                FROM land_history lh
                WHERE (
                    lh.farmer_name ILIKE $1 || '%' || $2 || '%'
                    OR lh.land_owner_name ILIKE $1 || '%' || $2 || '%'
                )
                AND lh.farm_location_barangay ILIKE $3
                ORDER BY lh.period_start_date DESC, lh.created_at DESC
            `;
            params = [surname, firstName, barangay];
        } else if (farmer_name && barangay) {
            // Query by full farmer_name and barangay
            query = `
                SELECT 
                    lh.id,
                    lh.farm_parcel_id,
                    lh.parcel_number,
                    lh.farm_location_barangay,
                    lh.farm_location_municipality,
                    lh.total_farm_area_ha,
                    lh.land_owner_name,
                    lh.farmer_name,
                    lh.is_registered_owner,
                    lh.is_tenant,
                    lh.is_lessee,
                    lh.ownership_document_type,
                    lh.ownership_document_no,
                    lh.change_type,
                    lh.change_reason,
                    lh.period_start_date,
                    lh.period_end_date,
                    lh.is_current,
                    lh.created_at as changed_at,
                    TO_CHAR(lh.period_start_date, 'Mon DD, YYYY') as formatted_start_date,
                    TO_CHAR(lh.period_end_date, 'Mon DD, YYYY') as formatted_end_date,
                    TO_CHAR(lh.created_at, 'Mon DD, YYYY HH24:MI') as formatted_changed_at,
                    CASE 
                        WHEN lh.is_registered_owner THEN 'Owner'
                        WHEN lh.is_tenant THEN 'Tenant'
                        WHEN lh.is_lessee THEN 'Lessee'
                        ELSE 'Other'
                    END as ownership_status
                FROM land_history lh
                WHERE (
                    lh.farmer_name ILIKE '%' || $1 || '%'
                    OR lh.land_owner_name ILIKE '%' || $1 || '%'
                )
                AND lh.farm_location_barangay ILIKE $2
                ORDER BY lh.period_start_date DESC, lh.created_at DESC
            `;
            params = [farmer_name, barangay];
        } else {
            return res.status(400).json({
                error: 'Invalid query parameters',
                message: 'Provide either (surname, firstName, barangay) or (farmer_name, barangay)'
            });
        }

        const result = await pool.query(query, params);

        console.log(`Found ${result.rows.length} land history records`);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching land rights history:', error);
        res.status(500).json({
            error: 'Failed to fetch land rights history',
            details: error.message
        });
    }
});

/**
 * GET /api/land-history/crop-planting-info
 * Returns crop/planting information for owner and tenant on this land
 */
router.get('/crop-planting-info', async (req, res) => {
    try {
        const { surname, firstName, middleName, barangay } = req.query;

        console.log('Crop/Planting info query:', { surname, firstName, middleName, barangay });

        // Require at least some name info and barangay
        if ((!surname && !firstName) || !barangay) {
            return res.status(400).json({ error: 'At least firstName or surname, and barangay are required' });
        }

        // Build dynamic WHERE conditions based on what's provided
        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        // Always require barangay match
        whereConditions.push(`LOWER(TRIM(rs."BARANGAY")) = LOWER(TRIM($${paramIndex}))`);
        queryParams.push(barangay);
        paramIndex++;

        if (surname) {
            // If surname provided, match it
            whereConditions.push(`LOWER(TRIM(rs."LAST NAME")) = LOWER(TRIM($${paramIndex}))`);
            queryParams.push(surname);
            paramIndex++;
        }

        if (firstName || middleName) {
            // Build flexible first name matching
            let nameConditions = [];

            if (firstName && middleName) {
                // Match: FIRST NAME = firstName AND MIDDLE NAME = middleName
                nameConditions.push(`(LOWER(TRIM(rs."FIRST NAME")) = LOWER(TRIM($${paramIndex})) AND LOWER(TRIM(COALESCE(rs."MIDDLE NAME", ''))) = LOWER(TRIM($${paramIndex + 1})))`);
                queryParams.push(firstName, middleName);
                paramIndex += 2;
            } else if (firstName) {
                // Match firstName flexibly
                const fnIndex = paramIndex;
                nameConditions.push(`LOWER(TRIM(rs."FIRST NAME")) = LOWER(TRIM($${fnIndex}))`);
                nameConditions.push(`LOWER(TRIM(CONCAT_WS(' ', rs."FIRST NAME", rs."MIDDLE NAME"))) = LOWER(TRIM($${fnIndex}))`);
                nameConditions.push(`LOWER(TRIM(rs."FIRST NAME")) LIKE LOWER(TRIM($${fnIndex})) || '%'`);
                nameConditions.push(`LOWER(TRIM($${fnIndex})) LIKE LOWER(TRIM(rs."FIRST NAME")) || '%'`);
                queryParams.push(firstName);
                paramIndex++;
            }

            if (nameConditions.length > 0) {
                whereConditions.push(`(${nameConditions.join(' OR ')})`);
            }
        }

        // Query to get the land owner and their crops
        const ownerQuery = `
            SELECT 
                rs.id,
                TRIM(
                    CONCAT_WS(', ',
                        NULLIF(TRIM(CONCAT_WS(' ', rs."FIRST NAME", rs."MIDDLE NAME")), ''),
                        NULLIF(TRIM(rs."LAST NAME"), '')
                    )
                ) as farmer_name,
                rs."FIRST NAME" as first_name,
                rs."MIDDLE NAME" as middle_name,
                rs."LAST NAME" as last_name,
                rs."BARANGAY" as barangay,
                rs."MAIN LIVELIHOOD" as main_livelihood,
                rs."FARMER_RICE" as farmer_rice,
                rs."FARMER_CORN" as farmer_corn,
                rs."FARMER_OTHER_CROPS" as farmer_other_crops,
                rs."FARMER_OTHER_CROPS_TEXT" as farmer_other_crops_text,
                rs."FARMER_LIVESTOCK" as farmer_livestock,
                rs."FARMER_LIVESTOCK_TEXT" as farmer_livestock_text,
                rs."FARMER_POULTRY" as farmer_poultry,
                rs."FARMER_POULTRY_TEXT" as farmer_poultry_text,
                rs.created_at as registration_date,
                CASE 
                    WHEN rs."OWNERSHIP_TYPE_REGISTERED_OWNER" = true THEN 'Owner'
                    WHEN rs."OWNERSHIP_TYPE_TENANT" = true THEN 'Tenant'
                    WHEN rs."OWNERSHIP_TYPE_LESSEE" = true THEN 'Lessee'
                    ELSE 'Other'
                END as ownership_status,
                rs."OWNERSHIP_TYPE_REGISTERED_OWNER" as is_owner,
                rs."OWNERSHIP_TYPE_TENANT" as is_tenant,
                rs."OWNERSHIP_TYPE_LESSEE" as is_lessee,
                rs.status as farmer_status
            FROM rsbsa_submission rs
            WHERE ${whereConditions.join(' AND ')}
        `;

        console.log('Owner query:', ownerQuery);
        console.log('Query params:', queryParams);

        const ownerResult = await pool.query(ownerQuery, queryParams);

        console.log('Owner query result count:', ownerResult.rows.length);
        if (ownerResult.rows.length > 0) {
            console.log('Found farmer:', ownerResult.rows[0].farmer_name, 'First:', ownerResult.rows[0].first_name, 'Middle:', ownerResult.rows[0].middle_name);
        }

        // Build owner name pattern for matching tenants/lessees
        // Matches formats like "Villanueva, Rosa Torres" or "Rosa Torres Villanueva"
        const ownerNamePattern1 = `${surname}, ${firstName}%`; // "Villanueva, Rosa Torres"
        const ownerNamePattern2 = `${surname},%${firstName}%`; // "Villanueva, Rosa" (partial)
        const ownerNamePattern3 = `${firstName}%${surname}%`;  // "Rosa Torres Villanueva"

        // Query to find tenants/lessees whose land owner matches this farmer
        // Uses rsbsa_farm_parcels.tenant_land_owner_name and lessee_land_owner_name
        const tenantsQuery = `
            SELECT DISTINCT
                rs.id,
                TRIM(
                    CONCAT_WS(', ',
                        NULLIF(TRIM(CONCAT_WS(' ', rs."FIRST NAME", rs."MIDDLE NAME")), ''),
                        NULLIF(TRIM(rs."LAST NAME"), '')
                    )
                ) as farmer_name,
                rs."FIRST NAME" as first_name,
                rs."MIDDLE NAME" as middle_name,
                rs."LAST NAME" as last_name,
                rs."BARANGAY" as barangay,
                rs."MAIN LIVELIHOOD" as main_livelihood,
                rs."FARMER_RICE" as farmer_rice,
                rs."FARMER_CORN" as farmer_corn,
                rs."FARMER_OTHER_CROPS" as farmer_other_crops,
                rs."FARMER_OTHER_CROPS_TEXT" as farmer_other_crops_text,
                rs."FARMER_LIVESTOCK" as farmer_livestock,
                rs."FARMER_LIVESTOCK_TEXT" as farmer_livestock_text,
                rs."FARMER_POULTRY" as farmer_poultry,
                rs."FARMER_POULTRY_TEXT" as farmer_poultry_text,
                rs.created_at as registration_date,
                CASE 
                    WHEN fp.ownership_type_tenant = true THEN 'Tenant'
                    WHEN fp.ownership_type_lessee = true THEN 'Lessee'
                    ELSE 'Tenant'
                END as ownership_status,
                false as is_owner,
                fp.ownership_type_tenant as is_tenant,
                fp.ownership_type_lessee as is_lessee,
                rs.status as farmer_status,
                COALESCE(fp.tenant_land_owner_name, fp.lessee_land_owner_name) as land_owner_name
            FROM rsbsa_farm_parcels fp
            JOIN rsbsa_submission rs ON fp.submission_id::bigint = rs.id
            WHERE LOWER(fp.farm_location_barangay) = LOWER($1)
                AND (
                    (fp.ownership_type_tenant = true AND (
                        LOWER(fp.tenant_land_owner_name) ILIKE LOWER($2) 
                        OR LOWER(fp.tenant_land_owner_name) ILIKE LOWER($3)
                        OR LOWER(fp.tenant_land_owner_name) ILIKE LOWER($4)
                    ))
                    OR 
                    (fp.ownership_type_lessee = true AND (
                        LOWER(fp.lessee_land_owner_name) ILIKE LOWER($2) 
                        OR LOWER(fp.lessee_land_owner_name) ILIKE LOWER($3)
                        OR LOWER(fp.lessee_land_owner_name) ILIKE LOWER($4)
                    ))
                )
        `;

        console.log('Tenants query params:', [barangay, ownerNamePattern1, ownerNamePattern2, ownerNamePattern3]);
        const tenantsResult = await pool.query(tenantsQuery, [barangay, ownerNamePattern1, ownerNamePattern2, ownerNamePattern3]);
        console.log('Tenants found:', tenantsResult.rows.length);

        // Combine results
        const plantingInfo = {
            owner: ownerResult.rows.length > 0 ? ownerResult.rows[0] : null,
            tenants: tenantsResult.rows || []
        };

        // Build crops list for each person
        // Uses individual crop fields first, then falls back to main_livelihood
        const buildCropsList = (row) => {
            if (!row) return [];
            const crops = [];

            // Check individual crop boolean fields first
            if (row.farmer_rice) crops.push('Rice');
            if (row.farmer_corn) crops.push('Corn');
            if (row.farmer_other_crops && row.farmer_other_crops_text) {
                crops.push(row.farmer_other_crops_text);
            } else if (row.farmer_other_crops) {
                crops.push('Other Crops');
            }
            if (row.farmer_livestock && row.farmer_livestock_text) {
                crops.push(`Livestock: ${row.farmer_livestock_text}`);
            } else if (row.farmer_livestock) {
                crops.push('Livestock');
            }
            if (row.farmer_poultry && row.farmer_poultry_text) {
                crops.push(`Poultry: ${row.farmer_poultry_text}`);
            } else if (row.farmer_poultry) {
                crops.push('Poultry');
            }

            // If no individual crops found, use MAIN LIVELIHOOD as fallback
            if (crops.length === 0 && row.main_livelihood) {
                // Parse the main_livelihood string (e.g., "Rice, Other Crops: Vegetables")
                const livelihoodParts = row.main_livelihood.split(',').map(s => s.trim()).filter(Boolean);
                crops.push(...livelihoodParts);
            }

            return crops.length > 0 ? crops : ['Not specified'];
        };

        // Format the response
        const response = {
            owner: plantingInfo.owner ? {
                ...plantingInfo.owner,
                crops: buildCropsList(plantingInfo.owner)
            } : null,
            tenants: plantingInfo.tenants.map(t => ({
                ...t,
                crops: buildCropsList(t)
            }))
        };

        console.log('Crop/Planting info response:', JSON.stringify(response, null, 2));
        res.json(response);

    } catch (error) {
        console.error('Error fetching crop/planting info:', error);
        res.status(500).json({
            error: 'Failed to fetch crop/planting info',
            details: error.message
        });
    }
});

/**
 * GET /api/land-history/owners-with-tenants
 * Returns land owners grouped with their tenants and lessees
 */
router.get('/owners-with-tenants', async (req, res) => {
    try {
        console.log('\n📋 GET /api/land-history/owners-with-tenants - Fetching land owners with tenants/lessees');

        // First, check how many farmers have transferred ownership or have no parcels
        const transferredCheck = await pool.query(`
            SELECT COUNT(*) as count
            FROM rsbsa_submission
            WHERE status IN ('Transferred Ownership', 'No Parcels') OR "OWNERSHIP_TYPE_REGISTERED_OWNER" = false
        `);
        console.log(`🔍 Farmers with transferred ownership or no parcels (filtered out): ${transferredCheck.rows[0].count}`);

        // Get all registered land owners with their parcels
        const query = `
            WITH land_owners AS (
                SELECT DISTINCT 
                    rs.id as owner_id,
                    rs."LAST NAME" || ', ' || rs."FIRST NAME" || 
                        CASE WHEN rs."MIDDLE NAME" IS NOT NULL AND rs."MIDDLE NAME" != '' 
                        THEN ' ' || rs."MIDDLE NAME" 
                        ELSE '' END as owner_name,
                    rs."FIRST NAME" as first_name,
                    rs."LAST NAME" as last_name,
                    rs."MIDDLE NAME" as middle_name,
                    rs.status
                FROM rsbsa_submission rs
                WHERE rs."OWNERSHIP_TYPE_REGISTERED_OWNER" = true
                    AND COALESCE(rs.status, '') NOT IN ('Transferred Ownership', 'No Parcels')
                    AND EXISTS (
                        SELECT 1 FROM rsbsa_farm_parcels fp 
                        WHERE fp.submission_id = rs.id
                    )
            ),
            tenants_lessees AS (
                SELECT 
                    fp.id,
                    fp.submission_id,
                    CASE 
                        WHEN fp.ownership_type_tenant THEN fp.tenant_land_owner_name
                        WHEN fp.ownership_type_lessee THEN fp.lessee_land_owner_name
                        ELSE NULL
                    END as land_owner_name,
                    rs."LAST NAME" || ', ' || rs."FIRST NAME" || 
                        CASE WHEN rs."MIDDLE NAME" IS NOT NULL AND rs."MIDDLE NAME" != '' 
                        THEN ' ' || rs."MIDDLE NAME" 
                        ELSE '' END as tenant_lessee_name,
                    CASE 
                        WHEN fp.ownership_type_tenant THEN 'Tenant'
                        WHEN fp.ownership_type_lessee THEN 'Lessee'
                        ELSE NULL
                    END as relationship_type,
                    fp.farm_location_barangay,
                    fp.total_farm_area_ha,
                    fp.created_at
                FROM rsbsa_farm_parcels fp
                JOIN rsbsa_submission rs ON fp.submission_id = rs.id
                WHERE (fp.ownership_type_tenant = true OR fp.ownership_type_lessee = true)
                    AND (fp.tenant_land_owner_name IS NOT NULL OR fp.lessee_land_owner_name IS NOT NULL)
            )
            SELECT 
                lo.owner_id,
                lo.owner_name,
                lo.first_name,
                lo.last_name,
                lo.middle_name,
                lo.status,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', tl.id,
                            'name', tl.tenant_lessee_name,
                            'type', tl.relationship_type,
                            'location', tl.farm_location_barangay,
                            'area', tl.total_farm_area_ha,
                            'createdAt', tl.created_at
                        ) ORDER BY tl.created_at DESC
                    ) FILTER (WHERE tl.id IS NOT NULL),
                    '[]'::json
                ) as tenants_lessees
            FROM land_owners lo
            LEFT JOIN tenants_lessees tl ON (
                LOWER(TRIM(lo.owner_name)) = LOWER(TRIM(tl.land_owner_name))
                OR LOWER(TRIM(tl.land_owner_name)) LIKE LOWER(TRIM(lo.owner_name)) || '%'
                OR LOWER(TRIM(lo.owner_name)) LIKE LOWER(TRIM(tl.land_owner_name)) || '%'
            )
            GROUP BY lo.owner_id, lo.owner_name, lo.first_name, lo.last_name, lo.middle_name, lo.status
            ORDER BY lo.last_name, lo.first_name;
        `;

        const result = await pool.query(query);
        console.log(`✅ Found ${result.rows.length} land owners with tenants/lessees`);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching land owners with tenants:', error.message);
        res.status(500).json({
            error: 'Failed to fetch land owners with tenants',
            details: error.message
        });
    }
});

module.exports = router;
