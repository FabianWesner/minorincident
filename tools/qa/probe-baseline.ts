import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { l4 } from '../../src/data/l4';
import { l4PerimeterWalls } from '../../src/data/l4Perimeter';
import physicsAssets from '../../src/data/physicsAssets';
import { obbHitsAabb } from '../../tests/qa/invariants/oracles';
import type { DistrictLayout } from '../../src/levels/districts/types';

// Cheap historical component probe, with no checkout or second build. Imported data must be byte-identical to the ref.
const ref = process.argv[2] ?? 'lane/batch13g';
const files = ['src/data/l3.ts', 'src/data/l4.ts', 'src/data/l4Perimeter.ts', 'src/data/physicsAssets.ts', 'src/sim/missions/L4Spectacle.ts'];
const sources = files.map(path => {
  const old = execFileSync('git', ['show', `${ref}:${path}`]);
  if (!old.equals(readFileSync(path))) throw new Error(`Historical source differs: ${path}; use an isolated full probe instead`);
  return { path, blob: execFileSync('git', ['rev-parse', `${ref}:${path}`], { encoding: 'utf8' }).trim() };
});
const layout = JSON.parse(execFileSync('git', ['show', `${ref}:public/assets/layouts/D-FAIR.layout.json`], { encoding: 'utf8' })) as DistrictLayout;
const solids = layout.colliders.filter(c => !c.walkable && /^(bld\.|prop\.(?:.*fence|.*barrier)|l4-)/.test(c.id) && !c.id.includes('hedge')).map(c => ({ id: c.id, aabb: c.aabb }));
for (const w of l4PerimeterWalls) solids.push({ id: w.id, aabb: { min: [w.x - w.halfX, w.y - w.halfY, w.z - w.halfZ], max: [w.x + w.halfX, w.y + w.halfY, w.z + w.halfZ] } });
const conflicts = new Set<string>(); let poses = 0;
function check(x: number, z: number, yaw: number, label: string) {
  poses++;
  for (const b of physicsAssets['veh.tank'].boxes) {
    const bx = (b.min[0] + b.max[0]) / 2, bz = (b.min[2] + b.max[2]) / 2, c = Math.cos(yaw), s = Math.sin(yaw);
    for (const solid of solids) if (obbHitsAabb(x + c * bx + s * bz, z - s * bx + c * bz, yaw, (b.max[0] - b.min[0]) / 2, (b.max[2] - b.min[2]) / 2, .7 + b.min[1], .7 + b.max[1], solid.aabb)) conflicts.add(`${label} overlaps ${solid.id}`);
  }
}
for (let i = 1; i < l4.tank.path.length; i++) {
  const a = l4.tank.path[i - 1], b = l4.tank.path[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (let d = 0; d <= length; d += .25) check(a[0] + (b[0] - a[0]) * d / length, a[1] + (b[1] - a[1]) * d / length, -Math.atan2(b[1] - a[1], b[0] - a[0]), `tank-leg-${i}`);
}
const stop = l4.tank.path.at(-1)!;
for (let a = 0; a < 24; a++) check(...stop, a * Math.PI / 12, `tank-stop-${a}`);
const receipt = { ref, revision: execFileSync('git', ['rev-parse', ref], { encoding: 'utf8' }).trim(), sources, poses, status: conflicts.size ? 'red' : 'green', conflicts: [...conflicts] };
mkdirSync('test-results/qa-invariants', { recursive: true });
writeFileSync('test-results/qa-invariants/historical-tank.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
process.exitCode = conflicts.size ? 1 : 0;
