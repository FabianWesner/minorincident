import { afterEach, expect, test } from 'vitest';
import { loadLevel } from '../../tools/sim-runner/levels';
import { L1Story } from '../../src/sim/missions/L1Story';
import { storyProtected } from '../../src/sim/npc/storyProtection';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import type { MissionId } from '../../src/levels/missions';
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });

for (const level of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] as const) {
  test(`story protection ${level} @E${18 + Number(level[1])} : every required actor resists bites, damage and collapse, then releases`, async () => {
    const w = world = await loadLevel(level as MissionId, 1), m = w.missions!, s = m.state;
    if (s.l1) new L1Story(m).pickup();
    const ids = s.l1 ? [s.l1.techId, s.l1.clerkId!]
      : s.l2 ? [...s.l2.crewIds, ...s.l2.trappedIds]
      : s.l3 ? [s.l3.squadIds[0]]
      : s.l4 ? [s.l4.qmId]
      : s.l5 ? [s.l5.lookoutId, ...s.l5.survivors.map(r => r.id)]
      : [s.l6!.survivors[0].id, s.l6!.survivors.find(r => r.key === 'rosa' || r.routine === 'treat')!.id, ...s.l6!.survivors.filter(r => r.injured).map(r => r.id)];
    expect(ids.length).toBeGreaterThan(0);
    const o = w.npcs!.civilians.outbreak!, nav = w.infected!.nav, player = w.entities.get(1)!;
    const cell = nav.nearestCell(player.transform.x, player.transform.z);
    const zid = w.infected!.spawn('infected.runner', { x: nav.x(cell), z: nav.z(cell) });
    const attacker = w.entities.get(zid)!;
    for (const id of ids) {
      const e = w.entities.get(id)!;
      expect(e, `required ${level} actor ${id}`).toBeDefined();
      expect(storyProtected(w, e)).toBe(true);
      const hp = e.health.current, state = e.civilian!.state;
      o.grab(e, attacker); w.npcs!.civilians.grab(id, zid);
      w.events.emit({ type: 'civilian.grabbed', tick: w.tick, sourceId: zid, targetId: id, variant: '', rescueUntil: w.tick + 60 });
      for (const turns of [false, true]) w.events.emit({ type: 'outbreak.bite', tick: w.tick, sourceId: zid, targetId: id, position: e.transform, turns });
      o.infect(e, zid); o.turnNow(e);
      for (const type of ['melee', 'bullet', 'explosive', 'status', 'vehicle', 'prop', 'projectile'] as const)
        w.combat!.damage.apply({ attackId: 0, actionId: 'test.pressure', sourceId: zid, targetId: id, origin: attacker.transform, direction: { x: 1, z: 0 }, base: 1000, multiplier: 1, type, knockback: 0, stagger: 10 });
      w.npcs!.civilians.hit(e, 'explosive');
      expect(e.health.current).toBe(hp); expect(e.infection).toBeUndefined(); expect(e.infected).toBeUndefined();
      expect(e.civilian!.state).toBe(state); expect(e.civilian!.knockedUntil).toBe(0);
    }
    // End the audited beats; ordinary allies/followers must still be vulnerable.
    if (s.l1) { s.l1.clerkId = 0; s.l1.delivered = true; }
    if (s.l2) s.l2.doorsOpenAt = 1;
    if (s.l3) { s.l3.handgunAt = 1; expect(storyProtected(w, w.entities.get(ids[0])!)).toBe(true); s.l3.handgunAt = 0; s.l3.fallbackAt = 1; }
    if (s.l4) s.l4.gunAt = 1;
    if (s.l5) { s.l5.shutterAt = 1; for (const r of s.l5.survivors) r.status = 'following'; }
    if (s.l6) {
      s.l6.gateAt = 1; s.l6.breach1At = w.tick;
      for (const r of s.l6.survivors.filter(r => r.injured)) {
        r.collected = true; expect(storyProtected(w, w.entities.get(r.id)!)).toBe(true);
        r.rejoined = true;
      }
    }
    for (const id of ids) {
      const e = w.entities.get(id)!; expect(storyProtected(w, e)).toBe(false);
      o.infect(e, zid); expect(e.infection, `released ${level} actor ${id} remains biteable`).toBeDefined();
    }
  }, 120_000);
}
