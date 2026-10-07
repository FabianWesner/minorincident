// Meshopt-compress layout GLBs (EXT_meshopt_compression + KHR_mesh_quantization), in place and
// idempotent. Blender exports float32 positions/normals/uvs: ~2 MB per L1 district before this step.
// Verifies that every named node keeps its world transform and every mesh its world bounds.
// Usage: tsx tools/layouts/compress.ts public/assets/layouts/D-RES.base.glb [...]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { Box3, Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder as ThreeMeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

async function parse(bytes: Uint8Array): Promise<Object3D> {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const { scene } = await new GLTFLoader().setMeshoptDecoder(ThreeMeshoptDecoder).parseAsync(buffer, '');
  scene.updateMatrixWorld(true); return scene;
}
/** Empties (placement/crown/anchor references) by traversal order; meshes as union world bounds per
 * name (quantization rescales mesh-bearing nodes by design, and GLTFLoader groups primitives),
 * since GLTFLoader may emit multi-primitive meshes as a group whose child order is not stable. */
function signature(scene: Object3D): Map<string, number[]> {
  const out = new Map<string, number[]>(), boxes = new Map<string, Box3>(); let i = 0;
  scene.traverse(node => {
    if (node instanceof Mesh) { const box = boxes.get(node.name) ?? new Box3(); box.union(new Box3().setFromObject(node)); boxes.set(node.name, box); }
    else if (!node.children.some(child => child instanceof Mesh)) out.set(`${node.name}#${i++}`, node.matrixWorld.toArray());
  });
  for (const [name, box] of [...boxes].sort(([x], [y]) => x.localeCompare(y))) out.set(`mesh:${name}`, [...box.min.toArray(), ...box.max.toArray()]);
  return out;
}
export async function compressLayoutGlb(path: string): Promise<{ before: number; after: number; skipped: boolean }> {
  const input = readFileSync(path);
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const document = await io.readBinary(input);
  if (document.getRoot().listExtensionsUsed().some(e => e.extensionName === 'EXT_meshopt_compression')) return { before: input.length, after: input.length, skipped: true };
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const output = await io.writeBinary(document);
  const [a, b] = [signature(await parse(input)), signature(await parse(output))];
  // Quantization inserts no nodes; it rescales mesh nodes. Compare by traversal order and name.
  if (a.size !== b.size) throw new Error(`${path}: node count changed ${a.size} -> ${b.size}`);
  const tolerance = 0.01; // metres; 16-bit positions over a 60 m district quantize to ~1 mm
  for (const [[key, x], [key2, y]] of [...a].map((entry, i) => [entry, [...b][i]] as const)) {
    if (key !== key2) throw new Error(`${path}: node order changed at ${key} / ${key2}`);
    const error = Math.max(...x.map((v, i) => Math.abs(v - y[i])));
    if (error > tolerance) throw new Error(`${path}: ${key} moved by ${error.toFixed(4)}`);
  }
  writeFileSync(path, output);
  return { before: input.length, after: output.length, skipped: false };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const path of process.argv.slice(2)) console.log(path, await compressLayoutGlb(path));
}
