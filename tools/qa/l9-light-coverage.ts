import { readFileSync } from 'node:fs';
import { crossing } from '../../src/levels/L9/district';
import { crossingAccents } from '../../src/render/NightAccents';

/** l9-night-look: share of route samples (every 5 m) whose ~zoom-1 game frame (a 16 m disc around the vehicle) holds a warm
 * light point (fire or a pooled lamp/flare), per route. E31 art addendum: "each camera frame along the route shows at least one
 * light point". Usage: npx tsx tools/qa/l9-light-coverage.ts [radius=16] */
const radius = Number(process.argv[2] ?? 16);
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CROSSING.layout.json', 'utf8'));
const { points, fires } = crossingAccents(layout.placements);
const lights = [...fires.map(f => [f.x, f.z, 'fire'] as const), ...points.filter(p => p.pool).map(p => [p.x, p.z, p.kind] as const)];
for (const r of crossing.routes) {
  let n = 0, lit = 0, fired = 0;
  for (const [i, b] of r.points.slice(1).entries()) {
    const a = r.points[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 0; s < d; s += 5) {
      const x = a[0] + (b[0] - a[0]) * s / d, z = a[1] + (b[1] - a[1]) * s / d; n++;
      const near = lights.filter(l => Math.hypot(l[0] - x, l[1] - z) < radius);
      if (near.length) lit++; if (near.some(l => l[2] === 'fire')) fired++;
    }
  }
  console.log(`${r.id}: ${(100 * lit / n).toFixed(0)}% of frames hold a light point, ${(100 * fired / n).toFixed(0)}% a fire (${n} samples)`);
}
console.log(`fires ${fires.length}, pooled points ${points.filter(p => p.pool).length}`);
