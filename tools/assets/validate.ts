import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { getBounds } from '@gltf-transform/functions';
import type { Document, Node } from '@gltf-transform/core';
import type { AssetDef } from '../../src/assets/types';
import { atLeast } from '../../src/assets/types';
import { validMaterial } from '../../src/assets/palette';
import { assetIO } from './io';

export interface Validation { id: string; errors: string[]; triangles: number; materials: number; drawCalls: number; fileKB: number; dimensions: number[]; hash: string }
export function geometryHash(document: Document): string {
  const hash = createHash('sha256');
  for (const node of document.getRoot().listNodes().sort((a,b) => a.getName().localeCompare(b.getName()))) {
    hash.update(JSON.stringify([node.getName(), node.getMatrix()]));
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      // Exporters may renumber split vertices while keeping identical triangles.
      // Hash geometry and winding, independent of vertex ordering and normals.
      const pos = primitive.getAttribute('POSITION');
      if (!pos) continue;
      const indices = primitive.getIndices(), count = indices?.getCount() ?? pos.getCount();
      const triangles: string[] = [], point = [0,0,0];
      for (let i = 0; i < count; i += 3) {
        const corners = [0,1,2].map((j) => { pos.getElement(indices?.getScalar(i+j) ?? i+j,point); return JSON.stringify(point); });
        triangles.push([0,1,2].map((j) => [corners[j],corners[(j+1)%3],corners[(j+2)%3]].join('|')).sort()[0]);
      }
      hash.update(JSON.stringify(triangles.sort()));
    }
  }
  return hash.digest('hex');
}
function descendants(node: Node): Node[] {
  return [node, ...node.listChildren().flatMap(descendants)];
}
/** No renderer needed: validate actual geometry, hierarchy and export contracts. */
export function validateDocument(document: Document, def: AssetDef, bytes: number, lod = 0): Validation {
  const errors: string[] = [];
  const root = document.getRoot(), nodes = root.listNodes();
  const byName = new Map(nodes.map((n) => [n.getName(), n]));
  const bounds = root.listScenes()[0] ? getBounds(root.listScenes()[0]) : { min: [0, 0, 0], max: [0, 0, 0] };
  const dimensions = bounds.max.map((v, i) => v - bounds.min[i]);
  for (const [i, axis] of ['x', 'y', 'z'].entries()) {
    const expected = def.dimensions[axis as 'x' | 'y' | 'z'];
    if (!Number.isFinite(dimensions[i]) || Math.abs(dimensions[i] - expected) > expected * def.dimensions.tolerance) errors.push(`dimensions.${axis}: ${dimensions[i]} expected ${expected}`);
  }
  const required = new Set([...def.requiredNodes, ...def.animatedNodes, ...def.sockets]);
  for (const name of required) {
    const found = nodes.filter((n) => n.getName() === name);
    if (found.length !== 1) errors.push(`node ${name}: expected exactly one, found ${found.length}`);
  }
  for (const name of def.animatedNodes) {
    const node = byName.get(name);
    if (node && !descendants(node).some((n) => n.getMesh())) errors.push(`animated ${name}: no separate geometry`);
  }
  for (const name of def.sockets) if (byName.get(name)?.getMesh()) errors.push(`socket ${name}: must be an empty`);
  if (def.forward !== '+X') errors.push('forward must be +X');
  if (!def.frontNodes.length) errors.push('forward: no front marker');
  for (const name of def.frontNodes) {
    const node = byName.get(name);
    if (!node || node.getWorldTranslation()[0] <= (bounds.min[0] + bounds.max[0]) / 2) errors.push(`forward ${name}: not on +X`);
  }
  let triangles = 0, drawCalls = 0;
  for (const node of nodes) {
    if (node.getExtras().collider && node.getMesh()) errors.push(`collider ${node.getName()}: must be an empty`);
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      drawCalls++;
      const position = primitive.getAttribute('POSITION');
      const indices = primitive.getIndices();
      if (!position || primitive.getMode() !== 4) { errors.push('geometry: expected triangle positions'); continue; }
      const count = indices?.getCount() ?? position.getCount();
      if (count % 3) errors.push('geometry: incomplete triangle');
      triangles += count / 3;
      for (const semantic of primitive.listSemantics()) {
        const array = primitive.getAttribute(semantic)?.getArray();
        if (array && Array.from(array).some((v) => !Number.isFinite(v))) errors.push(`geometry: non-finite ${semantic}`);
      }
      const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
      let degenerate = false;
      for (let i = 0; i < count; i += 3) {
        const ids = [0, 1, 2].map((j) => indices ? indices.getScalar(i + j) : i + j);
        if (ids.some((id) => id < 0 || id >= position.getCount())) { errors.push('geometry: index out of range'); break; }
        position.getElement(ids[0], a); position.getElement(ids[1], b); position.getElement(ids[2], c);
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-12) degenerate = true;
      }
      if (degenerate) errors.push(`geometry ${node.getName()}: degenerate triangle`);
    }
  }
  for (const material of root.listMaterials()) if (!validMaterial(material.getName())) errors.push(`material: unknown ${material.getName()}`);
  const materials = root.listMaterials().length, fileKB = bytes / 1024;
  const budget = lod === 1 ? Math.min(def.budget.triangles, Math.ceil(def.budget.triangles * .15)) : lod === 2 ? Math.min(4000, def.budget.triangles) : def.budget.triangles;
  if (triangles > budget) errors.push(`triangles: ${triangles} > ${budget}`);
  if (materials > def.budget.materials) errors.push(`materials: ${materials} > ${def.budget.materials}`);
  if (fileKB > def.budget.fileKB) errors.push(`fileKB: ${fileKB} > ${def.budget.fileKB}`);
  const staticCalls = nodes.filter((n) => !def.animatedNodes.some((name) => byName.get(name) && descendants(byName.get(name)!).includes(n))).reduce((sum, n) => sum + (n.getMesh()?.listPrimitives().length ?? 0), 0);
  if (staticCalls > def.budget.drawCalls) errors.push(`static drawCalls: ${staticCalls} > ${def.budget.drawCalls}`);
  if (def.category === 'infected') for (const name of ['head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'legL', 'legR']) {
    const cap = byName.get(`stump_${name}`);
    if (!cap || !descendants(cap).some((n) => n.getMesh())) errors.push(`stump_${name}: missing geometry`);
    if (cap && cap.getExtras().hidden !== true) errors.push(`stump_${name}: not hidden by default`);
  }
  return { id: def.id, errors: [...new Set(errors)], triangles, materials, drawCalls, fileKB, dimensions, hash: geometryHash(document) };
}
export async function validateAssets(manifest: AssetDef[], production = false): Promise<Validation[]> {
  const io = await assetIO(), results: Validation[] = [];
  for (const def of manifest) {
    if (!atLeast(def.status, 'modeled') && !(production && def.sourceGlb)) continue;
    const paths = [production && def.sourceGlb ? def.sourceGlb : def.glb, def.lods?.lod1, def.lods?.lod2];
    for (const [lod, path] of paths.entries()) {
      if (!path) {
        if (def.tier === 'hero') results.push({ id: `${def.id}:lod${lod}`, errors: ['missing LOD'], triangles: 0, materials: 0, drawCalls: 0, fileKB: 0, dimensions: [], hash: '' });
        continue;
      }
      if (!existsSync(path)) { results.push({ id: def.id, errors: [`missing GLB ${path}`], triangles: 0, materials: 0, drawCalls: 0, fileKB: 0, dimensions: [], hash: '' }); continue; }
      try { results.push({ ...validateDocument(await io.read(path), def, statSync(path).size, lod), id: `${def.id}:lod${lod}` }); }
      catch (error) { results.push({ id: def.id, errors: [String(error)], triangles: 0, materials: 0, drawCalls: 0, fileKB: 0, dimensions: [], hash: '' }); }
    }
    if (def.status === 'final') {
      const review = `assets/${def.id}/review.md`;
      if (!existsSync(review) || !/Verdict:\s*PASS/i.test(readFileSync(review, 'utf8')) || !/comparison.*\.png/i.test(readFileSync(review, 'utf8'))) results.push({ id: def.id, errors: ['final review missing pass/comparison'], triangles: 0, materials: 0, drawCalls: 0, fileKB: 0, dimensions: [], hash: '' });
    }
  }
  return results;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = await validateAssets(JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')), process.argv.includes('--production'));
  mkdirSync('test-results/epics/E17', { recursive: true });
  writeFileSync(`test-results/epics/E17/validate${process.argv.includes('--production') ? '-production' : ''}.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.map(({ id, errors, triangles }) => ({ id, errors, triangles })), null, 2));
  if (results.some((r) => r.errors.length)) process.exitCode = 1;
}
