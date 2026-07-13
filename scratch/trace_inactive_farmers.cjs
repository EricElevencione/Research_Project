const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const res = await pool.query(`
      SELECT id,
             "FIRST NAME" AS first_name,
             "MIDDLE NAME" AS middle_name,
             "LAST NAME" AS last_name,
             status,
             archived_at,
             archive_reason
      FROM rsbsa_submission
      WHERE id IN (
        SELECT submission_id FROM rsbsa_farm_parcels
      ) OR id::text IN ('97', '102', '100', '98')
      ORDER BY id::bigint
    `);
    console.log("=== All Active Submissions with parcels ===");
    console.log(res.rows);

    const targetSubmissions = await pool.query(`
      SELECT id,
             "FIRST NAME" AS first_name,
             "LAST NAME" AS last_name,
             status,
             archived_at,
             archive_reason
      FROM rsbsa_submission
      WHERE "LAST NAME" IN ('Libero', 'Reyes')
    `);
    console.log("\n=== Target Submissions (Libero, Reyes) ===");
    console.log(targetSubmissions.rows);

    if (targetSubmissions.rows.length > 0) {
      const ids = targetSubmissions.rows.map(r => r.id);
      const parcels = await pool.query(`
        SELECT id, submission_id, parcel_number, total_farm_area_ha,
               ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee,
               is_current_owner, is_cultivating, cultivator_submission_id
        FROM rsbsa_farm_parcels
        WHERE submission_id = ANY($1) OR tenant_land_owner_id = ANY($1)
      `, [ids]);
      console.log("\n=== Parcels for Libero/Reyes ===");
      console.log(parcels.rows);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
