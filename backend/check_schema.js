const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'postgresadmin',
    port: 5432
});

async function checkSchema() {
    try {
        // Check farmer_requests schema
        const schema = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'farmer_requests'
            ORDER BY ordinal_position
        `);

        console.log('\nfarmer_requests table columns:');
        schema.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type})`);
        });

        // Check a sample row
        const sample = await pool.query('SELECT * FROM farmer_requests LIMIT 1');
        if (sample.rows.length > 0) {
            console.log('\nSample row keys:');
            console.log(Object.keys(sample.rows[0]));
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkSchema();
