const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'postgresadmin',
    port: 5432
});

async function testMatching() {
    try {
        console.log('=== TESTING NAME MATCHING ===\n');

        // Test the exact query from the API with the fuzzy matching
        const query = `
            WITH land_owners AS (
                SELECT DISTINCT 
                    rs.id as owner_id,
                    rs."LAST NAME" || ', ' || rs."FIRST NAME" || 
                        CASE WHEN rs."MIDDLE NAME" IS NOT NULL AND rs."MIDDLE NAME" != '' 
                        THEN ' ' || rs."MIDDLE NAME" 
                        ELSE '' END as owner_name,
                    rs."FIRST NAME" as first_name,
                    rs."LAST NAME" as last_name,
                    rs."MIDDLE NAME" as middle_name
                FROM rsbsa_submission rs
                WHERE rs."OWNERSHIP_TYPE_REGISTERED_OWNER" = true
            ),
            tenants_lessees AS (
                SELECT 
                    fp.id,
                    fp.submission_id,
                    CASE 
                        WHEN fp.ownership_type_tenant THEN fp.tenant_land_owner_name
                        WHEN fp.ownership_type_lessee THEN fp.lessee_land_owner_name
                        ELSE NULL
                    END as land_owner_name,
                    rs."LAST NAME" || ', ' || rs."FIRST NAME" || 
                        CASE WHEN rs."MIDDLE NAME" IS NOT NULL AND rs."MIDDLE NAME" != '' 
                        THEN ' ' || rs."MIDDLE NAME" 
                        ELSE '' END as tenant_lessee_name,
                    CASE 
                        WHEN fp.ownership_type_tenant THEN 'Tenant'
                        WHEN fp.ownership_type_lessee THEN 'Lessee'
                        ELSE NULL
                    END as relationship_type,
                    fp.farm_location_barangay,
                    fp.total_farm_area_ha,
                    fp.created_at
                FROM rsbsa_farm_parcels fp
                JOIN rsbsa_submission rs ON fp.submission_id = rs.id
                WHERE (fp.ownership_type_tenant = true OR fp.ownership_type_lessee = true)
                    AND (fp.tenant_land_owner_name IS NOT NULL OR fp.lessee_land_owner_name IS NOT NULL)
            )
            SELECT 
                lo.owner_id,
                lo.owner_name,
                lo.first_name,
                lo.last_name,
                lo.middle_name,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', tl.id,
                            'name', tl.tenant_lessee_name,
                            'type', tl.relationship_type,
                            'location', tl.farm_location_barangay,
                            'area', tl.total_farm_area_ha,
                            'createdAt', tl.created_at
                        ) ORDER BY tl.created_at DESC
                    ) FILTER (WHERE tl.id IS NOT NULL),
                    '[]'::json
                ) as tenants_lessees
            FROM land_owners lo
            LEFT JOIN tenants_lessees tl ON (
                LOWER(TRIM(lo.owner_name)) = LOWER(TRIM(tl.land_owner_name))
                OR LOWER(TRIM(tl.land_owner_name)) LIKE LOWER(TRIM(lo.owner_name)) || '%'
                OR LOWER(TRIM(lo.owner_name)) LIKE LOWER(TRIM(tl.land_owner_name)) || '%'
            )
            GROUP BY lo.owner_id, lo.owner_name, lo.first_name, lo.last_name, lo.middle_name
            ORDER BY lo.last_name, lo.first_name;
        `;

        const result = await pool.query(query);

        // Filter to show only owners with tenants
        const ownersWithTenants = result.rows.filter(owner => owner.tenants_lessees.length > 0);

        console.log(`Total land owners: ${result.rows.length}`);
        console.log(`Land owners with tenants/lessees: ${ownersWithTenants.length}\n`);

        if (ownersWithTenants.length > 0) {
            console.log('✅ SUCCESS! Found matches:\n');
            ownersWithTenants.forEach((owner, idx) => {
                console.log(`${idx + 1}. ${owner.owner_name} (ID: ${owner.owner_id})`);
                console.log(`   Has ${owner.tenants_lessees.length} tenant(s)/lessee(s):`);
                owner.tenants_lessees.forEach((tenant, tIdx) => {
                    console.log(`   ${tIdx + 1}. ${tenant.name} (${tenant.type})`);
                    console.log(`      Location: ${tenant.location}`);
                    console.log(`      Area: ${tenant.area} ha`);
                });
                console.log('');
            });
        } else {
            console.log('❌ No matches found. Debugging info:\n');

            // Show what we're trying to match
            const debugQuery = `
                SELECT 
                    'OWNER' as type,
                    rs."LAST NAME" || ', ' || rs."FIRST NAME" || 
                        CASE WHEN rs."MIDDLE NAME" IS NOT NULL AND rs."MIDDLE NAME" != '' 
                        THEN ' ' || rs."MIDDLE NAME" 
                        ELSE '' END as name
                FROM rsbsa_submission rs
                WHERE rs."OWNERSHIP_TYPE_REGISTERED_OWNER" = true
                UNION ALL
                SELECT 
                    'TENANT' as type,
                    CASE 
                        WHEN fp.ownership_type_tenant THEN fp.tenant_land_owner_name
                        WHEN fp.ownership_type_lessee THEN fp.lessee_land_owner_name
                    END as name
                FROM rsbsa_farm_parcels fp
                WHERE (fp.ownership_type_tenant = true OR fp.ownership_type_lessee = true)
                    AND (fp.tenant_land_owner_name IS NOT NULL OR fp.lessee_land_owner_name IS NOT NULL)
            `;

            const debugResult = await pool.query(debugQuery);
            debugResult.rows.forEach(row => {
                console.log(`${row.type}: "${row.name}"`);
            });
        }

        await pool.end();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testMatching();
