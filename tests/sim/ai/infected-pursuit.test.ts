import { afterEach, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { compositions } from '../../../src/levels/compositions';
import type { CoverWall } from '../../../src/sim/combat/HitQuery';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import type { HumanTarget, HumanTargetQuery, Vec2 } from '../../../src/sim/outbreak/types';

/**
 * PO 2026-10-09 (verbatim): "sometimes Zombies are stuck somewhere, like this one is not moving at all." / "Zombies loose
 * track. This one was running behind me (same speed; should be a bit faster than me). Then running very fast but past me.
 * Then walking around, although in my direct near. Super strange. ALso there was a ped close, which the Zombie just
 * ignored." / "it even "found" me after some moments, attacked me, then walked away."
 * Real survivor input against the L1 brain (used by L1-L3) on the open horde arena.
 */
const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
async function arena(seed: number, humans?: HumanTargetQuery) {
  const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario('horde-arena', seed);
  w.infected!.configureL1v2(humans); w.combat!.damage.god = true;
  return w;
}
const runner = (w: SimWorld, x: number, z: number, yaw: number, variant = 'inf.cashier'): EntitySnapshot => w.entities.get(w.infected!.spawn('infected.runner', { x, z }, { yaw, variant }))!;
const brain = (e: EntitySnapshot) => e.infected!.l1!;
function wall(w: SimWorld, id: number, x: number, z: number, halfX: number, halfZ: number): void {
  const cover: CoverWall = { x, y: 1, z, halfX, halfY: 1, halfZ };
  (w.combat!.query.walls as CoverWall[]).push(cover);
  w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id, wall: cover, blocked: true } as never);
}
class Humans implements HumanTargetQuery {
  readonly list: HumanTarget[] = [];
  private readonly out: HumanTarget[] = [];
  add(id: number, kind: HumanTarget['kind'], x: number, z: number): HumanTarget { const h = { id, kind, position: { x, z }, facing: 0 }; this.list.push(h); return h; }
  all() { return this.list; }
  get(id: number) { return this.list.find(h => h.id === id); }
  within(c: Vec2, r: number) { this.out.length = 0; for (const h of this.list) if (Math.hypot(h.position.x - c.x, h.position.z - c.z) <= r) this.out.push(h); return this.out; }
}
type Move = (t: number) => { x: number; z: number };
/** Runs the courier with keyboard intents; per tick: lost-near (not chasing while she is < 6 m in sight), overshoot ahead of her. */
function pursue(w: SimWorld, e: EntitySnapshot, move: Move, seconds: number) {
  const p = w.entities.get(1)!; let lostNear = 0, overshoot = 0, swings = 0, chasing = 0;
  w.events.on('telegraph', ev => { if (ev.type === 'telegraph' && ev.sourceId === e.id) swings++; });
  for (let t = 0; t < seconds * 60; t++) {
    const m = move(t / 60); w.setInput({ move: m }); w.update();
    const b = e.infected!, l = brain(e), d = Math.hypot(p.transform.x - e.transform.x, p.transform.z - e.transform.z);
    const engaged = l.mode === 'chase' || l.mode === 'bite' || b.state === 'attack';
    if (engaged) chasing++;
    if (!engaged && chasing && d < 6 && w.infected!.l1!.lineOfSight(e.transform, p.transform) && (e.combat!.staggerUntil <= w.tick)) lostNear++;
    const length = Math.hypot(m.x, m.z);
    if (length && l.mode === 'chase') overshoot = Math.max(overshoot, ((e.transform.x - p.transform.x) * m.x + (e.transform.z - p.transform.z) * m.z) / length);
  }
  return { lostNear, overshoot, swings };
}

describe('infected pursuit (PO 2026-10-09)', () => {
  test('zigzag and circling courier: the runner stays on her, never runs past (< 2 m ahead), never drops her while she is near', async () => {
    const zigzag: Move = t => [{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 0 }, { x: 0, z: -1 }][Math.floor(t / 1.5) % 4];
    const circle: Move = t => ({ x: Math.cos(t * 0.7), z: Math.sin(t * 0.7) });
    const rows: string[] = [];
    for (const seed of [1, 2, 3, 4, 5]) for (const [name, move] of [['zigzag', zigzag], ['circle', circle]] as const) {
      const w = await arena(seed), e = runner(w, -8, 0, 0, seed % 2 ? 'inf.cashier' : 'inf.jogger');
      const r = pursue(w, e, move, 14);
      rows.push(`${name}#${seed} swings ${r.swings} overshoot ${r.overshoot.toFixed(2)} m lostNear ${r.lostNear}`);
      expect(r.overshoot, `${name} seed ${seed}`).toBeLessThan(2);
      expect(r.lostNear, `${name} seed ${seed}`).toBe(0);
      // Zigzag cuts let it close in and lunge; on a steady circle a chaser at the 4.4 m/s floor only creeps closer (pure pursuit).
      if (name === 'zigzag') expect(r.swings, `${name} seed ${seed}`).toBeGreaterThanOrEqual(1);
      w.dispose(); worlds.length = 0;
    }
    console.info(`[pursuit] ${rows.join('; ')}`);
  }, 120_000);

  test('a runner chasing the running courier is a bit faster than her and closes in', async () => {
    const w = await arena(3), e = runner(w, -8, 0, 0);
    const p = w.entities.get(1)!;
    expect(brain(e).runSpeed).toBeGreaterThan(4.5);
    for (let t = 0; t < 2 * 60; t++) { w.setInput({ move: { x: 1, z: 0 } }); w.update(); }
    const gap = Math.hypot(p.transform.x - e.transform.x, p.transform.z - e.transform.z);
    for (let t = 0; t < 4 * 60 && e.infected!.state !== 'attack'; t++) { w.setInput({ move: { x: 1, z: 0 } }); w.update(); }
    expect(Math.hypot(p.transform.x - e.transform.x, p.transform.z - e.transform.z)).toBeLessThan(gap);
  });

  test('after its attack and her knockback it stays on her (no walking away while she is in reach)', async () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = await arena(seed), e = runner(w, -5, 0.6, 0), p = w.entities.get(1)!;
      let swings = 0; w.events.on('telegraph', ev => { if (ev.type === 'telegraph' && ev.sourceId === e.id) swings++; });
      for (let i = 0; i < 300 && swings === 0; i++) w.update();
      expect(swings).toBe(1);
      let lost = 0;
      for (let round = 0; round < 3; round++) {
        // Her punch: a 2 m knockback and a 0.4 s stagger that may spin it away from her.
        const dx = e.transform.x - p.transform.x, dz = e.transform.z - p.transform.z, d = Math.hypot(dx, dz) || 1;
        w.combat!.damage.apply({ sourceId: 1, targetId: e.id, attackId: 900 + round, actionId: 'weapon.fists', origin: { x: p.transform.x, z: p.transform.z }, direction: { x: dx / d, z: dz / d }, base: 1, multiplier: 1, type: 'melee', stagger: 0.4, knockback: 2 });
        e.transform.yaw += Math.PI * 0.8; // knocked round: facing away
        for (let i = 0; i < 150; i++) { w.update(); const l = brain(e); if (l.mode !== 'chase' && e.infected!.state !== 'attack' && e.combat!.staggerUntil <= w.tick) lost++; }
      }
      expect(lost, `seed ${seed}`).toBeLessThanOrEqual(0);
      expect(swings, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      w.dispose(); worlds.length = 0;
    }
  }, 120_000);

  test('a pedestrian at arm\'s length behind an infected is noticed and bitten', async () => {
    const humans = new Humans(), w = await arena(1, humans);
    const e = runner(w, 0, 0, 0); // faces +X
    humans.add(300, 'civilian', -2.2, 0.4); // behind it, outside the 90 degree cone
    let bitten = -1; w.events.on('outbreak.bite', ev => { if (ev.type === 'outbreak.bite' && ev.targetId === 300 && bitten < 0) bitten = w.tick; });
    for (let i = 0; i < 4 * 60 && bitten < 0; i++) w.update();
    expect(brain(e).targetId === 300 || bitten > 0).toBe(true);
    expect(bitten).toBeGreaterThan(0);
    expect(bitten).toBeLessThanOrEqual(3 * 60);
  });

  test('an infected in a slot narrower than the nav clearance (fence gap, beside a parked truck) walks out instead of freezing', async () => {
    for (const seed of [1, 2, 3]) {
      const w = await arena(seed);
      // A 1.1 m wide, 7 m long slot open to the west: no 0.5 m nav cell inside it is walkable at the 0.65 m clearance.
      wall(w, 960, 20, 1.3, 4, 0.75); wall(w, 961, 20, -1.3, 4, 0.75); wall(w, 962, 24.3, 0, 0.3, 2.05);
      const e = runner(w, 22.5, 0, Math.PI / 2);
      const b = brain(e); b.pauseUntil = 0; b.looking = false;
      let still = 0, worst = 0, out = -1;
      for (let i = 0; i < 8 * 60 && out < 0; i++) {
        const x = e.transform.x; w.update();
        const busy = w.tick < b.pauseUntil || e.infected!.state === 'attack';
        still = !busy && Math.abs(e.transform.x - x) + 0 < 0.002 && (e.motion?.speed ?? 0) < 0.1 ? still + 1 : 0; worst = Math.max(worst, still);
        if (e.transform.x < 15.5) out = w.tick;
      }
      expect(out, `seed ${seed}: x ${e.transform.x.toFixed(2)} mode ${b.mode}`).toBeGreaterThan(0);
      expect(worst, `seed ${seed}`).toBeLessThan(90);
      w.dispose(); worlds.length = 0;
    }
  }, 120_000);

  test('D-GROVE porch gate (catalog inf-door-emerge): a resident turned in the 2-cell gate pocket walks out into the yard', async () => {
    const w = new SimWorld(); worlds.push(w); await w.init();
    const c = compositions['D-GROVE'];
    w.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 4); w.enableInfected();
    const e = runner(w, 33.5, 35.2, -Math.PI / 2, 'npc.civilian-man-b');
    let left = -1;
    for (let i = 0; i < 6 * 60 && left < 0; i++) { w.update(); if (Math.hypot(e.transform.x - 33.5, e.transform.z - 35.2) > 1.5) left = w.tick; }
    expect(left, `still at ${e.transform.x.toFixed(2)},${e.transform.z.toFixed(2)} (${brain(e).mode})`).toBeGreaterThan(0);
  });

  test('a blocker switched on around an infected (parked truck footprint, closed gate) pushes it out; it moves on', async () => {
    const w = await arena(2), e = runner(w, 10, 10, 0);
    for (let i = 0; i < 30; i++) w.update();
    wall(w, 970, e.transform.x + 0.4, e.transform.z, 3.7, 1.05); // the truck parks on top of it
    expect(w.infected!.nav.clear(e.transform.x, e.transform.z, 0.3)).toBe(false);
    for (let i = 0; i < 90; i++) w.update();
    expect(w.infected!.nav.clear(e.transform.x, e.transform.z, 0.3)).toBe(true);
    const at = { x: e.transform.x, z: e.transform.z }; let moved = 0;
    for (let i = 0; i < 6 * 60; i++) { w.update(); moved = Math.max(moved, Math.hypot(e.transform.x - at.x, e.transform.z - at.z)); }
    expect(moved).toBeGreaterThan(1);
  });
});
