const fs = require('fs');
const s = fs.readFileSync(require('path').join(__dirname,'learn_extracted.js'), 'utf8');
let counts = { '(':0, ')':0, '{':0, '}':0, '[':0, ']':0 };
for (let i=0;i<s.length;i++){ const c=s[i]; if (counts.hasOwnProperty(c)) counts[c]++; }
console.log(counts);
// report diff
console.log('paren diff', counts['(']-counts[')']);
console.log('brace diff', counts['{']-counts['}']);
console.log('bracket diff', counts['[']-counts[']']);
