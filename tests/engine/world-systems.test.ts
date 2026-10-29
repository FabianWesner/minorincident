// Shared world systems: interaction rings/devices/doors, pickups, explosions/hazards and barricades are authored in
// every level from the same catalogs. Each test drives the real system through a scenario.
import { afterEach, expect, test } from 'vitest';
import { blastDamage, explosionDef } from '../../src/data/explosions';
import type { Pickup } from '../../src/sim/interact/Pickups';
import { NavGrid } from '../../src/sim/world/NavGrid';
import type { GameEvent } from '../../src/sim/world/types';
import { SimWorld } from '../../src/sim/world/SimWorld';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds.splice(0)) w.dispose(); });
async function world(name = 'combat-arena', god = false) { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario(name, 1); w.combat!.damage.god = god; return w; }
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
const events = <T extends GameEvent['type']>(w: SimWorld, type: T) => w.events.events().filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
function move(w: SimWorld, x: number, z = 0) { const p = w.entities.get(1)!; Object.assign(p.transform, { x, z }); w.physics.playerBody!.setTranslation(p.transform, true); w.spatial.set(1, x, z); }

test('interaction: rings fill and decay, complete once, nearest instant wins in range, damage floors interruptible progress', async () => {
  const w = await world(), id = w.interactables!.spawn('switch', { x: 0, z: 0 }, { holdTime: 2 });
  step(w, 60); expect(w.entities.get(id)!.interactable!.progress).toBeCloseTo(.5);
  move(w, 4); step(w, 15); expect(w.entities.get(id)!.interactable!.progress).toBeCloseTo(.25);
  move(w, 0); step(w, 90); expect(w.entities.get(id)!.interactable!.progress).toBe(1);
  step(w, 120); expect(events(w, 'interact.completed')).toHaveLength(1);

  const n = await world(), a = n.interactables!.spawn('button', { x: .2, z: 0 }), b = n.interactables!.spawn('radio', { x: .8, z: 0 });
  n.setInput({ interact: true }); step(n, 1); n.clearInput();
  expect(n.entities.get(a)!.interactable!.completed).toBe(true); expect(n.entities.get(b)!.interactable!.progress).toBe(0);

  const g = await world(), gen = g.interactables!.spawn('generator', { x: 0, z: 0 }, { holdTime: 4, fuel: 10 });
  step(g, 155); g.player!.damage(1, g.tick);
  expect(g.entities.get(gen)!.interactable!.progress).toBe(.5);
});

test('doors: locked hint, key requirement, open/close updates navigation and colliders in the same tick', async () => {
  const w = await world(), nav = new NavGrid([-3, -1], [4, 2]); nav.cells.fill(1); w.interactables!.nav = nav;
  const id = w.interactables!.spawn('door', { x: 1, z: 0 }, { key: 'key.house', halfX: .4, halfZ: 2 });
  expect(nav.flood([-2, 0])[nav.index(3, 0)]).toBe(0);
  w.setInput({ interact: true }); step(w, 1);
  expect(w.entities.get(id)!.interactable!.hint).toBe('locked'); expect(w.entities.get(id)!.interactable!.open).toBe(false);
  w.clearInput(); step(w, 60);
  w.interactables!.giveItem('key.house'); w.setInput({ interact: true }); step(w, 1); w.clearInput();
  expect(w.entities.get(id)!.interactable!.open).toBe(true);
  expect(nav.flood([-2, 0])[nav.index(3, 0)]).toBe(1);
  const colliders = w.physics.colliderCount;
  move(w, -3); step(w, 1); move(w, 0); w.setInput({ interact: true }); step(w, 1);
  expect(w.entities.get(id)!.interactable!.open).toBe(false);
  expect(w.physics.colliderCount).toBe(colliders + 1);
});

test('pickups: exact one-time effects with caps, rack join/replacement, dead players wait, inventory survives respawn', async () => {
  const w = await world(), p = w.entities.get(1)!, pickups = w.pickups!;
  w.player!.damage(80, w.tick);
  const med = pickups.spawn('medkit', { x: 0, z: 0 }); step(w, 1); expect(p.health.current).toBe(70);
  pickups.spawn('soda', { x: 0, z: 0 }); step(w, 1); expect(p.health.current).toBe(85);
  pickups.spawn('medkit', { x: 0, z: 0 }); step(w, 1); expect(p.health.current).toBe(100);
  const full = pickups.spawn('medkit', { x: 0, z: 0 }); step(w, 1); expect((w.entities.get(full)!.pickup as Pickup).collected).toBe(false);
  w.combat!.setLoadout(['weapon.bat'], ['weapon.grenade']);
  const grenade = w.combat!.runner.loadout.current('RIGHT'); grenade.charges = 0; grenade.nextCharge = w.tick + 600;
  pickups.spawn('throwable', { x: 0, z: 0 }); step(w, 1); expect(grenade.charges).toBe(1);
  pickups.spawn('weapon', { x: 0, z: 0 }, 'weapon.pistol'); step(w, 1);
  expect(w.combat!.runner.loadout.state.LEFT.rack.map(s => s.id)).toContain('weapon.pistol');
  step(w, 60); expect(events(w, 'pickup.collected').filter(e => 'id' in e && e.id === med)).toHaveLength(1);
  w.player!.damage(100, w.tick); const key = pickups.spawn('item', { x: 0, z: 0 }, 'key.house'); step(w, 1);
  expect((w.entities.get(key)!.pickup as Pickup).collected).toBe(false);
  step(w, 150); expect(p.inventory).toContain('key.house');
  w.player!.damage(100, w.tick); step(w, 150); expect(p.inventory).toContain('key.house');
  expect(() => pickups.spawn('weapon', { x: 0, z: 0 }, 'unknown')).toThrow();

  const r = await world(); r.combat!.setLoadout(['weapon.bat', 'weapon.knife', 'weapon.crowbar'], ['weapon.grenade']);
  const rack = r.combat!.runner.loadout; rack.state.LEFT.index = 1;
  r.pickups!.spawn('weapon', { x: 0, z: 0 }, 'weapon.katana'); step(r, 1);
  expect(rack.current('LEFT').id).toBe('weapon.katana');
  expect(r.query({ kind: 'pickup' })[0].pickup).toEqual({ actionId: 'weapon.knife', armed: false, dropped: true });
});

test('explosions: every class follows its damage curve, full cover shields, rails take damage, chains are paced and capped, fires burn out', async () => {
  for (const id of ['explosion.pipe-bomb', 'explosion.propane', 'explosion.car', 'explosion.gas-tanks', 'explosion.molotov', 'explosion.toxic']) {
    const w = await world('blast-lab', true), d = explosionDef(id), at = { x: 0, z: -18 };
    const ids = [0, .5, 1].map(f => w.spawnDummy('infected.dummy', { x: at.x + d.radius * f * (f === 1 ? .999 : 1), z: at.z }, { hp: 5000 }));
    w.explosions!.blast(id, at);
    [0, .5, .999].forEach((f, i) => {
      const expected = blastDamage(d, d.radius * f), dealt = 5000 - w.entities.get(ids[i])!.health.current;
      expect(Math.abs(dealt - expected), `${id} at ${f}`).toBeLessThanOrEqual(Math.max(.02 * expected, 1e-6));
    });
  }
  const c = await world('blast-lab', true), behind = c.spawnDummy('infected.dummy', { x: -7, z: 0 }, { hp: 500 }), open = c.spawnDummy('infected.dummy', { x: -1.5, z: 3.5 }, { hp: 500 });
  const rail = c.barricades!.spawn({ id: 'blast-rail', groupId: 'g', a: { x: 2, z: 2 }, b: { x: 4, z: 2 }, height: 1, initialHp: 300 });
  c.explosions!.blast('explosion.propane', { x: -4.5, z: 0 });
  expect(c.entities.get(behind)!.health.current).toBe(500); expect(c.entities.get(open)!.health.current).toBeLessThan(500);
  c.explosions!.blast('explosion.propane', { x: 3, z: 0 });
  expect(c.entities.get(rail)!.health.current).toBeCloseTo(300 - 100 * (5 - 2) / 5, 5);

  const h = await world('combat-arena', true), tanks = [-6, -3, 0, 3, 6].map(x => h.hazards!.spawn('propane', { x, z: 8 }));
  h.hazards!.hit(tanks[0], 100, 'bullet'); step(h, 200);
  const blasts = events(h, 'hazard.exploded');
  expect(blasts.map(e => e.id)).toEqual(tanks);
  for (let i = 1; i < blasts.length; i++) { const dt = (blasts[i].tick - blasts[i - 1].tick) / 60; expect(dt).toBeGreaterThanOrEqual(.15); expect(dt).toBeLessThanOrEqual(.3); }
  const big = await world('combat-arena', true), stack = Array.from({ length: 14 }, (_, i) => big.hazards!.spawn('propane', { x: i * .2, z: 8 }));
  big.hazards!.hit(stack[0], 100, 'bullet'); step(big, 240);
  const ticks = events(big, 'hazard.exploded').map(e => e.tick);
  expect(ticks).toHaveLength(14);
  for (const t of ticks) expect(ticks.filter(u => u >= t && u < t + 60).length).toBeLessThanOrEqual(8);

  const f = await world('combat-arena', true);
  f.explosions!.blast('explosion.barrel', { x: 8, z: 8 });
  const fires = () => f.entities.values().filter(e => e.hazard?.kind === 'fire' && f.tick < e.hazard.activeUntil);
  expect(fires().length).toBeGreaterThan(0);
  step(f, 18 * 30 + 30 * 60 + 2); expect(fires()).toHaveLength(0);
});

test('look-l6-l9 decor is render-only: L6/L9 nav hash, colliders and pushables match the layout without it, and a re-preparation adds none', async () => {
  const { DistrictWorld } = await import('../../src/sim/world/DistrictWorld');
  const { compositions } = await import('../../src/levels/compositions');
  const layouts = { L6: (await import('../../public/assets/layouts/D-SUBWAY.layout.json')).default, L9: (await import('../../public/assets/layouts/D-CROSSING.layout.json')).default };
  for (const level of ['L6', 'L9'] as const) {
    const build = (skip: boolean) => { const layout = structuredClone(layouts[level]) as unknown as { geometryHash: string }; if (skip) layout.geometryHash = 'scene-lab'; return new DistrictWorld(compositions[level], [layout as never], 1); };
    const plain = build(true), dressed = build(false), d = dressed.districts[0], p = plain.districts[0];
    expect(d.decay.placements.filter(q => q.decor).length).toBeGreaterThan(60);
    expect(dressed.nav.hash).toBe(plain.nav.hash);
    expect(d.decay.colliders).toEqual(p.decay.colliders);
    expect(d.pushables.map(q => q.id)).toEqual(p.pushables.map(q => q.id));
    expect(new DistrictWorld(compositions[level], dressed.districts.map(x => x.layout), 1).districts[0].decay.placements.length).toBe(d.decay.placements.length);
  }
  // L9 pieces stay outside the swept envelope of a vehicle anywhere on any lane (they also collide: ChunkResidency physics-only statics).
  const { crossing } = await import('../../src/levels/L9/district'), { VEHICLE_ENVELOPE, districtDecor } = await import('../../src/levels/decor'), { worldAssets } = await import('../../src/assets/worldDefinitions');
  const seg = (p: number[], a: number[], b: number[]) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz); };
  for (const p of districtDecor('D-CROSSING', layouts.L9.placements as never)) {
    const dims = worldAssets[p.assetId].dimensions, r = Math.hypot(dims.x, dims.z) / 2;   // footprint circle of the piece
    for (const route of crossing.routes) expect(Math.min(...route.points.slice(1).map((b, i) => seg([p.position[0], p.position[2]], route.points[i], b))) - route.width / 2 - r).toBeGreaterThanOrEqual(VEHICLE_ENVELOPE - 1e-6);
  }
});
