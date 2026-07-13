const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    console.log("=== Synchronizing status for Christian Reyes (37) and Michael Libero (40) ===");
    
    // Sync status
    await pool.query("SELECT public.sync_farmer_no_parcels_status(37)");
    await pool.query("SELECT public.sync_farmer_no_parcels_status(40)");
    
    const res = await pool.query(`
      SELECT id, "FIRST NAME", "LAST NAME", status, archived_at, archive_reason
      FROM rsbsa_submission
      WHERE id IN (37, 40)
    `);
    console.log("Updated statuses:", res.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
