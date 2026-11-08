/** Add missing equipment anchors from the existing emissive geometry, with no geometry re-export. */
import { existsSync, writeFileSync } from 'node:fs';
import { Matrix4, Vector3, Box3 } from 'three';
import { assetIO } from './io';
import { readGltfJson } from './lights';
import { writeMetadata, type MetadataProof } from './e25-emitter-repair';
import equipment from './equipment-lights.json';

const io = await assetIO(), proof: (MetadataProof & { emitterBounds: number[][]; position: number[] })[] = [];
for (const { id, ...settings } of equipment) for (const suffix of ['', '.lod1', '.lod2']) for (const path of [`assets/${id}/model${suffix}.glb`, `public/assets/models/${id}${suffix}.glb`]) {
  const json = readGltfJson(path), before = structuredClone(json), name = 'light:equipment';
  if (json.nodes!.some(n => n.name === name)) continue;
  const document = await io.read(path), box = new Box3(), point = new Vector3();
  for (const n of document.getRoot().listNodes()) for (const p of n.getMesh()?.listPrimitives() ?? []) {
    if (!p.getMaterial()?.getName().startsWith('emi_')) continue;
    const positions = p.getAttribute('POSITION')!, matrix = new Matrix4().fromArray(n.getWorldMatrix()), value: number[] = [];
    const indices = p.getIndices();
    for (let i = 0; i < (indices?.getCount() ?? positions.getCount()); i++) box.expandByPoint(point.fromArray(positions.getElement(indices?.getScalar(i) ?? i, value)).applyMatrix4(matrix));
  }
  if (box.isEmpty()) throw Error(`${path}: no emissive geometry`);
  const targets: string[] = [];
  for (const [index, n] of json.nodes!.entries()) if (n.mesh !== undefined && json.meshes![n.mesh].primitives.some(p => p.material !== undefined && json.materials![p.material].name?.startsWith('emi_'))) {
    n.name ??= `emitter:equipment:${index}`; targets.push(n.name);
  }
  const position = box.getCenter(new Vector3()).toArray().map(v => Math.round(v * 1e6) / 1e6);
  json.scenes![json.scene ?? 0].nodes.push(json.nodes!.length);
  json.nodes!.push({ name, translation: position, extras: { ss_light: { type: 'point', ...settings, beam: 'none', flare: false, shadow: 'none', heroPriority: 0, flicker: 'none', powerGroup: 'self', breakable: false, emissiveNodes: targets, tiers: 'all' } } });
  const result = writeMetadata(path, json, before); if (result) proof.push({ ...result, emitterBounds: [box.min.toArray(), box.max.toArray()], position });
}
const out = 'docs/reports/e25-emitters/evidence/equipment-anchors.json';
if (proof.length || !existsSync(out)) writeFileSync(out, JSON.stringify(proof, null, 2) + '\n');
console.log({ files: proof.length, anchors: proof.reduce((s, p) => s + (p.addedAnchors?.length ?? 0), 0), out });
