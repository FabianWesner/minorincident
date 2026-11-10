// Summarise every .cpuprofile in a directory: top self-time and top inclusive-time functions.
// Usage: node tools/qa/threat/prof-summary.mjs <dir> [top=35]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.argv[2], top = Number(process.argv[3] ?? 35);
for (const file of readdirSync(dir).filter(f => f.endsWith('.cpuprofile'))) {
  const p = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const total = p.timeDeltas.reduce((a, b) => a + b, 0) / 1e6;
  if (total < 20) continue;
  const byId = new Map(p.nodes.map(n => [n.id, n])), parent = new Map();
  for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const self = new Map();
  p.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + p.timeDeltas[i] / 1e6));
  const label = n => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').slice(-2).join('/')}:${n.callFrame.lineNumber + 1}`;
  const selfBy = new Map(), inclBy = new Map();
  for (const [id, t] of self) {
    const n = byId.get(id); selfBy.set(label(n), (selfBy.get(label(n)) ?? 0) + t);
    const seen = new Set();
    for (let cur = id; cur !== undefined; cur = parent.get(cur)) { const l = label(byId.get(cur)); if (!seen.has(l)) { seen.add(l); inclBy.set(l, (inclBy.get(l) ?? 0) + t); } }
  }
  const fmt = m => [...m].sort((a, b) => b[1] - a[1]).slice(0, top).map(([l, t]) => `  ${t.toFixed(1).padStart(7)}s ${(100 * t / total).toFixed(1).padStart(5)}%  ${l}`).join('\n');
  console.log(`== ${file} total ${total.toFixed(1)}s\n-- self\n${fmt(selfBy)}\n-- inclusive\n${fmt(inclBy)}`);
}
