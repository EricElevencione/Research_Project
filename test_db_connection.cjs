const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'admin123',
    port: 5432,
});

async function testRSBSAQuery() {
    try {
        console.log('Testing RSBSA submission query...');
        const client = await pool.connect();
        
        // Test the exact query from the backend
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'rsbsa_submission'
            );
        `);
        
        console.log('Table exists check result:', tableCheck.rows[0].exists);
        
        if (tableCheck.rows[0].exists) {
            // Check columns
            const columnCheckQuery = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'rsbsa_submission' 
                ORDER BY ordinal_position
            `;
            const columnResult = await client.query(columnCheckQuery);
            console.log('Available columns:', columnResult.rows.map(row => row.column_name));
            
            // Check if there's any data
            const countResult = await client.query('SELECT COUNT(*) FROM rsbsa_submission');
            console.log('Total records:', countResult.rows[0].count);
        }
        
        client.release();
        await pool.end();
        
    } catch (err) {
        console.error('Error:', err);
    }
}

testRSBSAQuery();
