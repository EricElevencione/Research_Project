const { Pool } = require('pg');
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'Masterlist',
    user: 'postgres',
    password: 'postgresadmin'
});

async function testNameFormat() {
    try {
        // Test with Antonio Castro Bautista
        const result = await pool.query(`
            SELECT 
                "FIRST NAME", 
                "MIDDLE NAME", 
                "LAST NAME",
                TRIM(
                    CONCAT_WS(', ',
                        NULLIF(TRIM(CONCAT_WS(' ', "FIRST NAME", "MIDDLE NAME")), ''),
                        NULLIF(TRIM("LAST NAME"), '')
                    )
                ) as formatted_name
            FROM rsbsa_submission
            WHERE "FIRST NAME" ILIKE '%Antonio%' AND "LAST NAME" ILIKE '%Bautista%'
            LIMIT 5
        `);
        console.log('Antonio Bautista records from database:');
        result.rows.forEach(row => {
            console.log('  First: "' + row["FIRST NAME"] + '", Middle: "' + row["MIDDLE NAME"] + '", Last: "' + row["LAST NAME"] + '"');
            console.log('  Formatted: "' + row.formatted_name + '"');
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

testNameFormat();
