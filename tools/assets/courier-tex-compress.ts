import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMaterialsUnlit, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

/** Textured female courier skin (assets/char.courier-female-skin/build.py) → runtime GLB, written for both quality tiers
 * (6k triangles: the low tier needs no reduced copy).
 * Same contract as tools/skinpilot/compress.ts (positions never quantized: quantize() would rescale the skinned mesh node),
 * plus the base-colour map re-encoded as WebP (cwebp q90, ≤ 1024 px; the validator accepts only KTX2/WebP delivery maps).
 * Usage: npx tsx tools/assets/courier-tex-compress.ts [in.glb] [out.glb] */
const [input = 'assets/char.courier-female-skin/model.skin.glb', output = 'public/assets/models/char.courier-female.skin.glb'] = process.argv.slice(2);
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
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
await finish(await prepare(), output.replace(/\.skin\.glb$/, '.skin.low.glb'));
