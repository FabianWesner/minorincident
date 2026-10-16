import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { SimWorld } from '../../src/sim/world/SimWorld';
const rows = [];
for (const count of [100, 200]) for (const mixed of [false, true]) for (const seed of [1, 2]) {
  const w = new SimWorld(); await w.init(); w.loadScenario(count === 200 ? 'perf-horde-200' : 'perf-horde-100', seed);
  try {
    const ai = w.infected!, ids: number[] = [], events: string[] = [], hashes: string[] = [];
    if (mixed) for (const [i, old] of ai.active.slice(0, count / 10).entries()) {
      const at = { x: old.transform.x, z: old.transform.z }; ai.release(old);
      ids.push(ai.spawn(i % 2 ? 'infected.gorilla' : 'infected.elephant', at, { state: 'chase' }));
    }
    w.events.on('infected.special', event => { if (event.type === 'infected.special') events.push(JSON.stringify(event)); });
    const player = w.entities.get(1)!; let minVisible = count, pendingMax = 0;
    for (let tick = 0; tick < 720; tick++) {
      if (mixed && tick % 90 === 0) for (const [i, id] of ids.entries()) {
        const e = w.entities.get(id)!;
        ai.startSpecial(id, i % 2 ? 'gorilla.grab-throw' : tick % 180 ? 'elephant.swipe' : 'elephant.charge', { id: 1, x: player.transform.x, z: player.transform.z }, { x: e.transform.x, z: e.transform.z, radius: 1, dx: 1, dz: 0 });
      }
      w.update(); hashes.push(createHash('sha256').update(JSON.stringify(w.getState())).digest('hex'));
      if (tick >= 120) { minVisible = Math.min(minVisible, ai.active.filter(e => !e.hidden && !e.infected!.hidden && !e.pendingAdmission && e.health.current > 0).length); pendingMax = Math.max(pendingMax, w.solids.snapshot().pending); }
    }
    rows.push({ count, mixed, seed, hashes, events, minVisible, pendingMax, failures: w.solids.snapshot().failures });
  } finally { w.dispose(); }
}
writeFileSync(process.argv[2], JSON.stringify(rows));
