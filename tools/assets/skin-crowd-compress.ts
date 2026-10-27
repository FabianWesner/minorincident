import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { KHRMeshQuantization, KHRTextureBasisu, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { assetIO } from './io';

interface Encoder {
  setSliceSourceImage(i: number, data: Uint8Array, w: number, h: number, png: boolean): void;
  setCreateKTX2File(v: boolean): void; setUASTC(v: boolean): void; setKTX2AndBasisSRGBTransferFunc(v: boolean): void;
  setPerceptual(v: boolean): void; setMipGen(v: boolean): void; setMipSRGB(v: boolean): void;
  setQualityLevel(v: number): void; setYFlip(v: boolean): void; setCheckForAlpha(v: boolean): void;
  encode(dst: Uint8Array): number; delete(): void;
}
interface Ktx {
  isValid(): boolean; startTranscoding(): boolean; getWidth(): number; getHeight(): number;
  getImageTranscodedSizeInBytes(m: number, l: number, f: number, format: number): number;
  transcodeImage(dst: Uint8Array, m: number, l: number, f: number, format: number, flags: number, a: number, b: number): boolean;
  close(): void; delete(): void;
}
interface Basis { initializeBasis(): void; BasisEncoder: new () => Encoder; KTX2File: new (data: Uint8Array) => Ktx }

/** Box-filter the colour and keep the top-left class of each 2x2 block, until the long side fits. */
function halveClassed(image: PNG, maxSize: number): PNG {
  while (Math.max(image.width, image.height) > maxSize) {
    if (image.width % 2 || image.height % 2) throw Error(`Classed atlas ${image.width}x${image.height} cannot be halved exactly`);
    const half = new PNG({ width: image.width / 2, height: image.height / 2 });
    for (let y = 0; y < half.height; y++) for (let x = 0; x < half.width; x++) {
      const o = (y * half.width + x) * 4, at = (dx: number, dy: number) => ((2 * y + dy) * image.width + 2 * x + dx) * 4;
      for (let c = 0; c < 3; c++) half.data[o + c] = Math.round((image.data[at(0, 0) + c] + image.data[at(1, 0) + c] + image.data[at(0, 1) + c] + image.data[at(1, 1) + c]) / 4);
      half.data[o + 3] = image.data[at(0, 0) + 3];
    }
    image = half;
  }
  return image;
}

/** Pipeline Apache-2.0 Basis encoder: ETC1S q192, full sRGB mip chain (PLAYBOOK §5). */
export async function compressSkin(input: string, output: string, basisRoot: string, maxSize = 1024, coat?: string, coatSource?: string, coatBaseHalf = false): Promise<void> {
  const require = createRequire(import.meta.url);
  const factory = require(join(basisRoot, 'basis_encoder.js')) as (options: { wasmBinary: Uint8Array }) => Promise<Basis>;
  const basis = await factory({ wasmBinary: readFileSync(join(basisRoot, 'basis_encoder.wasm')) }); basis.initializeBasis();
  const io = await assetIO(), doc = await io.read(input), directory = mkdtempSync(join(tmpdir(), 'crowd-codec-'));
  try {
    if (coatSource) {
      const source = await io.read(coatSource), atlas = source.getRoot().listTextures()[0];
      let image = atlas.getImage()!, mime = atlas.getMimeType();
      if (coatBaseHalf) {
        const png = PNG.sync.read(Buffer.from(image)), half = new PNG({ width: png.width, height: png.height / 2 });
        half.data.set(png.data.subarray(0, half.data.length)); image = new Uint8Array(PNG.sync.write(half)); mime = 'image/png';
      }
      for (const texture of doc.getRoot().listTextures()) if (texture.getName() === 'atlas') texture.setImage(image).setMimeType(mime);
    }
    for (const texture of doc.getRoot().listTextures()) {
      const image = texture.getImage()!, size = texture.getSize()!;
      if (!coat && texture.getMimeType() === 'image/ktx2' && Math.max(...size) <= maxSize && size.every(n => n % 4 === 0)) continue;
      let png: Buffer;
      if (texture.getMimeType() === 'image/ktx2') {
        const file = new basis.KTX2File(image);
        try {
          if (!file.isValid() || !file.startTranscoding()) throw Error('Invalid source KTX2');
          const rgba = new Uint8Array(file.getImageTranscodedSizeInBytes(0, 0, 0, 13));
          if (!file.transcodeImage(rgba, 0, 0, 0, 13, 0, -1, -1)) throw Error('KTX2 RGBA transcode failed');
          png = PNG.sync.write({ width: file.getWidth(), height: file.getHeight(), data: Buffer.from(rgba) } as PNG);
        } finally { file.close(); file.delete(); }
      } else if (texture.getMimeType() === 'image/png') png = Buffer.from(image);
      else {
        const source = join(directory, 'source.' + texture.getMimeType().split('/')[1]), target = join(directory, 'source.png');
        writeFileSync(source, image);
        execFileSync('sips', ['-s', 'format', 'png', source, '--out', target], { stdio: 'ignore' }); png = readFileSync(target);
      }
      const path = join(directory, 'image.png');
      // Region classes live in the alpha (skin-crowd-regions.ts). CoreGraphics premultiplies, which erases the
      // colour of class 0, and any filter would average two classes into a third: halve in JS instead.
      const classed = PNG.sync.read(png);
      if (classed.data.some((v, i) => i % 4 === 3 && v < 255)) writeFileSync(path, PNG.sync.write(halveClassed(classed, maxSize)));
      else { writeFileSync(path, png); execFileSync('sips', ['-Z', String(maxSize), path], { stdio: 'ignore' }); }
      const resized = PNG.sync.read(readFileSync(path));
      // WebGPU requires the base extent of block-compressed textures to align
      // to the 4x4 block, including rectangular atlases (512x341 was invalid).
      if (resized.width % 4 || resized.height % 4) execFileSync('sips', ['-z', String(Math.max(4, Math.round(resized.height / 4) * 4)), String(Math.max(4, Math.round(resized.width / 4) * 4)), path], { stdio: 'ignore' });
      const decoded = PNG.sync.read(readFileSync(path)), encoder = new basis.BasisEncoder();
      if (coat) for (let i = 0; i < decoded.data.length; i += 4) {
        const r = decoded.data[i] / 255, g = decoded.data[i + 1] / 255, b = decoded.data[i + 2] / 255;
        // Keep teeth, deep sockets and red wounds; only the middle-value fur takes the seeded coat.
        if (Math.max(r, g, b) > .92 || Math.max(r, g, b) < .06 || r > g * 1.7 && r > b * 1.7) continue;
        const shade = .35 + .8 * Math.sqrt(.2126 * r + .7152 * g + .0722 * b);
        const rgb = coat === 'cream' ? [.93, .86, .72] : [.19, .19, .23];
        for (let c = 0; c < 3; c++) decoded.data[i + c] = Math.round(Math.min(1, rgb[c] * shade) * 255);
      }
      try {
        encoder.setSliceSourceImage(0, decoded.data, decoded.width, decoded.height, false);
        encoder.setCreateKTX2File(true); encoder.setUASTC(false); encoder.setKTX2AndBasisSRGBTransferFunc(true);
        encoder.setPerceptual(true); encoder.setMipGen(true); encoder.setMipSRGB(true); encoder.setQualityLevel(192);
        encoder.setYFlip(false); encoder.setCheckForAlpha(true);
        const dst = new Uint8Array(decoded.width * decoded.height * 8 + 65536), count = encoder.encode(dst);
        if (!count) throw Error('ETC1S encode failed');
        texture.setImage(dst.slice(0, count)).setMimeType('image/ktx2').setURI('');
      } finally { encoder.delete(); }
    }
    doc.createExtension(KHRTextureBasisu).setRequired(true);
    await doc.transform(weld(), dedup(), prune({ keepLeaves: true, keepAttributes: true }),
      // Positions stay in the bind frame: position quantization rescales the mesh node outside its skin.
      quantize({ pattern: /^(NORMAL|TEXCOORD_0|WEIGHTS_0|COLOR_0)$/, quantizeNormal: 10, quantizeTexcoord: 14, quantizeWeight: 16, quantizeColor: 16 }),
      reorder({ encoder: MeshoptEncoder }));
    doc.createExtension(KHRMeshQuantization).setRequired(true);
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    await io.write(output, doc);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
