/** Repaint the existing TRELLIS zebra skin without changing its joints or topology. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { consolidateMeshopt } from './compress';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { assetIO } from './io';
import { compressSkin, decodeSkinImage } from './skin-crowd-compress';
import { paintAnimalDetails } from './skin-crowd-animal-details';
const io = await assetIO(), basis = process.env.BASIS ?? resolve('/Users/wesner/Workspace/minorincident_3dpipeline/vendor/basis-encoder-2.1');
process.env.CROWD_Q ??= '128';
const temporary = mkdtempSync(join(tmpdir(), 'zebra-infection-'));
try {
  for (const lod of [0, 1, 2]) for (const quality of ['', '.low']) {
    const source = `public/assets/models/skinned/inf.zebra.lod${lod}${quality}.glb`;
    // Fixed pre-change revision makes repeated builds independent of delivered output.
    const baseline = execFileSync('git', ['show', `f7f41a1c:${source}`], { maxBuffer: 16 * 1024 * 1024 });
    const document = await io.readBinary(baseline);
    // The TRELLIS mane contains isolated high blades in the bind mesh. Taper
    // their tops into a low continuous crest; preserve face and ear vertices.
    const body = document.getRoot().listNodes().find(node => node.getName() === 'skin_body')!;
    const position = body.getMesh()!.listPrimitives()[0].getAttribute('POSITION')!;
    for (let i = 0; i < position.getCount(); i++) {
      const [x, y, z] = position.getElement(i, [0, 0, 0]);
      if (x < .15 || x > .83 || Math.abs(z) > .18) continue;
      const cap = 1.91 + .36 * (x - .15);
      if (y > cap) position.setElement(i, [x, cap + .12 * (y - cap), z]);
    }
    const maxSize = Math.max(...document.getRoot().listTextures().flatMap(texture => texture.getSize() ?? [512]));
    for (const texture of document.getRoot().listTextures()) {
      const image = await decodeSkinImage(texture.getImage()!, texture.getMimeType(), basis);
      texture.setImage(PNG.sync.write(image)).setMimeType('image/png');
    }
    paintAnimalDetails(document, false, undefined, undefined, false, { species: 'zebra', infected: true });
    const raw = join(temporary, `lod${lod}${quality}.glb`);
    await io.write(raw, document);
    const encoded = join(temporary, `encoded${lod}${quality}.glb`);
    await compressSkin(raw, encoded, basis, maxSize);
    const compact = await consolidateMeshopt(readFileSync(encoded), true);
    if (compact.length > baseline.length) throw Error(`${source}: ${compact.length} exceeds baseline ${baseline.length}`);
    writeFileSync(join(temporary, `out${lod}${quality}.glb`), compact);
  }
  console.log(`Experimental outputs: ${temporary}`);
} catch (error) { rmSync(temporary, { recursive: true, force: true }); throw error; }
