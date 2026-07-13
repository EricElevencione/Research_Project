const fs = require("fs");
const path = require("path");
const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    console.log("=== 1. Reading replace_current_tenant_lessee_on_registration.sql ===");
    const sqlPath = path.join(__dirname, "replace_current_tenant_lessee_on_registration.sql");
    let sql = fs.readFileSync(sqlPath, "utf8");

    console.log("=== 2. Inserting status sync calls into function definition ===");
    const target = `-- -------------------------------------------------------------------------
    -- 8. Return result
    -- -------------------------------------------------------------------------
    RETURN jsonb_build_object(`;

    const replacement = `    -- Call status sync for both users to apply changes immediately
    PERFORM public.sync_farmer_no_parcels_status(p_old_holder_id);
    PERFORM public.sync_farmer_no_parcels_status(p_new_holder_id);

    -- -------------------------------------------------------------------------
    -- 8. Return result
    -- -------------------------------------------------------------------------
    RETURN jsonb_build_object(`;

    if (!sql.includes("sync_farmer_no_parcels_status(p_old_holder_id)")) {
      sql = sql.replace(target, replacement);
      fs.writeFileSync(sqlPath, sql);
      console.log("Updated sql file locally!");
    } else {
      console.log("SQL file already contains the sync calls.");
    }

    console.log("=== 3. Deploying updated function to DB ===");
    await pool.query(sql);
    console.log("Successfully deployed replace_current_tenant_lessee_on_registration fix!");

  } catch (err) {
    console.error("❌ Deployment failed:", err);
  } finally {
    await pool.end();
  }
}

main();
