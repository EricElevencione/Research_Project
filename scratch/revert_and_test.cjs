const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    console.log("=== 1. Reverting DB state for Jada (98) and Lil Asian Sue (100) ===");

    // A. Revert farm parcel 144 back to Lil Asian Sue as owner
    console.log("Reverting parcel 144 back to owner Lil Asian Sue (100)...");
    await pool.query(`
      UPDATE rsbsa_farm_parcels
      SET submission_id = 100,
          ownership_type_registered_owner = true,
          ownership_type_tenant = false,
          tenant_land_owner_id = null,
          tenant_land_owner_name = null,
          is_current_owner = true,
          is_cultivating = true,
          is_farming = true,
          cultivator_submission_id = null,
          cultivation_status_reason = null,
          parent_parcel_id = null,
          ownership_category = 'registeredOwner',
          updated_at = NOW()
      WHERE id = 144
    `);

    // B. Revert land history record 173 (Lil Asian Sue)
    console.log("Reverting land_history record 173 to active current owner...");
    await pool.query(`
      UPDATE land_history
      SET is_current = true,
          period_end_date = null,
          updated_at = NOW()
      WHERE id = 173
    `);

    // C. Remove foreign key references to the land history records we are about to delete
    console.log("Clearing foreign key references in land_history...");
    await pool.query(`
      UPDATE land_history
      SET previous_history_id = null
      WHERE previous_history_id IN (
        SELECT id FROM land_history
        WHERE farmer_id = 98 AND parcel_number = 'Parcel-100-1'
      )
    `);

    // D. Clean up any tenant parcel rows that might have been created under Jada (98) for parcel 100-1
    // (Excluding row 141 and 144)
    console.log("Deleting any duplicate tenant parcels for Jada...");
    const cleanupResult = await pool.query(`
      DELETE FROM rsbsa_farm_parcels
      WHERE submission_id = 98 AND parcel_number = 'Parcel-100-1' AND id != 144
      RETURNING id
    `);
    console.log(`Cleaned up ${cleanupResult.rowCount} tenant parcel rows.`);

    // E. Clean up tenant land_history rows for Jada (98) for parcel 100-1
    console.log("Deleting tenant land_history rows for Jada...");
    await pool.query(`
      DELETE FROM land_history
      WHERE farmer_id = 98 AND parcel_number = 'Parcel-100-1'
    `);

    // F. Revert rsbsa_submission statuses using sync status function
    console.log("Running sync status function to restore original status...");
    await pool.query("SELECT public.sync_farmer_no_parcels_status(100)");
    await pool.query("SELECT public.sync_farmer_no_parcels_status(98)");

    // Let's print pre-test state
    const preSubmissions = await pool.query(`
      SELECT id, status FROM rsbsa_submission WHERE id IN (98, 100)
    `);
    console.log("Pre-test submission statuses:", preSubmissions.rows);

    const preParcels = await pool.query(`
      SELECT id, submission_id, parcel_number, ownership_type_registered_owner, ownership_type_tenant, tenant_land_owner_id, is_current_owner, is_cultivating, is_farming
      FROM rsbsa_farm_parcels
      WHERE submission_id IN (98, 100) OR tenant_land_owner_id IN (98, 100)
      ORDER BY id
    `);
    console.log("Pre-test parcels:", preParcels.rows);


    console.log("\n=== 2. Running landowner linkage RPC replace_tenant_lessee_holder_with_portions_no_review ===");
    const items = JSON.stringify([{ farm_parcel_id: 144, takeover_mode: "full", transfer_area_ha: 3.00 }]);
    const rpcResult = await pool.query(`
      SELECT public.replace_tenant_lessee_holder_with_portions_no_review(
        'tenant',
        100, -- current holder (owner: Lil Asian Sue)
        98,  -- replacement holder (tenant: Jada Stele Nash)
        100, -- owner context
        'Linked tenant Jada Nash',
        CURRENT_DATE,
        $1::jsonb
      ) AS result
    `, [items]);

    console.log("RPC execution result:", JSON.stringify(rpcResult.rows[0].result, null, 2));


    console.log("\n=== 3. Inspecting POST-TEST state ===");
    const postSubmissions = await pool.query(`
      SELECT id, status, archive_reason FROM rsbsa_submission WHERE id IN (98, 100)
    `);
    console.log("Post-test submission statuses:", postSubmissions.rows);

    const postParcels = await pool.query(`
      SELECT id, submission_id, parcel_number, ownership_type_registered_owner, ownership_type_tenant, tenant_land_owner_id, is_current_owner, is_cultivating, is_farming, parent_parcel_id
      FROM rsbsa_farm_parcels
      WHERE submission_id IN (98, 100) OR tenant_land_owner_id IN (98, 100)
      ORDER BY id
    `);
    console.log("Post-test parcels:", postParcels.rows);

    const postHistory = await pool.query(`
      SELECT id, farm_parcel_id, farmer_id, parcel_number, land_owner_id, is_registered_owner, is_tenant, is_current
      FROM land_history
      WHERE farmer_id IN (98, 100) OR land_owner_id IN (98, 100)
      ORDER BY id
    `);
    console.log("Post-test land history:", postHistory.rows);

  } catch (err) {
    console.error("❌ Test failed:", err);
  } finally {
    await pool.end();
  }
}

main();
