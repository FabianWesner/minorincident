/** Compact the delivered zoo buffers without changing decoded geometry, rigs or KTX2 atlases.
 * Run after skin-crowd-build. The existing codec combines compatible meshopt streams. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assetIO } from './io';
import { consolidateMeshopt } from './compress';
import type { Document } from '@gltf-transform/core';

const root = 'public/assets/models/skinned';
const out = process.argv[2] ?? 'test-results/followups-25/zoo-delivery.json';
const io = await assetIO();
function content(doc: Document) {
  const root = doc.getRoot();
  return {
    meshes: root.listMeshes().map(mesh => ({ name: mesh.getName(), primitives: mesh.listPrimitives().map(p => ({
      mode: p.getMode(), attributes: p.listSemantics().map(semantic => ({ semantic, values: [...p.getAttribute(semantic)!.getArray()!] })),
      // The triangle codec may cyclically rotate a triangle; retain winding and surface identity.
      indices: p.getIndices() ? Array.from({ length: p.getIndices()!.getCount() / 3 }, (_, i) => {
        const ids = [0, 1, 2].map(k => p.getIndices()!.getScalar(i * 3 + k));
        const start = ids.indexOf(Math.min(...ids)); return [...ids.slice(start), ...ids.slice(0, start)];
      }) : null,
    })) })),
    textures: root.listTextures().map(t => ({ name: t.getName(), mime: t.getMimeType(), sha256: createHash('sha256').update(t.getImage()!).digest('hex') })),
    skins: root.listSkins().map(s => ({ joints: s.listJoints().map(j => j.getName()), bind: [...s.getInverseBindMatrices()!.getArray()!] })),
    nodes: root.listNodes().map(n => ({ name: n.getName(), t: n.getTranslation(), r: n.getRotation(), s: n.getScale(), extras: n.getExtras() })),
  };
}
const rows = [];
for (const name of readdirSync(root).filter(name => /^(amb|inf)\.(lion|gorilla|elephant|zebra|flamingo)\.lod[012](\.low)?\.glb$/.test(name)).sort()) {
  const file = join(root, name), before = readFileSync(file), after = await consolidateMeshopt(before, true);
  assert.deepEqual(content(await io.readBinary(after)), content(await io.readBinary(before)), `${name}: decoded content changed`);
  assert.ok(after.length <= before.length, `${name}: byte regression`);
  writeFileSync(file, after);
  rows.push({ name, before: before.length, after: after.length, saved: before.length - after.length });
}
mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
writeFileSync(out, JSON.stringify({ method: 'Lossless meshopt buffer consolidation and compact encoder; all decoded attributes, oriented triangles, nodes, bind matrices and KTX2 bytes asserted identical.', before: rows.reduce((s, r) => s + r.before, 0), after: rows.reduce((s, r) => s + r.after, 0), rows }, null, 2) + '\n');
console.log(`${rows.length} zoo delivery files: ${rows.reduce((s, r) => s + r.saved, 0)} bytes removed; decoded content identical`);
