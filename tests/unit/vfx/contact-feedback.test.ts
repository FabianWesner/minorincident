import { expect, test, vi } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { stateHash } from '../../../src/sim/world/stateHash';
import { Vfx } from '../../../src/render/vfx/Vfx';
import { particleShape } from '../../../src/render/vfx/FxPool';

for (const quality of ['high', 'low'] as const) test(`@E15 hull collision feedback is bounded and never changes durability (${quality})`, async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('drive-course');
  const cars = [...world.vehicles!.cars.values()];
  const fx = new Vfx(world, { flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {} });
  fx.set({ quality });
  const hash = stateHash(world.getState()), geometry = fx.particles.mesh.geometry, material = fx.particles.mesh.material;
  const contact = { type: 'vehicle.durability-hit' as const, tick: world.tick, sourceId: cars[0].entity.id, targetId: cars[1].entity.id, source: 'obstacle' as const, contactId: 1, attackId: null, before: 100, after: 95 };
  try {
    world.events.emit({ ...contact, source: 'attack' }); expect(fx.particles.count).toBe(0);
    world.events.emit({ ...contact, after: 100 }); expect(fx.particles.count).toBe(0);
    world.events.emit(contact); expect(fx.particles.count).toBeGreaterThan(0);
    expect(fx.particles.count).toBeLessThanOrEqual(quality === 'low' ? 3 : 12);
    for (let i = 0; i < 300; i++) world.events.emit(contact);
    expect(fx.particles.count).toBeLessThanOrEqual(quality === 'low' ? 512 : 2048);
    expect(fx.particles.mesh.geometry).toBe(geometry); expect(fx.particles.mesh.material).toBe(material);
    expect(stateHash(world.getState())).toBe(hash);
    fx.advance(.5); expect(fx.particles.count).toBe(0);
    fx.set({ vfx: false }); world.events.emit(contact); expect(fx.particles.count).toBe(0);
  } finally { fx.dispose(); world.dispose(); }
});

for (const quality of ['high', 'low'] as const) test(`@E15 cover dust and glints start at the actual bullet stop without sim writes (${quality})`, async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('combat-arena');
  const fx = new Vfx(world, { muzzle: () => ({ x: 0, y: 2.5, z: 0 }), flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {} });
  fx.set({ quality });
  const clear = vi.spyOn(world.combat!.query, 'clearDistance').mockReturnValue(5);
  const ray = vi.spyOn(world.combat!.query, 'ray').mockReturnValue(null);
  const hash = stateHash(world.getState());
  try {
    world.events.emit({ type: 'combat.attack', tick: world.tick, attackId: 1, actionId: 'weapon.army-mg', sourceId: 1, side: 'LEFT', position: { x: 0, y: .7, z: 0, yaw: 0 }, direction: { x: 1, z: 0 } });
    const g = fx.particles.mesh.geometry, o = g.getAttribute('fxOrigin'), s = g.getAttribute('fxStyle'), m = g.getAttribute('fxMotion');
    const contact = Array.from({ length: o.count }, (_, i) => i).filter(i => m.getW(i) > 0 && o.getX(i) > 1 && s.getY(i) !== particleShape.tracer);
    expect(contact.length).toBeGreaterThan(0);
    expect(contact.length).toBeLessThanOrEqual(quality === 'high' ? 7 : 2);
    expect(contact.some(i => s.getY(i) === particleShape.smoke)).toBe(true);
    expect(contact.some(i => s.getY(i) === particleShape.spark)).toBe(true);
    for (const i of contact) expect([o.getX(i), o.getY(i), o.getZ(i)]).toEqual([5, 2.5, 0]);
    expect(stateHash(world.getState())).toBe(hash);
    fx.advance(1); expect(fx.particles.count).toBe(0);
  } finally { clear.mockRestore(); ray.mockRestore(); fx.dispose(); world.dispose(); }
});
