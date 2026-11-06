// fix67-a (L3-13): lateral offset of each recorded infected from the authored S-ramp centreline (deck half-width 2.31 m, rail to 2.88 m).
// Usage: node --import tsx/esm tools/qa/fix67/ramp-offsets.ts test-results/fix67/ramp-high-webgl2/ramp.json
import { readFileSync } from 'node:fs';
import { levelThreeLayouts } from '../../../src/levels/L3/layout';
import { highwayPoint } from '../../../src/levels/L3/highway';
import type { DistrictLayout } from '../../../src/levels/districts/types';

const [layout] = levelThreeLayouts([JSON.parse(readFileSync('public/assets/layouts/D-CORRIDOR.layout.json', 'utf8')) as DistrictLayout]);
const ramps = layout.placements.filter(p => p.assetId === 'kit.highway-onramp');
const samples = ramps.flatMap(p => Array.from({ length: 481 }, (_, i) => { const t = i / 480, c = highwayPoint(p, t), l = highwayPoint(p, t, 1); return { t, ramp: p.id, c, n: [l[0] - c[0], l[2] - c[2]] }; }));
const rows = JSON.parse(readFileSync(process.argv[2], 'utf8')) as { shot?: string; near: { id: number; x: number; y: number; z: number }[] }[];
for (const r of rows) {
  const out: string[] = [];
  for (const a of r.near) {
    if (a.y < 1) continue;
    let best = samples[0], bd = Infinity;
    for (const s of samples) { const d = (s.c[0] - a.x) ** 2 + (s.c[2] - a.z) ** 2; if (d < bd) { bd = d; best = s; } }
    const off = (a.x - best.c[0]) * best.n[0] + (a.z - best.c[2]) * best.n[1];
    if (Math.abs(off) > 1.9) out.push(`#${a.id} (${a.x},${a.y},${a.z}) t${best.t.toFixed(3)} off${off.toFixed(2)} dy${(a.y - best.c[1]).toFixed(2)}`);
  }
  console.log(r.shot ?? 'handover', out.length ? out.join(' | ') : 'none beyond 1.9 m');
}
