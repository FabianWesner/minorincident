import { readFileSync, existsSync, statSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { getBounds } from '@gltf-transform/functions';
import type { Document, Node, Scene, Mesh } from '@gltf-transform/core';
import type { AssetDef } from '../../src/assets/types';
import { atLeast } from '../../src/assets/types';
import { validMaterial } from '../../src/assets/palette';
import { assetIO } from './io';
import { reviewErrors } from './review';
import { requiredLods, semanticNodeNames } from './delivery';

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
/** Runtime hides gore/collider helpers; they do not contribute to the default silhouette. */
function visibleBounds(scene: Scene): ReturnType<typeof getBounds> {
  const hidden: [Node,Mesh][]=[];
  scene.traverse(node=>{
    let ancestor: Node|null=node, invisible=false;
    while(ancestor) {if(ancestor.getExtras().hidden===true) invisible=true;ancestor=ancestor.getParentNode();}
    const mesh=node.getMesh();
    if(invisible && mesh) {hidden.push([node,mesh]);node.setMesh(null);}
  });
  try { return getBounds(scene); }
  finally { for(const [node,mesh] of hidden) node.setMesh(mesh); }
}

/** No renderer needed: validate actual geometry, hierarchy and export contracts. */
export function validateDocument(document: Document, def: AssetDef, bytes: number, lod = 0, source?: Document): Validation {
  const errors: string[] = [];
  const root = document.getRoot(), nodes = root.listNodes();
  const byName = new Map(nodes.map((n) => [n.getName(), n]));
  const bounds = root.listScenes()[0] ? visibleBounds(root.listScenes()[0]) : { min: [0, 0, 0], max: [0, 0, 0] };
  const dimensions = bounds.max.map((v, i) => v - bounds.min[i]);
  for (const [i, axis] of ['x', 'y', 'z'].entries()) {
    const expected = def.dimensions[axis as 'x' | 'y' | 'z'];
    if (!Number.isFinite(dimensions[i]) || Math.abs(dimensions[i] - expected) > expected * def.dimensions.tolerance) errors.push(`dimensions.${axis}: ${dimensions[i]} expected ${expected}`);
  }
  const required = new Set([...(source ? semanticNodeNames(source) : []), ...def.requiredNodes, ...def.animatedNodes, ...def.sockets]);
  for (const name of required) {
    const found = nodes.filter((n) => n.getName() === name);
    if (found.length !== 1) errors.push(`node ${name}: expected exactly one, found ${found.length}`);
  }
  if (source) for (const name of semanticNodeNames(source)) {
    const original = source.getRoot().listNodes().find(node => node.getName() === name)!, packed = byName.get(name);
    if (packed && descendants(original).some(node => node.getMesh()) && !descendants(packed).some(node => node.getMesh())) errors.push(`node ${name}: lost source geometry`);
    if (/socket/i.test(name) && packed && !descendants(original).some(node => node.getMesh()) && descendants(packed).some(node => node.getMesh())) errors.push(`socket ${name}: must be an empty`);
  }
  for (const name of def.animatedNodes) {
    const node = byName.get(name);
    const original = source?.getRoot().listNodes().find(node => node.getName() === name);
    // Amputees retain empty animation pivots; packing must preserve the source geometry contract.
    const originallyEmpty = original && !descendants(original).some(node => node.getMesh());
    if (node && !originallyEmpty && !descendants(node).some((n) => n.getMesh())) errors.push(`animated ${name}: no separate geometry`);
  }
  if (source) for (const animation of source.getRoot().listAnimations()) {
    const packed = root.listAnimations().find(candidate => candidate.getName() === animation.getName());
    for (const channel of animation.listChannels()) {
      const name = channel.getTargetNode()?.getName(), path = channel.getTargetPath();
      if (!packed?.listChannels().some(candidate => candidate.getTargetPath() === path && [name, path === 'weights' ? `${name}__geometry` : name].includes(candidate.getTargetNode()?.getName()))) errors.push(`animation ${animation.getName()}: missing ${name}.${path}`);
    }
  }
  if (source) for (const skin of source.getRoot().listSkins()) {
    const names = skin.listJoints().map(node => node.getName()).sort().join('|');
    if (!root.listSkins().some(candidate => candidate.listJoints().map(node => node.getName()).sort().join('|') === names)) errors.push(`skin ${skin.getName()}: missing joints`);
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
  const budget = lod > 0 && def.authoredLodTriangles ? def.authoredLodTriangles[lod === 1 ? 'lod1' : 'lod2'] : lod > 0 && def.authoredLodRatios ? Math.ceil(def.budget.triangles * def.authoredLodRatios[lod === 1 ? 'lod1' : 'lod2']) : lod === 1 && def.tier === 'hero' ? Math.min(def.budget.triangles, Math.ceil(def.budget.triangles * .15)) : lod === 2 ? Math.min(4000, def.budget.triangles) : def.budget.triangles;
  if (triangles > budget) errors.push(`triangles: ${triangles} > ${budget}`);
  if (materials > def.budget.materials) errors.push(`materials: ${materials} > ${def.budget.materials}`);
  if (fileKB > def.budget.fileKB) errors.push(`fileKB: ${fileKB} > ${def.budget.fileKB}`);
  if (def.sourceGlb && bytes > (def.tier === 'hero' ? 1_500_000 : 300_000)) errors.push('delivery: file size exceeds tier budget');
  if (def.sourceGlb) for (const texture of root.listTextures()) {
    if (!['image/ktx2', 'image/webp'].includes(texture.getMimeType())) errors.push('delivery: texture must be KTX2/WebP');
    const size = texture.getSize(), limit = def.tier === 'side' ? 512 : 1024;
    if (!size || size.some(value => value > limit)) errors.push(`delivery: texture exceeds ${limit}px`);
  }
  const staticCalls = nodes.filter((n) => !def.animatedNodes.some((name) => byName.get(name) && descendants(byName.get(name)!).includes(n))).reduce((sum, n) => sum + (n.getMesh()?.listPrimitives().length ?? 0), 0);
  if (staticCalls > def.budget.drawCalls) errors.push(`static drawCalls: ${staticCalls} > ${def.budget.drawCalls}`);
  if (def.category === 'infected') for (const name of new Set([
    ...['head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'legL', 'legR'].map(name => `stump_${name}`),
    ...def.requiredNodes.filter(name => name.includes('stump_')),
  ])) {
    const cap = byName.get(name);
    if (!cap || !descendants(cap).some((n) => n.getMesh())) errors.push(`${name}: missing geometry`);
    if (cap && cap.getExtras().hidden !== true) errors.push(`${name}: not hidden by default`);
  }
  return { id: def.id, errors: [...new Set(errors)], triangles, materials, drawCalls, fileKB, dimensions, hash: geometryHash(document) };
}
export async function validateAssets(manifest: AssetDef[], production = true): Promise<Validation[]> {
  const io = await assetIO(), results: Validation[] = [];
  for (const def of manifest) {
    const sourcePath = def.sourceGlb ?? (existsSync(`assets/${def.id}/model.glb`) ? `assets/${def.id}/model.glb` : undefined);
    if (!atLeast(def.status, 'modeled') && !(production && sourcePath)) continue;
    if (def.decalTexture) {
      const errors: string[] = [];
      let bytes = Buffer.alloc(0);
      try {
        bytes = readFileSync(def.decalTexture);
        const png = PNG.sync.read(bytes);
        if (png.width > 256 || png.height > 256) errors.push('decal: exceeds 256px');
        let transparent = false, painted = false;
        for (let i = 3; i < png.data.length; i += 4) { transparent ||= png.data[i] === 0; painted ||= png.data[i] > 0; }
        if (!transparent || !painted) errors.push('decal: expected painted and transparent pixels');
      } catch (error) { errors.push(`decal: ${String(error)}`); }
      results.push({ id: def.id, errors, triangles: 2, materials: 1, drawCalls: 1, fileKB: bytes.length / 1024, dimensions: [def.dimensions.x, def.dimensions.y, def.dimensions.z], hash: createHash('sha256').update(bytes).digest('hex') });
      continue;
    }
    // HUD icons and rendered portraits ship as images, with no model contract.
    if (def.category === 'ui' && def.icon && !def.glb) {
      if (!existsSync(def.icon)) results.push({ id: def.id, errors: [`missing image ${def.icon}`], triangles: 0, materials: 0, drawCalls: 0, fileKB: 0, dimensions: [], hash: '' });
      continue;
    }
    const source = sourcePath && existsSync(sourcePath) ? await io.read(sourcePath) : undefined;
    const paths = [def.glb, def.lods?.lod1, def.lods?.lod2];
    let base: Validation | undefined;
    for (const [lod, path] of paths.entries()) {
      if (!path) {
        if (lod === 0 || (base && requiredLods(def, base.triangles).includes(lod === 1 ? 'lod1' : 'lod2'))) results.push({ id: `${def.id}:lod${lod}`, errors: ['missing LOD'], triangles: 0, materials: 0, drawCalls: 0, fileKB: 0, dimensions: [], hash: '' });
        continue;
      }
      if (!existsSync(path)) { results.push({ id: def.id, errors: [`missing GLB ${path}`], triangles: 0, materials: 0, drawCalls: 0, fileKB: 0, dimensions: [], hash: '' }); continue; }
      try {
        const document = await io.read(path);
        const validation = { ...validateDocument(document, def, statSync(path).size, lod, source), id: `${def.id}:lod${lod}` };
        // Pending registration belongs to art-integration. Still enforce shipping and
        // node preservation for its real exports, without treating placeholder sizes as authored contracts.
        if (!def.sourceGlb && sourcePath && !atLeast(def.status, 'modeled')) {
          validation.errors = validation.errors.filter(error => !/^(dimensions\.|triangles:|materials:|fileKB:|static drawCalls:)/.test(error));
          const limit = def.tier === 'hero' ? 1_500_000 : 300_000;
          if (statSync(path).size > limit) validation.errors.push('delivery: file size exceeds tier budget');
        }
        if (lod === 0) base = validation;
        if (sourcePath) {
          const extensions = document.getRoot().listExtensionsUsed().map(extension => extension.extensionName);
          if (!extensions.includes('EXT_meshopt_compression') || !extensions.includes('KHR_mesh_quantization')) validation.errors.push('delivery: missing meshopt/quantization');
          if (base && lod > 0 && requiredLods(def, base.triangles).includes(lod === 1 ? 'lod1' : 'lod2')) {
            const ratio = validation.triangles / base.triangles;
            const authoredLimit = def.authoredLodRatios?.[lod === 1 ? 'lod1' : 'lod2'];
            if (!def.authoredLodTriangles && ratio > (authoredLimit === undefined ? (lod === 1 ? .155 : .045) : authoredLimit + .005)) validation.errors.push(`delivery: triangle ratio ${ratio} exceeds LOD${lod} budget`);
          }
        }
        if (lod > 0 && def.authoredLodTriangles) {
          const better = paths[lod - 1];
          if (better && existsSync(better) && statSync(path).size > statSync(better).size) validation.errors.push('delivery: file exceeds next-better LOD');
        }
        results.push(validation);
      }
      catch (error) { results.push({ id: def.id, errors: [String(error)], triangles: 0, materials: 0, drawCalls: 0, fileKB: 0, dimensions: [], hash: '' }); }
    }
    if (def.status === 'final') {
      const review = `assets/${def.id}/review.md`;
      const errors = existsSync(review) ? reviewErrors(readFileSync(review,'utf8')) : ['final review missing'];
      if (errors.length) results.push({ id: def.id, errors, triangles: 0, materials: 0, drawCalls: 0, fileKB: 0, dimensions: [], hash: '' });
    }
  }
  return results;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const definitions = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
  const idsIndex = process.argv.indexOf('--ids');
  const ids = idsIndex >= 0 ? new Set(process.argv[idsIndex + 1]?.split(',')) : undefined;
  if (ids && (!process.argv[idsIndex + 1] || [...ids].some(id => !definitions.some(def => def.id === id)))) throw new Error('Unknown or missing --ids selection');
  const results = await validateAssets(ids ? definitions.filter(def => ids.has(def.id)) : definitions);
  mkdirSync('test-results/epics/E17', { recursive: true });
  if (!ids) for (const directory of ['public/assets/models', 'public/assets/layouts']) for (const file of readdirSync(directory).filter(file => file.endsWith('.glb'))) {
    const path = `${directory}/${file}`, bytes = readFileSync(path);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()) as { extensionsRequired?: string[] };
    if (!['EXT_meshopt_compression', 'KHR_mesh_quantization'].every(extension => json.extensionsRequired?.includes(extension))) results.push({ id: path, errors: ['delivery: missing meshopt/quantization'], triangles: 0, materials: 0, drawCalls: 0, fileKB: bytes.length / 1024, dimensions: [], hash: '' });
  }
  writeFileSync(`test-results/epics/E17/validate${ids ? '-selected' : process.argv.includes('--production') ? '-production' : ''}.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.map(({ id, errors, triangles }) => ({ id, errors, triangles })), null, 2));
  if (results.some((r) => r.errors.length)) process.exitCode = 1;
}
