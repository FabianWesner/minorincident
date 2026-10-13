import { afterEach, describe, expect, test } from 'vitest';
import { missionIds, type MissionId } from '../../src/levels/missions';
import { respawnRule } from '../../src/sim/missions/Respawn';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadLevel } from '../../tools/sim-runner/levels';

/**
 * PO 2026-10-13 verbatim: "After dying at the house where I got the baseball stick, I re-spawn at a totally different place. Let's respawn
 * at the last checkpoint as a general rule for all levels. Checkpoints for re-spawn."
 * One test per level with a mission (L1-L6, L8; L7 and L9 have no checkpoint mission): reach a checkpoint, run to the far side of the
 * map, die with infected next to the checkpoint, and assert the exact respawn, the cleared radius, the grace and the kept loadout.
 */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const rack = (w: SimWorld) => { const k = w.entities.get(1)!.weapons; return k ? [k.LEFT, k.RIGHT].map(s => s.rack.map(r => r.id).join()).join('|') : ''; };
function dieAndRespawn(w: SimWorld): void {
  const p = w.entities.get(1)!;
  while (w.tick < p.survivor!.invulnerableUntil) w.update();
  const count = () => w.events.events().filter(e => e.type === 'player.respawned').length, before = count();
  w.player!.damage(1000, w.tick);
  for (let i = 0; i < 400 && count() === before; i++) w.update();
  expect(count(), 'the courier respawned').toBe(before + 1);
}

describe('death respawns exactly on the last reached checkpoint, every level', () => {
  for (const level of missionIds) for (const reach of ['start', 'checkpoint'] as const) {
    // L4 starts as a passenger in a moving bus: its start checkpoint is a seat, covered by the 'arrival' checkpoint case.
    if (level === 'L4' && reach === 'start') continue;
    test(`${level} (${reach}): back on the anchor, nothing within 9 m, grace, loadout kept`, async () => {
      const w = world = await loadLevel(level as MissionId, 1), m = w.missions!, p = w.entities.get(1)!;
      for (let i = 0; i < 300; i++) w.update();
      if (reach === 'checkpoint') m.checkpoint(m.def.checkpoints[0]);
      const anchor = { x: p.survivor!.checkpoint.x, z: p.survivor!.checkpoint.z }, loadout = rack(w), id = m.state.checkpoint;
      // The courier is 60 m away when she dies; three infected stand next to the checkpoint, chasing.
      Object.assign(p.transform, { x: anchor.x + 60, z: anchor.z }); w.physics.playerBody!.setTranslation(p.transform, true);
      const ai = w.infected!;
      // Spots are searched on the player nav grid (the director's collider check is stricter near buildings).
      let placed = 0;
      for (let r = 2; r <= 8 && placed < 3; r += 1) for (let k = 0; k < 12 && placed < 3; k++) {
        const at = { x: anchor.x + Math.cos(k * Math.PI / 6) * r, z: anchor.z + Math.sin(k * Math.PI / 6) * r };
        if (!ai.nav.clear(at.x, at.z, .6)) continue;
        try { ai.spawn('infected.runner', at, { state: 'chase' }); placed++; } catch { /* inside a collider: next spot */ }
      }
      expect(placed, 'infected placed next to the checkpoint').toBeGreaterThan(0);
      dieAndRespawn(w);
      expect(dist(p.transform, anchor), `${level} respawn distance from the checkpoint anchor`).toBeLessThanOrEqual(respawnRule.snapM);
      expect(m.state.checkpoint).toBe(id);
      const near = ai.active.filter(e => e.health.current > 0 && !e.corpse && dist(e.transform, p.transform) < respawnRule.clearM - .5);
      expect(near.map(e => e.id), 'no infected within 9 m of the respawn').toEqual([]);
      expect(p.survivor!.invulnerableUntil - w.tick, 'grace').toBeGreaterThan(respawnRule.graceS * 60 - 30);
      expect(rack(w), 'loadout kept').toBe(loadout);
      for (const e of w.entities.iterate()) if (e.companion && e.passengerOf === undefined) expect(dist(e.transform, p.transform), 'companion beside her').toBeLessThanOrEqual(3);
    }, 300_000);
  }
});
