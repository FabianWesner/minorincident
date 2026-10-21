// Aggregate a .cpuprofile by self time per function and per file, and inclusive time for named functions.
// Usage: node tools/perf/cpuprofile-summary.mjs <file.cpuprofile> [top=30] [--inclusive name,name]
import { readFileSync } from 'node:fs';

const [file, topArg, ...rest] = process.argv.slice(2);
const top = Number(topArg ?? 30);
const inclusive = rest.includes('--inclusive') ? rest[rest.indexOf('--inclusive') + 1].split(',') : [];
const profile = JSON.parse(readFileSync(file, 'utf8'));
const nodes = new Map(profile.nodes.map(n => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const self = new Map(), total = profile.timeDeltas.reduce((a, b) => a + b, 0) / 1000;
for (let i = 0; i < profile.samples.length; i++) { const id = profile.samples[i], dt = (profile.timeDeltas[i] ?? 0) / 1000; self.set(id, (self.get(id) ?? 0) + dt); }
const label = n => `${n.callFrame.functionName || '(anonymous)'} ${n.callFrame.url.split('/').slice(-1)[0]}:${n.callFrame.lineNumber}`;
const byFunction = new Map(), byFile = new Map();
for (const [id, ms] of self) {
  const n = nodes.get(id), key = label(n), file = n.callFrame.url.split('/').slice(-1)[0] || n.callFrame.functionName;
  byFunction.set(key, (byFunction.get(key) ?? 0) + ms); byFile.set(file, (byFile.get(file) ?? 0) + ms);
}
console.log(`total ${total.toFixed(0)} ms`);
console.log('\nself time by file:');
for (const [k, v] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${v.toFixed(0).padStart(6)}  ${k}`);
console.log('\nself time by function:');
for (const [k, v] of [...byFunction].sort((a, b) => b[1] - a[1]).slice(0, top)) console.log(`  ${v.toFixed(0).padStart(6)}  ${k}`);
if (inclusive.length) {
  console.log('\ninclusive time (samples whose stack contains the function):');
  for (const name of inclusive) {
    let ms = 0;
    for (const [id, dt] of self) { for (let p = id; p !== undefined; p = parent.get(p)) if (nodes.get(p).callFrame.functionName === name) { ms += dt; break; } }
    console.log(`  ${ms.toFixed(0).padStart(6)}  ${name}`);
  }
}
