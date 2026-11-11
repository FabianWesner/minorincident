// r42-l9pin: table of an l9-bay-matrix jsonl (last row per case+seed wins). Usage: node tools/qa/r42/summary.mjs <file.jsonl>
import { readFileSync } from 'node:fs';
const rows = new Map();
for (const line of readFileSync(process.argv[2], 'utf8').split('\n')) {
  if (!line.trim().startsWith('{')) continue;
  try { const r = JSON.parse(line); if (r.case !== 'route') rows.set(`${r.case}:${r.seed}`, r); } catch { /* partial line */ }
}
const cases = [...new Set([...rows.values()].map(r => r.case))];
for (const c of cases) {
  const list = [...rows.values()].filter(r => r.case === c).sort((a, b) => a.seed - b.seed);
  const saved = list.map(r => r.saved < 0 ? 'x' : r.saved);
  const ok = list.filter(r => r.saved >= 2).length;
  console.log(`${c.padEnd(11)} saved/4 per seed: ${saved.join(' ')}  (>=2: ${ok}/${list.length})  evac at: ${list.map(r => r.evacPos || '-').join(' | ')}  pin max ${Math.max(...list.map(r => r.longestPinS))} s  end: ${list.map(r => r.end.replace('phase ', '')).join(',')}  courier deaths ${list.map(r => r.courierDeaths ?? 0).join(',')}`);
}
