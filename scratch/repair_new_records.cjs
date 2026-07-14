const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ufhymmbrynufimayalsc.supabase.co';
const supabaseKey = 'sb_secret_1CBR4FCYK0HnbG-dYUsS9Q_TUsl4pOS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== STARTING DATABASE REPAIR AND LINKING ===");

  // 1. Delete the dummy test plot
  const dummyPlotId = 'shape-1776753339660-d04b5efbace14';
  console.log(`\nDeleting dummy test plot:`);
  const { data: deletedDummy, error: deleteError } = await supabase
    .from('land_plots')
    .delete()
    .eq('id', dummyPlotId)
    .select('id, surname, first_name');

  if (deleteError) {
    console.error("  Error deleting dummy plot:", deleteError.message);
  } else {
    console.log(`  Successfully deleted ${deletedDummy ? deletedDummy.length : 0} dummy plot(s).`);
  }

  // 2. Link Albert Alfonso's plots
  console.log(`\nLinking Albert Alfonso (Farmer ID 45) plots:`);
  
  // Plot 1: Calao (Parcel-36-2)
  const { data: u1, error: e1 } = await supabase
    .from('land_plots')
    .update({ farmer_id: 45 })
    .eq('id', 'shape-1775218123987-807a2b8e997a88')
    .select('id, parcel_number, farmer_id');
  if (e1) console.error("  Error linking plot 1:", e1.message);
  else console.log(`  Linked Calao plot (ID: ${u1[0].id}) to farmer_id: ${u1[0].farmer_id}`);

  // Plot 2: Bacong (update parcel number to Parcel-45-1 and farmer_id to 45)
  const { data: u2, error: e2 } = await supabase
    .from('land_plots')
    .update({ farmer_id: 45, parcel_number: 'Parcel-45-1' })
    .eq('id', 'shape-1775563607462-8ad8e382c9a4e')
    .select('id, parcel_number, farmer_id');
  if (e2) console.error("  Error linking plot 2:", e2.message);
  else console.log(`  Linked Bacong plot (ID: ${u2[0].id}) to farmer_id: ${u2[0].farmer_id}, parcel_number: ${u2[0].parcel_number}`);

  // 3. Link Brian Guevara's plots
  console.log(`\nLinking Brian Guevara (Farmer ID 46) plots:`);

  // Plot 1: Dacutan (Parcel-46-2)
  const { data: g1, error: eg1 } = await supabase
    .from('land_plots')
    .update({ farmer_id: 46 })
    .eq('id', 'shape-1775135333948-ac13e78348f788')
    .select('id, parcel_number, farmer_id');
  if (eg1) console.error("  Error linking Guevara plot 1:", eg1.message);
  else console.log(`  Linked Dacutan plot (ID: ${g1[0].id}) to farmer_id: ${g1[0].farmer_id}`);

  // Plot 2: Lacturan (update parcel number to Parcel-46-2 and farmer_id to 46)
  const { data: g2, error: eg2 } = await supabase
    .from('land_plots')
    .update({ farmer_id: 46, parcel_number: 'Parcel-46-2' })
    .eq('id', 'shape-1775135421894-67fd69bed954e8')
    .select('id, parcel_number, farmer_id');
  if (eg2) console.error("  Error linking Guevara plot 2:", eg2.message);
  else console.log(`  Linked Lacturan plot (ID: ${g2[0].id}) to farmer_id: ${g2[0].farmer_id}, parcel_number: ${g2[0].parcel_number}`);

  // Plot 3: Bacong (Parcel-46-1)
  const { data: g3, error: eg3 } = await supabase
    .from('land_plots')
    .update({ farmer_id: 46 })
    .eq('id', 'shape-1775135377853-b38858fd87189')
    .select('id, parcel_number, farmer_id');
  if (eg3) console.error("  Error linking Guevara plot 3:", eg3.message);
  else console.log(`  Linked Bacong plot 1 (ID: ${g3[0].id}) to farmer_id: ${g3[0].farmer_id}`);

  // Plot 4: Bacong (Parcel-46-1)
  const { data: g4, error: eg4 } = await supabase
    .from('land_plots')
    .update({ farmer_id: 46 })
    .eq('id', 'shape-1775483339530-fbaf52b918c05')
    .select('id, parcel_number, farmer_id');
  if (eg4) console.error("  Error linking Guevara plot 4:", eg4.message);
  else console.log(`  Linked Bacong plot 2 (ID: ${g4[0].id}) to farmer_id: ${g4[0].farmer_id}`);

  console.log("\n=== DATABASE REPAIR COMPLETED ===");
}

run();
