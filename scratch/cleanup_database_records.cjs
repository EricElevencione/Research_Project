const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ufhymmbrynufimayalsc.supabase.co';
const supabaseKey = 'sb_secret_1CBR4FCYK0HnbG-dYUsS9Q_TUsl4pOS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== STARTING ADMIN PRIVILEGE DATABASE CLEANUP WITH FK RESOLUTION ===");

  const historyIds = [11, 83, 114, 123];

  // 1. Find any rows that reference these IDs as previous_history_id
  const { data: childRows, error: childError } = await supabase
    .from('land_history')
    .select('id, previous_history_id')
    .in('previous_history_id', historyIds);

  if (childError) {
    console.error("  Error querying referencing rows:", childError.message);
  } else {
    console.log(`  Found ${childRows.length} referencing rows in land_history.`);
    if (childRows.length > 0) {
      console.log("  Nullifying previous_history_id references...");
      for (const row of childRows) {
        const { error: updateError } = await supabase
          .from('land_history')
          .update({ previous_history_id: null })
          .eq('id', row.id);
        
        if (updateError) {
          console.error(`    Failed to nullify for row ID ${row.id}:`, updateError.message);
        } else {
          console.log(`    Successfully nullified reference on row ID ${row.id}`);
        }
      }
    }
  }

  // 2. Now delete the 4 broken land history entries
  console.log(`\nDeleting 4 broken land history entries:`);
  const { data: deletedHistory, error: historyError } = await supabase
    .from('land_history')
    .delete()
    .in('id', historyIds)
    .select('id, parcel_number, land_owner_name');

  if (historyError) {
    console.error("  Error deleting land history:", historyError.message);
  } else {
    console.log(`  Successfully deleted ${deletedHistory ? deletedHistory.length : 0} history entry/entries:`);
    if (deletedHistory) {
      deletedHistory.forEach(h => {
        console.log(`    - ID: ${h.id} (Parcel: ${h.parcel_number}, Owner: ${h.land_owner_name})`);
      });
    }
  }

  console.log("\n=== DATABASE CLEANUP COMPLETED ===");
}

run();
