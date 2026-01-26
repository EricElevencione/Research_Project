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
// RSBSA FARM PARCELS API ENDPOINTS
// ============================================================================

/**
 * GET /api/rsbsa-farm-parcels/by-farmer
 * Fetches farm parcels associated with a specific farmer by last and first names
 */
router.get('/by-farmer', async (req, res) => {
    try {
        const { lastName, firstName } = req.query;

        if (!lastName || !firstName) {
            return res.status(400).json({
                message: 'Both lastName and firstName query parameters are required'
            });
        }

        const query = `
            SELECT 
                fp.id,
                fp.submission_id,
                fp.parcel_number,
                fp.farm_location_barangay,
                fp.farm_location_municipality,
                fp.total_farm_area_ha,
                fp.within_ancestral_domain,
                fp.ownership_document_no,
                fp.agrarian_reform_beneficiary,
                fp.ownership_type_registered_owner,
                fp.ownership_type_tenant,
                fp.ownership_type_lessee,
                fp.ownership_type_others,
                fp.tenant_land_owner_name,
                fp.lessee_land_owner_name,
                fp.ownership_others_specify,
                fp.created_at,
                fp.updated_at,
                rs."LAST NAME",
                rs."FIRST NAME",
                rs."MIDDLE NAME",
                rs."BARANGAY",
                rs."MUNICIPALITY"
            FROM rsbsa_farm_parcels fp
            JOIN rsbsa_submission rs ON fp.submission_id = rs.id
            WHERE rs."LAST NAME" = $1 AND rs."FIRST NAME" = $2
            ORDER BY fp.parcel_number
        `;

        const result = await pool.query(query, [lastName, firstName]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching parcels by farmer:', error);
        res.status(500).json({ message: 'Error fetching parcels by farmer', error: error.message });
    }
});

/**
 * PUT /api/rsbsa-farm-parcels/:id
 * Update a specific farm parcel
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log('Updating farm parcel:', { id, updateData });

        // Build the UPDATE query dynamically based on provided fields
        const allowedFields = [
            'total_farm_area_ha',
            'farm_location_barangay',
            'farm_location_municipality',
            'within_ancestral_domain',
            'ownership_document_no',
            'agrarian_reform_beneficiary',
            'ownership_type_registered_owner',
            'ownership_type_tenant',
            'ownership_type_lessee',
            'tenant_land_owner_name',
            'lessee_land_owner_name',
            'ownership_others_specify'
        ];

        const updateFields = [];
        const queryValues = [];
        let paramCounter = 1;

        // Build SET clause dynamically
        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key) && value !== undefined) {
                updateFields.push(`${key} = $${paramCounter}`);
                queryValues.push(value);
                paramCounter++;
            }
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                message: 'No valid fields provided for update'
            });
        }

        // Add updated_at timestamp
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

        // Add the parcel ID as the last parameter
        queryValues.push(id);

        const updateQuery = `
            UPDATE rsbsa_farm_parcels
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCounter}
            RETURNING *;
        `;

        console.log('Executing parcel update query:', { query: updateQuery, params: queryValues });

        const result = await pool.query(updateQuery, queryValues);

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: 'Farm parcel not found',
                parcelId: id
            });
        }

        // After updating parcel, recalculate and update the submission's PARCEL AREA field
        const parcelSubmissionId = result.rows[0].submission_id;

        // Get all parcels for this submission to recalculate the comma-separated list
        const allParcelsResult = await pool.query(`
            SELECT total_farm_area_ha
            FROM rsbsa_farm_parcels
            WHERE submission_id = $1
            ORDER BY parcel_number
        `, [parcelSubmissionId]);

        const parcelAreasArray = allParcelsResult.rows
            .map(p => p.total_farm_area_ha)
            .filter(area => area !== null);

        const newParcelAreaString = parcelAreasArray.join(', ');
        const newTotalFarmArea = parcelAreasArray.reduce((sum, area) => sum + parseFloat(area), 0);

        // Update the submission record
        await pool.query(`
            UPDATE rsbsa_submission
            SET "PARCEL AREA" = $1,
                "TOTAL FARM AREA" = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
        `, [newParcelAreaString, newTotalFarmArea, parcelSubmissionId]);

        res.json({
            message: 'Farm parcel updated successfully',
            updatedParcel: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating farm parcel:', error);
        res.status(500).json({
            message: 'Error updating farm parcel',
            error: error.message
        });
    }
});

module.exports = router;
