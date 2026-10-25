/**
 * skinned-crowd prototype (dev flag `?skinCrowd=1`, internal only): crowd figures as ONE welded skinned body
 * on the crowd skeleton, drawn by the same instanced pose-atlas shader.
 *
 * - The pose atlas keeps one matrix per joint and frame (CPU rows unchanged: footwork IK, picking, accessories,
 *   corpse freezing all keep reading joint world matrices). The GPU copy is premultiplied by each joint's
 *   inverse bind, so a vertex in bind space needs only Σ wᵢ·Aᵢ (the same 2-row fetch per influence as a rigid part).
 * - Vertex layout: `_parts.x` = dominant joint (every CPU consumer keeps a valid part id), `_skin` =
 *   (j1 + 32·j2 + 1024·j3, w1, w2, w3), w0 = 1 − w1 − w2 − w3. One extra location, no extra buffer.
 * - `?skinCrowd=rigid` loads the same welded bodies but bakes every vertex to its dominant joint
 *   (A/B of the 4-influence vertex cost against one influence on identical geometry).
 */
import { BufferAttribute, Matrix4, type BufferGeometry, type DataTexture } from 'three';
import { float, Fn, If, attribute } from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import type { AssetDef } from '../../assets/types';
import { crowdBlendedMatrix, type CrowdClip } from '../../assets/crowd';

export type SkinnedCrowdMode = 'off' | 'skin' | 'rigid';
export function skinnedCrowdMode(): SkinnedCrowdMode {
  if (typeof location === 'undefined') return 'off';
  const value = new URLSearchParams(location.search).get('skinCrowd');
  return value === '1' ? 'skin' : value === 'rigid' ? 'rigid' : 'off';
}

/** Prototype assets (tools/assets/skin-crowd-figure.ts). `.low.glb` carries the 512 atlas. */
const skinnedAssets: Record<string, { dimensions: AssetDef['dimensions'] }> = {
  'inf.common-worker': { dimensions: { x: .95, y: 1.8, z: 1.35, tolerance: .15 } },
  'npc.civilian-woman-a': { dimensions: { x: .68, y: 1.8, z: 1.05, tolerance: .15 } },
};
export const skinnedCrowdAssets = Object.keys(skinnedAssets);
export function skinnedCrowdManifest(manifest: AssetDef[]): AssetDef[] {
  return manifest.map(def => {
    const skinned = skinnedAssets[def.id];
    if (!skinned) return def;
    const file = (lod: string) => `public/assets/models/skinned/${def.id}.${lod}.glb`;
    return { ...def, glb: file('lod0'), lods: { lod1: file('lod1'), lod2: file('lod2') }, textureMode: 'baseColor' as const, corpseGlb: undefined, lowGlb: undefined, dimensions: skinned.dimensions };
  });
}

/** Inverse rest (bind) matrices of every clip part, in the bake's world frame. */
export function restInverses(parts: { matrixWorld: Matrix4 }[]): Float32Array {
  const out = new Float32Array(parts.length * 16), m = new Matrix4();
  parts.forEach((part, i) => m.copy(part.matrixWorld).invert().toArray(out, i * 16));
  return out;
}

/** Pack four influences: `_part_index` keeps the dominant joint, `_skin` the other three. */
export function packSkin(indices: ArrayLike<number>, weights: ArrayLike<number>, count: number, rigid: boolean): { dominant: Float32Array; skin: Float32Array } {
  const dominant = new Float32Array(count), skin = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const order = [0, 1, 2, 3].sort((a, b) => weights[i * 4 + b] - weights[i * 4 + a]);
    const j = order.map(k => indices[i * 4 + k]), w = order.map(k => weights[i * 4 + k]);
    const sum = w[0] + w[1] + w[2] + w[3] || 1;
    dominant[i] = j[0];
    if (rigid) continue;
    skin[i * 4] = (w[1] > 0 ? j[1] : 0) + 32 * (w[2] > 0 ? j[2] : 0) + 1024 * (w[3] > 0 ? j[3] : 0);
    skin[i * 4 + 1] = w[1] / sum; skin[i * 4 + 2] = w[2] / sum; skin[i * 4 + 3] = w[3] / sum;
  }
  return { dominant, skin };
}

/** GPU skin matrix: Σ wᵢ·Aᵢ(frame) with Aᵢ = joint(frame)·bind⁻¹ (premultiplied atlas). Influences with zero
 * weight are skipped, so a vertex deep inside one part costs what a rigid vertex costs. */
export function skinnedCrowdMatrix(texture: DataTexture | TextureNode, dominant: Node<'float'>, frame: Node<'float'>, outgoing: Node<'float'>, weight: Node<'float'>) {
  return Fn(() => {
    const skin = attribute('_skin', 'vec4'), packed = skin.x;
    const w1 = skin.y, w2 = skin.z, w3 = skin.w, w0 = float(1).sub(w1).sub(w2).sub(w3);
    const matrix = crowdBlendedMatrix(texture, dominant, frame, outgoing, weight).mul(w0).toVar();
    If(w1.greaterThan(0), () => {
      matrix.assign(matrix.add(crowdBlendedMatrix(texture, packed.mod(32), frame, outgoing, weight).mul(w1)));
      If(w2.greaterThan(0), () => {
        matrix.assign(matrix.add(crowdBlendedMatrix(texture, packed.div(32).floor().mod(32), frame, outgoing, weight).mul(w2)));
        If(w3.greaterThan(0), () => { matrix.assign(matrix.add(crowdBlendedMatrix(texture, packed.div(1024).floor(), frame, outgoing, weight).mul(w3))); });
      });
    });
    return matrix;
  })();
}

/** CPU counterpart for frozen corpse pages: the blended, premultiplied matrix of vertex `i` at atlas frame offset. */
export function skinnedVertexMatrix(clip: CrowdClip, frameOffset: number, parts: BufferAttribute | import('three').InterleavedBufferAttribute, skin: BufferAttribute | import('three').InterleavedBufferAttribute, i: number, out: Float32Array): Float32Array {
  const binds = clip.binds!, matrices = clip.matrices, packed = skin.getX(i);
  const joints = [parts.getX(i), packed % 32, Math.floor(packed / 32) % 32, Math.floor(packed / 1024)];
  const w = [0, skin.getY(i), skin.getZ(i), skin.getW(i)]; w[0] = 1 - w[1] - w[2] - w[3];
  out.fill(0);
  for (let k = 0; k < 4; k++) {
    if (w[k] <= 0) continue;
    const m = frameOffset + joints[k] * 16, b = joints[k] * 16;
    // out += w · (M · B)  (column-major)
    for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let x = 0; x < 4; x++) sum += matrices[m + x * 4 + row] * binds[b + col * 4 + x];
      out[col * 4 + row] += w[k] * sum;
    }
  }
  return out;
}

/** Premultiply one atlas row (all parts) into the GPU copy. */
export function premultiplyRow(rows: Float32Array, gpu: Float32Array, binds: Float32Array, rowOffset: number, parts: number): void {
  for (let p = 0; p < parts; p++) {
    const m = rowOffset + p * 16, b = p * 16;
    for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let x = 0; x < 4; x++) sum += rows[m + x * 4 + row] * binds[b + col * 4 + x];
      gpu[m + col * 4 + row] = sum;
    }
  }
}

export function isSkinnedCrowd(geometry: BufferGeometry): boolean { return geometry.hasAttribute('_skin'); }
