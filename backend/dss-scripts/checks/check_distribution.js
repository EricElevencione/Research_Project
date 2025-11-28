const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'postgresadmin',
    port: 5432
});

async function checkDistribution() {
    try {
        // Check distribution_system schema
        const schema = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'distribution_system'
            ORDER BY ordinal_position
        `);

        console.log('\ndistribution_system table columns:');
        schema.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type})`);
        });

        // Check sample rows
        const sample = await pool.query('SELECT * FROM distribution_system LIMIT 3');
        console.log('\nSample rows:');
        sample.rows.forEach(row => {
            console.log(JSON.stringify(row, null, 2));
        });
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkDistribution();
