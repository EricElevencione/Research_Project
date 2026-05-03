const fs = require('fs');

const content = fs.readFileSync('c:\\thes\\Research_Project\\src\\screens\\JO\\JoIncentives.tsx', 'utf8');

// Extract RegionalAllocation interface properties
const interfaceMatch = content.match(/interface RegionalAllocation \{([\s\S]+?)\}/);
if (!interfaceMatch) {
    console.log("Could not find RegionalAllocation interface");
    process.exit(1);
}

const properties = interfaceMatch[1].split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//') && line.includes(': number'))
    .map(line => line.split(':')[0].replace('?', '').trim());

// Extract EDIT_FERTILIZER_FIELDS and EDIT_SEED_FIELDS keys
const fertFieldsMatch = content.match(/const EDIT_FERTILIZER_FIELDS:[\s\S]+? = \[([\s\S]+?)\];/);
const seedFieldsMatch = content.match(/const EDIT_SEED_FIELDS:[\s\S]+? = \[([\s\S]+?)\];/);

const fieldKeys = [];
if (fertFieldsMatch) {
    const keys = fertFieldsMatch[1].match(/key: "([^"]+)"/g);
    if (keys) fieldKeys.push(...keys.map(k => k.match(/"([^"]+)"/)[1]));
}
if (seedFieldsMatch) {
    const keys = seedFieldsMatch[1].match(/key: "([^"]+)"/g);
    if (keys) fieldKeys.push(...keys.map(k => k.match(/"([^"]+)"/)[1]));
}

console.log("Interface properties:", properties.length);
console.log("Field keys:", fieldKeys.length);

const missing = properties.filter(p => !fieldKeys.includes(p));
console.log("Missing fields in UI catalog:", missing);
