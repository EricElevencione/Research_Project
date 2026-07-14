const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ufhymmbrynufimayalsc.supabase.co';
const supabaseKey = 'sb_publishable_d0-wqhwRI8jBrAGdpZTF9Q_E2wyMhWB';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== INSPECTING REGISTERED PARCELS FOR SUBMISSIONS 45 AND 46 ===");

  // 1. Fetch parcels for Albert Alfonso (submission_id: 45)
  const { data: alfonsoParcels, error: alfonsoError } = await supabase
    .from('rsbsa_farm_parcels')
    .select('*')
    .eq('submission_id', 45);

  if (alfonsoError) {
    console.error("Alfonso parcels error:", alfonsoError);
  } else {
    console.log(`Albert Alfonso (ID 45) registered parcels in rsbsa_farm_parcels:`);
    alfonsoParcels.forEach(p => {
      console.log(`  - ID: ${p.id}, Parcel No: ${p.parcel_number}, Barangay: ${p.farm_location_barangay}, Area: ${p.total_farm_area_ha} ha, is_current_owner: ${p.is_current_owner}`);
    });
  }

  // 2. Fetch parcels for Brian Guevara (submission_id: 46)
  const { data: guevaraParcels, error: guevaraError } = await supabase
    .from('rsbsa_farm_parcels')
    .select('*')
    .eq('submission_id', 46);

  if (guevaraError) {
    console.error("Guevara parcels error:", guevaraError);
  } else {
    console.log(`\nBrian Guevara (ID 46) registered parcels in rsbsa_farm_parcels:`);
    guevaraParcels.forEach(p => {
      console.log(`  - ID: ${p.id}, Parcel No: ${p.parcel_number}, Barangay: ${p.farm_location_barangay}, Area: ${p.total_farm_area_ha} ha, is_current_owner: ${p.is_current_owner}`);
    });
  }
}

run();
