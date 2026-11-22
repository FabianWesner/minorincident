/** Rebuild zebra LOD2 from the coherent LOD1 surface while retaining the LOD2 budget. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { MeshoptSimplifier } from 'meshoptimizer';
import { Triangle, Vector3 } from 'three';
import { assetIO } from './io';
import { consolidateMeshopt } from './compress';
import { compressSkin } from './skin-crowd-compress';
import { join } from 'node:path';

function typedLike(template: ArrayBufferView, values: number[]) {
  if (template instanceof Uint8Array) return Uint8Array.from(values);
  if (template instanceof Uint16Array) return Uint16Array.from(values);
  if (template instanceof Uint32Array) return Uint32Array.from(values);
  if (template instanceof Int8Array) return Int8Array.from(values);
  if (template instanceof Int16Array) return Int16Array.from(values);
  return Float32Array.from(values);
}

const io = await assetIO();
await MeshoptSimplifier.ready;
const rows: unknown[] = [];
for (const id of ['amb.zebra', 'inf.zebra']) for (const tier of ['', '.low']) {
  const source = await io.read(`public/assets/models/skinned/${id}.lod1${tier}.glb`);
  const targetPath = `public/assets/models/skinned/${id}.lod2${tier}.glb`, target = await io.read(targetPath);
  const sourceBody = source.getRoot().listNodes().find(node => node.getName() === 'skin_body')!.getMesh()!.listPrimitives()[0];
  const targetBody = target.getRoot().listNodes().find(node => node.getName() === 'skin_body')!.getMesh()!.listPrimitives()[0];
  const positions = sourceBody.getAttribute('POSITION')!, indices = sourceBody.getIndices()!;
  const [reduced, error] = MeshoptSimplifier.simplify(new Uint32Array(indices.getArray()!), new Float32Array(positions.getArray()!), 3, 611 * 3, .2, ['Permissive']);
  if (reduced.length > 611 * 3) throw Error(`${id}${tier}: body simplifier exceeded its 611-triangle allocation`);
  const used = [...new Set(reduced)].sort((a, b) => a - b), remap = new Map(used.map((index, i) => [index, i]));
  for (const semantic of sourceBody.listSemantics()) {
    const attribute = sourceBody.getAttribute(semantic)!, values: number[] = [];
    for (const index of used) values.push(...attribute.getElement(index, []));
    const array = attribute.getNormalized() ? Float32Array.from(values) : typedLike(attribute.getArray()!, values);
    targetBody.setAttribute(semantic, target.createAccessor().setType(attribute.getType()).setNormalized(false).setArray(array));
  }
  targetBody.setIndices(target.createAccessor().setType('SCALAR').setArray(new Uint32Array(Array.from(reduced, index => remap.get(index)!))));
  const tail = target.getRoot().listSkins()[0].listJoints().findIndex(joint => joint.getName() === 'tail');
  const bodyPositions = targetBody.getAttribute('POSITION')!, bodyParts = targetBody.getAttribute('_CROWD_PART')!;
  const bodyNormals = targetBody.getAttribute('NORMAL')!, bodyIndices = targetBody.getIndices()!;
  const bodyJoints = targetBody.getAttribute('JOINTS_0')!, bodyWeights = targetBody.getAttribute('WEIGHTS_0')!;
  const moved: { vertex: number; distance: number }[] = [], triangle = new Triangle(), nearest = new Vector3(), bary = new Vector3();
  for (let vertex = 0; vertex < bodyPositions.getCount(); vertex++) {
    if (bodyParts.getScalar(vertex) !== tail) continue;
    const point = new Vector3().fromArray(bodyPositions.getElement(vertex, []));
    if (point.x < -1.3) continue;
    const hit = new Vector3(), hitNormal = new Vector3(), hitBary = new Vector3(); let best = Infinity, hitIds: number[] | undefined;
    for (let t = 0; t < bodyIndices.getCount(); t += 3) {
      const ids = [0, 1, 2].map(k => bodyIndices.getScalar(t + k));
      if (ids.some(index => bodyParts.getScalar(index) === tail)) continue;
      const vertices = ids.map(index => new Vector3().fromArray(bodyPositions.getElement(index, [])));
      triangle.set(vertices[0], vertices[1], vertices[2]); triangle.closestPointToPoint(point, nearest);
      const distance = point.distanceToSquared(nearest);
      if (distance >= best || !triangle.getBarycoord(nearest, bary)) continue;
      best = distance; hit.copy(nearest); hitBary.copy(bary); hitIds = ids; hitNormal.set(0, 0, 0);
      for (let corner = 0; corner < 3; corner++) hitNormal.addScaledVector(new Vector3().fromArray(bodyNormals.getElement(ids[corner], [])), bary.getComponent(corner));
      hitNormal.normalize();
    }
    if (best > .3 ** 2) continue;
    const factor = Math.max(0, Math.min(1, (point.x + 1.3) / .12)), blend = factor * factor * (3 - 2 * factor);
    if (!blend) continue;
    const corrected = point.lerp(hit, blend);
    bodyPositions.setElement(vertex, corrected.toArray());
    bodyNormals.setElement(vertex, hitNormal.toArray());
    if (!hitIds) throw Error(`${id}${tier}: tail root has no matching body surface weights`);
    const mixed = new Map<number, number>();
    const oldJoints = bodyJoints.getElement(vertex, []), oldWeights = bodyWeights.getElement(vertex, []);
    for (let k = 0; k < 4; k++) if (oldWeights[k] > 0) mixed.set(oldJoints[k], (mixed.get(oldJoints[k]) ?? 0) + oldWeights[k] * (1 - blend));
    for (let corner = 0; corner < 3; corner++) {
      const joints = bodyJoints.getElement(hitIds[corner], []), weights = bodyWeights.getElement(hitIds[corner], []), amount = hitBary.getComponent(corner) * blend;
      for (let k = 0; k < 4; k++) if (weights[k] > 0) mixed.set(joints[k], (mixed.get(joints[k]) ?? 0) + weights[k] * amount);
    }
    const sorted = [...mixed].sort((a, b) => b[1] - a[1]).slice(0, 4), total = sorted.reduce((sum, [, weight]) => sum + weight, 0);
    bodyJoints.setElement(vertex, [0, 1, 2, 3].map(i => sorted[i]?.[0] ?? tail));
    bodyWeights.setElement(vertex, [0, 1, 2, 3].map(i => (sorted[i]?.[1] ?? 0) / total));
    bodyParts.setElement(vertex, [sorted[0][0]]);
    moved.push({ vertex, distance: Math.sqrt(best) });
  }
  if (!moved.length) throw Error(`${id}${tier}: detached tail root was not repaired`);
  const sourceTexture = sourceBody.getMaterial()!.getBaseColorTexture()!, targetTexture = targetBody.getMaterial()!.getBaseColorTexture()!;
  targetTexture.setImage(new Uint8Array(sourceTexture.getImage()!)).setMimeType(sourceTexture.getMimeType());
  const triangles = target.getRoot().listNodes().filter(node => node.getMesh()).flatMap(node => node.getMesh()!.listPrimitives()).reduce((sum, primitive) => sum + (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION')!.getCount()) / 3, 0);
  assert.ok(triangles <= 647, `${id}${tier}: LOD2 triangle ceiling exceeded (${triangles})`);
  await io.write(targetPath, target);
  const pipeline = process.env.CROWD_PIPELINE ?? '/Users/wesner/Workspace/minorincident_3dpipeline';
  process.env.CROWD_JOINT_BITS = '8'; process.env.CROWD_WEIGHT_BITS = '8'; process.env.CROWD_Q ??= '128';
  await compressSkin(targetPath, targetPath, join(pipeline, 'vendor/basis-encoder-2.1'), 512, undefined, undefined, false, 1 / 8192);
  const compact = await consolidateMeshopt(readFileSync(targetPath), true);
  writeFileSync(targetPath, compact);
  assert.ok(compact.length <= 107576, `${id}${tier}: LOD2 byte ceiling exceeded (${compact.length})`);
  rows.push({ id, tier: tier || 'high', bytes: compact.length, triangles, bodyTriangles: reduced.length / 3, simplifierError: error, tailRootVerticesMoved: moved.length, tailRootMaxGapBefore: Math.max(...moved.map(vertex => vertex.distance)) });
}
writeFileSync('test-results/s224-zebra-lod2-repair.json', JSON.stringify(rows, null, 2) + '\n');
console.log(JSON.stringify(rows, null, 2));
