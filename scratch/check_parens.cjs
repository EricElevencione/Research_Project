const fs = require('fs');
const content = fs.readFileSync('src/screens/admin/MasterlistPage.tsx', 'utf8');
let stack = [];
let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  for (let j = 0; j < line.length; j++) {
    let char = line[j];
    if (char === '(') stack.push({ line: i + 1, char: j + 1 });
    else if (char === ')') {
      if (stack.length === 0) console.log(`Extra ) at ${i + 1}:${j + 1}`);
      else stack.pop();
    }
  }
}
if (stack.length > 0) {
  console.log(`Remaining unclosed: ${stack.length}`);
  stack.forEach(s => console.log(`Unclosed ( at ${s.line}:${s.char}`));
}
