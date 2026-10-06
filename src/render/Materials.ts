// Adapted from folio-2025 Materials.js by Bruno Simon (MIT), commit 41046b5.
import { DataTexture, NearestFilter, SRGBColorSpace, RGBAFormat, UnsignedByteType, type Color, type Node } from 'three/webgpu';
import { attribute, color, mix, positionGeometry, positionLocal, sin, uniform, vec3 } from 'three/tsl';
import { palette, paletteTokens, type PaletteToken } from '../data/palette';
import { PaletteMaterial } from './PaletteMaterial';
import type { Lighting } from './Lighting';

/** Shared palette texture/material cache. Occluders request owned copies so fading cannot affect other props. */
export class Materials {
  readonly wind = uniform(0);
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
  get look() { return this.lighting.look; }
  applyLook(): void {
    const data = this.texture.image.data as Uint8Array;
    let changed = false;
    paletteTokens.forEach((token, i) => {
      const hex = Number.parseInt(this.look.palette[token].slice(1), 16), rgb = [hex >> 16, hex >> 8 & 255, hex & 255];
      rgb.forEach((value, channel) => { if (data[i * 4 + channel] !== value) { data[i * 4 + channel] = value; changed = true; } });
    });
    if (changed) this.texture.needsUpdate = true;
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
  /** Rigid character parts share their authored vertex swatches and blood mask. */
  fromVertexColors(name: string): PaletteMaterial {
    const key = `vertices:${name}`;
    let material = this.cache.get(key);
    if (!material) { material = new PaletteMaterial('picketWhite', this.texture, this.lighting, 0, undefined, true); material.name = name; this.cache.set(key, material); }
    return material;
  }
  /** Owned GPU crowd/prop graph: same light as heroes, with caller-authored swatches/eyes. */
  shaded(base: Node<'vec3'>, glow?: Node<'vec3'>, opacity?: Node<'float'>): PaletteMaterial {
    return new PaletteMaterial('picketWhite', this.texture, this.lighting, 0, undefined, false, { base, glow, opacity });
  }
  /** One shared material for every tree/hedge LOD; bottom vertices remain rooted. */
  foliage(): PaletteMaterial {
    const key = 'wind-foliage';
    let material = this.cache.get(key);
    if (!material) {
      const ramp = positionGeometry.y.smoothstep(.25, 1.7);
      const tint = mix(this.look.nodes.foliageDark.rgb.div(color('#4a7533').rgb), this.look.nodes.foliageLight.rgb.div(color('#98b94f').rgb), ramp).mul(this.look.nodes.foliage.rgb.div(color('#789c4c').rgb));
      material = this.shaded(attribute('color', 'vec3').mul(tint));
      const weight = positionGeometry.y.smoothstep(.25, 1.7).mul(.055).mul(this.look.nodes.windStrength);
      const gust = sin(positionLocal.x.mul(.7).add(positionLocal.z.mul(.4)).add(this.wind.mul(1.2)));
      material.positionNode = positionLocal.add(vec3(gust.mul(weight), 0, gust.mul(weight).mul(.6)));
      material.name = 'pal_wind-foliage'; this.cache.set(key, material);
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
