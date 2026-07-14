const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ufhymmbrynufimayalsc.supabase.co';
const supabaseKey = 'sb_publishable_d0-wqhwRI8jBrAGdpZTF9Q_E2wyMhWB';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== INSPECTING ALFONSO, GUEVARA, AND TEST RECORDS ===");

  // 1. Query land_plots
  const { data: plots, error: plotsError } = await supabase
    .from('land_plots')
    .select('*');

  if (plotsError) {
    console.error("Plots query error:", plotsError);
    return;
  }

  const searchNames = ['Alfonso', 'Guevara', 'Test'];
  const matchedPlots = plots.filter(p => {
    const fullName = `${p.surname || ''} ${p.first_name || ''}`.toLowerCase();
    return searchNames.some(name => fullName.includes(name.toLowerCase()));
  });

  console.log(`Found ${matchedPlots.length} matched plot(s) in land_plots:`);
  matchedPlots.forEach(p => {
    console.log(`\nID: ${p.id}`);
    console.log(`Name: ${p.surname}, ${p.first_name} ${p.middle_name || ''}`);
    console.log(`FFRS ID: ${p.ffrs_id}`);
    console.log(`Parcel Number: ${p.parcel_number}`);
    console.log(`Area: ${p.area} ha`);
    console.log(`Barangay: ${p.barangay}`);
    console.log(`Farmer ID: ${p.farmer_id}`);
  });

  // 2. Query rsbsa_submission for similar names
  const { data: submissions, error: subError } = await supabase
    .from('rsbsa_submission')
    .select('id, "FIRST NAME", "LAST NAME", "MIDDLE NAME", "FFRS_CODE", status');

  if (subError) {
    console.error("Submissions error:", subError);
    return;
  }

  for (const name of searchNames) {
    console.log(`\nChecking rsbsa_submission for "${name}":`);
    const matches = submissions.filter(s => {
      const last = String(s["LAST NAME"] || "").toLowerCase();
      const first = String(s["FIRST NAME"] || "").toLowerCase();
      return last.includes(name.toLowerCase()) || first.includes(name.toLowerCase());
    });

    if (matches.length > 0) {
      console.log(`  Found ${matches.length} match(es):`);
      matches.forEach(m => {
        console.log(`    - ID: ${m.id}, Name: ${m["LAST NAME"]}, ${m["FIRST NAME"]}, FFRS: ${m.FFRS_CODE || m.ffrs_code}, Status: ${m.status}`);
      });
    } else {
      console.log(`  No matching farmer registered with name "${name}".`);
    }
  }
}

run();
