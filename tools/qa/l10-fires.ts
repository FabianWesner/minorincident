// look-l9b: list the D-CURE render-only accent fires and the burned-wreck candidates. npx tsx tools/qa/l10-fires.ts
import { readFileSync } from 'node:fs';
import { cureAccents } from '../../src/render/NightAccents';
import { cure } from '../../src/levels/L10/district';
import type { DistrictLayout, Point } from '../../src/levels/districts/types';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;
const fires = cureAccents(layout.placements).fires;
console.log('fires', fires.length, 'cars', fires.filter(f => f.car).length, 'R1', fires.filter(f => f.x < 760).length, 'R6', fires.filter(f => f.x > 2900).length);
console.log(fires.map(f => `${Math.round(f.x)},${Math.round(f.z)}${f.car ? 'c' : ''}`).join(' '));
const seg = (p: Point, a: Point, b: Point) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz); };
const lines: Point[][] = [...cure.regions.map(r => r.route as Point[]), ...cure.detours.map(d => d.route as Point[])];
const lane = (p: Point) => Math.min(...lines.map(l => Math.min(...l.slice(1).map((b, i) => seg(p, l[i], b))))) - 4;
for (const p of layout.placements) if (p.assetId.startsWith('veh.') && p.decay === 'burned' && (p.position[0] < 760 || p.position[0] > 2917)) console.log('burned', p.assetId, p.position.map(v => Math.round(v)).join(','), 'lane', lane([p.position[0], p.position[2]]).toFixed(1));
