const { Pool } = require('pg');
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'Masterlist',
    user: 'postgres',
    password: 'postgresadmin'
});

async function checkTenants() {
    try {
        // First get all columns in rsbsa_farm_parcels
        const colsResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'rsbsa_farm_parcels'
        `);
        console.log('All columns in rsbsa_farm_parcels:');
        console.log(colsResult.rows.map(r => r.column_name));

        // Check farm parcels with tenant/lessee data
        const parcelsResult = await pool.query(`
            SELECT *
            FROM rsbsa_farm_parcels 
            WHERE tenant_land_owner_name IS NOT NULL 
               OR lessee_land_owner_name IS NOT NULL
            LIMIT 5
        `);
        console.log('\nFarm parcels with tenant/lessee links:');
        console.log(JSON.stringify(parcelsResult.rows, null, 2));

        // Check tenants in rsbsa_submission
        const tenantsResult = await pool.query(`
            SELECT id, "FIRST NAME", "LAST NAME", "BARANGAY"
            FROM rsbsa_submission 
            WHERE "OWNERSHIP_TYPE_TENANT" = true OR "OWNERSHIP_TYPE_LESSEE" = true
        `);
        console.log('\nAll tenants/lessees in rsbsa_submission:');
        console.log(JSON.stringify(tenantsResult.rows, null, 2));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkTenants();
