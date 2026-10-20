import { expect, test } from 'vitest';
import { Box3, BufferGeometry, Float32BufferAttribute, Matrix4 } from 'three';
import { barEligible, barSize, followerBarCap, followerBarsAlwaysMax, isFollower } from '../../src/render/HealthBars';
import { PickBodies } from '../../src/render/characters/PickBodies';
import { CrowdPosePalette } from '../../src/render/characters/CrowdPosePalette';
import { healthBarColors, healthFraction } from '../../src/ui/health';
import { infectedDefinitions } from '../../src/data/infected';
import type { EntitySnapshot } from '../../src/sim/world/types';

const entity = () => ({ faction: 'infected', transform: { x: 15, z: 0 }, health: { current: 300, max: 300 }, infected: { state: 'idle', recoverAt: -1 } }) as EntitySnapshot;
test('T-E07-06-bars @E07-AC06 @E07-AC19 visibility boundary, damage, conversion and recovery are truthful', () => {
  const e = entity();
  expect(barEligible(e, { x: 0, z: 0 }, true)).toBe(true);
  e.transform.x = 15.001; expect(barEligible(e, { x: 0, z: 0 }, true)).toBe(false);
  e.health.current = 299; expect(barEligible(e, { x: 0, z: 0 }, true)).toBe(true);
  expect(barEligible(e, { x: 0, z: 0 }, false)).toBe(false);
  e.faction = 'neutral';
  for (const species of ['lion', 'gorilla', 'elephant', 'zebra', 'flamingo']) {
    e.archetype = `infected.${species}`; // Even a flagged zoo archetype stays hidden until infection.
    expect(barEligible(e, { x: 0, z: 0 }, true)).toBe(false);
  }
  e.faction = 'infected'; e.health.current = 0; e.infected!.state = 'dead'; e.infected!.recoverAt = 900;
  expect(barEligible(e, { x: 0, z: 0 }, true)).toBe(true); expect(healthFraction(0, 300)).toBe(0);
  e.infected!.recoverAt = -1; expect(barEligible(e, { x: 0, z: 0 }, true)).toBe(false);
  e.infected!.state = 'idle'; e.hidden = true; expect(barEligible(e, { x: 0, z: 0 }, true)).toBe(false);
  e.hidden = false; e.infected!.hidden = true; expect(barEligible(e, { x: 0, z: 0 }, true)).toBe(false);
});
test('T-E07-19-bars @E07-AC19 @E30-AC15 fill clamps, phone sizes and palette contrast', () => {
  expect(healthFraction(100, 300)).toBeCloseTo(1 / 3, 12);
  expect(healthFraction(-1, 300)).toBe(0); expect(healthFraction(400, 300)).toBe(1); expect(healthFraction(1, 0)).toBe(0);
  expect(barSize(390, 844)).toEqual({ width: 48, height: 6 }); expect(barSize(844, 390)).toEqual({ width: 48, height: 6 });
  expect(barSize(1600, 900)).toEqual({ width: 64, height: 8 });
  const luminance = (hex: string) => hex.slice(1).match(/../g)!.map(s => parseInt(s, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  const colors = Object.values(healthBarColors).map(luminance);
  for (let a = 0; a < colors.length; a++) for (let b = a + 1; b < colors.length; b++) expect((Math.max(colors[a], colors[b]) + .05) / (Math.min(colors[a], colors[b]) + .05)).toBeGreaterThanOrEqual(3);
  for (const species of ['lion', 'gorilla', 'elephant', 'zebra', 'flamingo']) expect(infectedDefinitions.find(d => d.id === `infected.${species}`)?.bar).toBe(true);
  expect(infectedDefinitions.find(d => d.id === 'infected.runner')?.bar).toBeUndefined();
});
test('T-E07-06-bars-bounds @E07-AC06 bounds follow displayed poses, interpolation and same-id conversion, without stale invisible figures', () => {
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute([-1, 0, 0, 1, 2, 1], 3)); geometry.setAttribute('_part_index', new Float32BufferAttribute([0, 0], 1));
  const matrices = new Matrix4().toArray().concat(new Matrix4().makeTranslation(0, -1, 0).toArray());
  const palette = new CrowdPosePalette({ parts: ['head'], frames: 2, duration: 1, matrices }, 2);
  const bodies = new PickBodies(), box = new Box3(); bodies.begin();
  bodies.add(7, new Matrix4().makeTranslation(4, 0, 3), palette, .5, 0, 1, geometry);
  expect(bodies.bounds(7, box)?.max.toArray()).toEqual([5, 1.5, 4]);
  bodies.add(7, new Matrix4().makeTranslation(8, 0, 3), palette, 1, 0, 1, geometry);
  expect(bodies.bounds(7, box)?.max.toArray()).toEqual([9, 1, 4]);
  expect(bodies.bounds(7, box, new Matrix4().makeScale(.5, .5, .5))?.max.toArray()).toEqual([4.5, .5, 2]);
  bodies.begin(); expect(bodies.bounds(7, box)).toBeNull();
  geometry.dispose(); palette.texture.dispose();
});

test('T-E07-06-bars-followers @E23-AC09 QA #37: healthy followers keep a bar only in a small group', () => {
  const follower = (current: number) => ({ faction: 'civilian', transform: { x: 30, z: 0 }, health: { current, max: 100 }, civilian: { survivor: { mode: 'follow' } } }) as unknown as EntitySnapshot;
  expect(followerBarsAlwaysMax).toBe(5); expect(followerBarCap).toBeGreaterThanOrEqual(3);
  expect(barEligible(follower(100), { x: 0, z: 0 }, false)).toBe(true); // PO #26: L5's five survivors
  expect(barEligible(follower(100), { x: 0, z: 0 }, false, false)).toBe(false); // L6/L7 crowd: healthy = no bar
  expect(barEligible(follower(99), { x: 0, z: 0 }, false, false)).toBe(true);
  expect(barEligible(follower(0), { x: 0, z: 0 }, false, true)).toBe(false);
  expect(isFollower(follower(50))).toBe(true);
});

test('T-E32-09-bars @E32 @E32-AC09 regular Alpha bars remain smaller than Mega bars on desktop and phone', () => {
  for (const [width, height] of [[1600, 900], [390, 844], [844, 390]]) {
    const regular = barSize(width, height), mega = barSize(width, height, true);
    expect(mega.width).toBe(regular.width * 1.5); expect(mega.height).toBeGreaterThan(regular.height);
  }
});
