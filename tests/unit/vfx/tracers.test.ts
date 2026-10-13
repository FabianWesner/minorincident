import { expect, test, vi } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { stateHash } from '../../../src/sim/world/stateHash';
import { Vfx } from '../../../src/render/vfx/Vfx';
import { tracerLaunchS } from '../../../src/render/vfx/FxPool';

for (const quality of ['high', 'low'] as const) test(`@E15 moving tracers use one warm pooled slot per selected round (${quality})`, async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('combat-arena', 7);
  const a = world.spawnDummy('infected.dummy', { x: -20, z: -10 });
  const b = world.spawnDummy('infected.dummy', { x: -20, z: 10 });
  const muzzle = { x: 0, y: 2, z: 0 };
  const fx = new Vfx(world, { muzzle: () => muzzle, flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {} });
  fx.set({ quality });
  const hash = stateHash(world.getState());
  const geometry = fx.particles.mesh.geometry;
  const slots = () => {
    const style = geometry.getAttribute('fxStyle'), motion = geometry.getAttribute('fxMotion');
    return Array.from({ length: style.count }, (_, i) => i).filter(i => style.getY(i) === 11 && motion.getW(i) > 0);
  };
  const shoot = (sourceId: number) => world.events.emit(sourceId === 1
    ? { type: 'combat.attack', tick: world.tick, attackId: 1, actionId: 'weapon.army-mg', sourceId, combo: 0, side: 'LEFT', position: { ...muzzle, yaw: 0 }, direction: { x: 1, z: 0 } }
    : { type: 'ally.attack', tick: world.tick, sourceId, targetId: 9999, role: 'soldier', from: muzzle, to: { x: 20, z: 0 }, hit: false });
  try {
    for (let round = 0; round < 6; round++) { shoot(a); shoot(b); }
    expect(slots()).toHaveLength(4); // Each shooter independently shows rounds 1 and 4.
    for (let round = 0; round < 3; round++) shoot(1);
    expect(slots()).toHaveLength(7);
    const origin = geometry.getAttribute('fxOrigin'), style = geometry.getAttribute('fxStyle'), motion = geometry.getAttribute('fxMotion');
    for (const slot of slots()) {
      expect([origin.getX(slot), origin.getY(slot), origin.getZ(slot)]).toEqual([0, 2, 0]);
      expect(Math.hypot(motion.getX(slot), motion.getY(slot), motion.getZ(slot))).toBeCloseTo(320);
      expect(style.getX(slot)).toBe(1); expect(style.getW(slot)).toBeCloseTo(.065);
      expect((motion.getW(slot) - tracerLaunchS) * 320).toBeCloseTo(style.getZ(slot)); // Ends at the hit, never beyond it.
      expect(motion.getW(slot)).toBeLessThan(.1);
    }
    expect(fx.particles.count).toBeLessThan(quality === 'high' ? 250 : 110);
    expect(stateHash(world.getState())).toBe(hash);
    fx.advance(.2);
    expect(fx.particles.count).toBeGreaterThan(0); // Brass/dust survive the flying streak.
    fx.advance(.8); expect(fx.particles.count).toBe(0);
    shoot(1); fx.set({ vfx: false }); expect(fx.particles.count).toBe(0);
  } finally { fx.dispose(); world.dispose(); }
});

test('@E15 a sloped tracer stops at cover and a muzzle blocked at zero distance emits no streak', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('combat-arena');
  const sourceId = world.spawnDummy('infected.dummy', { x: -20, z: 0 });
  const targetId = world.spawnDummy('infected.dummy', { x: 12, z: 0 });
  const fx = new Vfx(world, { muzzle: () => ({ x: 0, y: 2.5, z: 0 }), flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {} });
  const cover = vi.spyOn(world.combat!.query, 'clearDistance').mockReturnValue(5);
  try {
    const shoot = () => world.events.emit({ type: 'ally.attack', tick: world.tick, sourceId, targetId, role: 'soldier', from: { x: -20, z: 0 }, to: { x: 12, z: 0 }, hit: true });
    shoot();
    const g = fx.particles.mesh.geometry, s = g.getAttribute('fxStyle'), m = g.getAttribute('fxMotion');
    const slot = Array.from({ length: s.count }, (_, i) => i).find(i => s.getY(i) === 11)!;
    const slope = (world.entities.get(targetId)!.transform.y + .45 - 2.5) / 12;
    expect(m.getY(slot) / m.getX(slot)).toBeCloseTo(slope);
    expect((m.getW(slot) - tracerLaunchS) * m.getX(slot)).toBeCloseTo(5);
    expect(s.getZ(slot)).toBeCloseTo(5 * Math.hypot(1, slope));
    fx.advance(m.getW(slot) + .001);
    expect(fx.particles.count).toBeGreaterThan(0); // The original flash/brass remain.
    fx.particles.reset(fx.time); cover.mockReturnValue(0);
    for (let i = 0; i < 3; i++) shoot();
    expect(Array.from({ length: s.count }, (_, i) => i).filter(i => s.getY(i) === 11 && m.getW(i) > 0)).toHaveLength(0);
  } finally { cover.mockRestore(); fx.dispose(); world.dispose(); }
});

test('@E15 a player tracer ends at the first predicted victim instead of the weapon maximum range', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('combat-arena');
  const targetId = world.spawnDummy('infected.dummy', { x: 12, z: 0 });
  const fx = new Vfx(world, { muzzle: () => ({ x: 0, y: 1.3, z: 0 }), flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {} });
  const ray = vi.spyOn(world.combat!.query, 'ray').mockReturnValue(world.entities.get(targetId)!);
  try {
    world.events.emit({ type: 'combat.attack', tick: world.tick, attackId: 1, actionId: 'weapon.army-mg', sourceId: 1, combo: 0, side: 'LEFT', position: { x: 0, y: .7, z: 0, yaw: 0 }, direction: { x: 1, z: 0 } });
    expect(fx.shots.at(-1)!.end).toEqual([12, 1.3, 0]);
    const g = fx.particles.mesh.geometry, style = g.getAttribute('fxStyle'), motion = g.getAttribute('fxMotion');
    const slot = Array.from({ length: style.count }, (_, i) => i).find(i => style.getY(i) === 11)!;
    expect(motion.getW(slot)).toBeCloseTo(12 / 320 + tracerLaunchS);
  } finally { ray.mockRestore(); fx.dispose(); world.dispose(); }
});

test('@E15 tracer cadence and predicted hit queries preserve an MG burst simulation hash', async () => {
  const hashes = [];
  for (const enabled of [true, false]) {
    const world = new SimWorld(); await world.init(); world.loadScenario('combat-arena', 7);
    world.combat!.setLoadout(['weapon.army-mg'], ['weapon.bat']);
    world.spawnDummy('infected.dummy', { x: 12, z: 0 }, { hp: 10_000 });
    const fx = new Vfx(world, { flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {} });
    fx.set({ vfx: enabled });
    try {
      for (let tick = 0; tick < 240; tick++) {
        world.setInput({ aim: { x: 1, z: 0 }, left: { down: tick === 0, held: true, up: false } });
        world.update(); fx.advance(1 / 60);
      }
      expect(world.events.events().filter(e => e.type === 'combat.attack').length).toBeGreaterThan(3);
      hashes.push(stateHash(world.getState()));
    } finally { fx.dispose(); world.dispose(); }
  }
  expect(hashes[0]).toBe(hashes[1]);
});
