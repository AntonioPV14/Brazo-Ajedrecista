const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const htmlPath = path.resolve(__dirname, '..', 'views', 'learn.html');
const outPath = path.resolve(__dirname, '..', 'tools', 'learn_extracted.js');
let html = fs.readFileSync(htmlPath, 'utf8');
const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let scripts = '';
while ((match = scriptRe.exec(html)) !== null) {
  scripts += '\n// --- script chunk ---\n' + match[1] + '\n';
}
fs.writeFileSync(outPath, scripts, 'utf8');
console.log('Wrote extracted script to', outPath);
try {
  const res = cp.execSync(`node --check "${outPath}"`, { encoding: 'utf8' });
  console.log('Syntax OK');
  console.log(res);
} catch (e) {
  console.error('Syntax check failed:\n', e.stdout || '', e.stderr || '');
  process.exitCode = 2;
}
