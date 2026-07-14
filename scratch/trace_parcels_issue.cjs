const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ufhymmbrynufimayalsc.supabase.co';
const supabaseKey = 'sb_publishable_d0-wqhwRI8jBrAGdpZTF9Q_E2wyMhWB';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== TRACING LAURENTE, FERGUS VASQUEZ AND SATORIO, MEMPHIS ROBAN ===");

  // 1. Query Submissions using columns
  const { data: submissions, error: subError } = await supabase
    .from('rsbsa_submission')
    .select('*');

  if (subError) {
    console.error("Submissions error:", subError);
    return;
  }

  const targets = submissions.filter(s => {
    const lastName = String(s["LAST NAME"] || "").toLowerCase();
    return lastName.includes("laurente") || lastName.includes("satorio");
  });

  console.log(`Found ${targets.length} target submission(s):`);
  for (const s of targets) {
    const fullName = `${s["LAST NAME"]}, ${s["FIRST NAME"]} ${s["MIDDLE NAME"] || ""}`.trim();
    console.log(`\nSubmission ID: ${s.id}`);
    console.log(`Name: ${fullName}`);
    console.log(`Reference No: ${s.referenceNumber || s.reference_number || s.ffrs_code || s.FFRS_CODE}`);
    console.log(`Status: ${s.status}`);
    console.log(`Farming Status: ${s.farmingStatus}`);

    // 2. Query rsbsa_farm_parcels
    const { data: parcels, error: parcelsError } = await supabase
      .from('rsbsa_farm_parcels')
      .select('*')
      .eq('submission_id', s.id);

    if (parcelsError) {
      console.error("  Parcels error:", parcelsError);
    } else {
      console.log(`  Farm Parcels (${parcels.length}):`);
      parcels.forEach(p => {
        console.log(`    - ID: ${p.id}, Parcel No: ${p.parcel_number}, Size: ${p.total_farm_area_ha} ha`);
        console.log(`      is_current_owner: ${p.is_current_owner}, is_farming: ${p.is_farming}, role: ${p.role}`);
        console.log(`      tenant_land_owner_name: "${p.tenant_land_owner_name}", tenant_land_owner_id: ${p.tenant_land_owner_id}`);
        console.log(`      lessee_land_owner_name: "${p.lessee_land_owner_name}", lessee_land_owner_id: ${p.lessee_land_owner_id}`);
      });
    }

    // 3. Query land_history
    const { data: history, error: historyError } = await supabase
      .from('land_history')
      .select('*')
      .eq('farmer_id', s.id);

    if (historyError) {
      console.error("  History error:", historyError);
    } else {
      console.log(`  Land History (${history.length}):`);
      history.forEach(h => {
        console.log(`    - ID: ${h.id}, Parcel No: ${h.parcel_number}, Size: ${h.total_farm_area_ha} ha`);
        console.log(`      is_current: ${h.is_current}, is_registered_owner: ${h.is_registered_owner}, is_tenant: ${h.is_tenant}, is_lessee: ${h.is_lessee}`);
        console.log(`      land_owner_name: "${h.land_owner_name}", land_owner_id: ${h.land_owner_id}`);
      });
    }

    // 4. Query parcels pointing to this farmer as landowner
    const { data: occupiedParcels, error: occupiedError } = await supabase
      .from('rsbsa_farm_parcels')
      .select('*')
      .or(`tenant_land_owner_id.eq.${s.id},lessee_land_owner_id.eq.${s.id}`);

    if (occupiedError) {
      console.error("  Occupied parcels error:", occupiedError);
    } else {
      console.log(`  Parcels pointing to him as owner (${occupiedParcels.length}):`);
      occupiedParcels.forEach(p => {
        console.log(`    - Parcel ID: ${p.id}, submission_id: ${p.submission_id}, Parcel No: ${p.parcel_number}`);
        console.log(`      is_current_owner: ${p.is_current_owner}, tenant_land_owner_name: "${p.tenant_land_owner_name}", lessee_land_owner_name: "${p.lessee_land_owner_name}"`);
      });
    }
  }
}

run();
