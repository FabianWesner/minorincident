import { expect, test } from 'vitest';
import { missionIds } from '../../src/levels/missions';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { respawnAtCheckpoint, respawnRule } from '../../src/sim/missions/Respawn';
import { loadLevel, runLevel } from '../../tools/sim-runner/levels';

function clear(w: SimWorld, checkpoint: string): void {
  const p = w.entities.get(1)!;
  if (p.hidden || p.passengerOf !== undefined) return; // Owned vehicle seats are not walking spawns.
  const near = [...w.entities.iterate()].filter(e => e.id !== 1 && (e.civilian || e.infected || e.companion || e.escort) && !e.hidden && !e.pendingAdmission && !e.corpse && e.health.current > 0 && e.passengerOf === undefined && Math.abs(e.transform.y - p.transform.y) < 1.2 && Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < .8);
  expect(near.map(e => `${e.id}:${e.archetype}`), checkpoint).toEqual([]);
}
for (const level of missionIds) test(`${level}: every player start and reached checkpoint has no NPC within 0.8 m`, async () => {
  const start = await loadLevel(level, 1);
  try { clear(start, 'start'); } finally { start.dispose(); }
  // Natural inputs reach the actual saved checkpoint anchors. The debug graph walk cannot synthesize spatial checkpoints.
  let inspected = false;
  const report = await runLevel(level, 'complete', 1, level === 'L10' ? 3600 : 1200, 'auto', undefined, w => {
    const m = w.missions!, checkpoints = m.checkpointPositions();
    console.info(JSON.stringify({ level, checkpoints: checkpoints.map(p => p.id), declared: m.def.checkpoints }));
    expect(checkpoints.map(p => p.id)).toEqual(expect.arrayContaining(m.def.checkpoints));
    for (const { id, position } of checkpoints) {
      // Reconstruct the saved pre-cure world for L10 too; a live post-cure retry intentionally refuses to rewind it.
      m.restore(id, true);
      const p = w.entities.get(1)!;
      if (p.passengerOf === undefined) {
        respawnAtCheckpoint(w, p.survivor!.checkpoint, level === 'L1' || level === 'L4');
        expect(Math.hypot(p.transform.x - position[0], p.transform.z - position[2]), id).toBeLessThanOrEqual(respawnRule.snapM);
      }
      clear(w, id);
    }
    inspected = true;
  });
  expect(report.completed, JSON.stringify(report.blocker)).toBe(true);
  expect(inspected).toBe(true);
}, 900_000);
