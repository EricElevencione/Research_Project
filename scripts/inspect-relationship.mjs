import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ufhymmbrynufimayalsc.supabase.co";
const SUPABASE_KEY = "sb_secret_1CBR4FCYK0HnbG-dYUsS9Q_TUsl4pOS";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const run = async () => {
  const { data: parcels } = await supabase
    .from("rsbsa_farm_parcels")
    .select("*")
    .eq("submission_id", 80);
  console.log("Parcels for sub 80:", parcels);
};

run();
