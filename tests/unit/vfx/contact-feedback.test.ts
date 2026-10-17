import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { stateHash } from '../../../src/sim/world/stateHash';
import { Vfx } from '../../../src/render/vfx/Vfx';

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
