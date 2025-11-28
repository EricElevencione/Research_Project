const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'postgresadmin',
    port: 5432
});

async function findTables() {
    try {
        // List all tables
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        console.log('\nAll tables in database:');
        tables.rows.forEach(t => {
            console.log(`  - ${t.table_name}`);
        });

        // Check for allocation-related tables
        console.log('\n\nLooking for data in farmer_requests:');
        const requests = await pool.query(`
            SELECT COUNT(*), season, status 
            FROM farmer_requests 
            GROUP BY season, status
        `);
        console.log(requests.rows);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

findTables();
