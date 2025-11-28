const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'postgresadmin',
    port: 5432
});

async function checkApprovedRequests() {
    try {
        const result = await pool.query(`
            SELECT id, farmer_name, season, status, 
                   requested_urea_bags, requested_complete_14_bags,
                   requested_ammonium_sulfate_bags, requested_muriate_potash_bags
            FROM farmer_requests 
            WHERE season = 'dry_2025' AND status = 'approved'
            ORDER BY id
        `);

        console.log('\n✅ Approved Requests for dry_2025:', result.rows.length);
        console.log('\nThese farmers can claim their fertilizers in Distribution Log:\n');

        result.rows.forEach(r => {
            console.log(`📋 ID ${r.id}: ${r.farmer_name}`);
            console.log(`   Urea: ${r.requested_urea_bags || 0} bags`);
            console.log(`   Complete 14-14-14: ${r.requested_complete_14_bags || 0} bags`);
            console.log(`   Ammonium Sulfate: ${r.requested_ammonium_sulfate_bags || 0} bags`);
            console.log(`   Potash: ${r.requested_muriate_potash_bags || 0} bags`);
            console.log('');
        });

        if (result.rows.length > 0) {
            console.log('📝 To record distribution:');
            console.log('   1. Go to Distribution Log page');
            console.log('   2. Select "Record Distribution" or Form view');
            console.log('   3. Choose season: dry_2025');
            console.log(`   4. Select farmer from the ${result.rows.length} approved requests`);
            console.log('   5. Enter actual quantities given');
            console.log('   6. Save the record');
            console.log('   7. It will appear in the log!\n');
        } else {
            console.log('⚠️  No approved requests found.');
            console.log('   First approve some farmer requests in Manage Requests page.\n');
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkApprovedRequests();
