const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'postgresadmin',
    port: 5432,
});

async function checkOwnership() {
    try {
        const result = await pool.query(`
            SELECT id, "LAST NAME", "OWNERSHIP_TYPE_REGISTERED_OWNER", "OWNERSHIP_TYPE_TENANT", "OWNERSHIP_TYPE_LESSEE" 
            FROM rsbsa_submission 
            LIMIT 10
        `);
        
        console.log('Sample ownership data:');
        result.rows.forEach(row => {
            console.log(`ID: ${row.id}, Name: ${row["LAST NAME"]}, Registered Owner: ${row["OWNERSHIP_TYPE_REGISTERED_OWNER"]}, Tenant: ${row["OWNERSHIP_TYPE_TENANT"]}, Lessee: ${row["OWNERSHIP_TYPE_LESSEE"]}`);
        });
        
        // Also check the count of records with registered owner = true
        const countResult = await pool.query(`
            SELECT COUNT(*) as count 
            FROM rsbsa_submission 
            WHERE "OWNERSHIP_TYPE_REGISTERED_OWNER" = true
        `);
        
        console.log(`\nRecords with registeredOwner = true: ${countResult.rows[0].count}`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkOwnership();

