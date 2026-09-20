const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.join(__dirname,'learn_extracted.js'), 'utf8');
let par=0, br=0, brk=0;
for (let i=0;i<s.length;i++){
  const c=s[i];
  if (c==='(') par++;
  if (c===')') par--;
  if (c==='{' ) br++;
  if (c==='}') br--;
  if (c==='[') brk++;
  if (c===']') brk--;
  if (par<0 || br<0 || brk<0){
    const start = Math.max(0,i-80);
    const end = Math.min(s.length,i+80);
    console.log('Negative at', i, 'char', c, 'context:\n', s.slice(start,end));
    process.exit(0);
  }
}
console.log('No negative; final counts', {par,br,brk});
// If no negative then show final tail for inspection
console.log('\nTail (last 300 chars):\n', s.slice(-300));
