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
// TRANSFER OWNERSHIP API ENDPOINT
// ============================================================================

/**
 * POST /api/transfer-ownership
 * Transfers land ownership from one farmer to another (new or existing)
 */
router.post('/', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const {
            oldOwnerId,
            selectedParcelIds,
            transferReason,
            transferDate,
            newOwnerOption,
            newOwnerId,
            newFarmerData
        } = req.body;

        console.log('\n========================================');
        console.log('🔄 TRANSFER OWNERSHIP REQUEST');
        console.log('========================================');
        console.log('Request Body:', JSON.stringify(req.body, null, 2));
        console.log('Old Owner ID:', oldOwnerId);
        console.log('New Owner Option:', newOwnerOption);
        console.log('New Owner ID:', newOwnerId);
        console.log('Selected Parcel IDs:', selectedParcelIds);
        console.log('Transfer Reason:', transferReason);
        console.log('Transfer Date:', transferDate);

        // Validate required fields
        if (!oldOwnerId || !transferReason || !transferDate) {
            throw new Error('Missing required fields: oldOwnerId, transferReason, or transferDate');
        }

        if (!selectedParcelIds || selectedParcelIds.length === 0) {
            throw new Error('At least one parcel must be selected for transfer');
        }

        let finalNewOwnerId = newOwnerId;

        // If creating a new farmer, insert into database
        if (newOwnerOption === 'new') {
            if (!newFarmerData) {
                throw new Error('New farmer data is required when creating a new owner');
            }

            console.log('\n📝 Creating new farmer...');
            console.log('New Farmer Data:', JSON.stringify(newFarmerData, null, 2));

            // Generate FFRS code for new farmer
            const ffrsQuery = `
                SELECT COALESCE(MAX(CAST(SUBSTRING("FFRS_CODE" FROM 16) AS INTEGER)), 0) + 1 as next_number
                FROM rsbsa_submission
                WHERE "FFRS_CODE" LIKE '06-30-18-%'
            `;
            const ffrsResult = await client.query(ffrsQuery);
            const nextNumber = ffrsResult.rows[0].next_number;
            const barangayCode = '007'; // Default, you can map this based on barangay
            const newFfrsCode = `06-30-18-${barangayCode}-${String(nextNumber).padStart(6, '0')}`;

            console.log('Generated FFRS Code:', newFfrsCode);

            // Insert new farmer
            const insertQuery = `
                INSERT INTO rsbsa_submission (
                    "FIRST NAME",
                    "LAST NAME",
                    "MIDDLE NAME",
                    "EXT NAME",
                    "BARANGAY",
                    "MUNICIPALITY",
                    "BIRTHDATE",
                    "GENDER",
                    "FFRS_CODE",
                    "OWNERSHIP_TYPE_REGISTERED_OWNER",
                    status,
                    submitted_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, 'Active Farmer', CURRENT_TIMESTAMP)
                RETURNING id
            `;

            const insertResult = await client.query(insertQuery, [
                newFarmerData.firstName,
                newFarmerData.lastName,
                newFarmerData.middleName || null,
                newFarmerData.extensionName || null,
                newFarmerData.barangay,
                newFarmerData.municipality,
                newFarmerData.birthdate,
                newFarmerData.gender,
                newFfrsCode
            ]);

            finalNewOwnerId = insertResult.rows[0].id;
            console.log('✅ New farmer created with ID:', finalNewOwnerId);
        } else {
            console.log('\n👤 Using existing farmer ID:', finalNewOwnerId);
        }

        // Check if all parcels of old owner are being transferred
        const allParcelsQuery = `
            SELECT COUNT(*) as total
            FROM rsbsa_farm_parcels
            WHERE submission_id = $1
        `;
        const allParcelsResult = await client.query(allParcelsQuery, [oldOwnerId]);
        const totalParcels = parseInt(allParcelsResult.rows[0].total);
        const transferringAllParcels = selectedParcelIds.length >= totalParcels;

        console.log('\n📊 Parcel Analysis:');
        console.log('Total parcels owned by old owner:', totalParcels);
        console.log('Parcels being transferred:', selectedParcelIds.length);
        console.log('Transferring all parcels?', transferringAllParcels);

        // Update old owner - mark as transferred only if all parcels are transferred
        if (transferringAllParcels) {
            console.log('\n🔄 Updating old owner status (all parcels transferred)...');
            const updateOldOwnerQuery = `
                UPDATE rsbsa_submission
                SET 
                    "OWNERSHIP_TYPE_REGISTERED_OWNER" = false,
                    status = 'No Parcels'
                WHERE id = $1
                RETURNING id, "FIRST NAME", "LAST NAME", status, "OWNERSHIP_TYPE_REGISTERED_OWNER"
            `;
            const oldOwnerUpdateResult = await client.query(updateOldOwnerQuery, [oldOwnerId]);
            console.log('✅ Old owner updated:', oldOwnerUpdateResult.rows[0]);

            // Verify the update
            const verifyOldOwner = await client.query(`
                SELECT id, "FIRST NAME", "LAST NAME", status, "OWNERSHIP_TYPE_REGISTERED_OWNER"
                FROM rsbsa_submission WHERE id = $1
            `, [oldOwnerId]);
            console.log('🔍 Verification - Old owner in DB:', verifyOldOwner.rows[0]);
        } else {
            console.log('\n⚠️ Old owner keeps remaining parcels - status stays Active Farmer');
        }

        // Remove tenant/lessee status from new owner if they were tenant/lessee
        console.log('\n🔄 Updating new owner status...');
        const updateNewOwnerQuery = `
            UPDATE rsbsa_submission
            SET 
                "OWNERSHIP_TYPE_REGISTERED_OWNER" = true,
                "OWNERSHIP_TYPE_TENANT" = false,
                "OWNERSHIP_TYPE_LESSEE" = false,
                status = 'Active Farmer'
            WHERE id = $1
            RETURNING id, "FIRST NAME", "LAST NAME", status, 
                      "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE"
        `;
        const newOwnerUpdateResult = await client.query(updateNewOwnerQuery, [finalNewOwnerId]);
        console.log('✅ New owner updated:', newOwnerUpdateResult.rows[0]);

        // Get old owner's name for history records
        console.log('\n👤 Fetching owner names...');
        const oldOwnerResult = await client.query(`
            SELECT "FIRST NAME", "LAST NAME", "MIDDLE NAME" 
            FROM rsbsa_submission 
            WHERE id = $1
        `, [oldOwnerId]);

        const oldOwnerName = oldOwnerResult.rows[0]
            ? `${oldOwnerResult.rows[0]['LAST NAME']}, ${oldOwnerResult.rows[0]['FIRST NAME']} ${oldOwnerResult.rows[0]['MIDDLE NAME'] || ''}`.trim()
            : 'Unknown';

        console.log('Old owner name:', oldOwnerName);

        // Get new owner's name
        const newOwnerResult = await client.query(`
            SELECT "FIRST NAME", "LAST NAME", "MIDDLE NAME" 
            FROM rsbsa_submission 
            WHERE id = $1
        `, [finalNewOwnerId]);

        const newOwnerName = newOwnerResult.rows[0]
            ? `${newOwnerResult.rows[0]['LAST NAME']}, ${newOwnerResult.rows[0]['FIRST NAME']} ${newOwnerResult.rows[0]['MIDDLE NAME'] || ''}`.trim()
            : 'Unknown';

        console.log('New owner name:', newOwnerName);

        // Update only selected farm parcels
        console.log('\n🔄 Transferring parcels...');
        console.log('Updating submission_id from', oldOwnerId, 'to', finalNewOwnerId);
        console.log('For parcel IDs:', selectedParcelIds);

        const updateParcelsQuery = `
            UPDATE rsbsa_farm_parcels
            SET submission_id = $1
            WHERE id = ANY($2::int[])
            RETURNING id, parcel_number, farm_location_barangay, submission_id
        `;
        const parcelsUpdateResult = await client.query(updateParcelsQuery, [finalNewOwnerId, selectedParcelIds]);
        console.log('✅ Parcels updated:', parcelsUpdateResult.rowCount, 'rows affected');
        console.log('Updated parcels:', JSON.stringify(parcelsUpdateResult.rows, null, 2));

        // Update tenant/lessee land owner names
        console.log('\n🔄 Updating tenant/lessee land owner names...');
        console.log('Searching for ALL tenants with land_owner_name:', oldOwnerName);

        const updateTenantsQuery = `
            UPDATE rsbsa_farm_parcels
            SET tenant_land_owner_name = $1
            WHERE tenant_land_owner_name = $2
              AND ownership_type_tenant = true
            RETURNING id, parcel_number, submission_id, tenant_land_owner_name
        `;
        const tenantsUpdateResult = await client.query(updateTenantsQuery, [newOwnerName, oldOwnerName]);
        console.log('✅ Tenant land owner names updated:', tenantsUpdateResult.rowCount, 'rows affected');
        if (tenantsUpdateResult.rowCount > 0) {
            console.log('Updated tenant parcels:', JSON.stringify(tenantsUpdateResult.rows, null, 2));
        }

        console.log('Searching for ALL lessees with land_owner_name:', oldOwnerName);
        const updateLesseesQuery = `
            UPDATE rsbsa_farm_parcels
            SET lessee_land_owner_name = $1
            WHERE lessee_land_owner_name = $2
              AND ownership_type_lessee = true
            RETURNING id, parcel_number, submission_id, lessee_land_owner_name
        `;
        const lesseesUpdateResult = await client.query(updateLesseesQuery, [newOwnerName, oldOwnerName]);
        console.log('✅ Lessee land owner names updated:', lesseesUpdateResult.rowCount, 'rows affected');
        if (lesseesUpdateResult.rowCount > 0) {
            console.log('Updated lessee parcels:', JSON.stringify(lesseesUpdateResult.rows, null, 2));
        }

        // Create ownership transfer history record
        console.log('\n📝 Creating ownership transfer history...');
        const createHistoryQuery = `
            INSERT INTO ownership_transfers (
                from_farmer_id,
                to_farmer_id,
                transfer_date,
                transfer_type,
                transfer_reason,
                notes,
                created_at
            ) VALUES ($1, $2, $3, 'ownership_change', $4, $5, NOW())
            RETURNING id
        `;

        try {
            const parcelInfo = `Transferred ${selectedParcelIds.length} parcel(s): IDs ${selectedParcelIds.join(', ')}`;
            const historyResult = await client.query(createHistoryQuery, [
                oldOwnerId,
                finalNewOwnerId,
                transferDate,
                transferReason,
                parcelInfo
            ]);
            console.log(`✅ History record created with ID: ${historyResult.rows[0].id}`);
            console.log(`   Parcels transferred: ${selectedParcelIds.join(', ')}`);
        } catch (historyError) {
            console.log('⚠️ Could not create history record:', historyError.message);
            // Don't throw - history is optional, continue with transaction
        }

        await client.query('COMMIT');
        console.log('\n✅ TRANSACTION COMMITTED SUCCESSFULLY');
        console.log('========================================\n');

        res.json({
            success: true,
            message: 'Ownership transferred successfully',
            oldOwnerId,
            newOwnerId: finalNewOwnerId,
            newOwnerName,
            parcelsTransferred: selectedParcelIds.length,
            allParcelsTransferred: transferringAllParcels
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ ERROR IN TRANSFER OWNERSHIP:');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('========================================\n');
        res.status(500).json({
            error: 'Failed to transfer ownership',
            message: error.message
        });
    } finally {
        client.release();
    }
});

module.exports = router;
