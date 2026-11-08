import { expect, test, vi } from 'vitest';
import { Box3, BufferGeometry, Float32BufferAttribute, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { CrowdPosePalette } from '../../src/render/characters/CrowdPosePalette';
import { HealthBars } from '../../src/render/HealthBars';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { PickBodies, pickBodies } from '../../src/render/characters/PickBodies';

test('fractional unblended crowd poses keep finite body bounds for follower bars and picking', () => {
  const matrices = new Float32Array(32);
  new Matrix4().toArray(matrices, 0);
  new Matrix4().makeTranslation(4, 2, 0).toArray(matrices, 16);
  const palette = new CrowdPosePalette({ parts: ['root'], frames: 2, duration: 1, matrices, binds: new Float32Array(new Matrix4().elements) }, 1);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setAttribute('_parts', new Float32BufferAttribute(new Float32Array(12), 4));
  geometry.setAttribute('_skin', new Float32BufferAttribute(new Float32Array(12), 4));
  const bodies = new PickBodies();
  try {
    for (const frame of [0, .3, .7, 1]) {
      bodies.begin(); bodies.add(16, new Matrix4(), palette, frame, frame, 1, geometry);
      const box = bodies.bounds(16, new Box3());
      expect(box).not.toBeNull();
      expect(box!.min.toArray()).toEqual([expect.closeTo(4 * frame, 5), expect.closeTo(2 * frame, 5), 0]);
      expect(box!.max.toArray()).toEqual([expect.closeTo(4 * frame + 1, 5), expect.closeTo(2 * frame + 1, 5), 0]);
      expect(bodies.top(16, new Matrix4())).toBeCloseTo(2 * frame + 1, 5);
      const pose = palette.pose(frame, frame, 1);
      expect([...pose].every(Number.isFinite)).toBe(true);
      expect(pose[12]).toBeCloseTo(4 * frame, 5);
      expect(pose[13]).toBeCloseTo(2 * frame, 5);
    }
  } finally { geometry.dispose(); palette.texture.dispose(); }
});

test('a compact follower bar crossing the courier moves above her instead of disappearing', () => {
  const followers = Array.from({ length: 6 }, (_, i) => ({ id: 16 + i, faction: 'civilian', health: { current: 60, max: 60 }, transform: { x: 500, y: .7, z: 500 }, civilian: { state: 'calm', survivor: { mode: 'follow' } } }));
  const player = { id: 1, transform: { x: 500, y: .7, z: 500 } };
  const all = [player, ...followers];
  const world = { scenario: 'L6', entities: { iterate: () => all.values(), get: (id: number) => all.find(e => e.id === id) }, physics: { world: null } } as unknown as SimWorld;
  const camera = new PerspectiveCamera(25, 1280 / 720, .1, 600);
  camera.position.set(500, 4, 510); camera.lookAt(500, .8, 500); camera.updateMatrixWorld();
  const body = new Box3(new Vector3(499.7, 0, 499.7), new Vector3(500.3, 1, 500.3));
  const hero = new Box3(new Vector3(499.3, 0, 499.3), new Vector3(500.7, 2, 500.7));
  const bounds = vi.spyOn(pickBodies, 'bounds').mockImplementation((id, out) => id === 16 ? out.copy(body) : null);
  const top = vi.spyOn(pickBodies, 'top').mockImplementation(id => id === 16 ? new Vector3(500, 1, 500).project(camera).y : null);
  vi.stubGlobal('location', { search: '?test=1' });
  const bars = new HealthBars(world, out => { out.copy(hero); return true; });
  try {
    bars.update(camera, 1280, 720);
    expect(bars.count).toBe(1);
    const bar = bars.snapshot().bars[0];
    expect(bar).toMatchObject({ id: 16, width: 18, height: 3 });
    const heroTop = Math.min(...[hero.min.x, hero.max.x].flatMap(x => [hero.min.y, hero.max.y].flatMap(y => [hero.min.z, hero.max.z].map(z => (1 - new Vector3(x, y, z).project(camera).y) * 360))));
    expect(bar.y + bar.height / 2).toBeLessThan(heroTop);
  } finally { bars.dispose(); bounds.mockRestore(); top.mockRestore(); vi.unstubAllGlobals(); }
});
