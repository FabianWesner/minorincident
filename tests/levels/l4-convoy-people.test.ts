import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { l4, l4Route, l4RoutePose } from '../../src/data/l4';
import type { EntitySnapshot } from '../../src/sim/world/types';
import { loadL4 } from '../../tools/sim-runner/l4Bots';

// Independent rendered-hull oracle: three.js +Y yaw turns +X toward -Z.
const footprint = (e: EntitySnapshot) => {
  const c = e.civilian, seat = c?.schedule?.[c.scheduleStep ?? 0]?.seat;
  const displacement = seat && c?.activityUntil && ['calm', 'alarmed'].includes(c.state) ? Math.hypot(seat.x - e.transform.x, seat.z - e.transform.z) : 0;
  return Math.max(e.combat?.radius ?? .35, (c?.pet || e.companion || /\.(dog|cat)/.test(e.archetype) ? .95 : .9) + (displacement <= 1.2 ? displacement : 0));
};
function overlaps(v: EntitySnapshot, i: number, e: EntitySnapshot): boolean {
  const c = Math.cos(v.transform.yaw), s = Math.sin(v.transform.yaw);
  const dx = e.transform.x - v.transform.x, dz = e.transform.z - v.transform.z;
  const a = Math.max(0, Math.abs(dx * c - dz * s) - l4.convoy.vehicles[i].len / 2 - .3);
  const b = Math.max(0, Math.abs(dx * s + dz * c) - l4.convoy.vehicles[i].wid / 2 - .3);
  return Math.hypot(a, b) < footprint(e) - 1e-6;
}

for (const tier of ['high', 'low'] as const) for (const seed of [1, 2, 3]) {
  test(`@nightly T-E22-04g @E22 @E22-AC04 every tick of drive/stop/unload clears posed actor footprints, ${tier}, seed ${seed}`, async () => {
    const { world: w, mission } = await loadL4(seed, tier), state = mission.state.l4!;
    // Low-tier population may omit pets: retain a real pet in every seed audit.
    const nav = w.infected!.nav, cell = nav.nearestCell(-24, 4, .4);
    const petAt = { x: nav.x(cell), z: nav.z(cell) };
    w.npcs!.civilians.spawn('dog', petAt, { pet: 'dog', waypoints: [petAt] });
    const seen = new Set<number>();
    const bad: { tick: number; phase: string; actor: number; kind: string; bus: number; x: number; z: number; yaw: number }[] = [];
    try {
      const check = () => {
        for (const e of w.entities.iterate()) {
          if (e.hidden || e.corpse || e.health.current <= 0 || !(e.civilian || e.companion || e.infected || e.escort || e.id === 1)) continue;
          seen.add(e.id);
          for (const [i, id] of state.convoyIds.entries()) {
            const v = w.entities.get(id)!;
            if (overlaps(v, i, e)) bad.push({ tick: w.tick, phase: state.phase, actor: e.id, kind: `${e.kind}/${e.archetype}/${e.civilian?.story?.clip ?? e.civilian?.state ?? ''}`, bus: id, x: e.transform.x, z: e.transform.z, yaw: v.transform.yaw });
          }
        }
      };
      check();
      for (let t = 0; t < 60 * 150 && (state.phase === 'convoy' || w.tick < state.arrivedAt + 600); t++) { w.update(); check(); }
      const dir = 'test-results/l4-bus-clear'; mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/overlaps-${tier}-${seed}.json`, JSON.stringify({ seed, tier, arrivedAt: state.arrivedAt, overlapTicks: bad.length, bad }));
      console.log('convoy footprint audit', { seed, tier, arrivedS: state.arrivedAt / 60, overlaps: bad.length, first: bad.slice(0, 3) });

      expect(state.soldierIds.every(id => seen.has(id))).toBe(true);
      expect(state.evacueeIds.every(id => seen.has(id))).toBe(true);
      expect([...w.entities.iterate()].some(e => e.companion && seen.has(e.id))).toBe(true);
      expect([...w.entities.iterate()].some(e => e.civilian?.pet && seen.has(e.id))).toBe(true);
      expect(state.phase).toBe('plaza');
      expect(bad.slice(0, 20)).toEqual([]);
    } finally { w.dispose(); }
  }, 600_000);
}

for (const tier of ['high', 'low'] as const) {
  test(`T-E22-04h @E22 convoy yields to an immobile infected and resumes after clearance, ${tier}`, async () => {
    const { world: w, mission } = await loadL4(1, tier), s = mission.state.l4!;
    try {
      const p = l4RoutePose(l4Route(), s.convoyS[0] + 12);
      const id = w.infected!.spawn('infected.runner', p), infected = w.entities.get(id)!;
      infected.combat!.staggerUntil = Number.MAX_SAFE_INTEGER;
      let moved = false;
      for (let t = 0; t < 480; t++) {
        w.update(); moved ||= s.convoyV > .5;
        for (const [i, bus] of s.convoyIds.entries()) expect(overlaps(w.entities.get(bus)!, i, infected)).toBe(false);
      }
      expect(moved).toBe(true); expect(s.convoyV).toBe(0); expect(s.phase).toBe('convoy');
      w.infected!.release(infected);
      for (let t = 0; t < 600; t++) w.update();
      expect(s.convoyV).toBeGreaterThan(1);
    } finally { w.dispose(); }
  }, 600_000);

  test(`T-E22-04i @E22 cowering woman and pet leave the convoy route by walking, ${tier}`, async () => {
    const { world: w, mission } = await loadL4(1, tier), s = mission.state.l4!;
    try {
      const p = l4RoutePose(l4Route(), s.convoyS[0] + 15);
      const id = w.npcs!.civilians.outbreak!.spawnPedestrian(p, { model: 'npc.civilian-woman-a', handProp: 'bag', waypoints: [p] });
      const woman = w.entities.get(id)!; woman.civilian!.story = { clip: 'npc-cower', start: w.tick, prop: 'bag' };
      const q = l4RoutePose(l4Route(), s.convoyS[0] + 18);
      const dogId = w.npcs!.civilians.spawn('dog', q, { pet: 'dog', waypoints: [q] }), dog = w.entities.get(dogId)!;
      let previous = [woman, dog].map(e => ({ ...e.transform })), maxStep = 0, walked = false;
      for (let t = 0; t < 900; t++) {
        w.update();
        for (const [k, e] of [woman, dog].entries()) {
          const step = Math.hypot(e.transform.x - previous[k].x, e.transform.z - previous[k].z);
          maxStep = Math.max(maxStep, step); walked ||= step > .005;
          for (const [i, bus] of s.convoyIds.entries()) expect(overlaps(w.entities.get(bus)!, i, e)).toBe(false);
        }
        previous = [woman, dog].map(e => ({ ...e.transform }));
      }
      expect(walked).toBe(true); expect(maxStep).toBeLessThan(.15);
      expect(woman.civilian!.story?.clip).not.toBe('npc-cower');
    } finally { w.dispose(); }
  }, 600_000);
}
