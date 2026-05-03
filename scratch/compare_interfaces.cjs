const fs = require('fs');

function getProps(filePath, interfaceName) {
    const content = fs.readFileSync(filePath, 'utf8');
    const regex = new RegExp(`interface ${interfaceName} \\{([\\s\\S]+?)\\}`);
    const match = content.match(regex);
    if (!match) return [];
    return match[1].split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//') && line.includes(':'))
        .map(line => line.split(':')[0].replace('?', '').trim());
}

const joIncentProps = getProps('c:\\thes\\Research_Project\\src\\screens\\JO\\JoIncentives.tsx', 'RegionalAllocation');
const joAddFarmerProps = getProps('c:\\thes\\Research_Project\\src\\screens\\JO\\JoAddFarmerRequest.tsx', 'AllocationDetails');

console.log("JoIncentives props:", joIncentProps.length);
console.log("JoAddFarmerRequest props:", joAddFarmerProps.length);

const missingInIncent = joAddFarmerProps.filter(p => !joIncentProps.includes(p));
const missingInAddFarmer = joIncentProps.filter(p => !joAddFarmerProps.includes(p));

console.log("Missing in JoIncentives:", missingInIncent);
console.log("Missing in JoAddFarmerRequest:", missingInAddFarmer);
