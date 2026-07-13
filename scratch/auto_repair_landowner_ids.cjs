const { createPool } = require("../backend/config/db.cjs");

// Utility to parse name from string
function parseName(fullName) {
  const cleaned = fullName.replace(/\s+/g, ' ').trim().toLowerCase();
  // Try to split by comma first (Last Name, First Name Middle Name)
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    const lastName = parts[0].trim();
    const rest = parts[1].trim().split(' ');
    const firstName = rest[0] || '';
    const middleName = rest.slice(1).join(' ') || '';
    return { firstName, middleName, lastName };
  } else {
    // Space-separated (First Name Middle Name Last Name)
    const parts = cleaned.split(' ');
    if (parts.length === 1) {
      return { firstName: parts[0], middleName: '', lastName: '' };
    }
    if (parts.length === 2) {
      return { firstName: parts[0], middleName: '', lastName: parts[1] };
    }
    return {
      firstName: parts[0],
      middleName: parts.slice(1, -1).join(' '),
      lastName: parts[parts.length - 1]
    };
  }
}

async function main() {
  const pool = createPool();
  try {
    console.log("=== 1. Fetching all rsbsa_submissions for name matching ===");
    // Remove the archived_at IS NULL restriction so that we can match landowners currently categorized as "No Parcels"
    const subRes = await pool.query(`
      SELECT id, "FIRST NAME" AS first_name, "MIDDLE NAME" AS middle_name, "LAST NAME" AS last_name
      FROM rsbsa_submission
    `);
    const submissions = subRes.rows;

    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim().toLowerCase();

    // Helper to find a matching submission ID by full name
    const findMatch = (rawName) => {
      if (!rawName) return null;
      const parsed = parseName(rawName);
      
      // Look for matches
      const matches = submissions.filter(s => {
        const dbFirst = normalize(s.first_name);
        const dbLast = normalize(s.last_name);
        const dbMiddle = normalize(s.middle_name);

        const exactMatch = (dbFirst === parsed.firstName && dbLast === parsed.lastName);
        const middleMatch = dbMiddle === parsed.middleName;

        // Try loose matching on combined name
        const dbCombined = `${dbFirst} ${dbMiddle} ${dbLast}`.replace(/\s+/g, ' ').trim();
        const inputCombined = `${parsed.firstName} ${parsed.middleName} ${parsed.lastName}`.replace(/\s+/g, ' ').trim();
        
        return exactMatch || dbCombined === inputCombined;
      });

      if (matches.length === 1) {
        return Number(matches[0].id);
      }
      return null;
    };

    console.log("=== 2. Scanning for parcels missing landowner IDs ===");
    const parcelsRes = await pool.query(`
      SELECT id, submission_id, parcel_number, tenant_land_owner_name, lessee_land_owner_name,
             tenant_land_owner_id, lessee_land_owner_id, ownership_type_tenant, ownership_type_lessee
      FROM rsbsa_farm_parcels
      WHERE (ownership_type_tenant = true AND tenant_land_owner_id IS NULL AND tenant_land_owner_name IS NOT NULL AND tenant_land_owner_name != '')
         OR (ownership_type_lessee = true AND lessee_land_owner_id IS NULL AND lessee_land_owner_name IS NOT NULL AND lessee_land_owner_name != '')
    `);

    console.log(`Found ${parcelsRes.rowCount} parcels missing landowner IDs.`);

    let fixedCount = 0;

    for (const parcel of parcelsRes.rows) {
      const isTenant = parcel.ownership_type_tenant === true;
      const ownerName = isTenant ? parcel.tenant_land_owner_name : parcel.lessee_land_owner_name;
      
      const matchedId = findMatch(ownerName);
      if (matchedId) {
        console.log(`\nFixing parcel ID ${parcel.id} (${parcel.parcel_number}) for farmer ${parcel.submission_id}:`);
        console.log(`- Matching landowner name "${ownerName}" to submission ID ${matchedId}`);

        // Update rsbsa_farm_parcels
        if (isTenant) {
          await pool.query(`
            UPDATE rsbsa_farm_parcels
            SET tenant_land_owner_id = $1
            WHERE id = $2
          `, [matchedId, parcel.id]);
        } else {
          await pool.query(`
            UPDATE rsbsa_farm_parcels
            SET lessee_land_owner_id = $1
            WHERE id = $2
          `, [matchedId, parcel.id]);
        }

        // Update corresponding land_history record
        const historyUpdate = await pool.query(`
          UPDATE land_history
          SET land_owner_id = $1
          WHERE farm_parcel_id = $2 AND farmer_id = $3
          RETURNING id
        `, [matchedId, parcel.id, parcel.submission_id]);
        console.log(`- Updated ${historyUpdate.rowCount} land_history records.`);

        // Sync statuses
        await pool.query("SELECT public.sync_farmer_no_parcels_status($1)", [matchedId]);
        await pool.query("SELECT public.sync_farmer_no_parcels_status($1)", [parcel.submission_id]);

        fixedCount++;
      } else {
        console.log(`\n⚠️ Could not find unique match for landowner name "${ownerName}" on parcel ID ${parcel.id}`);
      }
    }

    console.log(`\n=== Auto-repair completed! Successfully fixed ${fixedCount} parcel links. ===`);

  } catch (err) {
    console.error("❌ Auto-repair failed:", err);
  } finally {
    await pool.end();
  }
}

main();
