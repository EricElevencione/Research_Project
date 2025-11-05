const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'postgresadmin',
    port: 5432,
});

async function debugTransformation() {
    try {
        // Check table structure
        const columnResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'rsbsa_submission' 
            ORDER BY ordinal_position
        `);
        
        console.log('Available columns:', columnResult.rows.map(row => row.column_name));
        
        const hasJsonbColumn = columnResult.rows.some(row => row.column_name === 'data');
        const hasStructuredColumns = columnResult.rows.some(row => row.column_name === 'LAST NAME');
        const hasOwnershipColumns = columnResult.rows.some(row => row.column_name === 'OWNERSHIP_TYPE_REGISTERED_OWNER');
        
        console.log('Table structure check:', {
            hasJsonbColumn,
            hasStructuredColumns,
            hasOwnershipColumns
        });
        
        // Get a sample record with ownership data
        const result = await pool.query(`
            SELECT 
                id,
                "LAST NAME",
                "FIRST NAME", 
                "MIDDLE NAME",
                "EXT NAME",
                "GENDER",
                "BIRTHDATE",
                "BARANGAY",
                "MUNICIPALITY", 
                "FARM LOCATION",
                "PARCEL AREA",
                "TOTAL FARM AREA",
                "OWNERSHIP_TYPE_REGISTERED_OWNER",
                "OWNERSHIP_TYPE_TENANT",
                "OWNERSHIP_TYPE_LESSEE",
                status,
                submitted_at,
                created_at
            FROM rsbsa_submission 
            WHERE "OWNERSHIP_TYPE_REGISTERED_OWNER" = true
            LIMIT 3
        `);
        
        console.log('\nRaw database records with registeredOwner = true:');
        result.rows.forEach(row => {
            console.log(`ID: ${row.id}, Name: ${row["LAST NAME"]}, Registered: ${row["OWNERSHIP_TYPE_REGISTERED_OWNER"]}`);
        });
        
        // Transform the data like the backend does
        const transformed = result.rows.map(row => {
            const fullName = [row["LAST NAME"], row["FIRST NAME"], row["MIDDLE NAME"], row["EXT NAME"]]
                .filter(Boolean)
                .join(', ');

            const ownershipType = {
                registeredOwner: hasOwnershipColumns ? !!row["OWNERSHIP_TYPE_REGISTERED_OWNER"] : false,
                tenant: hasOwnershipColumns ? !!row["OWNERSHIP_TYPE_TENANT"] : false,
                lessee: hasOwnershipColumns ? !!row["OWNERSHIP_TYPE_LESSEE"] : false
            };
            
            console.log(`Transforming ${fullName}: ownershipType=`, ownershipType, `(hasOwnershipColumns=${hasOwnershipColumns})`);
            
            return {
                id: row.id,
                referenceNumber: `RSBSA-${row.id}`,
                farmerName: fullName || '—',
                ownershipType: ownershipType
            };
        });
        
        console.log('\nTransformed records:');
        transformed.forEach(record => {
            console.log(`ID: ${record.id}, Name: ${record.farmerName}, Registered: ${record.ownershipType.registeredOwner}`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

debugTransformation();

