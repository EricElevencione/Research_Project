const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ufhymmbrynufimayalsc.supabase.co';
const supabaseKey = 'sb_publishable_d0-wqhwRI8jBrAGdpZTF9Q_E2wyMhWB';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== INSPECTING COLUMNS OF rsbsa_submission ===");
  const { data, error } = await supabase
    .from('rsbsa_submission')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching record:", error);
  } else if (data && data.length > 0) {
    console.log("Columns in rsbsa_submission:");
    Object.keys(data[0]).forEach(key => {
      console.log(`  - ${key}: ${typeof data[0][key]} (sample: ${data[0][key]})`);
    });
  } else {
    console.log("No records found in rsbsa_submission.");
  }
}

run();
