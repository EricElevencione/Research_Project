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

// Import DSS engines
const FertilizerAlternativeEngine = require('../dss-scripts/engines/alternativeEngine.cjs');
const RecommendationEngine = require('../dss-scripts/engines/recommendationEngine.cjs');

// ============================================================================
// AGRICULTURAL INPUT DISTRIBUTION SYSTEM API ENDPOINTS
// ============================================================================

// ==================== REGIONAL ALLOCATIONS ====================

/**
 * GET /api/distribution/allocations
 * Get all regional allocations
 */
router.get('/allocations', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM regional_allocations
            ORDER BY allocation_date DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching allocations:', error);
        res.status(500).json({ error: 'Failed to fetch allocations', message: error.message });
    }
});

/**
 * GET /api/distribution/allocations/:season
 * Get allocation by season
 */
router.get('/allocations/:season', async (req, res) => {
    const { season } = req.params;
    try {
        const result = await pool.query(`
            SELECT * FROM regional_allocations
            WHERE season = $1
        `, [season]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Allocation not found for this season' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching allocation:', error);
        res.status(500).json({ error: 'Failed to fetch allocation', message: error.message });
    }
});

/**
 * POST /api/distribution/allocations
 * Create or update regional allocation
 */
router.post('/allocations', async (req, res) => {
    const {
        season,
        allocation_date,
        season_start_date,
        season_end_date,
        urea_46_0_0_bags,
        complete_14_14_14_bags,
        complete_16_16_16_bags,
        ammonium_sulfate_21_0_0_bags,
        ammonium_phosphate_16_20_0_bags,
        muriate_potash_0_0_60_bags,
        rice_seeds_nsic_rc160_kg,
        rice_seeds_nsic_rc222_kg,
        rice_seeds_nsic_rc440_kg,
        corn_seeds_hybrid_kg,
        corn_seeds_opm_kg,
        vegetable_seeds_kg,
        jackpot_kg,
        us88_kg,
        th82_kg,
        rh9000_kg,
        lumping143_kg,
        lp296_kg,
        notes,
        created_by
    } = req.body;

    try {
        const result = await pool.query(`
            INSERT INTO regional_allocations (
                season, allocation_date, season_start_date, season_end_date,
                urea_46_0_0_bags, complete_14_14_14_bags, complete_16_16_16_bags,
                ammonium_sulfate_21_0_0_bags, ammonium_phosphate_16_20_0_bags,
                muriate_potash_0_0_60_bags, rice_seeds_nsic_rc160_kg,
                rice_seeds_nsic_rc222_kg, rice_seeds_nsic_rc440_kg,
                corn_seeds_hybrid_kg, corn_seeds_opm_kg, vegetable_seeds_kg,
                jackpot_kg, us88_kg, th82_kg, rh9000_kg, lumping143_kg, lp296_kg,
                notes, created_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
            )
            ON CONFLICT (season) 
            DO UPDATE SET
                allocation_date = EXCLUDED.allocation_date,
                season_start_date = EXCLUDED.season_start_date,
                season_end_date = EXCLUDED.season_end_date,
                urea_46_0_0_bags = EXCLUDED.urea_46_0_0_bags,
                complete_14_14_14_bags = EXCLUDED.complete_14_14_14_bags,
                complete_16_16_16_bags = EXCLUDED.complete_16_16_16_bags,
                ammonium_sulfate_21_0_0_bags = EXCLUDED.ammonium_sulfate_21_0_0_bags,
                ammonium_phosphate_16_20_0_bags = EXCLUDED.ammonium_phosphate_16_20_0_bags,
                muriate_potash_0_0_60_bags = EXCLUDED.muriate_potash_0_0_60_bags,
                rice_seeds_nsic_rc160_kg = EXCLUDED.rice_seeds_nsic_rc160_kg,
                rice_seeds_nsic_rc222_kg = EXCLUDED.rice_seeds_nsic_rc222_kg,
                rice_seeds_nsic_rc440_kg = EXCLUDED.rice_seeds_nsic_rc440_kg,
                corn_seeds_hybrid_kg = EXCLUDED.corn_seeds_hybrid_kg,
                corn_seeds_opm_kg = EXCLUDED.corn_seeds_opm_kg,
                vegetable_seeds_kg = EXCLUDED.vegetable_seeds_kg,
                jackpot_kg = EXCLUDED.jackpot_kg,
                us88_kg = EXCLUDED.us88_kg,
                th82_kg = EXCLUDED.th82_kg,
                rh9000_kg = EXCLUDED.rh9000_kg,
                lumping143_kg = EXCLUDED.lumping143_kg,
                lp296_kg = EXCLUDED.lp296_kg,
                notes = EXCLUDED.notes,
                updated_at = NOW()
            RETURNING *
        `, [
            season, allocation_date, season_start_date, season_end_date,
            urea_46_0_0_bags || 0, complete_14_14_14_bags || 0, complete_16_16_16_bags || 0,
            ammonium_sulfate_21_0_0_bags || 0, ammonium_phosphate_16_20_0_bags || 0,
            muriate_potash_0_0_60_bags || 0, rice_seeds_nsic_rc160_kg || 0,
            rice_seeds_nsic_rc222_kg || 0, rice_seeds_nsic_rc440_kg || 0,
            corn_seeds_hybrid_kg || 0, corn_seeds_opm_kg || 0, vegetable_seeds_kg || 0,
            jackpot_kg || 0, us88_kg || 0, th82_kg || 0, rh9000_kg || 0, lumping143_kg || 0, lp296_kg || 0,
            notes, created_by
        ]);

        res.status(201).json({
            message: 'Regional allocation saved successfully',
            allocation: result.rows[0]
        });
    } catch (error) {
        console.error('Error saving allocation:', error);
        res.status(500).json({ error: 'Failed to save allocation', message: error.message });
    }
});

/**
 * DELETE /api/distribution/allocations/:id
 * Delete regional allocation
 */
router.delete('/allocations/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // First, get the season for this allocation
        const allocationResult = await pool.query(
            'SELECT season FROM regional_allocations WHERE id = $1',
            [id]
        );

        if (allocationResult.rows.length === 0) {
            return res.status(404).json({ error: 'Allocation not found' });
        }

        const season = allocationResult.rows[0].season;

        // Delete all farmer requests for this season
        await pool.query(
            'DELETE FROM farmer_requests WHERE season = $1',
            [season]
        );

        // Delete the allocation
        await pool.query(
            'DELETE FROM regional_allocations WHERE id = $1',
            [id]
        );

        res.json({
            message: 'Regional allocation and associated requests deleted successfully',
            season: season
        });
    } catch (error) {
        console.error('Error deleting allocation:', error);
        res.status(500).json({ error: 'Failed to delete allocation', message: error.message });
    }
});

// ==================== FARMER REQUESTS ====================

/**
 * GET /api/distribution/requests
 * Get farmer requests with optional status filter
 */
router.get('/requests', async (req, res) => {
    const { season, status } = req.query;

    try {
        let query = `
            SELECT 
                fr.*,
                r."LAST NAME" || ', ' || r."FIRST NAME" as full_name,
                r."BARANGAY" as barangay
            FROM farmer_requests fr
            LEFT JOIN rsbsa_submission r ON fr.farmer_id = r.id
            WHERE 1=1
        `;
        const params = [];

        if (season) {
            params.push(season);
            query += ` AND fr.season = $${params.length}`;
        }

        if (status) {
            params.push(status);
            query += ` AND fr.status = $${params.length}`;
        }

        query += ` ORDER BY fr.request_date ASC, fr.id ASC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ error: 'Failed to fetch requests', message: error.message });
    }
});

/**
 * GET /api/distribution/requests/:season
 * Get all farmer requests for a season
 */
router.get('/requests/:season', async (req, res) => {
    const { season } = req.params;
    try {
        const result = await pool.query(`
            SELECT 
                fr.*,
                r."LAST NAME" || ', ' || r."FIRST NAME" as full_name,
                r."BARANGAY" as barangay
            FROM farmer_requests fr
            LEFT JOIN rsbsa_submission r ON fr.farmer_id = r.id
            WHERE fr.season = $1
            ORDER BY fr.request_date ASC, fr.id ASC
        `, [season]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ error: 'Failed to fetch requests', message: error.message });
    }
});

/**
 * POST /api/distribution/requests
 * Create farmer request
 */
router.post('/requests', async (req, res) => {
    const {
        season,
        farmer_id,
        farmer_name,
        barangay,
        farm_area_ha,
        crop_type,
        ownership_type,
        num_parcels,
        fertilizer_requested,
        seeds_requested,
        request_notes,
        created_by,
        // Detailed fertilizer requests
        requested_urea_bags,
        requested_complete_14_bags,
        requested_complete_16_bags,
        requested_ammonium_sulfate_bags,
        requested_ammonium_phosphate_bags,
        requested_muriate_potash_bags,
        // Detailed seed requests
        requested_jackpot_kg,
        requested_us88_kg,
        requested_th82_kg,
        requested_rh9000_kg,
        requested_lumping143_kg,
        requested_lp296_kg
    } = req.body;

    try {
        const result = await pool.query(`
            INSERT INTO farmer_requests (
                season, farmer_id, farmer_name, barangay, farm_area_ha,
                crop_type, ownership_type, num_parcels,
                fertilizer_requested, seeds_requested, request_notes, created_by,
                requested_urea_bags, requested_complete_14_bags, requested_complete_16_bags,
                requested_ammonium_sulfate_bags, requested_ammonium_phosphate_bags, requested_muriate_potash_bags,
                requested_jackpot_kg, requested_us88_kg, requested_th82_kg,
                requested_rh9000_kg, requested_lumping143_kg, requested_lp296_kg
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
            )
            RETURNING *
        `, [
            season, farmer_id, farmer_name, barangay, farm_area_ha,
            crop_type, ownership_type, num_parcels || 1,
            fertilizer_requested || false, seeds_requested || false,
            request_notes, created_by,
            requested_urea_bags || 0, requested_complete_14_bags || 0, requested_complete_16_bags || 0,
            requested_ammonium_sulfate_bags || 0, requested_ammonium_phosphate_bags || 0, requested_muriate_potash_bags || 0,
            requested_jackpot_kg || 0, requested_us88_kg || 0, requested_th82_kg || 0,
            requested_rh9000_kg || 0, requested_lumping143_kg || 0, requested_lp296_kg || 0
        ]);

        res.status(201).json({
            message: 'Farmer request created successfully',
            request: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating request:', error);
        res.status(500).json({ error: 'Failed to create request', message: error.message });
    }
});

/**
 * PUT /api/distribution/requests/:id
 * Update farmer request (assignment, acceptance, status)
 */
router.put('/requests/:id', async (req, res) => {
    const { id } = req.params;

    const {
        // Requested quantities (editable by JO staff)
        requested_urea_bags,
        requested_complete_14_bags,
        requested_ammonium_sulfate_bags,
        requested_muriate_potash_bags,
        requested_jackpot_kg,
        requested_us88_kg,
        requested_th82_kg,
        requested_rh9000_kg,
        requested_lumping143_kg,
        requested_lp296_kg,
        // Assigned/approval fields
        assigned_fertilizer_type,
        assigned_fertilizer_bags,
        assigned_seed_type,
        assigned_seed_kg,
        fertilizer_accepted,
        seeds_accepted,
        rejection_reason,
        status,
        request_notes
    } = req.body;

    try {
        const result = await pool.query(`
            UPDATE farmer_requests
            SET 
                requested_urea_bags = COALESCE($1, requested_urea_bags),
                requested_complete_14_bags = COALESCE($2, requested_complete_14_bags),
                requested_ammonium_sulfate_bags = COALESCE($3, requested_ammonium_sulfate_bags),
                requested_muriate_potash_bags = COALESCE($4, requested_muriate_potash_bags),
                requested_jackpot_kg = COALESCE($5, requested_jackpot_kg),
                requested_us88_kg = COALESCE($6, requested_us88_kg),
                requested_th82_kg = COALESCE($7, requested_th82_kg),
                requested_rh9000_kg = COALESCE($8, requested_rh9000_kg),
                requested_lumping143_kg = COALESCE($9, requested_lumping143_kg),
                requested_lp296_kg = COALESCE($10, requested_lp296_kg),
                assigned_fertilizer_type = COALESCE($11, assigned_fertilizer_type),
                assigned_fertilizer_bags = COALESCE($12, assigned_fertilizer_bags),
                assigned_seed_type = COALESCE($13, assigned_seed_type),
                assigned_seed_kg = COALESCE($14, assigned_seed_kg),
                fertilizer_accepted = COALESCE($15, fertilizer_accepted),
                seeds_accepted = COALESCE($16, seeds_accepted),
                rejection_reason = COALESCE($17, rejection_reason),
                status = COALESCE($18, status),
                request_notes = COALESCE($19, request_notes),
                updated_at = NOW()
            WHERE id = $20
            RETURNING *
        `, [
            requested_urea_bags,
            requested_complete_14_bags,
            requested_ammonium_sulfate_bags,
            requested_muriate_potash_bags,
            requested_jackpot_kg,
            requested_us88_kg,
            requested_th82_kg,
            requested_rh9000_kg,
            requested_lumping143_kg,
            requested_lp296_kg,
            assigned_fertilizer_type,
            assigned_fertilizer_bags,
            assigned_seed_type,
            assigned_seed_kg,
            fertilizer_accepted,
            seeds_accepted,
            rejection_reason,
            status,
            request_notes,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        res.json({
            message: 'Request updated successfully',
            request: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating request:', error);
        res.status(500).json({ error: 'Failed to update request', message: error.message });
    }
});

/**
 * DELETE /api/distribution/requests/:id
 * Delete farmer request
 */
router.delete('/requests/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            DELETE FROM farmer_requests WHERE id = $1 RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        res.json({ message: 'Request deleted successfully' });
    } catch (error) {
        console.error('Error deleting request:', error);
        res.status(500).json({ error: 'Failed to delete request', message: error.message });
    }
});

// ==================== SMART ALTERNATIVES (DSS Feature) ====================

/**
 * POST /api/distribution/suggest-alternatives
 * Suggest fertilizer alternatives for a specific farmer request
 */
router.post('/suggest-alternatives', async (req, res) => {
    const { request_id } = req.body;

    try {
        console.log(`\n🤖 Generating smart alternatives for request #${request_id}`);

        // Validate input
        if (!request_id) {
            return res.status(400).json({ error: 'request_id is required' });
        }

        // 1. Get farmer request details
        const requestResult = await pool.query(`
            SELECT * FROM farmer_requests WHERE id = $1
        `, [request_id]);

        if (requestResult.rows.length === 0) {
            console.log(`   ❌ Request #${request_id} not found in database`);
            return res.status(404).json({
                error: 'Farmer request not found',
                message: `No farmer request with ID ${request_id} exists in the database`
            });
        }

        const request = requestResult.rows[0];
        console.log(`   Farmer: ${request.farmer_name}`);
        console.log(`   Season: ${request.season}`);

        // 2. Get current allocation for the season
        const allocationResult = await pool.query(`
            SELECT * FROM regional_allocations WHERE season = $1
        `, [request.season]);

        if (allocationResult.rows.length === 0) {
            return res.status(404).json({ error: 'No allocation found for this season' });
        }

        const allocation = allocationResult.rows[0];

        // 3. Calculate remaining stock after all approved requests
        const approvedResult = await pool.query(`
            SELECT 
                COALESCE(SUM(requested_urea_bags), 0) as approved_urea,
                COALESCE(SUM(requested_complete_14_bags), 0) as approved_complete_14,
                COALESCE(SUM(requested_complete_16_bags), 0) as approved_complete_16,
                COALESCE(SUM(requested_ammonium_sulfate_bags), 0) as approved_amsul,
                COALESCE(SUM(requested_ammonium_phosphate_bags), 0) as approved_amph,
                COALESCE(SUM(requested_muriate_potash_bags), 0) as approved_potash,
                COALESCE(SUM(requested_jackpot_kg), 0) as approved_jackpot,
                COALESCE(SUM(requested_us88_kg), 0) as approved_us88,
                COALESCE(SUM(requested_th82_kg), 0) as approved_th82,
                COALESCE(SUM(requested_rh9000_kg), 0) as approved_rh9000,
                COALESCE(SUM(requested_lumping143_kg), 0) as approved_lumping143,
                COALESCE(SUM(requested_lp296_kg), 0) as approved_lp296
            FROM farmer_requests 
            WHERE season = $1 AND status = 'approved' AND id != $2
        `, [request.season, request_id]);

        const approved = approvedResult.rows[0];

        const remainingStock = {
            urea_46_0_0_bags: (allocation.urea_46_0_0_bags || 0) - (approved.approved_urea || 0),
            complete_14_14_14_bags: (allocation.complete_14_14_14_bags || 0) - (approved.approved_complete_14 || 0),
            complete_16_16_16_bags: (allocation.complete_16_16_16_bags || 0) - (approved.approved_complete_16 || 0),
            ammonium_sulfate_21_0_0_bags: (allocation.ammonium_sulfate_21_0_0_bags || 0) - (approved.approved_amsul || 0),
            ammonium_phosphate_16_20_0_bags: (allocation.ammonium_phosphate_16_20_0_bags || 0) - (approved.approved_amph || 0),
            muriate_potash_0_0_60_bags: (allocation.muriate_potash_0_0_60_bags || 0) - (approved.approved_potash || 0),
            jackpot_kg: (allocation.jackpot_kg || 0) - (approved.approved_jackpot || 0),
            us88_kg: (allocation.us88_kg || 0) - (approved.approved_us88 || 0),
            th82_kg: (allocation.th82_kg || 0) - (approved.approved_th82 || 0),
            rh9000_kg: (allocation.rh9000_kg || 0) - (approved.approved_rh9000 || 0),
            lumping143_kg: (allocation.lumping143_kg || 0) - (approved.approved_lumping143 || 0),
            lp296_kg: (allocation.lp296_kg || 0) - (approved.approved_lp296 || 0)
        };

        console.log('   Remaining stock:', remainingStock);

        // 4. Use Alternative Engine to generate suggestions
        const engine = new FertilizerAlternativeEngine();

        const farmerRequestData = {
            farmer_id: request.farmer_id,
            farmer_name: request.farmer_name,
            crop_type: request.crop_type || 'rice',
            requested_urea_bags: request.requested_urea_bags || 0,
            requested_complete_14_bags: request.requested_complete_14_bags || 0,
            requested_complete_16_bags: request.requested_complete_16_bags || 0,
            requested_ammonium_sulfate_bags: request.requested_ammonium_sulfate_bags || 0,
            requested_ammonium_phosphate_bags: request.requested_ammonium_phosphate_bags || 0,
            requested_muriate_potash_bags: request.requested_muriate_potash_bags || 0,
            requested_jackpot_kg: request.requested_jackpot_kg || 0,
            requested_us88_kg: request.requested_us88_kg || 0,
            requested_th82_kg: request.requested_th82_kg || 0,
            requested_rh9000_kg: request.requested_rh9000_kg || 0,
            requested_lumping143_kg: request.requested_lumping143_kg || 0,
            requested_lp296_kg: request.requested_lp296_kg || 0
        };

        const suggestions = await engine.suggestAlternatives(farmerRequestData, remainingStock);

        console.log(`   ✅ Generated ${suggestions.suggestions?.length || 0} alternative suggestions`);

        res.json({
            request_id: request_id,
            farmer_name: request.farmer_name,
            season: request.season,
            remaining_stock: remainingStock,
            suggestions: suggestions
        });

    } catch (error) {
        console.error('❌ Error generating alternatives:', error);
        res.status(500).json({
            error: 'Failed to generate alternatives',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * GET /api/distribution/validate-knowledge-base
 * Validate knowledge base integrity (for testing/debugging)
 */
router.get('/validate-knowledge-base', async (req, res) => {
    try {
        const engine = new FertilizerAlternativeEngine();
        const validation = engine.validateKnowledgeBase();

        res.json({
            status: validation.valid ? 'valid' : 'invalid',
            validation: validation,
            message: validation.valid
                ? '✅ Knowledge base is valid and ready to use'
                : '❌ Knowledge base has errors - please check configuration'
        });
    } catch (error) {
        console.error('Error validating knowledge base:', error);
        res.status(500).json({
            error: 'Failed to validate knowledge base',
            message: error.message
        });
    }
});

// ==================== RECOMMENDATIONS (DSS Feature) ====================

/**
 * GET /api/distribution/recommendations/:season
 * Get smart recommendations for gap analysis
 */
router.get('/recommendations/:season', async (req, res) => {
    const { season } = req.params;

    try {
        console.log(`\n🤖 Generating recommendations for season: ${season}`);

        // Get gap analysis data internally
        const allocationResult = await pool.query(`
            SELECT * FROM regional_allocations WHERE season = $1
        `, [season]);

        if (allocationResult.rows.length === 0) {
            return res.status(404).json({
                error: 'No gap analysis data found',
                message: `Please ensure allocation and requests exist for season ${season}`
            });
        }

        // Get all farmer requests for this season
        const requestsResult = await pool.query(`
            SELECT * FROM farmer_requests WHERE season = $1
        `, [season]);

        const farmerRequests = requestsResult.rows;

        // Build gap data
        const allocation = allocationResult.rows[0];
        const gapData = {
            season,
            allocation
        };

        // Generate recommendations
        const engine = new RecommendationEngine();
        const recommendations = engine.generateRecommendations(gapData, farmerRequests);

        console.log(`   ✅ Generated ${recommendations.recommendations.length} recommendations`);
        console.log(`   Summary: ${recommendations.summary.critical_issues} critical, ${recommendations.summary.high_priority_issues} high priority`);

        res.json(recommendations);

    } catch (error) {
        console.error('❌ Error generating recommendations:', error);
        res.status(500).json({
            error: 'Failed to generate recommendations',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// ==================== GAP ANALYSIS ====================

/**
 * GET /api/distribution/gap-analysis/:season
 * Get gap analysis for a season (compare estimation vs allocation vs requests)
 */
router.get('/gap-analysis/:season', async (req, res) => {
    const { season } = req.params;

    try {
        // 1. Get allocation data
        const allocationResult = await pool.query(`
            SELECT * FROM regional_allocations WHERE season = $1
        `, [season]);

        if (allocationResult.rows.length === 0) {
            return res.status(404).json({ error: 'No allocation found for this season' });
        }

        const allocation = allocationResult.rows[0];

        // 2. Get actual farmer requests (what they asked for)
        const requestsResult = await pool.query(`
            SELECT 
                COUNT(*) as total_requests,
                SUM(CASE WHEN fertilizer_requested THEN 1 ELSE 0 END) as fertilizer_requests,
                SUM(CASE WHEN seeds_requested THEN 1 ELSE 0 END) as seeds_requests,
                SUM(farm_area_ha) as total_farm_area,
                COALESCE(SUM(requested_urea_bags), 0) as requested_urea,
                COALESCE(SUM(requested_complete_14_bags), 0) as requested_complete_14,
                COALESCE(SUM(requested_ammonium_sulfate_bags), 0) as requested_amsul,
                COALESCE(SUM(requested_muriate_potash_bags), 0) as requested_potash,
                COALESCE(SUM(requested_jackpot_kg), 0) as requested_jackpot,
                COALESCE(SUM(requested_us88_kg), 0) as requested_us88,
                COALESCE(SUM(requested_th82_kg), 0) as requested_th82,
                COALESCE(SUM(requested_rh9000_kg), 0) as requested_rh9000,
                COALESCE(SUM(requested_lumping143_kg), 0) as requested_lumping143,
                COALESCE(SUM(requested_lp296_kg), 0) as requested_lp296
            FROM farmer_requests
            WHERE season = $1
        `, [season]);

        const requests = requestsResult.rows[0];

        // 3. Calculate gaps using ACTUAL REQUESTED amounts
        const requestedUrea = parseFloat(requests.requested_urea) || 0.01;
        const requestedComplete14 = parseFloat(requests.requested_complete_14) || 0.01;
        const requestedAmSul = parseFloat(requests.requested_amsul) || 0.01;
        const requestedPotash = parseFloat(requests.requested_potash) || 0.01;

        const totalRiceSeeds = parseFloat(requests.requested_jackpot) + parseFloat(requests.requested_us88) + parseFloat(requests.requested_th82);
        const totalCornSeeds = parseFloat(requests.requested_rh9000) + parseFloat(requests.requested_lumping143) + parseFloat(requests.requested_lp296);

        // 4. Calculate gaps (Allocated - Requested)
        const fertilizerGap = {
            urea: {
                requested: requestedUrea,
                allocated: allocation.urea_46_0_0_bags,
                gap: allocation.urea_46_0_0_bags - requestedUrea,
                percentage: requestedUrea > 0 ?
                    ((allocation.urea_46_0_0_bags / requestedUrea) * 100).toFixed(1) : '0'
            },
            complete_14_14_14: {
                requested: requestedComplete14,
                allocated: allocation.complete_14_14_14_bags,
                gap: allocation.complete_14_14_14_bags - requestedComplete14,
                percentage: requestedComplete14 > 0 ?
                    ((allocation.complete_14_14_14_bags / requestedComplete14) * 100).toFixed(1) : '0'
            },
            ammonium_sulfate: {
                requested: requestedAmSul,
                allocated: allocation.ammonium_sulfate_21_0_0_bags,
                gap: allocation.ammonium_sulfate_21_0_0_bags - requestedAmSul,
                percentage: requestedAmSul > 0 ?
                    ((allocation.ammonium_sulfate_21_0_0_bags / requestedAmSul) * 100).toFixed(1) : '0'
            },
            muriate_potash: {
                requested: requestedPotash,
                allocated: allocation.muriate_potash_0_0_60_bags,
                gap: allocation.muriate_potash_0_0_60_bags - requestedPotash,
                percentage: requestedPotash > 0 ?
                    ((allocation.muriate_potash_0_0_60_bags / requestedPotash) * 100).toFixed(1) : '0'
            }
        };

        const seedsGap = {
            rice_seeds: {
                requested: totalRiceSeeds || 0.01,
                allocated: parseFloat(allocation.jackpot_kg || 0) + parseFloat(allocation.us88_kg || 0) + parseFloat(allocation.th82_kg || 0),
                gap: (parseFloat(allocation.jackpot_kg || 0) + parseFloat(allocation.us88_kg || 0) + parseFloat(allocation.th82_kg || 0)) - totalRiceSeeds,
                percentage: totalRiceSeeds > 0 ?
                    (((parseFloat(allocation.jackpot_kg || 0) + parseFloat(allocation.us88_kg || 0) + parseFloat(allocation.th82_kg || 0)) / totalRiceSeeds) * 100).toFixed(1) : '0'
            },
            corn_seeds: {
                requested: totalCornSeeds || 0.01,
                allocated: parseFloat(allocation.rh9000_kg || 0) + parseFloat(allocation.lumping143_kg || 0) + parseFloat(allocation.lp296_kg || 0),
                gap: (parseFloat(allocation.rh9000_kg || 0) + parseFloat(allocation.lumping143_kg || 0) + parseFloat(allocation.lp296_kg || 0)) - totalCornSeeds,
                percentage: totalCornSeeds > 0 ?
                    (((parseFloat(allocation.rh9000_kg || 0) + parseFloat(allocation.lumping143_kg || 0) + parseFloat(allocation.lp296_kg || 0)) / totalCornSeeds) * 100).toFixed(1) : '0'
            }
        };

        res.json({
            season,
            allocation_date: allocation.allocation_date,
            total_requests: parseInt(requests.total_requests),
            total_farm_area_ha: parseFloat(requests.total_farm_area).toFixed(2),
            fertilizer_gap: fertilizerGap,
            seeds_gap: seedsGap,
            fertilizers: fertilizerGap,
            seeds: seedsGap,
            summary: {
                has_shortages: Object.values(fertilizerGap).some(f => f.gap < 0) ||
                    Object.values(seedsGap).some(s => s.gap < 0),
                prioritization_needed: Object.values(fertilizerGap).some(f => f.percentage < 100) ||
                    Object.values(seedsGap).some(s => s.percentage < 100)
            }
        });
    } catch (error) {
        console.error('Error generating gap analysis:', error);
        res.status(500).json({ error: 'Failed to generate gap analysis', message: error.message });
    }
});

// ==================== DISTRIBUTION RECORDS ====================

/**
 * POST /api/distribution/records
 * Create distribution record (when farmer claims)
 */
router.post('/records', async (req, res) => {
    const {
        request_id,
        fertilizer_type,
        fertilizer_bags_given,
        seed_type,
        seed_kg_given,
        voucher_code,
        farmer_signature,
        verified_by
    } = req.body;

    try {
        const result = await pool.query(`
            INSERT INTO distribution_records (
                request_id, fertilizer_type, fertilizer_bags_given,
                seed_type, seed_kg_given, voucher_code,
                farmer_signature, verified_by, claimed, claim_date
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW()
            )
            RETURNING *
        `, [
            request_id, fertilizer_type, fertilizer_bags_given,
            seed_type, seed_kg_given, voucher_code,
            farmer_signature || false, verified_by
        ]);

        res.status(201).json({
            message: 'Distribution recorded successfully',
            record: result.rows[0]
        });
    } catch (error) {
        console.error('Error recording distribution:', error);
        res.status(500).json({ error: 'Failed to record distribution', message: error.message });
    }
});

/**
 * GET /api/distribution/records/:season
 * Get distribution records for a season
 */
router.get('/records/:season', async (req, res) => {
    const { season } = req.params;
    try {
        const result = await pool.query(`
            SELECT 
                dr.*,
                fr.farmer_name,
                fr.barangay,
                fr.farm_area_ha
            FROM distribution_records dr
            JOIN farmer_requests fr ON dr.request_id = fr.id
            WHERE fr.season = $1
            ORDER BY dr.distribution_date DESC
        `, [season]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching distribution records:', error);
        res.status(500).json({ error: 'Failed to fetch records', message: error.message });
    }
});

/**
 * PUT /api/distribution/records/:id
 * Update distribution record
 */
router.put('/records/:id', async (req, res) => {
    const { id } = req.params;
    const {
        fertilizer_type,
        fertilizer_bags_given,
        seed_type,
        seed_kg_given,
        voucher_code,
        farmer_signature,
        verified_by,
        verification_notes
    } = req.body;

    try {
        const result = await pool.query(`
            UPDATE distribution_records 
            SET 
                fertilizer_type = $1,
                fertilizer_bags_given = $2,
                seed_type = $3,
                seed_kg_given = $4,
                voucher_code = $5,
                farmer_signature = $6,
                verified_by = $7,
                verification_notes = $8
            WHERE id = $9
            RETURNING *
        `, [
            fertilizer_type,
            fertilizer_bags_given,
            seed_type,
            seed_kg_given,
            voucher_code,
            farmer_signature || false,
            verified_by,
            verification_notes,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Distribution record not found' });
        }

        res.json({
            message: 'Distribution record updated successfully',
            record: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating distribution record:', error);
        res.status(500).json({ error: 'Failed to update record', message: error.message });
    }
});

// ==================== DASHBOARD KPI STATISTICS ====================

/**
 * GET /api/distribution/available-seasons
 * Get list of all seasons with regional allocations for dropdown
 */
router.get('/available-seasons', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                season,
                season_start_date,
                season_end_date,
                status,
                created_at
            FROM regional_allocations
            ORDER BY created_at DESC
        `);

        // Also determine the current season
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const currentSeason = month >= 5 && month <= 10 ? `wet_${year}` : `dry_${year}`;

        res.json({
            currentSeason,
            availableSeasons: result.rows
        });
    } catch (error) {
        console.error('Error fetching available seasons:', error);
        res.status(500).json({ error: 'Failed to fetch available seasons', message: error.message });
    }
});

/**
 * GET /api/distribution/dashboard-stats
 * Get comprehensive dashboard statistics for KPI cards
 * Query params: ?season=wet_2025 (optional - defaults to current season)
 */
router.get('/dashboard-stats', async (req, res) => {
    try {
        // Get season from query params or calculate current season
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const defaultSeason = month >= 5 && month <= 10 ? `wet_${year}` : `dry_${year}`;
        const selectedSeason = req.query.season || defaultSeason;

        // Get total farmers count
        const farmersResult = await pool.query(`
            SELECT 
                COUNT(*) as total_farmers,
                COUNT(*) FILTER (WHERE status = 'Active Farmer') as active_farmers
            FROM rsbsa_submission
        `);

        // Use selected season instead of auto-calculated
        const currentSeason = selectedSeason;

        // Get requests statistics for current season
        const requestsResult = await pool.query(`
            SELECT 
                COUNT(*) as total_requests,
                COUNT(*) FILTER (WHERE status = 'pending') as pending_requests,
                COUNT(*) FILTER (WHERE status = 'approved') as approved_requests,
                COUNT(*) FILTER (WHERE status = 'rejected') as rejected_requests,
                COUNT(*) FILTER (WHERE status = 'distributed') as distributed_requests
            FROM farmer_requests
            WHERE season = $1
        `, [currentSeason]);

        // Get all-time requests statistics
        const allTimeRequestsResult = await pool.query(`
            SELECT 
                COUNT(*) as total_requests,
                COUNT(*) FILTER (WHERE status = 'pending') as pending_requests,
                COUNT(*) FILTER (WHERE status = 'approved') as approved_requests,
                COUNT(*) FILTER (WHERE status = 'distributed') as distributed_requests
            FROM farmer_requests
        `);

        // Get distribution progress for current season
        const allocationResult = await pool.query(`
            SELECT 
                COALESCE(urea_46_0_0_bags, 0) + 
                COALESCE(complete_14_14_14_bags, 0) + 
                COALESCE(ammonium_sulfate_21_0_0_bags, 0) + 
                COALESCE(muriate_potash_0_0_60_bags, 0) as total_fertilizer_allocated,
                COALESCE(jackpot_kg, 0) + 
                COALESCE(us88_kg, 0) + 
                COALESCE(th82_kg, 0) + 
                COALESCE(rh9000_kg, 0) + 
                COALESCE(lumping143_kg, 0) + 
                COALESCE(lp296_kg, 0) as total_seeds_allocated
            FROM regional_allocations
            WHERE season = $1
        `, [currentSeason]);

        // Get distributed amounts for current season
        const distributedResult = await pool.query(`
            SELECT 
                COALESCE(SUM(dr.fertilizer_bags_given), 0) as total_fertilizer_distributed,
                COALESCE(SUM(dr.seed_kg_given), 0) as total_seeds_distributed
            FROM distribution_records dr
            JOIN farmer_requests fr ON dr.request_id = fr.id
            WHERE fr.season = $1
        `, [currentSeason]);

        // Get barangay coverage
        const barangayCoverageResult = await pool.query(`
            SELECT 
                COUNT(DISTINCT "BARANGAY") as total_barangays_with_farmers,
                (SELECT COUNT(DISTINCT barangay) FROM farmer_requests WHERE season = $1) as barangays_with_requests
            FROM rsbsa_submission
            WHERE "BARANGAY" IS NOT NULL
        `, [currentSeason]);

        // Get average processing time (days from request to status update)
        // Using updated_at as proxy since approved_date doesn't exist
        const processingTimeResult = await pool.query(`
            SELECT 
                AVG(EXTRACT(EPOCH FROM (updated_at - request_date)) / 86400) as avg_processing_days
            FROM farmer_requests
            WHERE status IN ('approved', 'distributed') 
            AND updated_at IS NOT NULL
            AND request_date IS NOT NULL
        `);

        // Compile response
        const farmers = farmersResult.rows[0];
        const requests = requestsResult.rows[0];
        const allTimeRequests = allTimeRequestsResult.rows[0];
        const allocation = allocationResult.rows[0] || { total_fertilizer_allocated: 0, total_seeds_allocated: 0 };
        const distributed = distributedResult.rows[0];
        const barangayCoverage = barangayCoverageResult.rows[0];
        const processingTime = processingTimeResult.rows[0];

        // Calculate percentages
        const fertilizerProgress = allocation.total_fertilizer_allocated > 0
            ? Math.round((distributed.total_fertilizer_distributed / allocation.total_fertilizer_allocated) * 100)
            : 0;
        const seedsProgress = allocation.total_seeds_allocated > 0
            ? Math.round((distributed.total_seeds_distributed / allocation.total_seeds_allocated) * 100)
            : 0;

        // Calculate overall distribution progress
        const totalAllocated = parseFloat(allocation.total_fertilizer_allocated || 0) + parseFloat(allocation.total_seeds_allocated || 0);
        const totalDistributed = parseFloat(distributed.total_fertilizer_distributed || 0) + parseFloat(distributed.total_seeds_distributed || 0);
        const overallProgress = totalAllocated > 0 ? Math.round((totalDistributed / totalAllocated) * 100) : 0;

        // Calculate remaining amounts
        const remainingFertilizer = Math.max(0, parseFloat(allocation.total_fertilizer_allocated || 0) - parseFloat(distributed.total_fertilizer_distributed || 0));
        const remainingSeeds = Math.max(0, parseFloat(allocation.total_seeds_allocated || 0) - parseFloat(distributed.total_seeds_distributed || 0));

        // Calculate request status percentages
        const totalRequests = parseInt(requests.total_requests) || 0;
        const requestStatusBreakdown = {
            approved: totalRequests > 0 ? Math.round((parseInt(requests.approved_requests) / totalRequests) * 100) : 0,
            pending: totalRequests > 0 ? Math.round((parseInt(requests.pending_requests) / totalRequests) * 100) : 0,
            rejected: totalRequests > 0 ? Math.round((parseInt(requests.rejected_requests) / totalRequests) * 100) : 0,
            distributed: totalRequests > 0 ? Math.round((parseInt(requests.distributed_requests) / totalRequests) * 100) : 0
        };

        res.json({
            currentSeason,
            seasonEndDate: month >= 5 && month <= 10 ? `October 31, ${year}` : `April 30, ${year + (month <= 4 ? 0 : 1)}`,
            farmers: {
                total: parseInt(farmers.total_farmers) || 0,
                active: parseInt(farmers.active_farmers) || 0
            },
            requests: {
                currentSeason: {
                    total: parseInt(requests.total_requests) || 0,
                    pending: parseInt(requests.pending_requests) || 0,
                    approved: parseInt(requests.approved_requests) || 0,
                    rejected: parseInt(requests.rejected_requests) || 0,
                    distributed: parseInt(requests.distributed_requests) || 0
                },
                allTime: {
                    total: parseInt(allTimeRequests.total_requests) || 0,
                    pending: parseInt(allTimeRequests.pending_requests) || 0,
                    approved: parseInt(allTimeRequests.approved_requests) || 0,
                    distributed: parseInt(allTimeRequests.distributed_requests) || 0
                },
                statusBreakdown: requestStatusBreakdown
            },
            distribution: {
                fertilizer: {
                    allocated: parseFloat(allocation.total_fertilizer_allocated) || 0,
                    distributed: parseFloat(distributed.total_fertilizer_distributed) || 0,
                    remaining: remainingFertilizer,
                    progress: fertilizerProgress
                },
                seeds: {
                    allocated: parseFloat(allocation.total_seeds_allocated) || 0,
                    distributed: parseFloat(distributed.total_seeds_distributed) || 0,
                    remaining: remainingSeeds,
                    progress: seedsProgress
                },
                overall: {
                    progress: overallProgress,
                    totalAllocated,
                    totalDistributed
                }
            },
            coverage: {
                totalBarangays: parseInt(barangayCoverage.total_barangays_with_farmers) || 0,
                barangaysWithRequests: parseInt(barangayCoverage.barangays_with_requests) || 0
            },
            processingTime: {
                averageDays: processingTime.avg_processing_days
                    ? parseFloat(processingTime.avg_processing_days).toFixed(1)
                    : 'N/A'
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics', message: error.message });
    }
});

/**
 * GET /api/distribution/monthly-trends
 * Get monthly distribution trends for the last 12 months
 */
router.get('/monthly-trends', async (req, res) => {
    try {
        // Get distribution data grouped by month for the last 12 months
        const trendsResult = await pool.query(`
            SELECT 
                TO_CHAR(distribution_date, 'YYYY-MM') as month,
                TO_CHAR(distribution_date, 'Mon') as month_name,
                COALESCE(SUM(fertilizer_bags_given), 0) as fertilizer_distributed,
                COALESCE(SUM(seed_kg_given), 0) as seeds_distributed,
                COUNT(*) as distribution_count
            FROM distribution_records
            WHERE distribution_date >= NOW() - INTERVAL '12 months'
            GROUP BY TO_CHAR(distribution_date, 'YYYY-MM'), TO_CHAR(distribution_date, 'Mon')
            ORDER BY month ASC
        `);

        // Get request data grouped by month
        const requestTrendsResult = await pool.query(`
            SELECT 
                TO_CHAR(request_date, 'YYYY-MM') as month,
                TO_CHAR(request_date, 'Mon') as month_name,
                COUNT(*) as total_requests,
                COUNT(*) FILTER (WHERE status = 'approved') as approved,
                COUNT(*) FILTER (WHERE status = 'distributed') as distributed
            FROM farmer_requests
            WHERE request_date >= NOW() - INTERVAL '12 months'
            GROUP BY TO_CHAR(request_date, 'YYYY-MM'), TO_CHAR(request_date, 'Mon')
            ORDER BY month ASC
        `);

        // Generate all 12 months for consistent chart display
        const months = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = d.toISOString().slice(0, 7);
            // Fix: Use the same date object for month name
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthName = monthNames[d.getMonth()];
            months.push({ month: monthKey, monthName });
        }

        // Merge distribution data with all months
        const distributionTrends = months.map(m => {
            const found = trendsResult.rows.find(r => r.month === m.month);
            return {
                month: m.month,
                monthName: m.monthName,
                fertilizer: found ? parseFloat(found.fertilizer_distributed) : 0,
                seeds: found ? parseFloat(found.seeds_distributed) : 0,
                count: found ? parseInt(found.distribution_count) : 0
            };
        });

        // Merge request data with all months
        const requestTrends = months.map(m => {
            const found = requestTrendsResult.rows.find(r => r.month === m.month);
            return {
                month: m.month,
                monthName: m.monthName,
                total: found ? parseInt(found.total_requests) : 0,
                approved: found ? parseInt(found.approved) : 0,
                distributed: found ? parseInt(found.distributed) : 0
            };
        });

        res.json({
            distribution: distributionTrends,
            requests: requestTrends,
            summary: {
                totalFertilizerLast12Months: distributionTrends.reduce((sum, m) => sum + m.fertilizer, 0),
                totalSeedsLast12Months: distributionTrends.reduce((sum, m) => sum + m.seeds, 0),
                totalDistributionsLast12Months: distributionTrends.reduce((sum, m) => sum + m.count, 0)
            }
        });
    } catch (error) {
        console.error('Error fetching monthly trends:', error);
        res.status(500).json({ error: 'Failed to fetch monthly trends', message: error.message });
    }
});

/**
 * GET /api/distribution/recent-activity
 * Get recent distribution activity for audit log display
 */
router.get('/recent-activity', async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;

    try {
        const result = await pool.query(`
            SELECT 
                dr.id,
                fr.farmer_name,
                fr.barangay,
                dr.fertilizer_type,
                dr.fertilizer_bags_given,
                dr.seed_type,
                dr.seed_kg_given,
                dr.distribution_date,
                dr.verified_by,
                dr.created_at
            FROM distribution_records dr
            JOIN farmer_requests fr ON dr.request_id = fr.id
            ORDER BY dr.created_at DESC
            LIMIT $1
        `, [limit]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        res.status(500).json({ error: 'Failed to fetch recent activity', message: error.message });
    }
});

// ==================== BARANGAY SHORTAGES (Enhanced Gap Analysis) ====================

/**
 * GET /api/distribution/barangay-shortages/:season
 * Get shortage data by barangay for heatmap visualization
 */
router.get('/barangay-shortages/:season', async (req, res) => {
    const { season } = req.params;

    try {
        console.log(`\n📊 Fetching barangay shortages for season: ${season}`);

        // Get allocation for the season
        const allocationResult = await pool.query(`
            SELECT * FROM regional_allocations WHERE season = $1
        `, [season]);

        if (allocationResult.rows.length === 0) {
            return res.status(404).json({ error: 'No allocation found for this season' });
        }

        // Get requests grouped by barangay
        const barangayData = await pool.query(`
            SELECT 
                barangay,
                COUNT(*) as farmer_count,
                SUM(COALESCE(requested_urea_bags, 0)) as total_urea_requested,
                SUM(COALESCE(requested_complete_14_bags, 0)) as total_complete_requested,
                SUM(COALESCE(requested_jackpot_kg, 0) + COALESCE(requested_us88_kg, 0) + 
                    COALESCE(requested_th82_kg, 0) + COALESCE(requested_rh9000_kg, 0) +
                    COALESCE(requested_lumping143_kg, 0) + COALESCE(requested_lp296_kg, 0)) as total_seeds_requested,
                SUM(farm_area_ha) as total_farm_area
            FROM farmer_requests
            WHERE season = $1
            GROUP BY barangay
            ORDER BY barangay
        `, [season]);

        const allocation = allocationResult.rows[0];
        const totalBarangays = barangayData.rows.length || 1;

        // Calculate per-barangay allocation (simple equal distribution)
        const perBarangayUrea = Math.floor((allocation.allocated_urea_bags || 0) / totalBarangays);
        const perBarangayComplete = Math.floor((allocation.allocated_complete_14_bags || 0) / totalBarangays);
        const perBarangaySeeds = Math.floor(((allocation.allocated_seeds_kg || 0)) / totalBarangays);

        // Build shortage data for each barangay
        const shortages = barangayData.rows.map(row => {
            const ureaGap = perBarangayUrea - (row.total_urea_requested || 0);
            const completeGap = perBarangayComplete - (row.total_complete_requested || 0);
            const seedsGap = perBarangaySeeds - (row.total_seeds_requested || 0);

            const getStatus = (gap, threshold) => {
                if (gap < -threshold) return 'critical';
                if (gap < 0) return 'moderate';
                return 'good';
            };

            const ureaStatus = getStatus(ureaGap, 50);
            const completeStatus = getStatus(completeGap, 50);
            const seedsStatus = getStatus(seedsGap, 25);

            const getOverall = (statuses) => {
                if (statuses.includes('critical')) return 'CRITICAL';
                if (statuses.includes('moderate')) return 'MODERATE';
                return 'GOOD';
            };

            return {
                barangay: row.barangay,
                farmerCount: parseInt(row.farmer_count),
                urea: ureaStatus,
                complete: completeStatus,
                seeds: seedsStatus,
                overall: getOverall([ureaStatus, completeStatus, seedsStatus]),
                ureaGap: Math.round(ureaGap),
                completeGap: Math.round(completeGap),
                seedsGap: Math.round(seedsGap)
            };
        });

        // Sort by severity (critical first)
        shortages.sort((a, b) => {
            const order = { 'CRITICAL': 0, 'MODERATE': 1, 'GOOD': 2 };
            return order[a.overall] - order[b.overall];
        });

        console.log(`   ✅ Found ${shortages.length} barangays with data`);
        res.json(shortages);

    } catch (error) {
        console.error('❌ Error fetching barangay shortages:', error);
        res.status(500).json({ error: 'Failed to fetch barangay shortages', message: error.message });
    }
});

// ==================== HISTORICAL COMPARISON ====================

/**
 * GET /api/distribution/historical-comparison
 * Get historical data for trend analysis
 */
router.get('/historical-comparison', async (req, res) => {
    try {
        console.log(`\n📈 Fetching historical comparison data`);

        // Get all seasons with allocations (using correct column names)
        const result = await pool.query(`
            SELECT 
                ra.season,
                COALESCE(ra.urea_46_0_0_bags, 0) as urea_bags,
                COALESCE(ra.complete_14_14_14_bags, 0) as complete_bags,
                COALESCE(ra.rice_seeds_nsic_rc160_kg, 0) + 
                COALESCE(ra.rice_seeds_nsic_rc222_kg, 0) + 
                COALESCE(ra.rice_seeds_nsic_rc440_kg, 0) as seeds_kg,
                ra.created_at,
                (SELECT COUNT(*) FROM farmer_requests fr WHERE fr.season = ra.season) as request_count,
                (SELECT COUNT(*) FROM farmer_requests fr WHERE fr.season = ra.season AND fr.fertilizer_requested = true) as fertilizer_requests,
                (SELECT COUNT(*) FROM farmer_requests fr WHERE fr.season = ra.season AND fr.seeds_requested = true) as seed_requests
            FROM regional_allocations ra
            ORDER BY ra.created_at DESC
            LIMIT 8
        `);

        if (result.rows.length === 0) {
            // Return sample data if no historical data exists
            return res.json([
                { season: 'Wet 2024', allocated: 5000, requested: 4200, gap: 800, fulfilled: 100 },
                { season: 'Dry 2024', allocated: 4500, requested: 5100, gap: -600, fulfilled: 88 },
                { season: 'Wet 2025', allocated: 5200, requested: 5800, gap: -600, fulfilled: 90 },
                { season: 'Dry 2025', allocated: 4800, requested: 5500, gap: -700, fulfilled: 87, isCurrent: true }
            ]);
        }

        // Determine current season
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        const currentSeasonType = currentMonth >= 5 && currentMonth <= 10 ? 'wet' : 'dry';
        const currentSeason = `${currentSeasonType}_${currentYear}`;

        const historicalData = result.rows.map(row => {
            const allocated = parseInt(row.urea_bags || 0) + parseInt(row.complete_bags || 0);
            const requested = parseInt(row.fertilizer_requests || 0) * 2; // Estimate bags per request
            const gap = allocated - requested;
            const fulfilled = requested > 0 ? Math.round((Math.min(allocated, requested) / requested) * 100) : 100;

            // Format season name for display
            const [type, year] = row.season.split('_');
            const displaySeason = `${type.charAt(0).toUpperCase() + type.slice(1)} ${year}`;

            return {
                season: displaySeason,
                allocated,
                requested,
                gap,
                fulfilled: Math.min(fulfilled, 100),
                isCurrent: row.season.toLowerCase() === currentSeason.toLowerCase()
            };
        });

        console.log(`   ✅ Found ${historicalData.length} seasons of historical data`);
        res.json(historicalData.reverse()); // Oldest first

    } catch (error) {
        console.error('❌ Error fetching historical comparison:', error);
        res.status(500).json({ error: 'Failed to fetch historical comparison', message: error.message });
    }
});

module.exports = router;
