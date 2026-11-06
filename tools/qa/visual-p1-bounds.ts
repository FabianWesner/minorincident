/** Production-level Rapier perimeter sweep: walk and drive at both ends and
 * the middle of every constant-height boundary run, including streamed levels. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadLevel } from '../../tests/qa/invariants/world';
import { inside } from '../../src/levels/districts/validate';
import { vehicleDef } from '../../src/data/vehicles';
import { VehicleBody } from '../../src/sim/vehicles/VehicleBody';
import type { MissionId } from '../../src/levels/missions';
import { Cuboid } from '@dimforge/rapier3d-compat';

const out = process.env.BOUNDS_OUT ?? 'test-results/visual-p1-1102'; mkdirSync(out, { recursive: true });
const levels = (process.env.BOUNDS_LEVELS ?? 'L1,L2,L3,L4,L5,L6,L7,L8,L9,L10').split(',') as MissionId[];
const results: { level: string; runs: number; walked: number; driven: number; failures: unknown[]; probes: unknown[] }[] = [];
const counterproof = process.env.BOUNDS_COUNTERPROOF === '1';
const tier = process.env.BOUNDS_TIER ?? 'low';
if (tier !== 'low' && tier !== 'high') throw new Error('BOUNDS_TIER must be low or high');
for (const level of levels) {
  const w = await loadLevel(level, 1, tier);
  const row = { level, runs: w.districts!.boundaries.length, walked: 0, driven: 0, failures: [] as unknown[], probes: [] as unknown[] };
  try {
    const districts = w.districts!;
    if (counterproof) {
      // Deliberately reproduce the original y=0..1.05 perimeter. Do not write
      // this fixture into production sources or the acceptance sweep artifact.
      const handles: number[] = [];
      w.physics.world!.forEachCollider(c => {
        const shape = c.shape, p = c.translation(); if (!(shape instanceof Cuboid)) return;
        if (districts.boundaries.some(b => Math.abs(p.x - (b.min[0] + b.max[0]) / 2) < .002 && Math.abs(p.y - (b.min[1] + b.max[1]) / 2) < .002 && Math.abs(p.z - (b.min[2] + b.max[2]) / 2) < .002 && Math.abs(shape.halfExtents.x - (b.max[0] - b.min[0]) / 2) < .002 && Math.abs(shape.halfExtents.z - (b.max[2] - b.min[2]) / 2) < .002)) handles.push(c.handle);
      });
      for (const handle of handles) w.physics.removeBlocker(handle);
      for (const b of districts.boundaries) w.physics.addStatic({ min: [...b.min], max: [b.max[0], 1.05, b.max[2]] }, [0, 0]);
    }
    const contains = (x: number, z: number) => districts.districts.some(d => inside([x - d.origin[0], z - d.origin[1]], d.layout.bounds));
    const body = w.physics.playerBody!, collider = w.physics.playerCollider!, controller = w.physics.characterController!;
    collider.setEnabled(true);
    for (const [edge, b] of districts.boundaries.entries()) {
      const alongX = b.max[0] - b.min[0] > b.max[2] - b.min[2];
      const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
      for (const fraction of [.15, .5, .85]) {
        const length = (alongX ? b.max[0] - b.min[0] : b.max[2] - b.min[2]) - (level === 'L7' ? .7 : .16);
        const x = cx + (alongX ? (fraction - .5) * length : 0), z = cz + (alongX ? 0 : (fraction - .5) * length);
        let nx = alongX ? 0 : 1, nz = alongX ? 1 : 0;
        if (contains(x + nx * .7, z + nz * .7)) { nx *= -1; nz *= -1; }
        if (!contains(x - nx * .7, z - nz * .7)) { row.failures.push({ edge, fraction, reason: 'no authored inside verge', x, z }); continue; }
        const start = { x: x - nx * 1.5, z: z - nz * 1.5 };
        const floor = districts.pavingHeight(start.x, start.z);
        w.chunks?.update([start.x, start.z]); collider.setEnabled(true);
        body.setTranslation({ ...start, y: floor + .705 }, true); body.setNextKinematicTranslation({ ...start, y: floor + .705 });
        w.physics.update(); let maxWalk = -Infinity, maxWalkY = -Infinity;
        for (let tick = 0; tick < 90; tick++) {
          const at = body.translation(), support = districts.supportBelow(at.x, at.z, at.y - .705);
          controller.computeColliderMovement(collider, { x: nx * .1, y: Math.max(-.08, support + .705 - at.y), z: nz * .1 });
          const p = body.translation(), m = controller.computedMovement();
          body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z }); w.physics.update();
          const q = body.translation(); maxWalk = Math.max(maxWalk, (q.x - x) * nx + (q.z - z) * nz); maxWalkY = Math.max(maxWalkY, q.y);
        }
        row.walked++;
        if (maxWalk > .1) row.failures.push({ edge, fraction, kind: 'walk', maxOutside: maxWalk, maxWalkY, end: body.translation(), b });
        collider.setEnabled(false);
        const def = vehicleDef('vehicle.sedan');
        // Spawning a car inside a house launches it through the air; that is
        // not a drivable approach. Try clear staging points along this normal.
        const candidates = [7, 10, 12, 5].map(distance => ({ x: x - nx * distance, z: z - nz * distance }));
        const at = candidates.find(p => contains(p.x, p.z) && w.solids.clear({ ...p, y: districts.pavingHeight(p.x, p.z) + .7 }, Math.hypot(def.length, def.width) / 2, undefined, false));
        if (!at) { row.probes.push({ edge, fraction, x, z, outward: [nx, nz], maxWalk, drive: 'no clear car-sized approach: authored solids' }); continue; }
        w.chunks?.update([at.x, at.z]);
        const car = new VehicleBody(def, w.physics.world!, at, Math.atan2(-nz, nx));
        const y = districts.pavingHeight(at.x, at.z) + def.suspension + def.wheelRadius + .15;
        car.body.setTranslation({ ...at, y }, true); car.intent.throttle = 1;
        let maxDrive = -Infinity, maxDriveY = -Infinity;
        try {
          for (let tick = 0; tick < 300; tick++) {
            car.prePhysics(); w.physics.update(); car.postPhysics();
            const q = car.transform; maxDrive = Math.max(maxDrive, (q.x - x) * nx + (q.z - z) * nz); maxDriveY = Math.max(maxDriveY, q.y);
          }
        } finally { car.dispose(); }
        row.driven++;
        if (maxDrive > .1) row.failures.push({ edge, fraction, kind: 'drive', maxOutside: maxDrive, maxDriveY, b });
        row.probes.push({ edge, fraction, x, z, outward: [nx, nz], ground: floor, top: b.max[1], maxWalk, maxDrive });
      }
    }
    results.push(row); writeFileSync(`${out}/${counterproof ? 'bounds-counterproof' : 'bounds-sweep'}.json`, JSON.stringify({ seed: 1, tier, counterproof, method: 'production loadLevel, real character controller and sedan, three probes on every boundary run; AI paused, physics runs', results }, null, 2));
    console.log(`${level}: ${row.runs} runs, walk ${row.walked}, drive ${row.driven}, failures ${row.failures.length}`);
  } finally { w.dispose(); }
}
if (results.some(row => row.failures.length)) process.exitCode = 1;
