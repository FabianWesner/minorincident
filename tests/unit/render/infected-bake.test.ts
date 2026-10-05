import { expect, test } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { bakeInfected, framesPerClip, infectedClips } from '../../../src/render/characters/bakeInfected';
import { createInfectedPlaceholder } from '../../../src/render/characters/infectedPlaceholder';

test('T-E07-bake @E07 @E07-AC12 merged infected geometry excludes hidden ancestor stumps and preserves rigid part poses', () => {
  const model = createInfectedPlaceholder('runner');
  const hidden = new Group(); hidden.visible = false;
  hidden.add(new Mesh(new BoxGeometry(100, 100, 100), new MeshBasicMaterial({ color: 'white' }))); model.add(hidden);
  const baked = bakeInfected(model);
  baked.geometry.computeBoundingBox();
  expect(baked.geometry.boundingBox!.getSize(new Vector3()).length()).toBeLessThan(5);
  expect(baked.clip.frames).toBe(framesPerClip * infectedClips.length);
  expect(baked.clip.matrices.length).toBe(baked.clip.parts.length * baked.clip.frames * 16);
  expect(baked.clip.matrices.every(Number.isFinite)).toBe(true);
  const part = baked.geometry.getAttribute('_part_index'), emissive = baked.geometry.getAttribute('_emissive');
  expect(part.count).toBe(baked.geometry.getAttribute('position').count);
  expect(Array.from(emissive.array).some((value) => value === 1)).toBe(true);
  expect(baked.geometry.groups).toHaveLength(0);
  baked.geometry.dispose();
  model.traverse((node) => { if (node instanceof Mesh) { node.geometry.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose(); } });
});
