// Adapted from folio-2025 Materials.js by Bruno Simon (MIT), commit 41046b5.
import { DataTexture, NearestFilter, SRGBColorSpace, RGBAFormat, UnsignedByteType, type Color } from 'three/webgpu';
import { attribute } from 'three/tsl';
import { palette, paletteTokens, type PaletteToken } from '../data/palette';
import { PaletteMaterial } from './PaletteMaterial';
import type { Lighting } from './Lighting';

/** Shared palette texture/material cache. Occluders request owned copies so fading cannot affect other props. */
export class Materials {
  readonly texture: DataTexture;
  private readonly cache = new Map<string, PaletteMaterial>();
  private readonly owned: PaletteMaterial[] = [];
  constructor(private readonly lighting: Lighting) {
    const data = new Uint8Array(paletteTokens.length * 4);
    paletteTokens.forEach((token, i) => {
      const hex = Number.parseInt(palette[token].slice(1), 16);
      data.set([hex >> 16, hex >> 8 & 255, hex & 255, 255], i * 4);
    });
    this.texture = new DataTexture(data, paletteTokens.length, 1, RGBAFormat, UnsignedByteType);
    this.texture.colorSpace = SRGBColorSpace; this.texture.minFilter = this.texture.magFilter = NearestFilter; this.texture.needsUpdate = true;
  }
  get(token: PaletteToken, emissive = 0): PaletteMaterial {
    const key = `${token}:${emissive}`;
    let material = this.cache.get(key);
    if (!material) { material = new PaletteMaterial(token, this.texture, this.lighting, emissive); this.cache.set(key, material); }
    return material;
  }
  /** Imported hero detail swatches retain their authored colors with the same stylized shading. */
  fromColor(name: string, color: Color): PaletteMaterial {
    const key = `swatch:${name}:${color.getHexString()}`;
    let material = this.cache.get(key);
    if (!material) { material = new PaletteMaterial('picketWhite', this.texture, this.lighting, 0, color.clone()); material.name = name; this.cache.set(key, material); }
    return material;
  }
  /** One stylized material for rigid meshes whose authored swatches are baked into vertex colors. */
  vertexColors(): PaletteMaterial {
    let material = this.cache.get('vertex-colors');
    if (!material) {
      material = new PaletteMaterial('picketWhite', this.texture, this.lighting, 0, undefined, attribute('color', 'vec3'));
      material.userData.sharedPalette = true; this.cache.set('vertex-colors', material);
    }
    return material;
  }
  unique(token: PaletteToken, emissive = 0, transparent = false): PaletteMaterial {
    const material = new PaletteMaterial(token, this.texture, this.lighting, emissive);
    material.transparent = transparent; this.owned.push(material); return material;
  }
  dispose(): void {
    for (const material of this.cache.values()) material.dispose();
    for (const material of this.owned) material.dispose();
    this.cache.clear(); this.owned.length = 0; this.texture.dispose();
  }
}
