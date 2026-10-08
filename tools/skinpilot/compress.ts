import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

/** Skinned pilot GLB → runtime GLB: weld/dedup + meshopt. Positions are never quantized: quantize() rescales the
 * skinned mesh node, which skinning ignores (figure came out 2 m tall). Baked AO colours and skin weights are stored
 * as normalized 16-bit (KHR_mesh_quantization, no node transform involved). */
const [input = 'assets/char.courier-female-skin/model.skin.glb', output = 'public/assets/models/char.courier-female.skin.glb'] = process.argv.slice(2);
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
await doc.transform(weld(), dedup(), prune({ keepLeaves: true, keepAttributes: true }), quantize({ pattern: /^(COLOR_0|WEIGHTS_0)$/, quantizeColor: 16, quantizeWeight: 16 }), reorder({ encoder: MeshoptEncoder }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(output, doc);
console.log(output);
