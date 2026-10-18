import { expect, test } from 'vitest';
import { InstancedMesh, type Color, type Scene, type WebGPURenderer } from 'three/webgpu';
import { Blasts } from '../../../src/render/vfx/Blasts';
import { FxPool } from '../../../src/render/vfx/FxPool';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { LightField } from '../../../src/render/LightField';

test('T-E27-14w @E27 @E18 blast fragment materials execute unoccluded during loading and reset before play', () => {
  const world = new SimWorld(), particles = new FxPool(2048, 'particle');
  const blasts = new Blasts(world, { particles, shake() {} });
  try {
    const parts = blasts.children.find(child => child instanceof InstancedMesh && Array.isArray(child.material)) as InstancedMesh;
    expect(parts.userData.preRenderSolo).toBe(true);
    expect(parts.material).toHaveLength(3);
    expect(parts.count).toBe(0);
    blasts.prewarm(4, 8);
    expect(parts.count).toBeGreaterThan(0);
    expect(blasts.blasts).toBe(0);
    blasts.reset();
    expect(parts.count).toBe(0);
    expect(blasts.snapshot()).toMatchObject({ puffs: 0, fireballs: 0, flames: 0, glows: 0, scorch: 0, parts: 0 });
  } finally { blasts.dispose(); particles.dispose(); world.dispose(); }
});

test('T-E27-06v @E27 @E27-AC06 mega lights the town orange for five seconds and slow motion can be disabled', () => {
  const world = new SimWorld(), particles = new FxPool(6000, 'particle'), field = new LightField();
  const lights: { hex: string; intensity: number; radius: number; ttl: number }[] = [];
  const blasts = new Blasts(world, { particles, shake() {}, light(x, z, hex, intensity, radius, ttl, flicker) {
    lights.push({ hex, intensity, radius, ttl }); return field.addTransient({ x, z }, hex, intensity, radius, ttl, flicker);
  } });
  try {
    blasts.play({ type: 'explosion', tick: 0, defId: 'explosion.gas-tanks', cls: 'mega', fx: 'blast.mega', sourceId: 0, position: { x: 0, y: 0, z: 0 }, radius: 18 });
    expect(lights).toContainEqual({ hex: '#ff7a30', intensity: 4, radius: 90, ttl: 5 });
    // The field's public update applies TTL on the same render clock as the blast.
    // Daylight practical weight is zero, but the mega must still render its pool.
    expect(field.strength.value).toBe(0);
    field.update(0, 0, 4.99); expect(field.snapshot()).toMatchObject({ transients: 1, drawn: 1 });
    expect(field.active).toBe(true);
    field.update(0, 0, 5); expect(field.snapshot().transients).toBe(0);
    expect(field.active).toBe(false);
    const event = { type: 'explosion.slowmo' as const, tick: 0, defId: 'explosion.gas-tanks', scale: .5, seconds: .6 };
    blasts.slowmo(event); expect(blasts.timeScale(.1)).toBe(.5);
    blasts.set({ slowMotion: false }); blasts.slowmo(event);
    expect(blasts.timeScale(0)).toBe(1);
    expect(blasts.timeScale(1)).toBe(1); expect(blasts.snapshot().bulletTime.remaining).toBe(0);
  } finally { blasts.dispose(); particles.dispose(); field.dispose(); world.dispose(); }
});

test('T-E27-06d @E27 @E27-AC06 daylight transients clear the field after expiry without enabling practical lamps', () => {
  const field = new LightField(), draws: number[] = [];
  const renderer = {
    getRenderTarget: () => null, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    getRenderObjectFunction: () => null, getPixelRatio: () => 1, getMRT: () => null,
    getClearColor: (color: Color) => color, getClearAlpha: () => 0, getScissorTest: () => false,
    setClearColor() {}, setRenderTarget() {}, setRenderObjectFunction() {}, setPixelRatio() {}, setMRT() {}, setScissorTest() {},
    render(scene: Scene) { draws.push((scene.children[0] as InstancedMesh).count); },
  } as unknown as WebGPURenderer;
  try {
    field.setStatic([{ x: 0, z: 0, y: 4, r: 1, g: 1, b: 1, radius: 4, aimX: 0, aimZ: 0, stretch: 1, flicker: 0, strobe: false, seed: 0, on: true, hero: true }]);
    field.addTransient({ x: 0, z: 0 }, '#ff7a30', 4, 90, 5);
    field.update(0, 0, 1); field.render(renderer);
    expect(draws).toEqual([1]); expect(field.heroAt(0, 0)).toBeNull();
    field.update(0, 0, 5); field.render(renderer);
    expect(draws).toEqual([1, 0]);
    field.update(0, 0, 6); field.render(renderer);
    expect(draws).toEqual([1, 0]);
  } finally { field.dispose(); }
});

test('T-E27-15f @E27 @E27-AC15 persistent fire emits pooled embers without an explosion on both tiers', () => {
  for (const quality of ['high', 'low'] as const) {
    const world = new SimWorld(), particles = new FxPool(quality === 'high' ? 2048 : 512, 'particle');
    const blasts = new Blasts(world, { particles, shake() {} });
    world.entities.create({ kind: 'hazard', archetype: 'hazard.fire', faction: 'neutral', health: { current: 1, max: 1 }, transform: { x: 0, y: .7, z: 0, yaw: 0 }, hazard: { kind: 'fire', radius: 1.3, activeUntil: 60, fuseAt: 0, exploded: false, leaked: false } });
    try {
      blasts.set({ quality }); blasts.advance(.5, .5); particles.advance(.5);
      expect(blasts.blasts).toBe(0); expect(particles.count).toBeGreaterThan(0);
      expect(blasts.snapshot().fireColumns).toBe(1);
      world.tick = 60; blasts.advance(1, .5); particles.advance(3);
      expect(blasts.snapshot().fireColumns).toBe(0); expect(particles.count).toBe(0);
    } finally { blasts.dispose(); particles.dispose(); world.dispose(); }
  }
});

test('T-E27-03p @E27 @E27-AC03 a fixed-tick jump retains distributed smoke births and upward motion', () => {
  const world = new SimWorld(), particles = new FxPool(2048, 'particle');
  const blasts = new Blasts(world, { particles, shake() {} });
  try {
    blasts.play({ type: 'explosion', tick: 0, defId: 'explosion.propane', cls: 'medium', fx: 'blast.medium', sourceId: 0, position: { x: 0, y: 0, z: 0 }, radius: 6 });
    blasts.advance(3, 3);
    const mesh = blasts.children.find(child => child instanceof InstancedMesh && child.geometry.hasAttribute('pOrigin')) as InstancedMesh;
    const origins = mesh.geometry.getAttribute('pOrigin'), motions = mesh.geometry.getAttribute('pMotion');
    const births = Array.from({ length: origins.count }, (_, i) => motions.getW(i) > 0 ? origins.getW(i) : -1).filter(born => born >= 0);
    expect(new Set(births).size).toBeGreaterThan(3);
    expect(Math.min(...births)).toBe(0);
    expect(Math.max(...births)).toBeCloseTo(3);
    expect(births.filter(born => born < 2).length).toBeGreaterThan(3);
  } finally { blasts.dispose(); particles.dispose(); world.dispose(); }
});
