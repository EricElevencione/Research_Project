const express = require('express');
const router = express.Router();

const { Pool } = require('pg');
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'Masterlist',
    password: process.env.DB_PASSWORD || 'postgresadmin',
    port: process.env.DB_PORT || 5432,
});

router.get('/', async (req, res) => {
    try {
        console.log('\n📋 GET /api/landowners - Fetching land owners list');

        // Check existence of tables and columns for querying
        const tableExists = async (tableName) => {
            const q = `
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = $1 
                ) AS exists;
            `;
            const r = await pool.query(q, [tableName]); // Query the database
            return Boolean(r?.rows?.[0]?.exists); // Return true if table exists
        };

        const rsbsaExists = await tableExists('rsbsa_submission'); // Check if RSBSA table exists
        if (!rsbsaExists) { // If table does not exist, return empty array
            console.log('⚠️ rsbsa_submission table does not exist'); // Log warning
            return res.json([]); // Return empty array
        }

        const columnsResult = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'rsbsa_submission'
        `);
        const rows = columnsResult.rows;
        const columnNames = rows.map(row => {
            return row.column_name;
        }); // Extract column names
        const hasLast = columnNames.includes('LAST NAME'); // Check for LAST NAME column and so on
        const hasFirst = columnNames.includes('FIRST NAME');
        const hasMiddle = columnNames.includes('MIDDLE NAME');
        const hasExt = columnNames.includes('EXT NAME');
        const hasOwnerFlag = columnNames.includes('OWNERSHIP_TYPE_REGISTERED_OWNER');
        const hasBarangay = columnNames.includes('BARANGAY');
        const hasMunicipality = columnNames.includes('MUNICIPALITY');

        console.log('📊 Table columns available:', {
            hasLast,
            hasFirst,
            hasMiddle,
            hasExt,
            hasOwnerFlag,
            hasBarangay,
            hasMunicipality
        });

        const farmParcelsExists = await tableExists('farm_parcels');

        const subSelects = [];

        // Build SELECT for parcels path if table exists
        if (farmParcelsExists && hasLast && hasFirst) {
            subSelects.push(`
                SELECT DISTINCT
                    rs.id,
                    TRIM(BOTH ', ' FROM (
                        COALESCE(rs."LAST NAME", '') || ', ' || COALESCE(rs."FIRST NAME", '') ||
                        ${hasMiddle ? `CASE WHEN COALESCE(rs."MIDDLE NAME", '') <> '' THEN ' ' || rs."MIDDLE NAME" ELSE '' END ||` : `'' ||`}
                        ${hasExt ? `CASE WHEN COALESCE(rs."EXT NAME", '') <> '' THEN ' ' || rs."EXT NAME" ELSE '' END` : `''`}
                    )) AS name,
                    ${hasBarangay ? `rs."BARANGAY"` : `''`} AS barangay,
                    ${hasMunicipality ? `rs."MUNICIPALITY"` : `''`} AS municipality
                FROM rsbsa_submission rs
                WHERE EXISTS (
                    SELECT 1 FROM farm_parcels fp
                    WHERE fp.submission_id = rs.id
                      AND COALESCE(fp.ownership_type_registered_owner, false) = true
                )
                  AND LENGTH(TRIM(BOTH ' ' FROM (
                        COALESCE(rs."LAST NAME", '') || COALESCE(rs."FIRST NAME", '')
                  ))) > 0
            `);
        }

        // Build SELECT for submission-level flag if column exists
        if (hasOwnerFlag && hasLast && hasFirst) {
            subSelects.push(`
                SELECT DISTINCT
                    id,
                    TRIM(BOTH ', ' FROM (
                        COALESCE("LAST NAME", '') || ', ' || COALESCE("FIRST NAME", '') ||
                        ${hasMiddle ? `CASE WHEN COALESCE("MIDDLE NAME", '') <> '' THEN ' ' || "MIDDLE NAME" ELSE '' END ||` : `'' ||`}
                        ${hasExt ? `CASE WHEN COALESCE("EXT NAME", '') <> '' THEN ' ' || "EXT NAME" ELSE '' END` : `''`}
                    )) AS name,
                    ${hasBarangay ? `"BARANGAY"` : `''`} AS barangay,
                    ${hasMunicipality ? `"MUNICIPALITY"` : `''`} AS municipality
                FROM rsbsa_submission
                WHERE COALESCE("OWNERSHIP_TYPE_REGISTERED_OWNER", false) = true
                  AND LENGTH(TRIM(BOTH ' ' FROM (
                        COALESCE("LAST NAME", '') || COALESCE("FIRST NAME", '')
                  ))) > 0
            `);
        }

        if (!subSelects.length) {
            // Not enough structure to build names
            console.log('⚠️ Not enough columns to build names');
            return res.json([]);
        }

        const finalQuery = `
            SELECT DISTINCT id, name, barangay, municipality
            FROM (
                ${subSelects.join('\n                UNION ALL\n')}
            ) owners
            WHERE name IS NOT NULL AND name <> ''
            ORDER BY name;
        `;

        const result = await pool.query(finalQuery);
        console.log(`✅ Found ${result.rows.length} land owners`);
        if (result.rows.length <= 5) {
            console.log('Land owners:', JSON.stringify(result.rows, null, 2));
        } else {
            console.log('First 5 land owners:', JSON.stringify(result.rows.slice(0, 5), null, 2));
        }
        res.json(result.rows || []);
    } catch (error) {
        console.error('❌ Error fetching landowners:', error.message);
        res.status(500).json({ error: 'Failed to fetch landowners' });
    }
});

module.exports = router;
// Delete RSBSA record endpoint
router.delete('/api/rsbsa_submission/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Convert string ID to integer for PostgreSQL
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) {
            return res.status(400).json({
                error: 'Invalid ID format',
                message: 'The provided ID must be a number'
            });
        }

        const result = await pool.query(
            'DELETE FROM rsbsa_submission WHERE id = $1 RETURNING *',
            [numericId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                error: 'Record not found',
                message: 'The specified RSBSA record was not found.'
            });
        }

        res.json({
            message: 'Record deleted successfully',
            deletedRecord: result.rows[0]
        });
    } catch (error) {
        console.error('Error deleting record:', error);
        res.status(500).json({
            error: 'Database error',
            message: 'Failed to delete the record'
        });
    }
});
module.exports = router;