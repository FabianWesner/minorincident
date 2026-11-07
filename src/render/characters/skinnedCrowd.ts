/** Instanced welded bodies on the production crowd skeleton.
 * CPU pose rows remain joint-world matrices for contacts, sockets and picking.
 * A final atlas row holds inverse binds; the shader blends joint(frame) × inverseBind.
 * _parts.x stores the dominant joint; _skin packs the other three joints and weights.
 */
import { BufferAttribute, DataTexture, Matrix4 } from 'three';
import { float, Fn, If, attribute, int, ivec2, mat4, normalFlat, textureLoad } from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { crowdBlendedMatrix, poseTexture, type CrowdClip } from '../../assets/crowd';

/** Inverse rest (bind) matrices of every clip part, in the bake's world frame. */
export function restInverses(parts: { matrixWorld: Matrix4 }[]): Float32Array {
  const out = new Float32Array(parts.length * 16), m = new Matrix4();
  parts.forEach((part, i) => m.copy(part.matrixWorld).invert().toArray(out, i * 16));
  return out;
}

/** Pack four influences: `_part_index` keeps the dominant joint, `_skin` the other three. */
export function packSkin(indices: ArrayLike<number>, weights: ArrayLike<number>, count: number, owners?: ArrayLike<number>): { dominant: Float32Array; skin: Float32Array } {
  const dominant = new Float32Array(count), skin = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const order = [0, 1, 2, 3].sort((a, b) => weights[i * 4 + b] - weights[i * 4 + a]);
    if (owners) {
      const at = order.findIndex(k => indices[i * 4 + k] === owners[i] && weights[i * 4 + k] > 0);
      if (at < 0) throw Error('Crowd semantic owner must be a weighted joint');
      order.unshift(order.splice(at, 1)[0]);
    }
    const j = order.map(k => indices[i * 4 + k]), w = order.map(k => weights[i * 4 + k]);
    const sum = w[0] + w[1] + w[2] + w[3] || 1;
    dominant[i] = j[0];
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

/** CPU blended, premultiplied matrix of vertex `i` at atlas frame offset.
 * `onlyRow` computes one coordinate for bounds and leaves the other rows zero. */
export function skinnedVertexMatrix(clip: CrowdClip, frameOffset: number, parts: BufferAttribute | import('three').InterleavedBufferAttribute, skin: BufferAttribute | import('three').InterleavedBufferAttribute, i: number, out: Float32Array, pose?: Float32Array, onlyRow?: 0 | 1 | 2 | 3): Float32Array {
  const binds = clip.binds!, matrices = clip.matrices;
  const w1 = skin.getY(i), w2 = skin.getZ(i), w3 = skin.getW(i) % 1, w0 = 1 - w1 - w2 - w3;
  // Rigid vertices already have their complete joint matrix in the pose row.
  // Keep the original +0 arithmetic (including signed zero) without blending it again.
  if (pose && w1 === 0 && w2 === 0 && w3 === 0) {
    const base = parts.getX(i) * 16;
    if (onlyRow === undefined) for (let j = 0; j < 16; j++) out[j] = (pose[base + j] ?? 0) + 0;
    else {
      out.fill(0);
      for (let col = 0; col < 4; col++) out[col * 4 + onlyRow] = (pose[base + col * 4 + onlyRow] ?? 0) + 0;
    }
    return out;
  }
  const packed = skin.getX(i);
  out.fill(0);
  // Bounds searches need only one coordinate. Keep its joint accumulation and
  // Float32 rounding identical to the full matrix; other rows remain zero.
  const firstRow = onlyRow ?? 0, lastRow = onlyRow === undefined ? 4 : onlyRow + 1;
  for (let k = 0; k < 4; k++) {
    const weight = k === 0 ? w0 : k === 1 ? w1 : k === 2 ? w2 : w3;
    if (weight <= 0) continue;
    // Avoid allocating joint/weight arrays for every sampled vertex.
    const joint = k === 0 ? parts.getX(i) : k === 1 ? packed % 32 : k === 2 ? Math.floor(packed / 32) % 32 : Math.floor(packed / 1024);
    const m = frameOffset + joint * 16, b = joint * 16;
    // out += w · (M · B)  (column-major)
    for (let col = 0; col < 4; col++) for (let row = firstRow; row < lastRow; row++) {
      let sum = pose?.[b + col * 4 + row] ?? 0;
      if (!pose) for (let x = 0; x < 4; x++) sum += matrices[m + x * 4 + row] * binds[b + col * 4 + x];
      out[col * 4 + row] += weight * sum;
    }
  }
  return out;
}

/** Premultiply one atlas row (all parts) into the GPU copy. */
export function premultiplyRow(rows: ArrayLike<number>, gpu: Float32Array, binds: ArrayLike<number>, rowOffset: number, parts: number, outputOffset = rowOffset): void {
  for (let p = 0; p < parts; p++) {
    const m = rowOffset + p * 16, b = p * 16;
    for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let x = 0; x < 4; x++) sum += rows[m + x * 4 + row] * binds[b + col * 4 + x];
      gpu[outputOffset + p * 16 + col * 4 + row] = sum;
    }
  }
}


/** A wound is a new spatial surface: use its posed face normal. Blended rim
 * normals can oppose across a folded cap and normalize to NaN on WebGL2. */
export function skinnedWoundNormal(body: Node<'vec3'>) {
  return attribute('_parts', 'vec4').w.greaterThanEqual(1024).select(normalFlat, body);
}
