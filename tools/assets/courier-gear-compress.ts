import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, quantize } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

/** Tier gear GLB (assets/acc.courier-gear/build.py raw export) → runtime GLB with meshopt (asset validator delivery contract).
 * No weld/reorder: CharacterView draws the tiers by triangle draw range, so the triangle order must survive. Positions stay float
 * (quantize() would rescale the skinned node); colours and weights are normalized 16-bit.
 * Usage: npx tsx tools/assets/courier-gear-compress.ts <in.glb> <out.glb> */
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('usage: courier-gear-compress.ts <in.glb> <out.glb>');
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
await doc.transform(prune({ keepLeaves: true, keepAttributes: true }), quantize({ pattern: /^(COLOR_0|WEIGHTS_0)$/, quantizeColor: 16, quantizeWeight: 16 }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(output, doc);
console.log(output);
