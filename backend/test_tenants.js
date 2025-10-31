const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'postgresadmin',
    port: 5432
});

async function checkTenants() {
    try {
        console.log('=== CHECKING TENANTS/LESSEES ===\n');

        const result = await pool.query(`
            SELECT 
                fp.id,
                rs."LAST NAME" || ', ' || rs."FIRST NAME" || 
                    CASE WHEN rs."MIDDLE NAME" IS NOT NULL AND rs."MIDDLE NAME" != '' 
                    THEN ' ' || rs."MIDDLE NAME" 
                    ELSE '' END as tenant_name,
                fp.ownership_type_tenant,
                fp.ownership_type_lessee,
                fp.tenant_land_owner_name,
                fp.lessee_land_owner_name,
                fp.farm_location_barangay,
                fp.total_farm_area_ha,
                fp.created_at
            FROM rsbsa_farm_parcels fp
            JOIN rsbsa_submission rs ON fp.submission_id = rs.id
            WHERE fp.ownership_type_tenant = true OR fp.ownership_type_lessee = true
            ORDER BY fp.created_at DESC
            LIMIT 10
        `);

        console.log(`Found ${result.rows.length} tenant/lessee records:\n`);
        result.rows.forEach((row, idx) => {
            console.log(`${idx + 1}. ${row.tenant_name}`);
            console.log(`   Land Owner: ${row.tenant_land_owner_name || row.lessee_land_owner_name}`);
            console.log(`   Type: ${row.ownership_type_tenant ? 'Tenant' : 'Lessee'}`);
            console.log(`   Location: ${row.farm_location_barangay}`);
            console.log(`   Area: ${row.total_farm_area_ha} ha`);
            console.log(`   Created: ${row.created_at}`);
            console.log('');
        });

        console.log('\n=== CHECKING LAND OWNERS ===\n');

        const owners = await pool.query(`
            SELECT DISTINCT 
                rs.id,
                rs."LAST NAME" || ', ' || rs."FIRST NAME" || 
                    CASE WHEN rs."MIDDLE NAME" IS NOT NULL AND rs."MIDDLE NAME" != '' 
                    THEN ' ' || rs."MIDDLE NAME" 
                    ELSE '' END as owner_name
            FROM rsbsa_submission rs
            WHERE rs."OWNERSHIP_TYPE_REGISTERED_OWNER" = true
            ORDER BY rs.id DESC
            LIMIT 10
        `);

        console.log(`Found ${owners.rows.length} land owners:\n`);
        owners.rows.forEach((row, idx) => {
            console.log(`${idx + 1}. ID: ${row.id} - ${row.owner_name}`);
        });

        await pool.end();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkTenants();
