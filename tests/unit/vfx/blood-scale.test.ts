import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { Vfx } from '../../../src/render/vfx/Vfx';

for (const quality of ['high', 'low'] as const) test(`PO #32 blood is a supported ground splat with tiny transient drops (${quality})`, async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('combat-arena');
  const fx = new Vfx(world, { flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {} });
  fx.set({ quality, gore: 'Full' });
  try {
    world.events.emit({ type: 'combat.hit', tick: world.tick, attackId: 1, actionId: 'weapon.bat', sourceId: 1, targetId: 1, amount: 40, position: { x: 0, y: .7, z: 0, yaw: 0 }, direction: { x: 1, z: 0 }, knockback: 1, damageType: 'melee' });
    const g = fx.particles.mesh.geometry, motion = g.getAttribute('fxMotion'), style = g.getAttribute('fxStyle');
    const live = Array.from({ length: motion.count }, (_, i) => i).filter(i => motion.getW(i) > 0);
    expect(live.length).toBeGreaterThan(0);
    for (const i of live) { expect(style.getX(i)).toBeLessThanOrEqual(.036); expect(motion.getW(i)).toBeLessThanOrEqual(.181); }
    expect(fx.snapshot().lastSpray.chunks).toBe(quality === 'high' ? 2 : 0);
    expect(fx.decals.count).toBeGreaterThan(0);
    const origin = fx.decals.mesh.geometry.getAttribute('fxOrigin');
    for (let i = 0; i < fx.decals.count; i++) expect(origin.getY(i), 'every clot and splat stays on the support').toBeCloseTo(.016);
    fx.advance(.3); expect(fx.particles.count).toBe(0); expect(fx.decals.count).toBeGreaterThan(0);
  } finally { fx.dispose(); world.dispose(); }
});
