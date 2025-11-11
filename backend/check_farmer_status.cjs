// Quick script to check the current status of farmers in database
const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'postgresadmin',
    port: 5432
});

async function checkFarmers() {
    try {
        console.log('\n=== CHECKING FARMER STATUS IN DATABASE ===\n');

        // Check farmer ID 6 (old owner)
        const farmer6 = await pool.query(`
            SELECT 
                id,
                "FIRST NAME",
                "LAST NAME",
                status,
                "OWNERSHIP_TYPE_REGISTERED_OWNER",
                "OWNERSHIP_TYPE_TENANT",
                "OWNERSHIP_TYPE_LESSEE"
            FROM rsbsa_submission
            WHERE id = 6
        `);

        console.log('Farmer ID 6 (asdf, Eleve):');
        console.log(JSON.stringify(farmer6.rows[0], null, 2));

        // Check farmer ID 32 (new owner)
        const farmer32 = await pool.query(`
            SELECT 
                id,
                "FIRST NAME",
                "LAST NAME",
                status,
                "OWNERSHIP_TYPE_REGISTERED_OWNER",
                "OWNERSHIP_TYPE_TENANT",
                "OWNERSHIP_TYPE_LESSEE"
            FROM rsbsa_submission
            WHERE id = 32
        `);

        console.log('\nFarmer ID 32 (Thompson, Elizabeth):');
        console.log(JSON.stringify(farmer32.rows[0], null, 2));

        // Check parcels 5 and 6
        const parcels = await pool.query(`
            SELECT 
                id,
                parcel_number,
                farm_location_barangay,
                submission_id
            FROM rsbsa_farm_parcels
            WHERE id IN (5, 6)
        `);

        console.log('\nParcels 5 and 6:');
        console.log(JSON.stringify(parcels.rows, null, 2));

        // Check ownership_transfers table
        const history = await pool.query(`
            SELECT 
                id,
                from_farmer_id,
                to_farmer_id,
                transfer_date,
                transfer_reason,
                notes
            FROM ownership_transfers
            ORDER BY created_at DESC
            LIMIT 5
        `);

        console.log('\nRecent ownership transfers:');
        console.log(JSON.stringify(history.rows, null, 2));

        console.log('\n=== END ===\n');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkFarmers();
