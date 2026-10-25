import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, quantize } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

/** Tier gear GLB (assets/acc.courier-gear/build.py raw export) → runtime GLB with meshopt (asset validator delivery contract).
 * No weld/reorder: CharacterView draws the tiers by triangle draw range, so the triangle order must survive. Positions stay float
 * (quantize() would rescale the skinned node); weights are normalized 16-bit. The painted gear map (Q-183) is re-encoded as WebP
 * (cwebp q90, as the courier body maps; the validator accepts only KTX2/WebP delivery maps).
 * Usage: npx tsx tools/assets/courier-gear-compress.ts <in.glb> <out.glb> */
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('usage: courier-gear-compress.ts <in.glb> <out.glb>');
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
const dir = mkdtempSync(join(tmpdir(), 'courier-gear-'));
try {
  for (const texture of doc.getRoot().listTextures()) {
    if (texture.getMimeType() === 'image/webp') continue;
    const source = join(dir, 'in.png'), target = join(dir, 'out.webp');
    writeFileSync(source, texture.getImage()!);
    execFileSync('cwebp', ['-quiet', '-q', '90', '-m', '6', '-sharp_yuv', source, '-o', target]);
    texture.setImage(readFileSync(target)).setMimeType('image/webp').setURI('');
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
await doc.transform(prune({ keepLeaves: true, keepAttributes: true }), quantize({ pattern: /^(COLOR_0|WEIGHTS_0)$/, quantizeColor: 16, quantizeWeight: 16 }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(output, doc);
console.log(output, readFileSync(output).length);
