import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Query land_history rows for id = 110 and 111
  const { data, error } = await supabase
    .from('land_history')
    .select('*')
    .in('id', [110, 111]);

  if (error) {
    console.error(error);
    return;
  }

  console.log('--- Land History rows with ID 110 or 111 ---');
  console.log(JSON.stringify(data, null, 2));
}

run();
