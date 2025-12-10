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

/*
Purpose: Handles the submission of the final RSBSA form along with multiple farmland parcels. 
Validates data, calculates totals, and stores everything in the database.
Where: Used in backend API route '/api/rsbsa_submission' in server.cjs.
Description: This endpoint handles the submission of the final RSBSA form along with multiple farmland parcels. 
Validates data, calculates totals, and stores everything in the database.
*/
router.post('/', async (req, res) => {
    const { draftId, data } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // console.log('Received RSBSA submission:', {
        //     draftId,
        //     data: {
        //         ...data,
        //         farmlandParcels: JSON.stringify(data.farmlandParcels, null, 2)
        //     }
        // });

        const totalFarmArea = data.farmlandParcels
            ? data.farmlandParcels.reduce((total, parcel) => {
                const area = parseFloat(parcel.totalFarmAreaHa) || 0;
                return total + area;
            }, 0)
            : 0;

        // Derive FARM LOCATION from the first parcel, if available
        let farmLocation = '';
        if (data.farmlandParcels && data.farmlandParcels.length > 0) {
            const firstParcel = data.farmlandParcels[0];
            farmLocation = `${firstParcel.farmLocationBarangay || ''}, ${firstParcel.farmLocationMunicipality || ''}`.trim();
            if (farmLocation === ',') farmLocation = '';
        }

        // Validate ownership type
        if (data.farmlandParcels && data.farmlandParcels.length > 0) {
            const hasValidOwnershipType = data.farmlandParcels.some(
                parcel =>
                    parcel.ownershipTypeRegisteredOwner ||
                    parcel.ownershipTypeTenant ||
                    parcel.ownershipTypeLessee
            );
            if (!hasValidOwnershipType) {
                throw new Error('At least one parcel must have a valid ownership type (Registered Owner, Tenant, or Lessee)');
            }
        } else {
            throw new Error('At least one farmland parcel is required');
        }

        // Derive ownership types from the first parcel (or adjust logic as needed)
        const firstParcel = data.farmlandParcels && data.farmlandParcels.length > 0 ? data.farmlandParcels[0] : {};
        const ownershipTypeRegisteredOwner = firstParcel.ownershipTypeRegisteredOwner || false;
        const ownershipTypeTenant = firstParcel.ownershipTypeTenant || false;
        const ownershipTypeLessee = firstParcel.ownershipTypeLessee || false;

        // Get all parcel areas and join them with commas
        const parcelAreasArray = data.farmlandParcels
            ? data.farmlandParcels
                .map(parcel => parcel.totalFarmAreaHa ? parseFloat(parcel.totalFarmAreaHa) : null)
                .filter(area => area !== null) // Remove null values
            : [];
        const parcelArea = parcelAreasArray.length > 0 ? parcelAreasArray.join(', ') : null;

        const insertSubmissionQuery = `
            INSERT INTO rsbsa_submission (
                "LAST NAME", "FIRST NAME", "MIDDLE NAME", "EXT NAME", "GENDER", "BIRTHDATE", age,
                "BARANGAY", "MUNICIPALITY", "FARM LOCATION", "PARCEL AREA", "TOTAL FARM AREA",
                "MAIN LIVELIHOOD", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT",
                "OWNERSHIP_TYPE_LESSEE", status,
                "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT",
                "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT"
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                $18, $19, $20, $21, $22, $23, $24, $25
            )
            RETURNING id, submitted_at
        `;

        const submissionValues = [
            data.surname || '',
            data.firstName || '',
            data.middleName || '',
            data.extensionName || '',
            data.gender || '',
            data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            data.age ? parseInt(data.age) : null,
            data.barangay || '',
            data.municipality || '',
            farmLocation,
            parcelArea, // PARCEL AREA - now uses first parcel's area
            totalFarmArea,
            data.mainLivelihood || '',
            ownershipTypeRegisteredOwner,
            ownershipTypeTenant,
            ownershipTypeLessee,
            'Active Farmer',
            data.farmerRice || false,
            data.farmerCorn || false,
            data.farmerOtherCrops || false,
            data.farmerOtherCropsText || '',
            data.farmerLivestock || false,
            data.farmerLivestockText || '',
            data.farmerPoultry || false,
            data.farmerPoultryText || '',
        ];

        const submissionResult = await client.query(insertSubmissionQuery, submissionValues);
        const submissionId = submissionResult.rows[0].id;
        const submittedAt = submissionResult.rows[0].submitted_at;

        if (data.farmlandParcels && data.farmlandParcels.length > 0) {
            const parcelInsertQuery = `
                INSERT INTO rsbsa_farm_parcels (
                    submission_id, parcel_number, farm_location_barangay, farm_location_municipality,
                    total_farm_area_ha, within_ancestral_domain, ownership_document_no,
                    agrarian_reform_beneficiary, ownership_type_registered_owner, ownership_type_tenant,
                    ownership_type_lessee, tenant_land_owner_name, lessee_land_owner_name, ownership_others_specify
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
                )
            `;
            for (let parcel of data.farmlandParcels) {
                try {
                    if (!parcel.farmLocationBarangay || !parcel.totalFarmAreaHa) {
                        console.warn('Skipping parcel due to missing required fields:', parcel);
                        continue;
                    }
                    const area = parseFloat(parcel.totalFarmAreaHa);
                    if (isNaN(area)) throw new Error('Invalid totalFarmAreaHa');
                    await client.query(parcelInsertQuery, [
                        submissionId,
                        parcel.parcelNo || `Parcel-${submissionId}-${data.farmlandParcels.indexOf(parcel) + 1}`,
                        parcel.farmLocationBarangay || '',
                        parcel.farmLocationMunicipality || '',
                        area,
                        parcel.withinAncestralDomain === 'Yes' ? 'Yes' : 'No',  // Fixed: Must be 'Yes' or 'No' string
                        parcel.ownershipDocumentNo || '',
                        parcel.agrarianReformBeneficiary === 'Yes' ? 'Yes' : 'No',  // Fixed: Must be 'Yes' or 'No' string
                        parcel.ownershipTypeRegisteredOwner || false,
                        parcel.ownershipTypeTenant || false,
                        parcel.ownershipTypeLessee || false,
                        parcel.tenantLandOwnerName || '',
                        parcel.lesseeLandOwnerName || '',
                        parcel.ownershipOthersSpecify || '',
                    ]);
                } catch (err) {
                    console.error('Error inserting parcel:', err, 'Parcel data:', parcel);
                    throw err;
                }
            }
        }

        await client.query('COMMIT');
        // console.log(`RSBSA form submitted successfully with ${data.farmlandParcels.length} parcels for farmer: ${data.firstName} ${data.surname}`);
        res.status(201).json({
            message: 'RSBSA form submitted successfully!',
            submissionId: submissionId,
            submittedAt: submittedAt,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error submitting RSBSA form:', error);
        res.status(400).json({
            message: 'Error submitting RSBSA form',
            error: error.message,
        });
    } finally {
        client.release();
    }
});

// ============================================================================
// GET /:id/parcels - Get farm parcels for a specific submission
// ============================================================================
/*
Purpose: Fetches farm parcels for a specific RSBSA submission
Where: GET /api/rsbsa_submission/:id/parcels
Description: Returns all farm parcels associated with a submission ID
*/
router.get('/:id/parcels', async (req, res) => {
    try {
        const submissionId = req.params.id;
        // console.log(`Fetching farm parcels for submission ID: ${submissionId}`);

        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'rsbsa_farm_parcels'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('rsbsa_farm_parcels table does not exist');
            return res.status(500).json({
                message: 'Database error: rsbsa_farm_parcels table not found',
            });
        }

        const query = `
            SELECT 
                id,
                submission_id,
                parcel_number,
                farm_location_barangay,
                farm_location_municipality,
                total_farm_area_ha,
                within_ancestral_domain,
                ownership_document_no,
                agrarian_reform_beneficiary,
                ownership_type_registered_owner,
                ownership_type_tenant,
                ownership_type_lessee,
                tenant_land_owner_name,
                lessee_land_owner_name,
                ownership_others_specify,
                created_at,
                updated_at
            FROM rsbsa_farm_parcels 
            WHERE submission_id = $1
            ORDER BY parcel_number
        `;

        const result = await pool.query(query, [submissionId]);
        console.log(`Found ${result.rows.length} farm parcels for submission ${submissionId}`);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching farm parcels:', error);
        res.status(500).json({ message: 'Error fetching farm parcels', error: error.message });
    }
});

// ============================================================================
// GET /farm_parcels - Get all farm parcels with farmer details
// ============================================================================
/*
Purpose: Fetches all farm parcels along with associated farmer details
Where: GET /api/rsbsa_submission/farm_parcels
Description: Returns all parcels with farmer information via JOIN
*/
router.get('/farm_parcels', async (req, res) => {
    try {
        console.log('Fetching all farm parcels...');

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
                rs."MIDDLE NAME"
            FROM rsbsa_farm_parcels fp
            JOIN rsbsa_submission rs ON fp.submission_id = rs.id
            ORDER BY fp.submission_id, fp.parcel_number
        `;

        const result = await pool.query(query);
        console.log(`Found ${result.rows.length} farm parcels`);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching farm parcels:', error);
        res.status(500).json({ message: 'Error fetching farm parcels', error: error.message });
    }
});

// Note: GET /, GET /:id, and PUT /:id endpoints are in server.cjs
// They handle both JSONB and structured table formats for backwards compatibility
// This route file only handles: POST (create), GET parcels, DELETE

// ============================================================================
// DELETE /:id - Delete RSBSA submission and associated parcels
// ============================================================================
/*
Purpose: Deletes an RSBSA submission and all associated farm parcels
Where: DELETE /api/rsbsa_submission/:id
Description: Cascading delete - removes submission and all linked parcels in a transaction
*/
router.delete('/:id', async (req, res) => {
    const submissionId = req.params.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        console.log(`Deleting RSBSA submission ID: ${submissionId}`);

        // First delete all associated parcels
        const deleteParcelsQuery = 'DELETE FROM rsbsa_farm_parcels WHERE submission_id = $1';
        const parcelsResult = await client.query(deleteParcelsQuery, [submissionId]);
        console.log(`Deleted ${parcelsResult.rowCount} parcels for submission ${submissionId}`);

        // Then delete the submission
        const deleteSubmissionQuery = 'DELETE FROM rsbsa_submission WHERE id = $1 RETURNING id';
        const submissionResult = await client.query(deleteSubmissionQuery, [submissionId]);

        if (submissionResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Submission not found' });
        }

        await client.query('COMMIT');
        res.json({
            message: 'RSBSA submission and associated parcels deleted successfully',
            submissionId: submissionResult.rows[0].id,
            parcelsDeleted: parcelsResult.rowCount
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting submission:', error);
        res.status(500).json({ message: 'Error deleting submission', error: error.message });
    } finally {
        client.release();
    }
});

module.exports = router;