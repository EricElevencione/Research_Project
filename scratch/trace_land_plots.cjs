const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ufhymmbrynufimayalsc.supabase.co';
const supabaseKey = 'sb_publishable_d0-wqhwRI8jBrAGdpZTF9Q_E2wyMhWB';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== SEARCHING LAND_PLOTS FOR UNREGISTERED PARCELS ===");
  const targetNames = ['Woods', 'Xcdf', 'Elena', 'Yusra'];

  // Query all land_plots
  const { data: plots, error } = await supabase
    .from('land_plots')
    .select('*');

  if (error) {
    console.error("Error querying land_plots:", error);
    return;
  }

  console.log(`Total land_plots rows: ${plots.length}`);

  const matches = plots.filter(p => {
    const fullName = `${p.surname || ''} ${p.first_name || ''} ${p.middle_name || ''}`.toLowerCase();
    return targetNames.some(name => fullName.includes(name.toLowerCase()));
  });

  console.log(`Found ${matches.length} matching record(s) in land_plots:`);
  matches.forEach(p => {
    console.log(`\nID: ${p.id}`);
    console.log(`Name: ${p.surname}, ${p.first_name} ${p.middle_name || ''}`);
    console.log(`FFRS ID / Code: ${p.ffrs_id}`);
    console.log(`Parcel Number: ${p.parcel_number}`);
    console.log(`Area: ${p.area} ha`);
    console.log(`Barangay: ${p.barangay}`);
    console.log(`Farmer ID: ${p.farmer_id}`);
  });
}

run();
