const fs = require('fs');
const content = fs.readFileSync('src/screens/admin/MasterlistPage.tsx', 'utf8');
let stack = [];
let inString = false;
let inComment = false;
let inMultiComment = false;
let quoteChar = '';
let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  for (let j = 0; j < line.length; j++) {
    let char = line[j];
    let next = line[j+1];
    
    if (inComment) continue;
    if (inMultiComment) {
      if (char === '*' && next === '/') {
        inMultiComment = false;
        j++;
      }
      continue;
    }
    if (inString) {
      if (char === quoteChar) {
          // Template literals can have nested ${}
          if (quoteChar === '`') {
              // Simple check: we don't handle nested template literals perfectly
              // but we need to handle ${}
          }
          inString = false;
      }
      if (char === '\\') j++;
      continue;
    }
    if (char === '/' && next === '/') { inComment = true; j++; continue; }
    if (char === '/' && next === '*') { inMultiComment = true; j++; continue; }
    if (char === '"' || char === "'" || char === '`') { inString = true; quoteChar = char; continue; }
    
    if (char === '(') stack.push({ line: i + 1, char: j + 1 });
    else if (char === ')') {
      if (stack.length === 0) console.log(`Extra ) at ${i + 1}:${j + 1}: ${line.trim()}`);
      else stack.pop();
    }
  }
  inComment = false;
}
