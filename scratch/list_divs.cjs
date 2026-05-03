const fs = require('fs');
const content = fs.readFileSync('src/screens/admin/MasterlistPage.tsx', 'utf8');
let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  // Simple check for opening div (not handling strings/comments but should be enough for a quick look)
  if (line.includes('<div')) console.log(`${i+1}: OPEN ${line.trim()}`);
  if (line.includes('</div>')) console.log(`${i+1}: CLOSE ${line.trim()}`);
}
