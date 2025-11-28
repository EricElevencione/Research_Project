const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'postgresadmin',
    port: 5432
});

async function testDSS() {
    try {
        console.log('\n=== Testing DSS with Real Data ===\n');

        // 1. Check farmer requests
        console.log('1. Checking farmer_requests table:');
        const requests = await pool.query(`
            SELECT id, farmer_name, season, status, crop_type,
                   requested_urea_bags, requested_complete_14_bags, 
                   requested_ammonium_sulfate_bags, requested_muriate_potash_bags,
                   requested_jackpot_kg, requested_th82_kg
            FROM farmer_requests 
            ORDER BY id 
            LIMIT 5
        `);
        console.log(`Found ${requests.rows.length} farmer requests:`);
        requests.rows.forEach(r => {
            console.log(`  - ID ${r.id}: ${r.farmer_name} (${r.season}, ${r.crop_type}) - Status: ${r.status}`);
            console.log(`    Fertilizers: Urea=${r.requested_urea_bags}, Complete14=${r.requested_complete_14_bags}, AmSul=${r.requested_ammonium_sulfate_bags}, Potash=${r.requested_muriate_potash_bags}`);
            console.log(`    Seeds: Jackpot=${r.requested_jackpot_kg}kg, TH82=${r.requested_th82_kg}kg`);
        });

        // 2. Check distribution_system table
        console.log('\n2. Checking distribution_system table:');
        const distributions = await pool.query(`
            SELECT * FROM distribution_system 
            WHERE season = 'dry_2025'
            ORDER BY id
            LIMIT 5
        `);
        console.log(`Found ${distributions.rows.length} distribution records for dry_2025:`);
        distributions.rows.forEach(d => {
            console.log(`  - ID ${d.id}: ${d.item_type}`);
            console.log(`    Allocated: ${d.allocated_quantity}, Remaining: ${d.remaining_quantity}`);
        });

        // 3. Test alternative suggestions
        console.log('\n3. Testing Alternative Suggestions Engine:');
        if (requests.rows.length > 0) {
            const testRequestId = requests.rows[0].id;
            console.log(`   Using request_id: ${testRequestId}`);

            const FertilizerAlternativeEngine = require('./services/alternativeEngine.cjs');
            const altEngine = new FertilizerAlternativeEngine();

            // Get request details
            const requestDetail = await pool.query(
                'SELECT * FROM farmer_requests WHERE id = $1',
                [testRequestId]
            );

            // Get current stock
            const stock = await pool.query(`
                SELECT item_type, fertilizer_type, remaining_quantity 
                FROM distribution_system 
                WHERE season = $1
            `, [requestDetail.rows[0].season]);

            const farmerRequest = requestDetail.rows[0];
            const currentStock = {};
            stock.rows.forEach(s => {
                if (s.item_type === 'fertilizer') {
                    currentStock[s.fertilizer_type] = s.remaining_quantity;
                }
            });

            console.log('   Current stock:', currentStock);
            console.log('   Farmer request:', {
                urea: farmerRequest.requested_urea_bags,
                complete_14: farmerRequest.requested_complete_14_bags,
                amsul: farmerRequest.requested_ammonium_sulfate_bags,
                potash: farmerRequest.requested_muriate_potash_bags
            });

            const alternatives = altEngine.suggestAlternatives(farmerRequest, currentStock);
            console.log('\n   ✅ Alternatives generated:', JSON.stringify(alternatives, null, 2));
        }

        // 4. Test recommendation engine
        console.log('\n4. Testing Recommendation Engine:');
        const RecommendationEngine = require('./services/recommendationEngine.cjs');

        // Get gap analysis data
        const gapData = await pool.query(`
            SELECT 
                ds.item_type,
                ds.fertilizer_type,
                ds.seed_variety,
                ds.allocated_quantity,
                COALESCE(SUM(
                    CASE 
                        WHEN ds.item_type = 'fertilizer' THEN
                            CASE ds.fertilizer_type
                                WHEN 'urea' THEN fr.urea_qty
                                WHEN 'complete' THEN fr.complete_qty
                                WHEN 'amsul' THEN fr.amsul_qty
                                WHEN 'potash' THEN fr.potash_qty
                                ELSE 0
                            END
                        WHEN ds.item_type = 'seed' THEN
                            CASE ds.seed_variety
                                WHEN 'rice' THEN fr.rice_qty
                                WHEN 'corn' THEN fr.corn_qty
                                ELSE 0
                            END
                        ELSE 0
                    END
                ), 0) as total_requested
            FROM distribution_system ds
            LEFT JOIN farmer_requests fr ON fr.season = ds.season
            WHERE ds.season = 'dry_2025'
            GROUP BY ds.id, ds.item_type, ds.fertilizer_type, ds.seed_variety, ds.allocated_quantity
        `);

        const gapAnalysis = {
            season: 'dry_2025',
            allocation_date: new Date().toISOString(),
            items: gapData.rows.map(item => ({
                item_type: item.item_type,
                fertilizer_type: item.fertilizer_type,
                seed_variety: item.seed_variety,
                allocated: parseFloat(item.allocated_quantity) || 0,
                requested: parseFloat(item.total_requested) || 0,
                remaining: (parseFloat(item.allocated_quantity) || 0) - (parseFloat(item.total_requested) || 0)
            }))
        };

        const farmerRequests = await pool.query(`
            SELECT * FROM farmer_requests WHERE season = 'dry_2025'
        `);

        const recEngine = new RecommendationEngine(gapAnalysis, farmerRequests.rows);
        const recommendations = recEngine.generateRecommendations();

        console.log('\n   ✅ Recommendations generated:');
        console.log('   Summary:', JSON.stringify(recommendations.summary, null, 2));
        console.log(`   Total recommendations: ${recommendations.recommendations.length}`);
        recommendations.recommendations.slice(0, 3).forEach(rec => {
            console.log(`\n   ${rec.priority}: ${rec.title}`);
            console.log(`   Type: ${rec.type}`);
            console.log(`   Description: ${rec.description}`);
            if (rec.actions && rec.actions.length > 0) {
                console.log(`   Actions (${rec.actions.length}):`);
                rec.actions.forEach((action, idx) => {
                    console.log(`     ${idx + 1}. ${action.action}`);
                });
            }
        });

        console.log('\n=== All DSS Tests Completed Successfully! ===\n');

    } catch (error) {
        console.error('Error during testing:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

testDSS();
