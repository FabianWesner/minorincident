// Bruno's toktx stage adapted to embedded GLB atlases; geometry stays meshopt.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Document } from '@gltf-transform/core';
import { KHRTextureBasisu } from '@gltf-transform/extensions';
import { getTextureColorSpace, listTextureSlots } from '@gltf-transform/functions';

/** Texture-free palette assets need no external encoder. Atlases require toktx. */
export function compressTextures(document: Document, binary = process.env.TOKTX_BIN ?? 'toktx'): void {
  const textures = document.getRoot().listTextures().filter(t => t.getMimeType() !== 'image/ktx2');
  if (!textures.length) return;
  const directory = mkdtempSync(join(tmpdir(),'minor-incident-ktx-'));
  try {
    for (const [index,texture] of textures.entries()) {
      if (texture.getMimeType() !== 'image/png' || !texture.getImage()) throw new Error('Atlases must be PNG');
      const input = join(directory,`${index}.png`), output = join(directory,`${index}.ktx2`);
      writeFileSync(input,texture.getImage()!);
      const detail = listTextureSlots(texture).some(slot => /normal|occlusion|metallicRoughness/.test(slot));
      const result = spawnSync(binary,['--t2','--genmipmap','--threads','3','--encode',detail ? 'uastc' : 'etc1s','--assign_oetf',getTextureColorSpace(texture) ?? 'linear',output,input],{encoding:'utf8'});
      if (result.error || result.status !== 0) throw new Error(`KTX2 encode failed: configure TOKTX_BIN (${result.error?.message ?? result.stderr})`);
      const image = readFileSync(output);
      if (image.subarray(0,12).toString('hex') !== 'ab4b5458203230bb0d0a1a0a') throw new Error('Encoder did not produce KTX2');
      texture.setImage(image).setMimeType('image/ktx2');
    }
    document.createExtension(KHRTextureBasisu).setRequired(true);
  } finally { rmSync(directory,{recursive:true,force:true}); }
}
