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
const adminAllocProps = getProps('c:\\thes\\Research_Project\\src\\screens\\admin\\AdminCreateAllocation.tsx', 'RegionalAllocation');

console.log("JoIncentives props:", joIncentProps.length);
console.log("AdminCreateAllocation props:", adminAllocProps.length);

const missingInIncent = adminAllocProps.filter(p => !joIncentProps.includes(p));
const missingInAdmin = joIncentProps.filter(p => !adminAllocProps.includes(p));

console.log("Missing in JoIncentives:", missingInIncent);
console.log("Missing in AdminCreateAllocation:", missingInAdmin);
