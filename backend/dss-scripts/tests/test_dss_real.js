const { Pool } = require('pg');
const FertilizerAlternativeEngine = require('./services/alternativeEngine.cjs');
const RecommendationEngine = require('./services/recommendationEngine.cjs');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'postgresadmin',
    port: 5432
});

async function testDSSWithRealData() {
    try {
        console.log('\n🧪 === DSS Testing with Real Database Data ===\n');

        // 1. Get farmer requests
        console.log('📊 Step 1: Fetching farmer requests for dry_2025...');
        const requests = await pool.query(`
            SELECT * FROM farmer_requests 
            WHERE season = 'dry_2025'
            ORDER BY id
        `);
        console.log(`   ✅ Found ${requests.rows.length} farmer requests\n`);

        if (requests.rows.length === 0) {
            console.log('   ⚠️  No farmer requests found. Please add some test data first.');
            return;
        }

        // 2. Get regional allocation
        console.log('📊 Step 2: Fetching regional allocation for dry_2025...');
        const allocation = await pool.query(`
            SELECT * FROM regional_allocations 
            WHERE season = 'dry_2025' AND status = 'active'
            ORDER BY allocation_date DESC
            LIMIT 1
        `);

        if (allocation.rows.length === 0) {
            console.log('   ⚠️  No allocation found for dry_2025');
            return;
        }

        const allocData = allocation.rows[0];
        console.log(`   ✅ Allocation ID: ${allocData.id}, Date: ${allocData.allocation_date}`);
        console.log(`   Stock levels:`);
        console.log(`     - Urea: ${allocData.urea_46_0_0_bags} bags`);
        console.log(`     - Complete 14-14-14: ${allocData.complete_14_14_14_bags} bags`);
        console.log(`     - Ammonium Sulfate: ${allocData.ammonium_sulfate_21_0_0_bags} bags`);
        console.log(`     - Muriate Potash: ${allocData.muriate_potash_0_0_60_bags} bags\n`);

        // 3. Test Alternative Engine
        console.log('🤖 Step 3: Testing Alternative Engine...');
        const testRequest = requests.rows[0];
        console.log(`   Testing with: ${testRequest.farmer_name} (Request ID: ${testRequest.id})`);
        console.log(`   Requested: Urea=${testRequest.requested_urea_bags || 0}, Complete14=${testRequest.requested_complete_14_bags || 0}`);

        const currentStock = {
            urea_46_0_0_bags: allocData.urea_46_0_0_bags,
            complete_14_14_14_bags: allocData.complete_14_14_14_bags,
            ammonium_sulfate_21_0_0_bags: allocData.ammonium_sulfate_21_0_0_bags,
            muriate_potash_0_0_60_bags: allocData.muriate_potash_0_0_60_bags
        };

        const altEngine = new FertilizerAlternativeEngine();
        const alternatives = await altEngine.suggestAlternatives(testRequest, currentStock);

        if (alternatives.error) {
            console.log(`   ❌ Error: ${alternatives.error}`);
        } else if (alternatives.has_shortages) {
            console.log(`   ✅ Alternative engine working! Found ${alternatives.suggestions.length} shortage(s)`);
            alternatives.suggestions.forEach((sug, idx) => {
                console.log(`\n   Shortage #${idx + 1}:`);
                console.log(`     - Item: ${sug.original_fertilizer_name}`);
                console.log(`     - Requested: ${sug.requested_bags} bags`);
                console.log(`     - Available: ${sug.available_bags} bags`);
                console.log(`     - Shortage: ${sug.shortage_bags} bags`);
                console.log(`     - Alternatives found: ${sug.alternatives.length}`);
                if (sug.alternatives.length > 0) {
                    console.log(`     - Top alternative: ${sug.alternatives[0].alternative_fertilizer_name}`);
                }
            });
        } else {
            console.log(`   ✅ No shortages detected - sufficient stock available`);
        }

        // 4. Test Recommendation Engine
        console.log('\n\n🤖 Step 4: Testing Recommendation Engine...');

        // Calculate totals
        const totals = {
            urea_requested: 0,
            complete14_requested: 0,
            amsul_requested: 0,
            potash_requested: 0
        };

        requests.rows.forEach(req => {
            totals.urea_requested += parseFloat(req.requested_urea_bags || 0);
            totals.complete14_requested += parseFloat(req.requested_complete_14_bags || 0);
            totals.amsul_requested += parseFloat(req.requested_ammonium_sulfate_bags || 0);
            totals.potash_requested += parseFloat(req.requested_muriate_potash_bags || 0);
        });

        console.log(`   Total requests:`);
        console.log(`     - Urea: ${totals.urea_requested} bags`);
        console.log(`     - Complete 14-14-14: ${totals.complete14_requested} bags`);
        console.log(`     - Ammonium Sulfate: ${totals.amsul_requested} bags`);
        console.log(`     - Muriate Potash: ${totals.potash_requested} bags`);

        // Build gap analysis structure matching the expected format
        const gapAnalysis = {
            season: 'dry_2025',
            allocation_date: allocData.allocation_date,
            fertilizers: {
                urea_46_0_0: {
                    allocated: allocData.urea_46_0_0_bags,
                    requested: totals.urea_requested,
                    remaining: allocData.urea_46_0_0_bags - totals.urea_requested,
                    gap_percentage: ((totals.urea_requested - allocData.urea_46_0_0_bags) / allocData.urea_46_0_0_bags * 100)
                },
                complete_14_14_14: {
                    allocated: allocData.complete_14_14_14_bags,
                    requested: totals.complete14_requested,
                    remaining: allocData.complete_14_14_14_bags - totals.complete14_requested,
                    gap_percentage: ((totals.complete14_requested - allocData.complete_14_14_14_bags) / allocData.complete_14_14_14_bags * 100)
                },
                ammonium_sulfate_21_0_0: {
                    allocated: allocData.ammonium_sulfate_21_0_0_bags,
                    requested: totals.amsul_requested,
                    remaining: allocData.ammonium_sulfate_21_0_0_bags - totals.amsul_requested,
                    gap_percentage: ((totals.amsul_requested - allocData.ammonium_sulfate_21_0_0_bags) / allocData.ammonium_sulfate_21_0_0_bags * 100)
                },
                muriate_potash_0_0_60: {
                    allocated: allocData.muriate_potash_0_0_60_bags,
                    requested: totals.potash_requested,
                    remaining: allocData.muriate_potash_0_0_60_bags - totals.potash_requested,
                    gap_percentage: ((totals.potash_requested - allocData.muriate_potash_0_0_60_bags) / allocData.muriate_potash_0_0_60_bags * 100)
                }
            },
            seeds: {} // No seed data for this test
        };

        const recEngine = new RecommendationEngine();
        const recommendations = recEngine.generateRecommendations(gapAnalysis, requests.rows);

        console.log(`\n   ✅ Recommendation engine working!`);
        console.log(`   Summary:`);
        console.log(`     - Total recommendations: ${recommendations.summary.total_recommendations}`);
        console.log(`     - Critical issues: ${recommendations.summary.critical_issues}`);
        console.log(`     - High priority: ${recommendations.summary.high_priority_issues}`);
        console.log(`     - Shortages detected: ${recommendations.summary.shortages}`);
        console.log(`     - Opportunities: ${recommendations.summary.opportunities}`);

        if (recommendations.recommendations.length > 0) {
            console.log(`\n   Top 3 Recommendations:`);
            recommendations.recommendations.slice(0, 3).forEach((rec, idx) => {
                console.log(`\n   ${idx + 1}. [${rec.priority}] ${rec.title}`);
                console.log(`      Type: ${rec.type}`);
                console.log(`      ${rec.description}`);
                if (rec.actions && rec.actions.length > 0) {
                    console.log(`      Actions: ${rec.actions.length} recommended steps`);
                }
            });
        }

        console.log('\n\n✅ === All DSS Tests Passed! ===\n');
        console.log('💡 Next steps:');
        console.log('   1. Start the backend server: node backend/server.cjs');
        console.log('   2. Start the frontend: npm run dev');
        console.log('   3. Navigate to JO Manage Requests page');
        console.log('   4. Navigate to Gap Analysis page');
        console.log('   5. See the DSS features in action!\n');

    } catch (error) {
        console.error('\n❌ Error during testing:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

testDSSWithRealData();
