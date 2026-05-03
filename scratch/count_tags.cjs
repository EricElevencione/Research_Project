const fs = require('fs');
const content = fs.readFileSync('src/screens/admin/MasterlistPage.tsx', 'utf8');
let tags = {};
let pos = 0;
while (true) {
  let open = content.indexOf('<', pos);
  if (open === -1) break;
  let close = content.indexOf('>', open);
  if (close === -1) break;
  let tagStr = content.substring(open + 1, close).trim();
  
  if (tagStr.startsWith('!--')) {
    // skip comment
  } else if (tagStr === '') {
    tags['FRAGMENT'] = (tags['FRAGMENT'] || 0) + 1;
  } else if (tagStr === '/') {
    tags['FRAGMENT'] = (tags['FRAGMENT'] || 0) - 1;
  } else if (tagStr.startsWith('/')) {
    let name = tagStr.substring(1).trim().split(' ')[0].split('\n')[0];
    tags[name] = (tags[name] || 0) - 1;
  } else if (tagStr.endsWith('/')) {
    // self-closing
  } else {
    let name = tagStr.split(' ')[0].split('\n')[0];
    if (name) tags[name] = (tags[name] || 0) + 1;
  }
  pos = close + 1;
}
console.log(tags);
