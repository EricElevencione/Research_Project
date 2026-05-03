const fs = require('fs');
const content = fs.readFileSync('src/screens/admin/MasterlistPage.tsx', 'utf8');
let open = 0;
let close = 0;
let inString = false;
let inComment = false;
let inMultiComment = false;
let quoteChar = '';

for (let i = 0; i < content.length; i++) {
  let char = content[i];
  let next = content[i+1];
  
  if (inComment) {
    if (char === '\n') inComment = false;
    continue;
  }
  if (inMultiComment) {
    if (char === '*' && next === '/') {
      inMultiComment = false;
      i++;
    }
    continue;
  }
  if (inString) {
    if (char === quoteChar) inString = false;
    if (char === '\\') i++;
    continue;
  }
  if (char === '/' && next === '/') { inComment = true; i++; continue; }
  if (char === '/' && next === '*') { inMultiComment = true; i++; continue; }
  if (char === '"' || char === "'" || char === '`') { inString = true; quoteChar = char; continue; }
  
  if (char === '<') open++;
  if (char === '>') {
    if (i > 0 && content[i-1] === '=') {
        // arrow function
    } else {
        close++;
    }
  }
}
console.log('Open < :', open, 'Close > :', close);
