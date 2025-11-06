const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'postgresadmin',
    port: 5432,
});

async function debugAPILogic() {
    try {
        // Check table structure exactly like the backend does
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
        
        // Determine which query path the backend would take
        let query;
        if (hasJsonbColumn && !hasStructuredColumns) {
            console.log('Backend would use JSONB table structure');
            query = `
                SELECT 
                    id,
                    data,
                    submitted_at,
                    created_at
                FROM rsbsa_submission 
                WHERE data IS NOT NULL 
                ORDER BY submitted_at DESC
            `;
        } else {
            console.log('Backend would use structured table');
            let selectFields = `
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
                "MAIN LIVELIHOOD",
                status,
                submitted_at,
                created_at,
                updated_at
            `;
            
            if (hasOwnershipColumns) {
                selectFields += `,
                "OWNERSHIP_TYPE_REGISTERED_OWNER",
                "OWNERSHIP_TYPE_TENANT",
                "OWNERSHIP_TYPE_LESSEE"`;
            }
            
            query = `
                SELECT ${selectFields}
                FROM rsbsa_submission 
                WHERE "LAST NAME" IS NOT NULL 
                ORDER BY submitted_at DESC
            `;
        }
        
        console.log('\nQuery that backend would execute:');
        console.log(query);
        
        const result = await pool.query(query);
        console.log(`\nFound ${result.rows.length} records`);
        
        // Transform like the backend does
        const submissions = result.rows.map(row => {
            if (hasJsonbColumn && !hasStructuredColumns) {
                console.log('Processing JSONB record (should not happen based on our table structure)');
                return {
                    id: row.id,
                    ownershipType: {
                        registeredOwner: false,
                        tenant: false,
                        lessee: false
                    }
                };
            } else {
                const fullName = [row["LAST NAME"], row["FIRST NAME"], row["MIDDLE NAME"], row["EXT NAME"]]
                    .filter(Boolean)
                    .join(', ');

                const ownershipType = {
                    registeredOwner: hasOwnershipColumns ? !!row["OWNERSHIP_TYPE_REGISTERED_OWNER"] : false,
                    tenant: hasOwnershipColumns ? !!row["OWNERSHIP_TYPE_TENANT"] : false,
                    lessee: hasOwnershipColumns ? !!row["OWNERSHIP_TYPE_LESSEE"] : false
                };
                
                console.log(`Processing ${fullName}: ownershipType=`, ownershipType, `(hasOwnershipColumns=${hasOwnershipColumns})`);

                return {
                    id: row.id,
                    referenceNumber: `RSBSA-${row.id}`,
                    farmerName: fullName || '—',
                    ownershipType: ownershipType
                };
            }
        });
        
        // Count registered owners
        const registeredOwners = submissions.filter(sub => sub.ownershipType.registeredOwner === true);
        console.log(`\nTotal submissions: ${submissions.length}`);
        console.log(`Registered owners: ${registeredOwners.length}`);
        
        if (registeredOwners.length > 0) {
            console.log('\nFirst few registered owners:');
            registeredOwners.slice(0, 3).forEach(owner => {
                console.log(`ID: ${owner.id}, Name: ${owner.farmerName}`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

debugAPILogic();

