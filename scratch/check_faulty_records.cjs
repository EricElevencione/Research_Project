const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ufhymmbrynufimayalsc.supabase.co';
const supabaseKey = 'sb_publishable_d0-wqhwRI8jBrAGdpZTF9Q_E2wyMhWB';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== COMPARING LAND_PLOTS AND RSBSA_SUBMISSION ===");

  // 1. Fetch all submissions
  const { data: submissions, error: subError } = await supabase
    .from('rsbsa_submission')
    .select('id, "FIRST NAME", "LAST NAME", "MIDDLE NAME", "FFRS_CODE", status');

  if (subError) {
    console.error("Submissions error:", subError);
    return;
  }

  // 2. Fetch all land_plots
  const { data: plots, error: plotsError } = await supabase
    .from('land_plots')
    .select('*');

  if (plotsError) {
    console.error("Plots error:", plotsError);
    return;
  }

  const targets = [
    { name: "Woods, Upton Osian", surname: "Woods", first: "Upton" },
    { name: "Xcdf, Sdxcz Xcsd", surname: "Xcdf", first: "Sdxcz" },
    { name: "Elena, Melborn Nelson", surname: "Elena", first: "Melborn" },
    { name: "Yusra Gary", surname: "Yusra", first: "Gary", isSpecial: true }
  ];

  for (const t of targets) {
    console.log(`\n----------------------------------------`);
    console.log(`Checking plot: "${t.name}"`);

    // Search submissions for matches
    const matches = submissions.filter(s => {
      const last = String(s["LAST NAME"] || "").toLowerCase();
      const first = String(s["FIRST NAME"] || "").toLowerCase();
      if (t.isSpecial) {
        return last.includes("yusra") || first.includes("yusra") || last.includes("gary") || first.includes("gary");
      }
      return last.includes(t.surname.toLowerCase()) || first.includes(t.first.toLowerCase());
    });

    if (matches.length > 0) {
      console.log(`  -> Match found in rsbsa_submission!`);
      matches.forEach(m => {
        console.log(`     Submission ID: ${m.id}`);
        console.log(`     Full Name: ${m["LAST NAME"]}, ${m["FIRST NAME"]} ${m["MIDDLE NAME"] || ""}`);
        console.log(`     FFRS Code: ${m.FFRS_CODE || m.ffrs_code}`);
        console.log(`     Status: ${m.status}`);
      });
    } else {
      console.log(`  -> No matching farmer registered in rsbsa_submission at all.`);
    }
  }

  // Let's also look for general "problems" in land_history.
  // For example, land_history records where is_current is true but the parcel does not exist in rsbsa_farm_parcels,
  // or land_history records where farmer_id is null, etc.
  console.log(`\n========================================`);
  console.log("=== CHECKING LAND_HISTORY FOR FAULTY ENTRIES ===");

  const { data: history, error: historyError } = await supabase
    .from('land_history')
    .select('*');

  if (historyError) {
    console.error("Land history error:", historyError);
    return;
  }

  console.log(`Total land_history records: ${history.length}`);
  
  // Find land_history rows with potential issues:
  // 1. Missing farmer_id or land_owner_id
  // 2. farmer_id does not exist in rsbsa_submission
  const invalidFarmerHistory = [];
  const submissionsIds = new Set(submissions.map(s => s.id));

  for (const h of history) {
    if (h.farmer_id && !submissionsIds.has(h.farmer_id)) {
      invalidFarmerHistory.push({
        id: h.id,
        parcel_number: h.parcel_number,
        land_owner_name: h.land_owner_name,
        farmer_name: h.farmer_name,
        farmer_id: h.farmer_id,
        reason: `linked farmer_id (${h.farmer_id}) does not exist in rsbsa_submission`
      });
    }
  }

  console.log(`Faulty land_history records: ${invalidFarmerHistory.length}`);
  invalidFarmerHistory.forEach(h => {
    console.log(`  - History Row ID: ${h.id}, Parcel: ${h.parcel_number}, Owner: ${h.land_owner_name}, Farmer ID: ${h.farmer_id}`);
    console.log(`    Reason: ${h.reason}`);
  });
}

run();
