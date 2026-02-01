const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'postgresadmin',
    port: 5432
});

async function cleanupOrphans() {
    try {
        // Delete orphaned land_plots
        const result = await pool.query(`
            DELETE FROM land_plots lp
            WHERE NOT EXISTS (
                SELECT 1 FROM rsbsa_submission rs
                WHERE LOWER(TRIM(COALESCE(rs."LAST NAME", ''))) = LOWER(TRIM(COALESCE(lp.surname, '')))
                AND LOWER(TRIM(COALESCE(rs."FIRST NAME", ''))) = LOWER(TRIM(COALESCE(lp.first_name, '')))
                AND LOWER(TRIM(COALESCE(rs."BARANGAY", ''))) = LOWER(TRIM(COALESCE(lp.barangay, '')))
            )
            RETURNING id, surname, first_name, barangay
        `);
        console.log('Deleted orphaned land plots:', result.rows);
        console.log('Count:', result.rowCount);

        // Verify remaining
        const remaining = await pool.query('SELECT id, surname, first_name, barangay FROM land_plots');
        console.log('\nRemaining land_plots:', remaining.rows);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

cleanupOrphans();
