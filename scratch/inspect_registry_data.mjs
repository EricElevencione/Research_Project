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
  console.log('--- 1. Querying farmer_aggregated_unified ---');
  const { data: unified, error: uError } = await supabase
    .from('farmer_aggregated_unified')
    .select('*')
    .limit(10);
    
  if (uError) {
    console.error('Error fetching farmer_aggregated_unified:', uError);
  } else {
    console.log(`Fetched ${unified.length} records.`);
    console.log('Sample record keys:', Object.keys(unified[0] || {}));
    console.log('Sample record 0:', JSON.stringify(unified[0], null, 2));
    console.log('Sample record 1:', JSON.stringify(unified[1], null, 2));
  }

  console.log('--- 2. Checking for duplicates or anomalies ---');
  // Let's fetch all records to analyze
  const { data: allUnified, error: allUError } = await supabase
    .from('farmer_aggregated_unified')
    .select('*');

  if (allUError) {
    console.error('Error fetching all records:', allUError);
    return;
  }

  console.log(`Total records in farmer_aggregated_unified: ${allUnified.length}`);

  // Check duplicate farmer_id
  const farmerIdCounts = {};
  allUnified.forEach(row => {
    farmerIdCounts[row.farmer_id] = (farmerIdCounts[row.farmer_id] || 0) + 1;
  });

  const duplicateFarmerIds = Object.entries(farmerIdCounts).filter(([id, count]) => count > 1);
  console.log('Farmers appearing more than once in the unified view:', duplicateFarmerIds.length);
  duplicateFarmerIds.slice(0, 10).forEach(([id, count]) => {
    const rows = allUnified.filter(row => row.farmer_id === Number(id));
    console.log(`Farmer ID ${id} (Count: ${count}):`, rows.map(r => r.farmer_name));
  });

  // Check parcels structure inside farmer_aggregated_unified
  // Note that unified view has column 'parcels' which is probably an array of parcel objects
  let totalParcelsCount = 0;
  let parcelIdCounts = {};
  allUnified.forEach(row => {
    if (Array.isArray(row.parcels)) {
      totalParcelsCount += row.parcels.length;
      row.parcels.forEach(p => {
        if (p && p.id) {
          parcelIdCounts[p.id] = (parcelIdCounts[p.id] || 0) + 1;
        }
      });
    }
  });

  console.log(`Total parcels across all unified records: ${totalParcelsCount}`);
  const duplicateParcelIds = Object.entries(parcelIdCounts).filter(([id, count]) => count > 1);
  console.log('Parcels appearing more than once across the unified view:', duplicateParcelIds.length);
  duplicateParcelIds.slice(0, 10).forEach(([id, count]) => {
    console.log(`Parcel ID ${id} appears ${count} times.`);
  });
}

run();
