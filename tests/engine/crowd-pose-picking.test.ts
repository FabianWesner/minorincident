import { expect, test } from 'vitest';
import { Box3, BufferGeometry, Float32BufferAttribute, Matrix4 } from 'three';
import { CrowdPosePalette } from '../../src/render/characters/CrowdPosePalette';
import { PickBodies } from '../../src/render/characters/PickBodies';

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
