const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), 'backend/.env') });

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  const search = process.argv[2] || 'shelton';
  const res = await pool.query(
    `
      SELECT id, "FIRST NAME", "MIDDLE NAME", "LAST NAME", "EXT NAME", "BARANGAY", "MUNICIPALITY"
      FROM rsbsa_submission
      WHERE LOWER(CONCAT(COALESCE("FIRST NAME", ''), ' ', COALESCE("LAST NAME", ''))) LIKE $1
         OR LOWER(CONCAT(COALESCE("LAST NAME", ''), ', ', COALESCE("FIRST NAME", ''))) LIKE $1
         OR LOWER(CONCAT(COALESCE("FIRST NAME", ''), ' ', COALESCE("MIDDLE NAME", ''), ' ', COALESCE("LAST NAME", ''))) LIKE $1
      ORDER BY id
      LIMIT 20
    `,
    [`%${search}%`],
  );

  console.log(JSON.stringify(res.rows, null, 2));

  await pool.end();
})();
