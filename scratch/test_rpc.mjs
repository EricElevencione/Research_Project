import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // 1. Get an existing farmer ID to act as Harvey Solano Kim (land owner / tenant)
  const { data: submissions, error: sErr } = await supabase
    .from('rsbsa_submission')
    .select('id, "FIRST NAME", "LAST NAME"')
    .limit(2);

  if (sErr || !submissions || submissions.length === 0) {
    console.error('No submissions found or error:', sErr);
    return;
  }

  const helperFarmer = submissions[0];
  console.log(`Using helper farmer: ID=${helperFarmer.id}, Name=${helperFarmer['FIRST NAME']} ${helperFarmer['LAST NAME']}`);

  // 2. Prepare test payload
  const testPayload = {
    firstName: 'TestEric',
    surname: 'TestElevencione',
    middleName: 'Solano',
    extensionName: '',
    gender: 'Male',
    dateOfBirth: '1985-05-15',
    barangay: 'Cayos',
    municipality: 'Dumangas',
    mainLivelihood: 'Rice',
    isActivelyFarming: true,
    totalFarmArea: 5.5,
    ownershipCategory: 'owner', // registrant is Owner (YES path)
    farmlandParcels: [
      {
        farmLocationBarangay: 'Cayos',
        farmLocationMunicipality: 'Dumangas',
        totalFarmAreaHa: 2.5,
        parcelNo: '1',
        isCultivating: false,
        cultivatorSubmissionId: helperFarmer.id,
        cultivationStatusReason: `Cultivated by tenant: ${helperFarmer['FIRST NAME']} ${helperFarmer['LAST NAME']}`,
        ownershipTypeRegisteredOwner: true,
        ownershipTypeTenant: false,
        ownershipTypeLessee: false,
        tenantLandOwnerName: '',
        lesseeLandOwnerName: ''
      },
      {
        farmLocationBarangay: 'Bacay',
        farmLocationMunicipality: 'Dumangas',
        totalFarmAreaHa: 3.0,
        parcelNo: '2',
        isCultivating: true,
        ownershipTypeRegisteredOwner: false,
        ownershipTypeTenant: true,
        ownershipTypeLessee: false,
        tenantLandOwnerName: `${helperFarmer['FIRST NAME']} ${helperFarmer['LAST NAME']}`,
        tenantLandOwnerId: helperFarmer.id,
        lesseeLandOwnerName: ''
      }
    ]
  };

  console.log('Calling register_farmer_with_parcels RPC with test data...');
  const { data, error } = await supabase.rpc('register_farmer_with_parcels', {
    p_data: testPayload
  });

  if (error) {
    console.error('❌ RPC Error:', error);
  } else {
    console.log('✅ RPC Success! Result:', JSON.stringify(data, null, 2));

    const submissionId = data.submissionId;

    // Verify rsbsa_farm_parcels
    const { data: parcels, error: pErr } = await supabase
      .from('rsbsa_farm_parcels')
      .select('*')
      .eq('submission_id', submissionId);

    console.log('\n--- Verify rsbsa_farm_parcels ---');
    console.log(JSON.stringify(parcels, null, 2));

    // Verify land_history
    const { data: history, error: hErr } = await supabase
      .from('land_history')
      .select('*')
      .eq('rsbsa_submission_id', submissionId);

    console.log('\n--- Verify land_history ---');
    console.log(JSON.stringify(history, null, 2));

    // Clean up test records
    console.log('\nCleaning up test records...');
    await supabase.from('land_history').delete().eq('rsbsa_submission_id', submissionId);
    await supabase.from('rsbsa_farm_parcels').delete().eq('submission_id', submissionId);
    await supabase.from('rsbsa_submission').delete().eq('id', submissionId);
    console.log('Cleanup completed.');
  }
}

main();
