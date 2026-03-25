const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'ffrs_system',
  user: 'postgres',
  password: 'admin123'
});
client.connect();

const validBarangays = [
  'Aurora-Del Pilar', 'Bacay', 'Bacong', 'Balabag', 'Balud',
  'Bantud', 'Bantud Fabrica', 'Baras', 'Barasan', 'Basa-Mabini Bonifacio',
  'Bolilao', 'Buenaflor Embarkadero', 'Burgos-Regidor', 'Calao', 'Cali',
  'Cansilayan', 'Capaliz', 'Cayos', 'Compayan', 'Dacutan',
  'Ermita', 'Ilaya 1st', 'Ilaya 2nd', 'Ilaya 3rd', 'Jardin',
  'Lacturan', 'Lopez Jaena - Rizal', 'Managuit', 'Maquina', 'Nanding Lopez',
  'Pagdugue', 'Paloc Bigque', 'Paloc Sool', 'Patlad', 'Pd Monfort North',
  'Pd Monfort South', 'Pulao', 'Rosario', 'Sapao', 'Sulangan',
  'Tabucan', 'Talusan', 'Tambobo', 'Tamboilan', 'Victorias'
];

const query = `
  SELECT id, "LAST NAME", "FARM LOCATION" 
  FROM rsbsa_submission 
  WHERE "FARM LOCATION" IS NOT NULL 
  ORDER BY "FARM LOCATION"
`;

client.query(query, (err, res) => {
  if (err) {
    console.error('Error:', err);
  } else {
    const records = res.rows;
    const invalidRecords = records.filter(r => !validBarangays.includes(r['FARM LOCATION'].trim()));
    console.log('Invalid farm locations found:');
    invalidRecords.forEach(r => {
      console.log(`ID: ${r.id}, Name: ${r['LAST NAME']}, Farm Location: "${r['FARM LOCATION']}"`);
    });
    console.log(`\nTotal invalid: ${invalidRecords.length}`);
  }
  client.end();
});
