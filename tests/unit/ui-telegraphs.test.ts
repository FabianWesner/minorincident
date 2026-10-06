import { expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { stateHash } from '../../src/sim/world/stateHash';
import { Vfx } from '../../src/render/vfx/Vfx';
test('@E14 colorblind setting recolors existing tells without changing geometry, lifetime or simulation', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('vfx-showcase');
  const fx = new Vfx(world, { flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {} });
  try {
    world.events.emit({ tick: 0, type: 'telegraph', attackId: 14, kind: 'charge', position: { x: 2, z: 1 }, radius: 3, angle: 0 });
    const hash = stateHash(world.getState()), before = fx.snapshot().telegraphs, geometry = fx.telegraphs.mesh.geometry;
    const color = geometry.getAttribute('fxColor'), slot = before[0].slot, original = color.getX(slot);
    fx.set({ colorblind: true, quality: 'high' });
    expect(color.getX(slot)).toBe(1); expect(color.getY(slot)).toBe(1); expect(color.getZ(slot)).toBe(1);
    expect(fx.snapshot().telegraphs).toEqual(before); expect(fx.telegraphs.mesh.geometry).toBe(geometry);
    expect(stateHash(world.getState())).toBe(hash);
    fx.set({ colorblind: false }); expect(color.getX(slot)).toBe(original);
  } finally { fx.dispose(); world.dispose(); }
});
