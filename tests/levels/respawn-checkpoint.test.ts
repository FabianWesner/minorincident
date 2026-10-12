import { afterEach, describe, expect, test } from 'vitest';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL1, runL1 } from '../../tools/sim-runner/l1Bots';
import { loadL2, runL2 } from '../../tools/sim-runner/l2Bots';

/** PO 2026-10-12: a death respawns at the last checkpoint the courier actually reached (bat pickup), never somewhere unvisited. */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
function dieAndRespawn(w: SimWorld) {
  // A recent hit leaves the courier invulnerable and the lethal damage would be ignored.
  while (w.tick < w.entities.get(1)!.survivor!.invulnerableUntil) w.update();
  const before = w.events.events().filter(e => e.type === 'player.respawned').length;
  w.player!.damage(1000, w.tick);
  for (let i = 0; i < 400 && w.events.events().filter(e => e.type === 'player.respawned').length === before; i++) w.update();
  w.update();
}

describe('respawn at the last reached checkpoint', () => {
  for (const seed of [1, 2, 3, 4]) test(`L1 seed ${seed}: bat pickup, walk far away, die: back at the bat spot with the bat`, async () => {
    const { world: w, mission } = await loadL1(seed); world = w;
    runL1(w, mission, 'complete', { seed, stopWhen: m => m.state.checkpoint === 'bat' });
    const p = w.entities.get(1)!, pickup = mission.checkpointPositions().find(c => c.id === 'bat')!.position;
    const spot = { x: pickup[0], z: pickup[2] };
    // The courier wanders 40 m off (the PO died elsewhere); the respawn must still use the bat checkpoint, not the death spot.
    Object.assign(p.transform, { x: spot.x - 40, z: spot.z }); w.physics.playerBody!.setTranslation(p.transform, true);
    dieAndRespawn(w);
    expect(dist(p.transform, spot), 'near the pickup, not near the death spot').toBeLessThanOrEqual(14);
    expect(w.events.events().some(e => e.type === 'checkpoint.restored')).toBe(false);
    expect(p.weapons!.LEFT.rack[0].id).toBe('weapon.bat'); expect(mission.state.items).toContain('bat');
    expect(mission.state.checkpoint).toBe('bat');
  }, 600_000);

  test('L1: before the bat only the start checkpoint exists', async () => {
    const { world: w, mission } = await loadL1(1); world = w;
    expect(mission.checkpointPositions().map(c => c.id)).toEqual(['start']);
    expect(mission.state.checkpoint).toBeNull();
  }, 600_000);

  test('L2: taking the axe records a checkpoint; death before the doors respawns at the axe rack with the axe', async () => {
    const { world: w, mission: m } = await loadL2(2); world = w;
    expect(m.def.checkpoints).toContain('axe');
    runL2(w, m, 'complete', { stopWhen: mm => mm.state.checkpoint === 'axe' });
    expect(m.state.checkpoint).toBe('axe');
    const p = w.entities.get(1)!, at = { x: p.transform.x, z: p.transform.z };
    dieAndRespawn(w);
    expect(dist(p.transform, at)).toBeLessThan(3);
    expect(p.weapons!.LEFT.rack.map(r => r.id).join()).toContain('axe');
    expect(m.state.items).toContain('axe');
  }, 600_000);
});
