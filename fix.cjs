const fs = require('fs');
const glob = require('glob');
const files = glob.sync('src/**/*.tsx');
let changed = 0;
const svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('&#9776;')) {
        content = content.replace(/&#9776;/g, svg);
        fs.writeFileSync(file, content, 'utf8');
        changed++;
    }
}
console.log('Replaced in ' + changed + ' files');
