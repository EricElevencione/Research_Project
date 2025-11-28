const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'postgresadmin',
    port: 5432
});

async function reviewGapCalculation() {
    try {
        console.log('\n=== GAP ANALYSIS REVIEW ===\n');

        // Get allocation
        const allocation = await pool.query(`
            SELECT * FROM regional_allocations WHERE season = 'dry_2025'
        `);
        const alloc = allocation.rows[0];

        console.log('📦 ALLOCATED (What you have):');
        console.log(`  Urea: ${alloc.urea_46_0_0_bags} bags`);
        console.log(`  Complete 14-14-14: ${alloc.complete_14_14_14_bags} bags`);
        console.log(`  Ammonium Sulfate: ${alloc.ammonium_sulfate_21_0_0_bags} bags`);
        console.log('');

        // Get actual requests
        const requests = await pool.query(`
            SELECT 
                SUM(requested_urea_bags) as total_urea,
                SUM(requested_complete_14_bags) as total_complete14,
                SUM(requested_ammonium_sulfate_bags) as total_amsul,
                SUM(farm_area_ha) as total_area,
                COUNT(*) as total_requests
            FROM farmer_requests
            WHERE season = 'dry_2025'
        `);
        const req = requests.rows[0];

        console.log('📝 REQUESTED (What farmers asked for):');
        console.log(`  Urea: ${req.total_urea} bags`);
        console.log(`  Complete 14-14-14: ${req.total_complete14} bags`);
        console.log(`  Ammonium Sulfate: ${req.total_amsul} bags`);
        console.log(`  Total farm area: ${req.total_area} hectares`);
        console.log('');

        // Calculate gaps using REQUESTED (not estimated)
        console.log('📊 GAP ANALYSIS (Allocated - Requested):');
        console.log('');

        const ureaGap = alloc.urea_46_0_0_bags - parseFloat(req.total_urea);
        const ureaFulfillment = (alloc.urea_46_0_0_bags / parseFloat(req.total_urea) * 100).toFixed(1);
        console.log('UREA:');
        console.log(`  Allocated: ${alloc.urea_46_0_0_bags} bags`);
        console.log(`  Requested: ${req.total_urea} bags`);
        console.log(`  Gap: ${ureaGap.toFixed(2)} bags ${ureaGap >= 0 ? '(SURPLUS ✅)' : '(SHORTAGE ❌)'}`);
        console.log(`  Fulfillment: ${ureaFulfillment}% ${parseFloat(ureaFulfillment) >= 100 ? '(Can fulfill all)' : '(Cannot fulfill all)'}`);
        console.log('');

        const complete14Gap = alloc.complete_14_14_14_bags - parseFloat(req.total_complete14);
        const complete14Fulfillment = (alloc.complete_14_14_14_bags / parseFloat(req.total_complete14) * 100).toFixed(1);
        console.log('COMPLETE 14-14-14:');
        console.log(`  Allocated: ${alloc.complete_14_14_14_bags} bags`);
        console.log(`  Requested: ${req.total_complete14} bags`);
        console.log(`  Gap: ${complete14Gap.toFixed(2)} bags ${complete14Gap >= 0 ? '(SURPLUS ✅)' : '(SHORTAGE ❌)'}`);
        console.log(`  Fulfillment: ${complete14Fulfillment}% ${parseFloat(complete14Fulfillment) >= 100 ? '(Can fulfill all)' : '(Cannot fulfill all)'}`);
        console.log('');

        // Now check what the API is calculating (area-based estimation)
        const totalArea = parseFloat(req.total_area) || 0;
        const estimatedFertilizerKg = totalArea * 150;
        const estimatedFertilizerBags = Math.ceil(estimatedFertilizerKg / 50);
        const estimatedUreaBags = Math.ceil(estimatedFertilizerBags * 0.55);
        const estimatedComplete14Bags = Math.ceil(estimatedFertilizerBags * 0.30);

        console.log('⚠️  CURRENT API CALCULATION (Using Farm Area Estimation):');
        console.log(`  Total farm area: ${totalArea} ha`);
        console.log(`  Estimated total fertilizer: ${estimatedFertilizerBags} bags`);
        console.log(`  Estimated Urea (55%): ${estimatedUreaBags} bags`);
        console.log(`  Estimated Complete 14 (30%): ${estimatedComplete14Bags} bags`);
        console.log('');

        const apiUreaGap = alloc.urea_46_0_0_bags - estimatedUreaBags;
        const apiUreaPercent = (alloc.urea_46_0_0_bags / estimatedUreaBags * 100).toFixed(1);
        console.log('API Urea Calculation:');
        console.log(`  Gap: ${apiUreaGap} bags (This shows in your UI)`);
        console.log(`  Percentage: ${apiUreaPercent}% (This shows in your UI)`);
        console.log('');

        console.log('🔍 THE PROBLEM:');
        console.log('  The API uses ESTIMATED needs based on farm area (theoretical)');
        console.log('  But it SHOULD use ACTUAL REQUESTED amounts (what farmers asked for)');
        console.log('');
        console.log('✅ RECOMMENDATION:');
        console.log('  Change gap calculation to use SUM(requested_*_bags) instead of farm area estimation');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

reviewGapCalculation();
