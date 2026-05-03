const fs = require('fs');
const content = fs.readFileSync('src/screens/admin/MasterlistPage.tsx', 'utf8');
let count = 0;
let pos = content.indexOf('<div');
while (pos !== -1) {
  count++;
  pos = content.indexOf('<div', pos + 1);
}
console.log('Open divs:', count);

count = 0;
pos = content.indexOf('</div>');
while (pos !== -1) {
  count++;
  pos = content.indexOf('</div>', pos + 1);
}
console.log('Close divs:', count);
