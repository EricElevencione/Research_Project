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

// ============================================================================
// GET / - Fetch all RSBSA submissions for masterlist
// ============================================================================
router.get('/', async (req, res) => {
    try {
        // Check for optional columns that may not exist in all database versions
        const columnCheckQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'rsbsa_submission' 
            ORDER BY ordinal_position
        `;
        const columnResult = await pool.query(columnCheckQuery);
        const hasOwnershipColumns = columnResult.rows.some(row => row.column_name === 'OWNERSHIP_TYPE_REGISTERED_OWNER');
        const hasFFRSCode = columnResult.rows.some(row => row.column_name === 'FFRS_CODE');

        const ownershipFields = hasOwnershipColumns
            ? `,
            rs."OWNERSHIP_TYPE_REGISTERED_OWNER",
            rs."OWNERSHIP_TYPE_TENANT",
            rs."OWNERSHIP_TYPE_LESSEE"`
            : '';

        const ffrsField = hasFFRSCode ? ', rs."FFRS_CODE"' : '';

        const query = `
            SELECT 
                rs.id,
                rs."LAST NAME",
                rs."FIRST NAME",
                rs."MIDDLE NAME",
                rs."EXT NAME",
                rs."GENDER",
                rs."BIRTHDATE",
                rs.age,
                rs."BARANGAY",
                rs."MUNICIPALITY",
                rs."FARM LOCATION",
                COALESCE(fp_sum.total_area, rs."TOTAL FARM AREA", 0)::TEXT AS "PARCEL AREA",
                COALESCE(fp_sum.total_area, rs."TOTAL FARM AREA", 0) AS "TOTAL FARM AREA",
                rs."MAIN LIVELIHOOD",
                rs.status,
                rs.submitted_at,
                rs.created_at,
                rs.updated_at,
                COALESCE(fp_count.parcel_count, 0) AS parcel_count
                ${ownershipFields}
                ${ffrsField}
            FROM rsbsa_submission rs
            LEFT JOIN (
                SELECT submission_id, SUM(total_farm_area_ha) AS total_area
                FROM rsbsa_farm_parcels
                GROUP BY submission_id
            ) fp_sum ON fp_sum.submission_id = rs.id
            LEFT JOIN (
                SELECT submission_id, COUNT(*) AS parcel_count
                FROM rsbsa_farm_parcels
                GROUP BY submission_id
            ) fp_count ON fp_count.submission_id = rs.id
            WHERE rs."LAST NAME" IS NOT NULL
            ORDER BY rs.submitted_at DESC
        `;
        const result = await pool.query(query);

        // Transform the data to match the frontend's expected format
        const submissions = result.rows.map(row => {
            const fullName = [row["LAST NAME"], row["FIRST NAME"], row["MIDDLE NAME"], row["EXT NAME"]]
                .filter(Boolean)
                .join(', ');

            const parcelInfo = row["FARM LOCATION"]
                ? `${row["FARM LOCATION"]}${row["PARCEL AREA"] ? ` (${row["PARCEL AREA"]} ha)` : ''}`
                : 'N/A';

            const ownershipType = {
                registeredOwner: hasOwnershipColumns ? !!row["OWNERSHIP_TYPE_REGISTERED_OWNER"] : false,
                tenant: hasOwnershipColumns ? !!row["OWNERSHIP_TYPE_TENANT"] : false,
                lessee: hasOwnershipColumns ? !!row["OWNERSHIP_TYPE_LESSEE"] : false
            };

            let parcelAreaDisplay = '—';
            if (row["PARCEL AREA"]) {
                const areaStr = String(row["PARCEL AREA"]);
                const areaNum = parseFloat(areaStr);
                if (!isNaN(areaNum) && areaNum > 0) {
                    parcelAreaDisplay = `${areaNum.toFixed(2)} ha`;
                } else {
                    parcelAreaDisplay = areaStr;
                }
            }

            return {
                id: row.id,
                referenceNumber: row["FFRS_CODE"] || `RSBSA-${row.id}`,
                farmerName: fullName || '—',
                farmerAddress: `${row["BARANGAY"] || ''}, ${row["MUNICIPALITY"] || ''}`.replace(/^,\s*|,\s*$/g, '') || '—',
                farmLocation: row["FARM LOCATION"] || '—',
                gender: row["GENDER"] || '—',
                birthdate: row["BIRTHDATE"] || null,
                age: row.age || null,
                dateSubmitted: row.submitted_at || row.created_at,
                status: row.status || 'Not Active',
                parcelArea: parcelAreaDisplay,
                totalFarmArea: parseFloat(row["TOTAL FARM AREA"]) || 0,
                landParcel: parcelInfo,
                parcelCount: parseInt(row.parcel_count) || 0,
                ownershipType: ownershipType
            };
        });

        res.json(submissions);
    } catch (error) {
        console.error('Error fetching RSBSA submissions:', error);
        res.status(500).json({
            message: 'Error fetching RSBSA submissions',
            error: error.message
        });
    }
});

// ============================================================================
// GET /:id - Fetch a specific RSBSA submission by ID
// ============================================================================
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    // Skip if this looks like a special route (handled by other endpoints)
    if (id === 'farm_parcels') {
        return; // Let the farm_parcels route handle it
    }

    try {
        console.log(`Fetching RSBSA submission ${id}...`);

        const query = `SELECT * FROM rsbsa_submission WHERE id = $1`;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'RSBSA submission not found',
                message: `No RSBSA submission found with ID ${id}`
            });
        }

        const row = result.rows[0];

        const fullName = [
            row["LAST NAME"] || '',
            row["FIRST NAME"] || '',
            row["MIDDLE NAME"] || '',
            row["EXT NAME"] || ''
        ].filter(part => part).join(', ');

        const barangay = row["BARANGAY"] || '';
        const municipality = row["MUNICIPALITY"] || '';
        const province = row["PROVINCE"] || '';

        const submissionData = {
            id: row.id,
            referenceNumber: row["FFRS_CODE"] || `RSBSA-${row.id}`,
            farmerName: fullName,
            firstName: row["FIRST NAME"] || '',
            middleName: row["MIDDLE NAME"] || '',
            lastName: row["LAST NAME"] || '',
            extName: row["EXT NAME"] || '',
            gender: row["GENDER"] || '',
            birthdate: row["BIRTHDATE"] || '',
            age: row.age || null,
            mainLivelihood: row["MAIN LIVELIHOOD"] || '',
            farmerRice: row["FARMER_RICE"] || false,
            farmerCorn: row["FARMER_CORN"] || false,
            farmerOtherCrops: row["FARMER_OTHER_CROPS"] || false,
            farmerOtherCropsText: row["FARMER_OTHER_CROPS_TEXT"] || '',
            farmerLivestock: row["FARMER_LIVESTOCK"] || false,
            farmerLivestockText: row["FARMER_LIVESTOCK_TEXT"] || '',
            farmerPoultry: row["FARMER_POULTRY"] || false,
            farmerPoultryText: row["FARMER_POULTRY_TEXT"] || '',
            farmerAddress: [barangay, municipality, province].filter(Boolean).join(', ') || '',
            farmLocation: row["FARM LOCATION"] || barangay || '',
            parcelArea: row["PARCEL AREA"] || row["TOTAL FARM AREA"] || '',
            status: row.status || 'Not Active',
            dateSubmitted: row.submitted_at || row.created_at,
            ownershipType: {
                registeredOwner: row["OWNERSHIP_TYPE_REGISTERED_OWNER"] || false,
                tenant: row["OWNERSHIP_TYPE_TENANT"] || false,
                lessee: row["OWNERSHIP_TYPE_LESSEE"] || false
            },
            created_at: row.created_at,
            updated_at: row.updated_at
        };

        // Also fetch farm parcels for this submission
        const parcelsQuery = `
            SELECT * FROM rsbsa_farm_parcels 
            WHERE submission_id = $1
            ORDER BY parcel_number
        `;
        const parcelsResult = await pool.query(parcelsQuery, [id]);
        submissionData.farmParcels = parcelsResult.rows;

        res.json(submissionData);
    } catch (error) {
        console.error('Error fetching RSBSA submission:', error);
        res.status(500).json({
            message: 'Error fetching RSBSA submission',
            error: error.message
        });
    }
});

// ============================================================================
// PUT /:id - Update a specific RSBSA submission
// ============================================================================
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log('Updating RSBSA submission:', { id, updateData });

        let queryValues = [];
        const updateFields = [];
        let paramCounter = 1;

        // Check if only status is provided (e.g., from Masterlist toggle)
        if (Object.keys(updateData).length === 1 && updateData.status) {
            if (!['Active Farmer', 'Not Active'].includes(updateData.status)) {
                return res.status(400).json({
                    message: 'Invalid status value',
                    error: 'Status must be either "Active Farmer" or "Not Active"'
                });
            }

            const updateQuery = `
                UPDATE rsbsa_submission 
                SET status = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *;
            `;
            queryValues = [updateData.status, id];

            const result = await pool.query(updateQuery, queryValues);

            if (result.rowCount === 0) {
                return res.status(404).json({
                    message: 'Record not found',
                    error: 'No record found with the provided ID'
                });
            }

            return res.json({
                message: 'Status updated successfully',
                updatedRecord: result.rows[0]
            });
        }

        // Handle status if provided
        if (updateData.status) {
            if (!['Active Farmer', 'Not Active'].includes(updateData.status)) {
                return res.status(400).json({
                    message: 'Invalid status value',
                    error: 'Status must be either "Active Farmer" or "Not Active"'
                });
            }
            updateFields.push(`status = $${paramCounter}`);
            queryValues.push(updateData.status);
            paramCounter++;
        }

        // Handle farmer name components if provided
        if (updateData.farmerName) {
            const nameParts = updateData.farmerName.split(', ');
            const [lName, fName, mName, eName] = nameParts;

            updateFields.push('"LAST NAME" = $' + paramCounter);
            queryValues.push(lName || '');
            paramCounter++;

            updateFields.push('"FIRST NAME" = $' + paramCounter);
            queryValues.push(fName || '');
            paramCounter++;

            updateFields.push('"MIDDLE NAME" = $' + paramCounter);
            queryValues.push(mName || '');
            paramCounter++;

            updateFields.push('"EXT NAME" = $' + paramCounter);
            queryValues.push(eName || '');
            paramCounter++;
        }

        // Handle other fields
        if (updateData.gender) {
            updateFields.push('"GENDER" = $' + paramCounter);
            queryValues.push(updateData.gender);
            paramCounter++;
        }

        if (updateData.birthdate) {
            updateFields.push('"BIRTHDATE" = $' + paramCounter);
            queryValues.push(updateData.birthdate);
            paramCounter++;
        }

        if (updateData.farmLocation) {
            updateFields.push('"FARM LOCATION" = $' + paramCounter);
            queryValues.push(updateData.farmLocation);
            paramCounter++;
        }

        if (updateData.parcelArea) {
            const areaValue = updateData.parcelArea.replace(/\s*hectares\s*$/i, '').trim();
            if (!isNaN(parseFloat(areaValue))) {
                updateFields.push('"PARCEL AREA" = $' + paramCounter);
                queryValues.push(parseFloat(areaValue));
                paramCounter++;
            }
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                message: 'No valid fields to update',
                error: 'Please provide at least one field to update'
            });
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        const finalQuery = `
            UPDATE rsbsa_submission 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCounter}
            RETURNING *;
        `;
        queryValues.push(id);

        const result = await pool.query(finalQuery, queryValues);

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: 'Record not found',
                error: 'No record found with the provided ID'
            });
        }

        res.json({
            message: 'Record updated successfully',
            updatedRecord: result.rows[0]
        });

    } catch (error) {
        console.error('Error updating RSBSA submission:', error);
        res.status(500).json({
            message: 'Error updating RSBSA submission',
            error: error.message || 'Unknown error occurred',
            details: error.detail || 'No additional details available'
        });
    }
});

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