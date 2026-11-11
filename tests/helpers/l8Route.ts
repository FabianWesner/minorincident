import { expect } from 'vitest';
import { inRect, l8Route, l8GateClosed } from '../../src/data/l8Bosses';
import { loadLevel } from '../qa/invariants/world';
import { objectiveText } from '../../src/sim/missions/objectiveText';

/** r33-l8route: per gate, the group follows the courier in and nobody is left behind the closing entry gate; the exit opens on the clear and the previous cell stays reachable. */
export async function checkL8Route(): Promise<void> {
  const w = await loadLevel('L8', 1);
  try {
    const mission = w.missions!, zoo = mission.l8!;
    zoo.state.nextWave = Number.MAX_SAFE_INTEGER; w.combat!.damage.god = true;
    zoo.advance();
    const player = w.entities.get(1)!;
    // r36-l8gates (QA P2 "the courier and some civilians can run far out of the plaza during 'Protect the group'"): with the group
    // in the plaza and the courier kiting 40 m away, the 30 s hold pauses, the objective calls her back and the group stays inside.
    zoo.followers().forEach((e, n) => w.solids.relocate(e, { x: (n % 6 - 2.5) * 1.5, z: 2 + Math.floor(n / 6) * 1.5, y: e.transform.y }, 'fixture.l8-route', 20, false));
    w.solids.relocate(player, { x: 0, z: 40, y: player.transform.y }, 'fixture.l8-route', 20, false);
    for (let i = 0; i < 32 * 60; i++) { player.health.current = player.health.max; w.update(); }
    expect(zoo.protecting(), 'the hold pauses while the courier is away from the plaza').toBe(true);
    expect(objectiveText(mission, '')).toMatch(/^Back to the plaza/);
    // The corgi and Reyes (armed escort) stay with her; the civilians hold.
    const strays = zoo.followers().filter(e => !e.companion && !e.civilian?.ally && Math.hypot(e.transform.x, e.transform.z) > 20).map(e => `${e.id}@${e.transform.x.toFixed(0)},${e.transform.z.toFixed(0)} ${e.archetype} companion=${!!e.companion} ally=${!!e.civilian?.ally} mode=${e.civilian?.survivor?.mode}`);
    expect(strays, 'the group holds the plaza while she is away').toEqual([]);
    // Back at the plaza edge (inside the 4 m grace, outside the cell, so the doors cannot shut yet) the hold runs out.
    w.solids.relocate(player, { x: 0, z: 9, y: player.transform.y }, 'fixture.l8-route', 20, false);
    for (let i = 0; i < 2400 && zoo.protecting(); i++) w.update();
    expect(zoo.protecting()).toBe(false);
    // Unsealed: the doors are still open, the fight cannot start from the plaza.
    expect(zoo.state.sealedAt).toBe(0);
    Object.assign(player.transform, { x: 0, z: 0 });
    zoo.followers().forEach((e, n) => w.solids.relocate(e, { x: (n % 6 - 2.5) * 1.5, z: 2 + Math.floor(n / 6) * 1.5, y: e.transform.y }, 'fixture.l8-route', 20, false));
    for (let i = 0; i < 400 && !zoo.state.sealedAt; i++) w.update();
    expect(zoo.state.sealedAt, 'the plaza doors shut once the group is inside').toBeGreaterThan(0);
    const closedKeys = (): string[] => l8Route.flatMap(s => [`${s.id}.entry`, `${s.id}.exit`]).filter(k => !k.startsWith('elephant') && l8GateClosed(k, { arenas: zoo.state.arenas, sealed: true }));
    expect(closedKeys()).toContain('lion.entry');
    for (const [index, stage] of l8Route.entries()) {
      if (!stage.entry) break;
      const arena = zoo.state.arenas[index], before = zoo.state.arenas.slice(0, index);
      for (const a of before) a.phase = 3;
      // The opening tunnel cohort would make the group flee; this probe is about the gates, so the opening wave is gone.
      for (const e of w.infected!.active) if (!e.infected!.arenaBoss && !e.infected!.arenaCarrier) e.health.current = 0;
      zoo.bosses.updateGates();
      // The group waits 8 m outside the entry gate, the courier steps in: the gate must not shut on them.
      const gate = stage.entry, inward = { x: (stage.zone.x0 + stage.zone.x1) / 2 - gate.x, z: (stage.zone.z0 + stage.zone.z1) / 2 - gate.z };
      const len = Math.hypot(inward.x, inward.z) || 1, ux = gate.halfX > gate.halfZ ? 0 : Math.sign(inward.x), uz = gate.halfX > gate.halfZ ? Math.sign(inward.z) : 0;
      void len;
      const at = (d: number) => ({ x: gate.x + ux * d, z: gate.z + uz * d });
      const members = zoo.followers();
      members.forEach((e, n) => { const p = at(-4 - (n % 4) * 1.2); w.solids.relocate(e, { x: p.x + (uz ? (n - 4) * .8 : 0), z: p.z + (ux ? (n - 4) * .8 : 0), y: e.transform.y }, 'fixture.l8-route', 20, false); });
      const p0 = at(6); w.solids.relocate(player, { ...p0, y: player.transform.y }, 'fixture.l8-route', 20, false);
      expect(inRect(player.transform, stage.zone), `${stage.id}: courier inside the enclosure`).toBe(true);
      let armedWith = -1;
      let stragglers = '';
      for (let i = 0; i < 3600 && !arena.armed; i++) {
        w.update();
        if (arena.armed) {
          const out = zoo.followers().filter(e => !inRect(e.transform, stage.zone)); armedWith = out.length;
          stragglers = out.map(e => `${e.id}${e.companion ? ' companion' : ''} ${e.archetype} ${e.civilian?.state} ${e.civilian?.survivor?.mode} slot${e.civilian?.survivor?.slot} injured=${e.civilian?.survivor?.injured} path=${e.civilian?.path?.length}@${e.transform.x.toFixed(1)},${e.transform.z.toFixed(1)} after ${i} ticks`).join('; ');
        }
      }
      expect(arena.phase, `${stage.id} engaged`).toBeGreaterThan(0);
      expect(arena.armed, `${stage.id}: the entry gate closes behind the group`).toBe(true);
      expect(armedWith, `${stage.id}: no follower left outside when the entry gate shuts (${stragglers})`).toBe(0);
      expect(l8GateClosed(`${stage.id}.entry`, { arenas: zoo.state.arenas, sealed: true })).toBe(true);
      expect(l8GateClosed(`${stage.id}.exit`, { arenas: zoo.state.arenas, sealed: true })).toBe(true);
      arena.phase = 3; arena.armed = false; zoo.bosses.updateGates();
      expect(l8GateClosed(`${stage.id}.exit`, { arenas: zoo.state.arenas, sealed: true }), `${stage.id}: the exit opens on the clear`).toBe(false);
    }
  } finally { w.dispose(); }
}
