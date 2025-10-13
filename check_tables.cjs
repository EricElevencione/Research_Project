const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'admin123',
    port: 5432,
});

async function checkTables() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();
        
        console.log('Checking existing tables...');
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log('Existing tables:');
        result.rows.forEach(row => {
            console.log(`- ${row.table_name}`);
        });
        
        // Check specifically for rsbsa_submission table
        const rsbsaCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'rsbsa_submission'
            );
        `);
        
        console.log(`\nrsbsa_submission table exists: ${rsbsaCheck.rows[0].exists}`);
        
        client.release();
        await pool.end();
        
    } catch (err) {
        console.error('Error:', err);
    }
}

checkTables();
