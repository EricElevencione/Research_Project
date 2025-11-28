const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'postgresadmin',
    port: 5432
});

async function checkAllocations() {
    try {
        // Check regional_allocations
        console.log('\n=== regional_allocations table ===');
        const allocSchema = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'regional_allocations'
            ORDER BY ordinal_position
        `);
        allocSchema.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type})`);
        });

        const allocSample = await pool.query('SELECT * FROM regional_allocations LIMIT 2');
        console.log('\nSample data:');
        allocSample.rows.forEach(row => console.log(JSON.stringify(row, null, 2)));

        // Check distribution_records
        console.log('\n\n=== distribution_records table ===');
        const distSchema = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'distribution_records'
            ORDER BY ordinal_position
        `);
        distSchema.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type})`);
        });

        const distSample = await pool.query('SELECT * FROM distribution_records LIMIT 2');
        console.log('\nSample data:');
        distSample.rows.forEach(row => console.log(JSON.stringify(row, null, 2)));

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

checkAllocations();
