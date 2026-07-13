const { createPool } = require("../backend/config/db.cjs");

async function main() {
  const pool = createPool();
  try {
    const submissions = await pool.query(`
      SELECT id,
             "FIRST NAME" AS first_name,
             "MIDDLE NAME" AS middle_name,
             "LAST NAME" AS last_name,
             status
      FROM rsbsa_submission
      WHERE lower(concat_ws(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME")) LIKE '%holloway%'
    `);
    console.log("=== Submissions for Holloway ===");
    console.log(submissions.rows);
  } catch (err) {
    console.error("Error inspecting:", err);
  } finally {
    await pool.end();
  }
}

main();
