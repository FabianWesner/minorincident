/** Seed-1 native companion audit and fresh-world regional checkpoint restores; no browser or raw tick traces. */
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { runLevel, loadLevel } from '../sim-runner/levels';
import type { MissionCheckpoint } from '../../src/sim/missions/types';
const rows: unknown[] = [];
for (const quality of ['low', 'high'] as const) {
  let maximumGap = 0, missing = 0, samples = 0, last = { x: NaN, z: NaN, tick: 0 }, maximumStall = 0;
  const checkpoints = new Map<string, MissionCheckpoint>(), restores: unknown[] = [];
  const report = await runLevel('L10', 'complete', 1, 3600, 'auto', undefined, undefined, 0, {
    quality,
    beforeBegin: w => {
      w.events.on('checkpoint.set', event => {
        if (event.type === 'checkpoint.set' && ['cure-military', 'cure-corridor'].includes(event.id)) checkpoints.set(event.id, w.missions!.saveResume(true).checkpoint);
      });
      const update = w.update.bind(w);
      w.update = () => {
        update();
        if (w.tick % 60) return;
        const p = w.entities.get(1)!, dog = w.entities.values().find(e => e.companion); samples++;
        if (!dog) { missing++; return; }
        const gap = Math.hypot(dog.transform.x - p.transform.x, dog.transform.z - p.transform.z);
        maximumGap = Math.max(maximumGap, gap);
        if (!Number.isFinite(last.x) || Math.hypot(dog.transform.x - last.x, dog.transform.z - last.z) > .25) last = { x: dog.transform.x, z: dog.transform.z, tick: w.tick };
        if (gap > 6) maximumStall = Math.max(maximumStall, (w.tick - last.tick) / 60);
      };
    },
  });
  assert.equal(report.completed, true); assert.equal(missing, 0); assert.equal(checkpoints.size, 2);
  for (const [id, saved] of checkpoints) for (const remote of [false, true]) {
    const w = await loadLevel('L10', 1, undefined, 0, { quality });
    try {
      const snapshot = structuredClone(saved);
      if (remote) {
        const dog = snapshot.entities.find(e => e.companion)!;
        dog.transform.x -= 200; dog.hidden = true; dog.companion!.transitionUntil = snapshot.tick + 9999;
      }
      w.missions!.loadResume({ current: snapshot, checkpoint: structuredClone(snapshot) });
      w.missions!.restore(id);
      const p = w.entities.get(1)!, dog = w.entities.values().find(e => e.companion)!;
      const gap = Math.hypot(dog.transform.x - p.transform.x, dog.transform.z - p.transform.z);
      assert.equal(w.missions!.state.checkpoint, id); assert.ok(gap <= 4); assert.ok(!dog.hidden && !dog.pendingAdmission); assert.equal(dog.companion!.transitionUntil, undefined);
      restores.push({ id, remoteSnapshot: remote, gap, hidden: dog.hidden ?? false, pending: !!dog.pendingAdmission });
    } finally { w.dispose(); }
  }
  rows.push({ quality, completed: report.completed, time: report.time, deaths: report.deaths, maximumGap, maximumStall, missing, samples, restores });
  mkdirSync('test-results/r13-corgi', { recursive: true });
  writeFileSync('test-results/r13-corgi/native-after.json', JSON.stringify({ seed: 1, rows }, null, 2) + '\n');
  console.log(JSON.stringify({ quality, time: report.time, maximumGap, maximumStall, missing, restores }));
}
