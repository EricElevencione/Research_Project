const fs = require('fs');
const content = fs.readFileSync('src/screens/admin/MasterlistPage.tsx', 'utf8');
let stack = [];
let pos = 0;
let lines = content.split('\n');

function getLine(p) {
    return content.substring(0, p).split('\n').length;
}

while (true) {
  let open = content.indexOf('<', pos);
  if (open === -1) break;
  let close = content.indexOf('>', open);
  if (close === -1) break;
  let tagStr = content.substring(open + 1, close).trim();
  
  if (tagStr.startsWith('!--')) {
    // skip
  } else if (tagStr === '') {
    stack.push({ name: 'FRAGMENT', line: getLine(open) });
  } else if (tagStr === '/') {
    if (stack.length === 0) {
      console.log(`Extra </> at line ${getLine(open)}`);
    } else if (stack[stack.length-1].name !== 'FRAGMENT') {
      console.log(`Mismatched </> at line ${getLine(open)}. Expected </${stack[stack.length-1].name}>`);
      stack.pop();
    } else {
      stack.pop();
    }
  } else if (tagStr.startsWith('/')) {
    let name = tagStr.substring(1).trim().split(' ')[0].split('\n')[0];
    if (stack.length === 0) {
      console.log(`Extra </${name}> at line ${getLine(open)}`);
    } else if (stack[stack.length-1].name !== name) {
      console.log(`Mismatched </${name}> at line ${getLine(open)}. Expected </${stack[stack.length-1].name}> from line ${stack[stack.length-1].line}`);
      // Find the tag in the stack
      let found = false;
      for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].name === name) {
              stack.splice(i, 1);
              found = true;
              break;
          }
      }
    } else {
      stack.pop();
    }
  } else if (tagStr.endsWith('/') || tagStr.startsWith('input') || tagStr.startsWith('img') || tagStr.startsWith('br') || tagStr.startsWith('hr')) {
    // self-closing or known self-closing
  } else {
    let name = tagStr.split(' ')[0].split('\n')[0].replace(/[^\w-]/g, '');
    // Exclude generics (start with uppercase and in a JS context, but here we just check if it's a known HTML tag or common component)
    const commonTags = ['div', 'span', 'button', 'select', 'option', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'p', 'svg', 'line', 'a', 'label', 'section', 'header', 'main', 'footer'];
    const isComponent = name && name[0] === name[0].toUpperCase() && !name.includes('[');
    
    if (commonTags.includes(name) || isComponent) {
      stack.push({ name, line: getLine(open) });
    }
  }
  pos = close + 1;
}
if (stack.length > 0) {
  console.log(`Remaining unclosed: ${stack.length}`);
  stack.forEach(s => console.log(`Unclosed <${s.name}> from line ${s.line}`));
}
