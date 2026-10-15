import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import palette from '../../src/assets/palette.json';

/** PO 10-15 #9c: the courier's chunky sneaker sole was the same white as the upper and read as a pale plate under the shoes.
 * Recolours the sole band (rest-pose y below SOLE_TOP) of the skinned courier GLBs to the leatherEdge rubber token, keeping the baked AO
 * (new = old / white * rubber, linear). Idempotent: re-running leaves recoloured vertices alone because they are no longer whitish.
 * Usage: npx tsx tools/assets/courier-soles.ts [public/assets/models/char.courier-female.skin.glb ...] */
const SOLE_TOP = 0.066;
const lin = (hex: string) => [1, 3, 5].map(i => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
const white = lin(palette.picketWhite), rubber = lin(palette.leatherEdge);
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['female', 'male'].map(s => `public/assets/models/char.courier-${s}.skin.glb`);
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
for (const file of files) {
  const doc = await io.read(file);
  let changed = 0;
  for (const primitive of doc.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives())) {
    const position = primitive.getAttribute('POSITION'), color = primitive.getAttribute('COLOR_0');
    if (!position || !color) continue;
    for (let i = 0; i < position.getCount(); i++) {
      if (position.getElement(i, [])[1] > SOLE_TOP) continue;
      const c = color.getElement(i, []);
      // whitish = within 45% of the white token's brightness on every channel (AO darkens it, rubber is far below)
      if (!c.slice(0, 3).every((v, k) => v > white[k] * .45 && v < white[k] * 1.05 + .02)) continue;
      color.setElement(i, [c[0] / white[0] * rubber[0], c[1] / white[1] * rubber[1], c[2] / white[2] * rubber[2], ...c.slice(3)]); changed++;
    }
  }
  if (!doc.getRoot().listExtensionsUsed().some(e => e.extensionName === 'EXT_meshopt_compression')) doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await io.write(file, doc);
  console.log(`${file}: ${changed} sole vertices recoloured`);
}
