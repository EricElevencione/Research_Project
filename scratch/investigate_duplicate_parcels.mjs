import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envConfig = dotenv.parse(fs.readFileSync(path.join(__dirname, '..', 'backend', '.env')));
const connectionString = envConfig.SUPABASE_DB_URL;

const { Pool } = pg;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    // 1. Find Lip Mark Ton in rsbsa_submission
    console.log('=== Finding Lip Mark Ton ===');
    const farmerRes = await client.query(`
      SELECT id, "FIRST NAME", "MIDDLE NAME", "LAST NAME", "FFRS_CODE", status
      FROM rsbsa_submission
      WHERE LOWER(CONCAT_WS(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME")) LIKE '%lip%mark%ton%'
         OR LOWER(CONCAT_WS(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME")) LIKE '%lip%ton%'
      LIMIT 5
    `);
    console.log('Farmer records:', JSON.stringify(farmerRes.rows, null, 2));

    if (farmerRes.rows.length === 0) {
      console.log('Lip Mark Ton not found. Trying broader search...');
      const broadRes = await client.query(`
        SELECT id, "FIRST NAME", "MIDDLE NAME", "LAST NAME", "FFRS_CODE", status
        FROM rsbsa_submission
        WHERE LOWER("LAST NAME") LIKE '%ton%' AND LOWER("FIRST NAME") LIKE '%lip%'
        LIMIT 5
      `);
      console.log('Broad search:', JSON.stringify(broadRes.rows, null, 2));
      if (broadRes.rows.length === 0) {
        console.log('Still not found, exiting.');
        return;
      }
    }

    const farmerId = farmerRes.rows[0]?.id;
    if (!farmerId) return;

    // 2. Get ALL parcels from rsbsa_farm_parcels for this farmer
    console.log(`\n=== rsbsa_farm_parcels for farmer_id=${farmerId} ===`);
    const parcelsRes = await client.query(`
      SELECT id, parcel_number, submission_id, 
             ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee,
             tenant_land_owner_id, tenant_land_owner_name,
             lessee_land_owner_id, lessee_land_owner_name,
             farm_location_barangay, farm_location_municipality,
             total_farm_area_ha, is_current_owner, parent_parcel_id,
             created_at, updated_at
      FROM rsbsa_farm_parcels
      WHERE submission_id = $1
      ORDER BY created_at
    `, [farmerId]);
    console.log(`Found ${parcelsRes.rows.length} parcels:`);
    for (const p of parcelsRes.rows) {
      console.log(`  Parcel #${p.parcel_number} (id=${p.id})`);
      console.log(`    tenant_owner: ${p.tenant_land_owner_name} (id=${p.tenant_land_owner_id})`);
      console.log(`    is_tenant: ${p.ownership_type_tenant}, is_owner: ${p.ownership_type_registered_owner}`);
      console.log(`    location: ${p.farm_location_barangay}, ${p.farm_location_municipality}`);
      console.log(`    area: ${p.total_farm_area_ha} ha`);
      console.log(`    parent_parcel_id: ${p.parent_parcel_id}`);
      console.log(`    created: ${p.created_at}, updated: ${p.updated_at}`);
      console.log('');
    }

    // 3. Get land_history for this farmer
    console.log(`\n=== land_history for farmer_id=${farmerId} ===`);
    const historyRes = await client.query(`
      SELECT id, farm_parcel_id, parcel_number, 
             farmer_id, farmer_name,
             land_owner_name, land_owner_id,
             is_tenant, is_lessee, is_registered_owner,
             tenant_name, lessee_name,
             change_type, is_current, change_reason,
             period_start_date, period_end_date,
             created_at, updated_at
      FROM land_history
      WHERE farmer_id = $1
      ORDER BY created_at
    `, [farmerId]);
    console.log(`Found ${historyRes.rows.length} history records:`);
    for (const h of historyRes.rows) {
      console.log(`  History #${h.id} — parcel=${h.parcel_number} (farm_parcel_id=${h.farm_parcel_id})`);
      console.log(`    change_type: ${h.change_type}, is_current: ${h.is_current}`);
      console.log(`    land_owner: ${h.land_owner_name} (id=${h.land_owner_id})`);
      console.log(`    tenant: ${h.tenant_name}, lessee: ${h.lessee_name}`);
      console.log(`    is_tenant: ${h.is_tenant}, is_lessee: ${h.is_lessee}, is_owner: ${h.is_registered_owner}`);
      console.log(`    reason: ${h.change_reason}`);
      console.log(`    period: ${h.period_start_date} → ${h.period_end_date}`);
      console.log(`    created: ${h.created_at}`);
      console.log('');
    }

    // 4. Also check Jada Steele Nash's parcels
    console.log('\n=== Finding Jada Steele Nash ===');
    const jadaRes = await client.query(`
      SELECT id, "FIRST NAME", "MIDDLE NAME", "LAST NAME", "FFRS_CODE", status
      FROM rsbsa_submission
      WHERE LOWER(CONCAT_WS(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME")) LIKE '%jada%steele%nash%'
         OR LOWER(CONCAT_WS(' ', "FIRST NAME", "LAST NAME")) LIKE '%jada%nash%'
      LIMIT 5
    `);
    console.log('Jada records:', JSON.stringify(jadaRes.rows, null, 2));

    if (jadaRes.rows.length > 0) {
      const jadaId = jadaRes.rows[0].id;
      console.log(`\n=== rsbsa_farm_parcels for Jada (id=${jadaId}) ===`);
      const jadaParcels = await client.query(`
        SELECT id, parcel_number, submission_id,
               ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee,
               tenant_land_owner_id, tenant_land_owner_name,
               farm_location_barangay, total_farm_area_ha,
               is_current_owner, created_at, updated_at
        FROM rsbsa_farm_parcels
        WHERE submission_id = $1
        ORDER BY created_at
      `, [jadaId]);
      console.log(`Found ${jadaParcels.rows.length} parcels for Jada:`);
      for (const p of jadaParcels.rows) {
        console.log(`  Parcel #${p.parcel_number} (id=${p.id}), is_owner=${p.ownership_type_registered_owner}, is_tenant=${p.ownership_type_tenant}, tenant_owner=${p.tenant_land_owner_name}`);
      }
    }

    // 5. Also check Marvin Aryan Harrell
    console.log('\n=== Finding Marvin Aryan Harrell ===');
    const marvinRes = await client.query(`
      SELECT id, "FIRST NAME", "MIDDLE NAME", "LAST NAME", "FFRS_CODE", status
      FROM rsbsa_submission
      WHERE LOWER(CONCAT_WS(' ', "FIRST NAME", "MIDDLE NAME", "LAST NAME")) LIKE '%marvin%aryan%harrell%'
         OR LOWER(CONCAT_WS(' ', "FIRST NAME", "LAST NAME")) LIKE '%marvin%harrell%'
      LIMIT 5
    `);
    console.log('Marvin records:', JSON.stringify(marvinRes.rows, null, 2));

    if (marvinRes.rows.length > 0) {
      const marvinId = marvinRes.rows[0].id;
      console.log(`\n=== rsbsa_farm_parcels for Marvin (id=${marvinId}) ===`);
      const marvinParcels = await client.query(`
        SELECT id, parcel_number, submission_id,
               ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee,
               tenant_land_owner_id, tenant_land_owner_name,
               farm_location_barangay, total_farm_area_ha,
               is_current_owner, created_at, updated_at
        FROM rsbsa_farm_parcels
        WHERE submission_id = $1
        ORDER BY created_at
      `, [marvinId]);
      console.log(`Found ${marvinParcels.rows.length} parcels for Marvin:`);
      for (const p of marvinParcels.rows) {
        console.log(`  Parcel #${p.parcel_number} (id=${p.id}), is_owner=${p.ownership_type_registered_owner}, is_tenant=${p.ownership_type_tenant}`);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
