import { Color, InstancedMesh, Matrix4, MeshLambertNodeMaterial } from 'three/webgpu';
import { expect, test } from 'vitest';
import { packCrowdParts } from '../../../src/assets/crowd';
import { bakeInfected, framesPerClip, infectedClips } from '../../../src/render/characters/bakeInfected';
import { createInfectedPlaceholder } from '../../../src/render/characters/infectedPlaceholder';
import { StaticCorpses } from '../../../src/render/characters/StaticCorpses';
import { CrowdPosePalette } from '../../../src/render/characters/CrowdPosePalette';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { RoutineProps } from '../../../src/render/npc/RoutineProps';

test('dropped accessories grow beyond their initial instance capacity', () => {
  const props = new RoutineProps(); props.begin();
  for (let i = 0; i < 260; i++) props.dropped('coffee', { x: i, y: 0, z: 0, yaw: 0 });
  props.finish();
  expect(props.children.find(mesh => (mesh as InstancedMesh).count === 260)).toBeDefined(); props.dispose();
});

test('static corpse pages grow beyond the old population cap and survive camera movement', () => {
  const baked = bakeInfected(createInfectedPlaceholder('runner')); packCrowdParts(baked.geometry);
  const pool = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  const records = new Map<number, EntitySnapshot>();
  const frame = infectedClips.indexOf('death-back') * framesPerClip + framesPerClip - 1;
  for (let id = 1; id <= 260; id++) {
    const e = { id, corpse: true } as EntitySnapshot; records.set(id, e);
    pool.place(e, 'runner', baked.geometry, material, baked.clip, frame, new Matrix4().makeTranslation(id, 0, 0), new Color('white'), [0, 0, 0]);
  }
  expect(pool.snapshot()).toMatchObject({ instances: 260, draws: 3 });
  pool.begin(id => records.get(id)); expect(pool.snapshot().instances).toBe(260);
  expect(pool.children.every(mesh => (mesh as InstancedMesh).frustumCulled === false)).toBe(true);
  // Restore removes only bodies absent from the checkpoint; the next sync repopulates its saved bodies.
  records.delete(1); pool.begin(id => records.get(id)); expect(pool.snapshot().instances).toBe(0);
  pool.dispose(); baked.geometry.dispose(); material.dispose();
});

test('opposing crowd rotations keep full size during clip fades', () => {
  const first = new Matrix4(), second = new Matrix4().makeRotationY(Math.PI);
  const palette = new CrowdPosePalette({ parts: ['root'], frames: 2, duration: 1, matrices: [...first.elements, ...second.elements] }, 1, .2);
  palette.sample(1, 'idle', 0, 0); palette.sample(1, 'turn', 1, .1);
  const [outgoing, weight] = palette.sample(1, 'turn', 1, .2);
  const row = palette.correct(1, 1, outgoing, weight, () => {});
  const pose = new Matrix4().fromArray(palette.pose(row, outgoing, 1));
  expect(pose.determinant()).toBeCloseTo(1);
  palette.texture.dispose();
});
