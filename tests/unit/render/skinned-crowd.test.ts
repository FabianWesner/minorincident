import { describe, expect, it } from 'vitest';
import { BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three';
import { packSkin, premultiplyRow, restInverses, skinnedVertexMatrix } from '../../../src/render/characters/skinnedCrowd';
import manifest from '../../../src/assets/manifest.json';

const pose = (x: number, angle: number) => new Matrix4().compose(new Vector3(x, 1, 0), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angle), new Vector3(1, 1, 1));

describe('skinned-crowd prototype', () => {
  it('packs the dominant joint into _part_index and three more influences into _skin', () => {
    const { dominant, skin } = packSkin([3, 7, 12, 0], [.2, .5, .3, 0], 1, false);
    expect(dominant[0]).toBe(7);
    expect(skin[0] % 32).toBe(12); expect(Math.floor(skin[0] / 32) % 32).toBe(3); expect(Math.floor(skin[0] / 1024)).toBe(0);
    expect(1 - skin[1] - skin[2] - skin[3]).toBeCloseTo(.5);
    expect([...packSkin([3, 7, 12, 0], [.2, .5, .3, 0], 1, true).skin]).toEqual([0, 0, 0, 0]);
  });
  it('premultiplies atlas rows by the inverse rest matrices (joint · bind⁻¹)', () => {
    const rest = [pose(0, 0), pose(.5, .3)], frame = [pose(.1, .2), pose(.7, -.4)];
    const binds = restInverses(rest.map(m => ({ matrixWorld: m })));
    const rows = new Float32Array(32); frame.forEach((m, i) => m.toArray(rows, i * 16));
    const gpu = new Float32Array(32); premultiplyRow(rows, gpu, binds, 0, 2);
    const expected = new Matrix4().multiplyMatrices(frame[1], rest[1].clone().invert());
    expect([...gpu.subarray(16, 32)].map(v => +v.toFixed(5))).toEqual(expected.toArray().map(v => +v.toFixed(5)));
    // A rest vertex weighted to one joint lands where the rigid path puts its part-local twin.
    const local = new Vector3(.1, .2, .3), world = local.clone().applyMatrix4(rest[1]);
    expect(world.applyMatrix4(new Matrix4().fromArray(gpu, 16)).distanceTo(local.applyMatrix4(frame[1]))).toBeLessThan(1e-5);
  });
  it('freezes a corpse vertex with the same blend as the shader', () => {
    const rest = [pose(0, 0), pose(.5, .3)], frame = [pose(.1, .2), pose(.7, -.4)];
    const binds = restInverses(rest.map(m => ({ matrixWorld: m })));
    const matrices = new Float32Array(32); frame.forEach((m, i) => m.toArray(matrices, i * 16));
    const clip = { parts: ['a', 'b'], frames: 1, duration: 1, matrices, binds };
    const parts = new BufferAttribute(new Float32Array([0, 0, 0, 0]), 4), skin = new BufferAttribute(new Float32Array([1, .25, 0, 0]), 4);
    const out = skinnedVertexMatrix(clip, 0, parts, skin, 0, new Float32Array(16));
    const a = new Matrix4().multiplyMatrices(frame[0], rest[0].clone().invert()), b = new Matrix4().multiplyMatrices(frame[1], rest[1].clone().invert());
    const blended = a.toArray().map((v, i) => v * .75 + b.elements[i] * .25);
    expect([...out].map(v => +v.toFixed(5))).toEqual(blended.map(v => +v.toFixed(5)));
  });
  it('converted archetypes select the production skin directly while unconverted figures retain their rigid models', () => {
    const worker = manifest.find(def => def.id === 'inf.common-worker')!;
    const woman = manifest.find(def => def.id === 'npc.civilian-woman-a')!;
    const jogger = manifest.find(def => def.id === 'inf.jogger')!;
    expect(worker.glb).toBe('public/assets/models/skinned/inf.common-worker.lod0.glb');
    expect(woman.glb).toBe('public/assets/models/skinned/npc.civilian-woman-a.lod0.glb');
    expect(jogger.glb).not.toContain('/skinned/');
  });
});
