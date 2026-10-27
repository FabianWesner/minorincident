import { expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry, Color, InstancedBufferAttribute, InstancedInterleavedBuffer, InterleavedBufferAttribute, Matrix4 } from 'three';
import { MeshLambertNodeMaterial, type InstancedMesh } from 'three/webgpu';
import { createInfectedPlaceholder } from '../../../src/render/characters/infectedPlaceholder';
import { bakeInfected, framesPerClip, infectedClips } from '../../../src/render/characters/bakeInfected';
import { packCrowdParts } from '../../../src/assets/crowd';
import { StaticCorpses } from '../../../src/render/characters/StaticCorpses';
import { crowdVertexLayout } from '../../../src/render/characters/CrowdAppearance';
import type { EntitySnapshot } from '../../../src/sim/world/types';

// Q-201 headroom targets; the compiled-program gate is tests/e2e/crowd-gpu-limits.spec.ts.
const CROWD = { attributes: 14, buffers: 7 };

test('@E18-AC01 layout estimate: a pass binds the explicit matrix columns or the implicit instanceMatrix, never both', () => {
  const geometry = new BufferGeometry();
  for (const [name, size] of [['position', 3], ['normal', 3], ['color', 3], ['_parts', 4], ['_dogCream', 3]] as const) geometry.setAttribute(name, new BufferAttribute(new Float32Array(size * 3), size));
  const instance = new InstancedInterleavedBuffer(new Float32Array(8), 8, 1);
  geometry.setAttribute('_state', new InterleavedBufferAttribute(instance, 4, 0)); geometry.setAttribute('_variant', new InterleavedBufferAttribute(instance, 4, 4));
  const columns = new InstancedInterleavedBuffer(new Float32Array(16), 16, 1);
  for (let c = 0; c < 4; c++) geometry.setAttribute(`_crowd${c}`, new InterleavedBufferAttribute(columns, 4, c * 4));
  // Summing both reported 15 here (and 17 for the real LOD1 dog palette batch, inf.dog) although no compiled program binds more than 13.
  const layout = crowdVertexLayout(geometry, new InstancedBufferAttribute(new Float32Array(16), 16));
  expect(layout).toEqual({ buffers: 7, locations: 11, webgpu: true, webgl2: true });
  expect(layout.locations).toBeLessThanOrEqual(CROWD.attributes);
});

test('@E18-AC01 an untextured frozen corpse page keeps its surface in one buffer (<= 7 WebGPU buffers with placement)', () => {
  const baked = bakeInfected(createInfectedPlaceholder('runner'), [], false);
  packCrowdParts(baked.geometry);
  expect(baked.geometry.hasAttribute('uv')).toBe(false);
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  const frame = infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1;
  pool.prepare('plain', baked.geometry, material, baked.clip, frame);
  for (const id of [1, 2]) pool.place({ id } as EntitySnapshot, 'plain', baked.geometry, material, baked.clip, frame, new Matrix4(), new Color(1, 1, 1), [0, 0, 0]);
  const page = pool.children[0] as InstancedMesh, layout = crowdVertexLayout(page.geometry, page.instanceMatrix);
  const surface = ['position', 'normal', 'color', '_parts'].map(name => page.geometry.getAttribute(name) as InterleavedBufferAttribute);
  expect(surface.every(a => a.isInterleavedBufferAttribute && a.data === surface[0].data)).toBe(true);
  // Placement colour binds one more buffer and location.
  expect(layout.buffers + 1).toBeLessThanOrEqual(CROWD.buffers);
  expect(layout.locations + 1).toBeLessThanOrEqual(CROWD.attributes);
  pool.dispose(); baked.geometry.dispose(); material.dispose();
});
