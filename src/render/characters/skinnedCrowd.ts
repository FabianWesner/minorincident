/** Instanced welded bodies on the production crowd skeleton.
 * CPU pose rows remain joint-world matrices for contacts, sockets and picking.
 * A final atlas row holds inverse binds; the shader blends joint(frame) × inverseBind.
 * _parts.x stores the dominant joint; _skin packs the other three joints and weights.
 */
import { BufferAttribute, DataTexture, Matrix4, type BufferGeometry } from 'three';
import { float, Fn, If, attribute, int, ivec2, mat4, textureLoad } from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { crowdBlendedMatrix, poseTexture, type CrowdClip } from '../../assets/crowd';

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

/** One part's inverse bind from the atlas bind row (4 texels). */
export function crowdBind(texture: DataTexture | TextureNode, part: Node<'float'>, bindRow: number) {
  const atlas = texture instanceof DataTexture ? poseTexture(texture) : texture, start = int(part).mul(4), row = int(bindRow);
  return mat4(textureLoad(atlas, ivec2(start, row)), textureLoad(atlas, ivec2(start.add(1), row)), textureLoad(atlas, ivec2(start.add(2), row)), textureLoad(atlas, ivec2(start.add(3), row)));
}
/** One influence: joint(frame) · bind⁻¹. */
export function crowdSkinJoint(texture: DataTexture | TextureNode, part: Node<'float'>, frame: Node<'float'>, outgoing: Node<'float'>, weight: Node<'float'>, bindRow: number) {
  return crowdBlendedMatrix(texture, part, frame, outgoing, weight).mul(crowdBind(texture, part, bindRow));
}
/** GPU skin matrix: sum of w_i * joint_i(frame) * bind_i^-1. Influences with zero weight are skipped, so a vertex deep
 * inside one part costs one rigid fetch plus its bind. */
export function skinnedCrowdMatrix(texture: DataTexture | TextureNode, dominant: Node<'float'>, frame: Node<'float'>, outgoing: Node<'float'>, weight: Node<'float'>, bindRow: number) {
  return Fn(() => {
    const skin = attribute('_skin', 'vec4'), packed = skin.x;
    const w1 = skin.y, w2 = skin.z, w3 = skin.w.fract(), w0 = float(1).sub(w1).sub(w2).sub(w3);
    const matrix = crowdSkinJoint(texture, dominant, frame, outgoing, weight, bindRow).mul(w0).toVar();
    If(w1.greaterThan(0), () => {
      matrix.assign(matrix.add(crowdSkinJoint(texture, packed.mod(32), frame, outgoing, weight, bindRow).mul(w1)));
      If(w2.greaterThan(0), () => {
        matrix.assign(matrix.add(crowdSkinJoint(texture, packed.div(32).floor().mod(32), frame, outgoing, weight, bindRow).mul(w2)));
        If(w3.greaterThan(0), () => { matrix.assign(matrix.add(crowdSkinJoint(texture, packed.div(1024).floor(), frame, outgoing, weight, bindRow).mul(w3))); });
      });
    });
    return matrix;
  })();
}

/** CPU counterpart for frozen corpse pages: the blended, premultiplied matrix of vertex `i` at atlas frame offset. */
export function skinnedVertexMatrix(clip: CrowdClip, frameOffset: number, parts: BufferAttribute | import('three').InterleavedBufferAttribute, skin: BufferAttribute | import('three').InterleavedBufferAttribute, i: number, out: Float32Array): Float32Array {
  const binds = clip.binds!, matrices = clip.matrices, packed = skin.getX(i);
  const joints = [parts.getX(i), packed % 32, Math.floor(packed / 32) % 32, Math.floor(packed / 1024)];
  const w = [0, skin.getY(i), skin.getZ(i), skin.getW(i) % 1]; w[0] = 1 - w[1] - w[2] - w[3];
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
