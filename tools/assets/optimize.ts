// Adapted from Bruno Simon's scripts/compress.js (MIT): raw export → compression.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Document } from '@gltf-transform/core';
import { dedup, prune, weld, join, meshopt, simplify, normals } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import type { AssetDef } from '../../src/assets/types';
import { assetIO } from './io';

/** Named transforms are gameplay pivots; quantization acts on geometry children. */
export async function optimizeDocument(document: Document, def: AssetDef, ratio = 1): Promise<void> {
  await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  const protectedNames = new Set([...def.requiredNodes, ...def.animatedNodes, ...def.sockets]);
  const pivots = new Map<string, number[]>();
  for (const node of document.getRoot().listNodes()) {
    if (!protectedNames.has(node.getName()) && !/^(stump_|light:|col:)/.test(node.getName())) continue;
    pivots.set(node.getName(), node.getWorldTranslation());
    const mesh = node.getMesh();
    if (mesh) { node.setMesh(null); node.addChild(document.createNode(`${node.getName()}_geometry`).setMesh(mesh)); }
  }
  await document.transform(dedup(), prune({ keepLeaves: true, keepAttributes: true, keepExtras: true }), weld(), join({ keepNamed: true, cleanup: false }));
  if (ratio < 1) {
    // Split hard normals prevent decimation; regenerate normals on the lower tier.
    for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) primitive.setAttribute('NORMAL', null);
    await document.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: ratio < .05 ? .1 : .02 }), normals());
  }
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16, quantizeNormal: 10, cleanup: false }));
  // Quantization can collapse microscopic triangles; omit these zero-area faces.
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    const pos = primitive.getAttribute('POSITION')!, indices = primitive.getIndices();
    const count = indices?.getCount() ?? pos.getCount();
    const kept: number[] = [], a = [0,0,0], b = [0,0,0], c = [0,0,0];
    for (let i = 0; i < count; i += 3) {
      const x = indices?.getScalar(i) ?? i, y = indices?.getScalar(i + 1) ?? i + 1, z = indices?.getScalar(i + 2) ?? i + 2;
      pos.getElement(x,a); pos.getElement(y,b); pos.getElement(z,c);
      const u = b.map((v,j) => v-a[j]), v = c.map((v,j) => v-a[j]);
      if (Math.hypot(u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]) >= 1e-12) kept.push(x,y,z);
    }
    primitive.setIndices(document.createAccessor().setType('SCALAR').setArray(new Uint32Array(kept)).setBuffer(pos.getBuffer()));
  }
  for (const [name, before] of pivots) {
    const node = document.getRoot().listNodes().find((n) => n.getName() === name);
    if (!node || Math.hypot(...node.getWorldTranslation().map((v, i) => v - before[i])) > .001) throw new Error(`Optimization moved/lost pivot ${name}`);
  }
}
export async function optimizeAsset(raw: string, output: string, def: AssetDef, ratio = 1): Promise<void> {
  const io = await assetIO(), document = await io.read(raw);
  await optimizeDocument(document, def, ratio);
  mkdirSync(dirname(output), { recursive: true });
  await io.write(output, document);
}
