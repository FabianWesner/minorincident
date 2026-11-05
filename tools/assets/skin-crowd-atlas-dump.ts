// Dump every texture of a GLB to PNG (KTX2 transcoded to RGBA) for stage diagnosis.
// Usage: node --import tsx tools/assets/skin-crowd-atlas-dump.ts <in.glb> <out-prefix>
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { assetIO } from './io';

const [input, prefix] = process.argv.slice(2);
const basisRoot = process.env.BASIS ?? join(process.cwd(), '..', 'minorincident_3dpipeline/vendor/basis-encoder-2.1');
const require = createRequire(import.meta.url);
const factory = require(join(basisRoot, 'basis_encoder.js'));
const basis = await factory({ wasmBinary: readFileSync(join(basisRoot, 'basis_encoder.wasm')) }); basis.initializeBasis();
const doc = await (await assetIO()).read(input);
doc.getRoot().listTextures().forEach((t, i) => {
  const image = t.getImage()!, name = `${prefix}.${i}.${t.getName() || 'tex'}.png`;
  if (t.getMimeType() === 'image/ktx2') {
    const f = new basis.KTX2File(image); f.startTranscoding();
    const rgba = new Uint8Array(f.getImageTranscodedSizeInBytes(0, 0, 0, 13)); f.transcodeImage(rgba, 0, 0, 0, 13, 0, -1, -1);
    writeFileSync(name, PNG.sync.write({ width: f.getWidth(), height: f.getHeight(), data: Buffer.from(rgba) } as PNG)); f.close(); f.delete();
  } else writeFileSync(name, image);
  console.log(name, t.getMimeType(), t.getSize());
});
