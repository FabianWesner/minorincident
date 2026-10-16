import { expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { stateHash } from '../../src/sim/world/stateHash';
import { Vfx } from '../../src/render/vfx/Vfx';
test('@E14 colorblind setting recolors existing tells without changing geometry, lifetime or simulation', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('vfx-showcase');
  const fx = new Vfx(world, { flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {} });
  try {
    fx.set({ vfx: false }); // Optional effects must not hide the warnings formerly owned by CrowdView.
    fx.visible = false; const restore = fx.prewarm(0, 0);
    expect(fx.visible).toBe(true); expect(fx.telegraphs.count).toBe(1);
    restore(); expect(fx.visible).toBe(false); expect(fx.telegraphs.count).toBe(0);
    world.events.emit({ tick: 0, type: 'telegraph', attackId: 14, kind: 'charge', position: { x: 2, z: 1 }, radius: 3, angle: 0 });
    expect(fx.visible).toBe(true); expect(fx.telegraphs.count).toBe(1);
    const hash = stateHash(world.getState()), before = fx.snapshot().telegraphs, geometry = fx.telegraphs.mesh.geometry;
    const color = geometry.getAttribute('fxColor'), slot = before[0].slot, original = [color.getX(slot), color.getY(slot), color.getZ(slot)];
    fx.set({ colorblind: true, quality: 'high' });
    expect(color.getX(slot)).toBe(1); expect(color.getY(slot)).toBe(1); expect(color.getZ(slot)).toBe(1);
    expect(fx.snapshot().telegraphs).toEqual(before); expect(fx.telegraphs.mesh.geometry).toBe(geometry);
    expect(stateHash(world.getState())).toBe(hash);
    fx.set({ colorblind: false }); expect([color.getX(slot), color.getY(slot), color.getZ(slot)]).toEqual(original);
  } finally { fx.dispose(); world.dispose(); }
});

test.each([
  ['alpha.charge', 12, 2, 2, .8],
  ['alpha.ground-slam', 8, 8, 1, 1],
  ['alpha.grab-throw', 8, 2, 2, .8],
] as const)('PO24 %s uses one road-aligned pooled warning with the real wind-up', async (move, length, width, shape, duration) => {
  const world = new SimWorld(); await world.init(); world.loadScenario('vfx-showcase');
  const sourceId = world.spawnDummy('infected.alpha', { x: 0, z: 0 });
  const fx = new Vfx(world, { flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {} });
  try {
    const hash = stateHash(world.getState());
    world.events.emit({ tick: 0, type: 'telegraph', sourceId, attackId: 24, special: move, move, duration,
      area: { x: 0, z: 0, dx: 0, dz: 1, radius: move === 'alpha.ground-slam' ? 4 : 1 }, target: { id: 1, x: 0, z: 8 } });
    expect(fx.telegraphs.count).toBe(1);
    const slot = fx.snapshot().telegraphs[0].slot, geometry = fx.telegraphs.mesh.geometry;
    const style = geometry.getAttribute('fxStyle'), motion = geometry.getAttribute('fxMotion'), origin = geometry.getAttribute('fxOrigin');
    expect(style.getX(slot)).toBeCloseTo(length); expect(style.getY(slot)).toBe(shape);
    expect(style.getW(slot) * length).toBeCloseTo(width);
    expect(motion.getX(slot)).toBeCloseTo(Math.PI / 2); expect(motion.getY(slot)).toBeCloseTo(duration);
    expect(origin.getZ(slot)).toBeCloseTo(shape === 2 ? length / 2 : 0);
    const color = geometry.getAttribute('fxColor'); expect(color.getX(slot)).toBeGreaterThan(color.getY(slot) * 3);
    fx.set({ flashReduction: true }); expect(fx.telegraphs.pulse.value).toBe(0);
    expect(stateHash(world.getState())).toBe(hash);
    world.events.emit({ tick: 48, type: 'infected.special', sourceId, attackId: 24, move, stage: 'cancelled' });
    expect(fx.telegraphs.count).toBe(0);
  } finally { fx.dispose(); world.dispose(); }
});
