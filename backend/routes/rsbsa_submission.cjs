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

module.exports = router;