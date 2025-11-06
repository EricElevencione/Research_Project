// ============================================================================
// LAND HISTORY API ENDPOINTS
// ============================================================================
// Add these endpoints to your backend/server.cjs file
// Copy and paste into server.cjs after your existing endpoints
// ============================================================================

// ============================================================================
// 1. GET CURRENT OWNERSHIP STATUS FOR A SPECIFIC PARCEL
// ============================================================================
// GET /api/land-history/parcel/:parcelId/current
// Returns the current ownership/tenancy information for a farm parcel
app.get('/api/land-history/parcel/:parcelId/current', async (req, res) => {
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

// ============================================================================
// 2. GET COMPLETE HISTORY FOR A PARCEL
// ============================================================================
// GET /api/land-history/parcel/:parcelId/history
// Returns all historical records (current and past) for a farm parcel
app.get('/api/land-history/parcel/:parcelId/history', async (req, res) => {
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

// ============================================================================
// 3. GET TENANT/LESSEE HISTORY (For Dropdown)
// ============================================================================
// GET /api/land-history/parcel/:parcelId/tenants
// Returns list of all tenants/lessees who have farmed this parcel
// Perfect for populating dropdown menus
app.get('/api/land-history/parcel/:parcelId/tenants', async (req, res) => {
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

// ============================================================================
// 4. GET ALL LANDS OWNED BY A SPECIFIC PERSON
// ============================================================================
// GET /api/land-history/owner/:ownerName
// Returns all lands where the specified person is the legal owner
app.get('/api/land-history/owner/:ownerName', async (req, res) => {
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

// ============================================================================
// 5. GET LIST OF ALL LAND OWNERS
// ============================================================================
// GET /api/land-history/owners
// Returns unique list of all land owners with summary statistics
app.get('/api/land-history/owners', async (req, res) => {
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

// ============================================================================
// 6. GET OWNERSHIP SUMMARY BY BARANGAY
// ============================================================================
// GET /api/land-history/summary/barangay
// Returns statistical summary of land ownership by barangay
app.get('/api/land-history/summary/barangay', async (req, res) => {
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

// ============================================================================
// 7. GET RECENT OWNERSHIP CHANGES
// ============================================================================
// GET /api/land-history/changes/recent?days=30
// Returns land parcels where ownership/tenancy changed recently
app.get('/api/land-history/changes/recent', async (req, res) => {
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

// ============================================================================
// 8. SEARCH LAND HISTORY
// ============================================================================
// GET /api/land-history/search?q=searchTerm
// Search across land owners, farmers, and locations
app.get('/api/land-history/search', async (req, res) => {
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

// ============================================================================
// 9. GET COMPREHENSIVE OWNER PROFILE
// ============================================================================
// GET /api/land-history/owner-profile/:ownerName
// Complete profile of a land owner including owned and rented lands
app.get('/api/land-history/owner-profile/:ownerName', async (req, res) => {
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

// ============================================================================
// 10. DATA QUALITY CHECK
// ============================================================================
// GET /api/land-history/quality-check
// Checks for data quality issues and orphaned records
app.get('/api/land-history/quality-check', async (req, res) => {
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

// ============================================================================
// END OF LAND HISTORY API ENDPOINTS
// ============================================================================

console.log('✅ Land History API endpoints loaded successfully');
