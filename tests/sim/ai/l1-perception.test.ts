import { afterEach, describe, expect, test } from 'vitest';
import { l1v2 } from '../../../src/data/l1v2';
import type { BiteEvent, HumanKind, HumanTarget, HumanTargetQuery, Vec2 } from '../../../src/sim/outbreak/types';
import type { CoverWall } from '../../../src/sim/combat/HitQuery';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { SimWorld } from '../../../src/sim/world/SimWorld';

/** Scripted humans the tests move by hand (lane D supplies the real civilian query in the game). */
class Humans implements HumanTargetQuery {
  readonly list: HumanTarget[] = [];
  private readonly out: HumanTarget[] = [];
  add(id: number, kind: HumanKind, x: number, z: number): HumanTarget { const h = { id, kind, position: { x, z }, facing: 0 }; this.list.push(h); this.list.sort((a, b) => a.id - b.id); return h; }
  remove(id: number): void { const i = this.list.findIndex((h) => h.id === id); if (i >= 0) this.list.splice(i, 1); }
  all() { return this.list; }
  get(id: number) { return this.list.find((h) => h.id === id); }
  within(c: Vec2, r: number) { this.out.length = 0; for (const h of this.list) if (Math.hypot(h.position.x - c.x, h.position.z - c.z) <= r) this.out.push(h); return this.out; }
}
const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
async function l1World(seed: number, humans: HumanTargetQuery | undefined = new Humans()) {
  const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario('horde-arena', seed);
  const perception = w.infected!.configureL1v2(humans);
  return { w, ai: w.infected!, perception, humans: humans as Humans };
}
function zombie(w: SimWorld, x: number, z: number, yaw = 0, variant = 'inf.cashier'): EntitySnapshot { return w.entities.get(w.infected!.spawn('infected.runner', { x, z }, { yaw, variant }))!; }
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
const brain = (e: EntitySnapshot) => e.infected!.l1!;
/** Full-height cover wall: blocks infected sight and navigation. */
function wall(w: SimWorld, id: number, x: number, z: number, halfX: number, halfZ: number): void {
  const cover: CoverWall = { x, y: 1.5, z, halfX, halfY: 1.5, halfZ };
  (w.combat!.query.walls as CoverWall[]).push(cover);
  w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id, wall: cover, blocked: true } as never);
}
const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

describe('L1 v2 infected perception', () => {
  test('T-E19-08 @E19 @E19-AC08 vision cone 90 deg, 16 m, LOS incl. gates and car-wash curtain, no player hearing', async () => {
    const { w, perception } = await l1World(1);
    const e = zombie(w, 20, 20, 0); e.transform.yaw = 0;
    // Table over angles and ranges: seen only inside +/-45 deg and <= 16 m.
    for (let angle = -180; angle <= 180; angle += 5) for (const range of [1, 5, 10, 15.9, 16.5, 20]) {
      const a = angle * Math.PI / 180, p = { x: 20 + Math.cos(a) * range, z: 20 - Math.sin(a) * range };
      expect(perception.sees(e, p), `${angle} deg ${range} m`).toBe(Math.abs(angle) <= 45 && range <= 16);
    }
    const ahead = { x: 30, z: 20 };
    expect(perception.sees(e, ahead)).toBe(true);
    // Static cover (building/car/hedge collider).
    wall(w, 900, 25, 20, 0.5, 3); expect(perception.sees(e, ahead)).toBe(false);
    (w.combat!.query.walls as CoverWall[]).pop(); expect(perception.sees(e, ahead)).toBe(true);
    // Dynamic blockers: closed yard gate (aabb) and active car-wash curtain (polygon), toggled by their owner.
    perception.los.register({ id: 'gate-1', source: 'gate', active: true, shape: { kind: 'aabb', min: { x: 24.9, z: 18 }, max: { x: 25.1, z: 22 } } });
    expect(perception.sees(e, ahead)).toBe(false);
    perception.los.setActive('gate-1', false); expect(perception.sees(e, ahead)).toBe(true);
    perception.los.register({ id: 'curtain', source: 'carwash-curtain', active: true, shape: { kind: 'polygon', points: [{ x: 27, z: 17 }, { x: 27.2, z: 17 }, { x: 27.2, z: 23 }, { x: 27, z: 23 }] } });
    expect(perception.sees(e, ahead)).toBe(false);
    perception.los.setActive('curtain', false); expect(perception.sees(e, ahead)).toBe(true);
    perception.los.register({ id: 'fence', source: 'fence', active: true, shape: { kind: 'polygon', points: [{ x: 28, z: 15 }, { x: 28, z: 25 }] } });
    expect(perception.sees(e, ahead)).toBe(false);
    perception.los.unregister('fence'); expect(perception.sees(e, ahead)).toBe(true);
  });

  test('T-E19-08b @E19 @E19-AC08 detection follows sight; footsteps, attacks and the bicycle create no perception events', async () => {
    // Detection timing with scripted humans: in front -> chase within 0.25 s; behind a wall -> never.
    for (const seed of seeds) {
      const { w, humans } = await l1World(seed);
      const front = zombie(w, -30, -30, 0), hidden = zombie(w, 30, 30, 0);
      wall(w, 901, 35, 30, 0.5, 4);
      humans.add(100, 'civilian', -22, -30); humans.add(101, 'civilian', 40, 30);
      step(w, 15);
      expect(brain(front).mode).toBe('chase'); expect(brain(front).targetId).toBe(100);
      humans.remove(100); humans.list[0].position.x = 40;
      step(w, 120);
      expect(brain(hidden).mode).not.toBe('chase');
      w.dispose(); worlds.length = 0;
    }
    // No hearing: the real survivor makes footsteps/attack/bicycle noise right behind an infected facing away.
    const { w, ai } = await l1World(3, undefined);
    const e = zombie(w, 0, 18, 0); e.transform.yaw = Math.PI / 2; // faces -Z, the survivor stands at the origin behind it
    const alerted = () => w.events.events().filter((ev) => ev.type === 'ai.alerted' && ev.targetId === e.id);
    for (let i = 0; i < 120; i++) {
      for (const [actionId, kind, radius] of [['move.footstep', 'footstep', 12], ['weapon.punch', 'melee', 30], ['vehicle.bicycle', 'vehicle', 40]] as const) {
        w.events.emit({ type: 'noise', tick: w.tick, sourceId: 1, actionId, position: { x: 0, y: 0.7, z: 0 }, radius, loudness: 1, kind });
        ai.noise({ x: 0, z: 0 }, radius, true, 1);
      }
      e.transform.yaw = Math.PI / 2; w.update();
    }
    expect(alerted()).toHaveLength(0);
    expect(brain(e).mode).not.toBe('chase');
    expect(e.noiseTarget).toBeUndefined();
  });

  test('T-E19-09 @E19 @E19-AC09 closest visible target with 1.5 m hysteresis', async () => {
    const switches: number[] = [], backs: number[] = [];
    for (const seed of seeds) {
      const { w, humans } = await l1World(seed);
      const e = zombie(w, -40, 0, 0);
      const player = humans.add(1, 'player', -32, 0);
      step(w, 20); expect(brain(e).mode).toBe('chase'); expect(brain(e).targetId).toBe(1);
      // Player runs away at 4.5 m/s for 1 s, then stops ~6+ m ahead.
      for (let i = 0; i < 60; i++) { player.position.x += 4.5 / 60; w.update(); }
      const gap = player.position.x - e.transform.x;
      // A pedestrian only 1.0 m closer: no switch.
      const near = humans.add(200, 'civilian', e.transform.x + gap - 1, 1.5);
      step(w, 30); expect(brain(e).targetId).toBe(1);
      humans.remove(200); void near;
      // A pedestrian >= 1.5 m closer and visible: switch within 0.5 s.
      const d = player.position.x - e.transform.x;
      humans.add(201, 'civilian', e.transform.x + d - 3, 1.2);
      const added = w.tick; let switched = -1;
      for (let i = 0; i < 60 && switched < 0; i++) { w.update(); if (brain(e).targetId === 201) switched = w.tick - added; }
      expect(switched).toBeGreaterThanOrEqual(0); expect(switched).toBeLessThanOrEqual(30); switches.push(switched);
      // Bite (grab 1.0 s) -> BiteEvent; lane D's query drops the victim -> back to the player within 0.5 s.
      let bite: BiteEvent | undefined;
      w.events.on('outbreak.bite', (ev) => { if (ev.type === 'outbreak.bite') { bite = ev; humans.remove(ev.targetId); } });
      for (let i = 0; i < 240 && !bite; i++) w.update();
      expect(bite?.sourceId).toBe(e.id); expect(bite?.targetId).toBe(201); expect(bite?.turns).toBe(true);
      const bitten = w.tick; let back = -1;
      for (let i = 0; i < 60 && back < 0; i++) { if (brain(e).targetId === 1 && brain(e).mode === 'chase') back = w.tick - bitten; w.update(); }
      expect(back).toBeGreaterThanOrEqual(0); expect(back).toBeLessThanOrEqual(30); backs.push(back);
      w.dispose(); worlds.length = 0;
    }
    expect(Math.max(...switches)).toBeLessThanOrEqual(30);
  });

  test('T-E19-09b @E19 @E19-AC09 a hit during the 1.0 s grab rescues the civilian (no bite)', async () => {
    const { w, humans } = await l1World(5);
    const e = zombie(w, -20, 10, 0);
    humans.add(300, 'civilian', -14, 10);
    let bites = 0; w.events.on('outbreak.bite', () => { bites++; });
    let grabbed = false; w.events.on('civilian.grabbed', (ev) => { if (ev.type === 'civilian.grabbed' && ev.targetId === 300) grabbed = true; });
    for (let i = 0; i < 300 && brain(e).mode !== 'bite'; i++) w.update();
    expect(brain(e).mode).toBe('bite'); expect(grabbed).toBe(true); expect(w.infected!.holding(300)).toBe(e.id);
    step(w, 30);
    w.combat!.damage.apply({ sourceId: 1, targetId: e.id, attackId: 77, actionId: 'weapon.test', origin: { x: e.transform.x - 1, z: e.transform.z }, direction: { x: 1, z: 0 }, base: 5, multiplier: 1, type: 'melee', stagger: 0, knockback: 0 });
    step(w, 60);
    expect(bites).toBe(0); expect(w.infected!.holding(300)).toBe(0);
  });

  test('T-E19-10 @E19 @E19-AC10 search 10-18 s, probe points, double-back, then wander', async () => {
    const episodes: { duration: number; visited: number; doubledBack: boolean; endOffset: number; after: string }[] = [];
    for (const seed of seeds) {
      const { w, humans } = await l1World(seed);
      const pairs: { e: EntitySnapshot; h: HumanTarget }[] = [];
      // Ten lanes far apart; each infected sees its own human run away, then the human vanishes (behind cover).
      for (let i = 0; i < 10; i++) {
        const x = -45 + (i % 5) * 22, z = i < 5 ? -30 : 25;
        pairs.push({ e: zombie(w, x, z, 0), h: humans.add(100 + i, i === 0 ? 'player' : 'civilian', x + 7, z) });
      }
      step(w, 20);
      for (let t = 0; t < 45; t++) { for (const { h } of pairs) h.position.x += 4.5 / 60; w.update(); }
      for (const { e } of pairs) expect(brain(e).mode).toBe('chase');
      const lkp = pairs.map(({ h }) => ({ ...h.position }));
      for (const { h } of pairs) humans.remove(h.id);
      const started = pairs.map(() => -1), ended = pairs.map(() => -1), endPos = pairs.map(() => ({ x: 0, z: 0 }));
      const stats = pairs.map(() => ({ visited: 0, doubledBack: false }));
      for (let t = 0; t < 21 * 60; t++) {
        w.update();
        pairs.forEach(({ e }, i) => {
          const b = brain(e);
          if (started[i] < 0 && b.mode === 'search') started[i] = w.tick;
          if (b.mode === 'search') { stats[i].visited = b.search.visited; stats[i].doubledBack = b.search.doubledBack; endPos[i] = { x: e.transform.x, z: e.transform.z }; }
          if (started[i] >= 0 && ended[i] < 0 && b.mode === 'wander') ended[i] = w.tick;
        });
      }
      pairs.forEach(({ e }, i) => {
        expect(started[i]).toBeGreaterThan(0); expect(ended[i]).toBeGreaterThan(0);
        episodes.push({ duration: (ended[i] - started[i]) / 60, ...stats[i], endOffset: Math.hypot(endPos[i].x - lkp[i].x, endPos[i].z - lkp[i].z), after: brain(e).mode });
      });
      w.dispose(); worlds.length = 0;
    }
    expect(episodes).toHaveLength(200);
    const durations = episodes.map((e) => e.duration), mean = durations.reduce((a, b) => a + b) / durations.length;
    const std = Math.sqrt(durations.reduce((a, b) => a + (b - mean) ** 2, 0) / durations.length);
    expect(Math.min(...durations)).toBeGreaterThanOrEqual(10 - 1 / 60); expect(Math.max(...durations)).toBeLessThanOrEqual(18 + 1 / 60);
    expect(std).toBeGreaterThanOrEqual(l1v2.infected.search.minStdS);
    for (const e of episodes) { expect(e.visited).toBeGreaterThanOrEqual(3); expect(e.endOffset).toBeGreaterThan(0.5); expect(e.after).toBe('wander'); }
    expect(episodes.filter((e) => e.doubledBack).length / episodes.length).toBeGreaterThanOrEqual(0.35);
    console.info(`[AC10] 200 episodes mean ${mean.toFixed(2)} s std ${std.toFixed(2)} s, double-back ${episodes.filter((e) => e.doubledBack).length}/200, probes min ${Math.min(...episodes.map((e) => e.visited))} median ${median(episodes.map((e) => e.visited))}`);
  }, 120_000);

  test('T-E19-10b @E19 @E19-AC10 hide behind a building: the chaser searches around the corner, not at one spot', async () => {
    for (const seed of seeds.slice(0, 5)) {
      const { w, humans } = await l1World(seed);
      wall(w, 902, 0, 0, 4, 4); // a house
      const e = zombie(w, -14, 6, 0); const h = humans.add(1, 'player', -7, 6);
      step(w, 20); expect(brain(e).mode).toBe('chase');
      // Run east along the house, duck behind it (north side), then stand still hidden.
      for (let t = 0; t < 60; t++) { h.position.x += 4.5 / 60; w.update(); }
      for (let t = 0; t < 70; t++) { h.position.z = Math.max(-8, h.position.z - 4.5 / 60); h.position.x = Math.min(6, h.position.x + 1 / 60); w.update(); }
      const positions: Vec2[] = [];
      for (let t = 0; t < 600 && brain(e).mode !== 'chase'; t++) { w.update(); if (t % 30 === 0) positions.push({ x: e.transform.x, z: e.transform.z }); }
      // Either it re-acquired the player around the corner, or its search covered ground (no standing still).
      if (brain(e).mode !== 'chase') {
        const xs = positions.map((p) => p.x), zs = positions.map((p) => p.z);
        expect(Math.max(...xs) - Math.min(...xs) + Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(6);
      }
      w.dispose(); worlds.length = 0;
    }
  });

  test('T-E19-11 @E19 @E19-AC11 car alarm attracts non-chasing infected within 30 m; 20 s, then search and wander', async () => {
    for (const seed of seeds) {
      const { w, humans } = await l1World(seed);
      const car = { x: 10, z: 0 };
      wall(w, 903, 10, 0, 2.2, 1); // the parked car itself; sound passes walls, so add a house in between too
      wall(w, 904, -2, 0, 1, 6);
      const near: EntitySnapshot[] = [];
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = 8 + (i % 4) * 5.5; near.push(zombie(w, car.x + Math.cos(a) * r, car.z + Math.sin(a) * r, a)); }
      const far = zombie(w, car.x + 34, car.z, 0);
      // One infected is chasing a visible human and must ignore the alarm.
      const chaser = zombie(w, car.x - 20, car.z + 18, Math.PI / 2 * 3); const victim = humans.add(500, 'civilian', car.x - 20, car.z + 26);
      step(w, 20); expect(brain(chaser).mode).toBe('chase');
      const until = w.tick + l1v2.toys.carAlarm.durationS * 60;
      w.events.emit({ type: 'outbreak.distraction', tick: w.tick, id: 1, kind: 'car-alarm', position: car, radius: l1v2.infected.attracted.radiusM, until });
      const closest = near.map(() => Infinity);
      for (let t = 0; t < 12 * 60; t++) { w.update(); victim.position.z += 4 / 60; near.forEach((e, i) => { closest[i] = Math.min(closest[i], Math.hypot(e.transform.x - car.x, e.transform.z - car.z)); }); }
      for (const d of closest) expect(d).toBeLessThanOrEqual(l1v2.infected.attracted.arriveWithinM);
      expect(Math.hypot(far.transform.x - car.x, far.transform.z - car.z)).toBeGreaterThan(30);
      expect(['chase', 'bite']).toContain(brain(chaser).mode);
      // A visible human overrides the attraction.
      const lure = near[0]; humans.add(600, 'civilian', lure.transform.x + Math.cos(-lure.transform.yaw) * 6, lure.transform.z + Math.sin(-lure.transform.yaw) * 6);
      step(w, 16); expect(brain(lure).mode).toBe('chase'); expect(brain(lure).targetId).toBe(600); humans.remove(600);
      // Others keep searching around the car during the alarm, then wander within alarm + 8 s.
      step(w, until - w.tick);
      expect(near.slice(1).every((e) => brain(e).mode === 'search' || brain(e).mode === 'chase')).toBe(true);
      step(w, 8 * 60 + 2);
      expect(near.slice(1).filter((e) => brain(e).mode === 'wander').length).toBeGreaterThanOrEqual(6);
      w.dispose(); worlds.length = 0;
    }
  }, 120_000);

  test('T-E19-12 @E19 @E19-AC12 speed tiers ordered and faster than the running player, jitter per entity', async () => {
    const closing: number[] = [];
    const tiers = { frail: 'npc.civilian-elderly', average: 'inf.cashier', athletic: 'inf.jogger' } as const;
    const all: Record<string, number[]> = { frail: [], average: [], athletic: [] };
    for (const seed of seeds) {
      const { w, ai, humans } = await l1World(seed);
      for (const [tier, variant] of Object.entries(tiers)) {
        const group = Array.from({ length: 5 }, (_, i) => ai.l1Speed(zombie(w, -50 + i * 2, -50 + Object.keys(tiers).indexOf(tier) * 4, 0, variant).id));
        expect(group.every((s) => s > l1v2.player.runMs)).toBe(true);
        for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) expect(Math.abs(group[i] - group[j]) / Math.max(group[i], group[j])).toBeGreaterThanOrEqual(0.01);
        all[tier].push(...group);
        expect(brain(w.entities.get(ai.active.at(-1)!.id)!).tier).toBe(tier);
      }
      // Straight-line chase: average tier vs the player running at 4.5 m/s, starting 12 m apart.
      const e = zombie(w, -40, 40, 0, 'inf.common-worker'); const p = humans.add(1, 'player', -28, 40);
      let gap = 12, t = 0;
      for (; t < 60 * 60 && gap > 2; t++) { p.position.x += l1v2.player.runMs / 60; w.update(); gap = p.position.x - e.transform.x; }
      closing.push(t / 60);
      w.dispose(); worlds.length = 0;
    }
    const mean = (v: number[]) => v.reduce((a, b) => a + b) / v.length;
    expect(mean(all.frail)).toBeLessThan(mean(all.average)); expect(mean(all.average)).toBeLessThan(mean(all.athletic));
    expect(all.frail.filter((s) => s > 4.5).length / all.frail.length).toBeGreaterThanOrEqual(0.95);
    expect(median(closing)).toBeLessThanOrEqual(l1v2.speedTiers.closeTenMetresMaxS);
    console.info(`[AC12] frail ${Math.min(...all.frail).toFixed(2)}-${Math.max(...all.frail).toFixed(2)} average ${Math.min(...all.average).toFixed(2)}-${Math.max(...all.average).toFixed(2)} athletic ${Math.min(...all.athletic).toFixed(2)}-${Math.max(...all.athletic).toFixed(2)} m/s; close 10 m median ${median(closing).toFixed(1)} s (min ${Math.min(...closing).toFixed(1)}, max ${Math.max(...closing).toFixed(1)})`);
  }, 120_000);
});
