import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMaterialsUnlit, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

/** Textured courier (assets/char.courier-female-tex/build.py) → runtime GLBs (lod0 + lod1/lod2 for the asset contract).
 * Same contract as tools/skinpilot/compress.ts (positions never quantized: quantize() would rescale the skinned mesh node),
 * plus the base-colour map re-encoded as WebP (cwebp q90, ≤ 1024 px; the validator accepts only KTX2/WebP delivery maps).
 * LODs keep UV seams (LockBorder on the unwelded islands) and every skin influence of the kept vertices.
 * Usage: npx tsx tools/assets/courier-tex-compress.ts [in.glb] [out.glb] */
const [input = 'assets/char.courier-female-tex/model.skin.glb', output = 'public/assets/models/char.courier-female-tex.skin.glb'] = process.argv.slice(2);
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

async function prepare(): Promise<Document> {
  const doc = await io.read(input);
  const dir = mkdtempSync(join(tmpdir(), 'courier-tex-'));
  try {
    for (const texture of doc.getRoot().listTextures()) {
      const source = join(dir, 'in' + (texture.getMimeType() === 'image/png' ? '.png' : '.jpg')), target = join(dir, 'out.webp');
      writeFileSync(source, texture.getImage()!);
      execFileSync('cwebp', ['-quiet', '-q', '90', '-m', '6', '-sharp_yuv', source, '-o', target]);
      texture.setImage(readFileSync(target)).setMimeType('image/webp').setURI('');
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
  // The game shades it with its own lit graph (Materials.fromTexture); the research viewer's unlit flag is not used.
  for (const material of doc.getRoot().listMaterials()) material.setExtension('KHR_materials_unlit', null);
  doc.getRoot().listExtensionsUsed().find(extension => extension instanceof KHRMaterialsUnlit)?.dispose();
  return doc;
}
/** Triangle target for the whole mesh, split by primitive size; seams/borders locked. */
function simplify(doc: Document, ratio: number): number {
  let after = 0;
  for (const primitive of doc.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives())) {
    const positions = primitive.getAttribute('POSITION')!, uv = primitive.getAttribute('TEXCOORD_0'), normal = primitive.getAttribute('NORMAL');
    const source = primitive.getIndices()!, indices = new Uint32Array(source.getArray()!);
    const attributes = [uv, normal].filter(Boolean) as NonNullable<typeof uv>[];
    const stride = attributes.reduce((n, attribute) => n + attribute.getElementSize(), 0), values = new Float32Array(positions.getCount() * stride), row: number[] = [];
    for (let i = 0; i < positions.getCount(); i++) { let o = i * stride; for (const a of attributes) { a.getElement(i, row); for (let c = 0; c < a.getElementSize(); c++) values[o++] = row[c]; } }
    const target = Math.max(3, Math.floor(indices.length * ratio / 3) * 3);
    const [reduced] = MeshoptSimplifier.simplifyWithAttributes(indices, new Float32Array(positions.getArray()!), 3, values, stride, [.5, .5, .2, .2, .2].slice(0, stride), null, target, .05, ['LockBorder']);
    primitive.setIndices(source.clone().setArray(reduced));
    if (source.listParents().length === 1) source.dispose();
    after += reduced.length / 3;
  }
  return after;
}
async function finish(doc: Document, path: string): Promise<void> {
  await doc.transform(weld(), dedup(), prune({ keepLeaves: true, keepAttributes: true }),
    quantize({ pattern: /^(COLOR_0|WEIGHTS_0|NORMAL|TEXCOORD_0)$/, quantizeColor: 16, quantizeWeight: 16, quantizeNormal: 10, quantizeTexcoord: 14 }), reorder({ encoder: MeshoptEncoder }));
  // Normalized int16 normals need KHR_mesh_quantization; positions stay float (see above).
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await io.write(path, doc);
  console.log(path, readFileSync(path).length);
}
await finish(await prepare(), output);
for (const [lod, ratio] of [['lod1', .5], ['lod2', .25]] as const) {
  const doc = await prepare(), triangles = simplify(doc, ratio);
  console.log(lod, triangles);
  await finish(doc, output.replace(/\.skin\.glb$/, `.skin.${lod}.glb`));
}
