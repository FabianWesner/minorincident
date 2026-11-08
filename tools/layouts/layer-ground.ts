/** Derive shared depth priorities before streaming splits. No geometry or physics changes. */
import { NodeIO } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { groundTriangles } from './audit-ground';
import { maxBakedGroundLayer } from '../../src/render/GroundLayers';
import { groundGroup, groundPriorities } from './ground-layers';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export async function layerGround(path: string): Promise<number> {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
  const doc = await io.read(path);
  for (const material of doc.getRoot().listMaterials()) material.setExtras({...material.getExtras(),groundLayer:0});
  const triangles = groundTriangles(doc), ranks = groundPriorities(triangles);
  const maxLayer = Math.max(0,...ranks.values());
  if (maxLayer > maxBakedGroundLayer) throw Error(`${path}: ground priority ${maxLayer} exceeds reserved baked range`);
  if (!maxLayer) return 0;
  const faces = new Map(triangles.map(t => [t.id,t]));
  const materials = new Map<string, import('@gltf-transform/core').Material>();
  for (const [nodeIndex,node] of doc.getRoot().listNodes().entries()) for (const [primitiveIndex,primitive] of [...node.getMesh()?.listPrimitives() ?? []].entries()) {
    const position = primitive.getAttribute('POSITION')!, original = primitive.getMaterial()!;
    const indices = primitive.getIndices()?.getArray() ?? Array.from({length:position.getCount()},(_,i)=>i);
    const layers = new Map<number,number[]>();
    for (let i=0;i<indices.length;i+=3) {
      const face = faces.get(`${nodeIndex}:${primitiveIndex}:${i/3}`);
      const rank = face ? ranks.get(groundGroup(face))! : 0;
      const row = layers.get(rank) ?? []; row.push(indices[i],indices[i+1],indices[i+2]); layers.set(rank,row);
    }
    if (![...layers.keys()].some(Boolean)) continue;
    for (const [rank, values] of layers) {
      const key = `${original.getName()}:${rank}`;
      let material = materials.get(key);
      if (!material) { material = original.clone().setExtras({...original.getExtras(),groundLayer:rank}); materials.set(key,material); }
      const copy = primitive.clone().setMaterial(material).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(values)).setBuffer(position.getBuffer()!));
      node.getMesh()!.addPrimitive(copy);
    }
    node.getMesh()!.removePrimitive(primitive); primitive.dispose();
  }
  // Re-encoding an already compressed document requires disposing the old codec declarations.
  for (const extension of doc.getRoot().listExtensionsUsed()) if (extension.extensionName === 'EXT_meshopt_compression') extension.dispose();
  await doc.transform(prune());
  await io.write(path,doc);
  return Math.max(0,...ranks.values());
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) for(const path of process.argv.slice(2)) console.log(path,await layerGround(path));
