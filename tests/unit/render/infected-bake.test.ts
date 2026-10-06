import { expect, test } from 'vitest';
import { BoxGeometry, BufferAttribute, BufferGeometry, Group, InterleavedBufferAttribute, Mesh, MeshBasicMaterial, Vector3 } from 'three';
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
  expect(Array.from({ length: emissive.count }, (_, i) => emissive.getX(i)).some((value) => value === 1)).toBe(true);
  const attributes = ['position', 'normal', 'color', '_shirt', '_emissive', '_part_index'].map((name) => baked.geometry.getAttribute(name));
  expect(attributes.every((attribute) => attribute instanceof InterleavedBufferAttribute)).toBe(true);
  expect(new Set(attributes.map((attribute) => (attribute as InterleavedBufferAttribute).data)).size).toBe(1);
  expect(baked.geometry.groups).toHaveLength(0);
  baked.geometry.dispose();
  model.traverse((node) => { if (node instanceof Mesh) { node.geometry.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose(); } });
});

test('T-E07-bake-quantized @E07 @E07-AC12 quantized GLB vertices retain part-local offsets when baked', () => {
  const root = new Group(); root.name = 'root';
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Uint16Array([0, 0, 0, 65535, 0, 0, 0, 65535, 0]), 3, true));
  geometry.setAttribute('normal', new BufferAttribute(new Int16Array([0, 0, 32767, 0, 0, 32767, 0, 0, 32767]), 3, true));
  const material = new MeshBasicMaterial({ color: 'red' }), mesh = new Mesh(geometry, material);
  mesh.position.set(0.2, 0.3, 0.4); root.add(mesh);
  const baked = bakeInfected(root), position = baked.geometry.getAttribute('position');
  expect(position.getX(1)).toBeCloseTo(1.2); expect(position.getY(2)).toBeCloseTo(1.3); expect(position.getZ(0)).toBeCloseTo(0.4);
  expect(baked.geometry.getAttribute('normal').getZ(0)).toBeCloseTo(1);
  baked.geometry.dispose(); geometry.dispose(); material.dispose();
});
