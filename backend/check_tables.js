const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres.fbkihucbxeoxqysvrksq:Erice20050514@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'
});

const checkTables = async () => {
    try {
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('seasonal_allocations', 'demand_forecasts', 'historical_distributions', 'incentive_distribution_log')
            ORDER BY table_name
        `);

        console.log('\n=== Tables Found in Database ===');
        if (result.rows.length === 0) {
            console.log('None of these tables exist yet.');
        } else {
            result.rows.forEach(row => {
                console.log(`✓ ${row.table_name}`);
            });
        }
        console.log('================================\n');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
};

checkTables();
