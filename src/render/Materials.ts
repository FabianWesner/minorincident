// Adapted from Bruno Simon folio-2025 Materials.js (MIT).
import { DataTexture, NearestFilter, SRGBColorSpace, RGBAFormat, UnsignedByteType, Color, type Node } from 'three/webgpu';
import { attribute, positionGeometry, positionLocal, sin, uniform, vec2, vec3, texture, luminance, varying } from 'three/tsl';
import { palette, paletteTokens, type PaletteToken } from '../data/palette';
import { surfaceDetail } from './SurfaceDetail';
import { worldPalette } from '../data/worldLook';
import { PaletteMaterial } from './PaletteMaterial';
import type { Lighting } from './Lighting';

/** Shared palette texture/material cache. Occluders request owned copies so fading cannot affect other props. */
export class Materials {
  readonly wind = uniform(0);
  readonly texture: DataTexture;
  private readonly cache = new Map<string, PaletteMaterial>();
  private readonly nearestCache = new Map<string, number>();
  private readonly swatches = paletteTokens.map(token => new Color(palette[token]));
  private readonly owned: PaletteMaterial[] = [];
  constructor(private readonly lighting: Lighting) {
    const data = new Uint8Array(paletteTokens.length * 8);
    const sheets: Partial<Record<PaletteToken, string>>[] = [{}, worldPalette];
    for (const [sheet, overrides] of sheets.entries()) paletteTokens.forEach((token, i) => {
      const hex = Number.parseInt((overrides[token] ?? palette[token]).slice(1), 16);
      data.set([hex >> 16, hex >> 8 & 255, hex & 255, 255], (i + sheet * paletteTokens.length) * 4);
    });
    this.texture = new DataTexture(data, paletteTokens.length * 2, 1, RGBAFormat, UnsignedByteType);
    this.texture.colorSpace = SRGBColorSpace; this.texture.minFilter = this.texture.magFilter = NearestFilter; this.texture.needsUpdate = true;
  }
  /** All world batches sample the second half of this single sheet; figures retain identity colors. */
  sample(index: Node<'float'>): Node<'vec3'> {
    const offset = index.lessThan(0).select(paletteTokens.length, this.lighting.worldPaletteEnabled.mul(paletteTokens.length));
    return texture(this.texture, vec2(index.add(offset).add(.5).div(paletteTokens.length * 2), .5)).rgb;
  }
  world(token: PaletteToken, emissive = 0, vertexColors = false): PaletteMaterial {
    const key = `world:${token}:${emissive}:${vertexColors}`;
    let material = this.cache.get(key);
    if (!material) {
      const swatch = this.sample(uniform(paletteTokens.indexOf(token)));
      const base = vertexColors ? swatch.mul(attribute('color', 'vec3')) : surfaceDetail(token, swatch);
      material = new PaletteMaterial(token, this.texture, this.lighting, 0, undefined, false, { base, glow: emissive ? base.div(luminance(base).max(.001)).mul(emissive) : undefined });
      material.color.set(palette[token]); material.vertexColors = vertexColors;
      material.name = `${emissive ? 'emi' : 'pal'}_${token}`; material.userData.emissiveStrength = emissive; this.cache.set(key, material);
    }
    return material;
  }
  /** Imported palette identity remains available to batching and figure bake consumers. */
  asset(token: PaletteToken, emissive = 0, vertexColors = false): PaletteMaterial {
    const key = `asset:${token}:${emissive}:${vertexColors}`;
    let material = this.cache.get(key);
    if (!material) {
      const base = texture(this.texture, vec2((paletteTokens.indexOf(token) + .5) / (paletteTokens.length * 2), .5)).rgb.mul(vertexColors ? attribute('color', 'vec3') : 1);
      material = new PaletteMaterial(token, this.texture, this.lighting, 0, undefined, false, { base, glow: emissive ? base.div(luminance(base).max(.001)).mul(emissive) : undefined });
      material.color.set(palette[token]); material.vertexColors = vertexColors;
      material.name = `${emissive ? 'emi' : 'pal'}_${token}`; material.userData.emissiveStrength = emissive; this.cache.set(key, material);
    }
    return material;
  }
  nearest(color: Color): number {
    const key = [color.r, color.g, color.b].map(value => Math.round(value * 4096)).join(':');
    const cached = this.nearestCache.get(key); if (cached !== undefined) return cached;
    let nearest = 0, distance = Infinity;
    this.swatches.forEach((swatch, i) => {
      const d = (swatch.r - color.r) ** 2 + (swatch.g - color.g) ** 2 + (swatch.b - color.b) ** 2;
      if (d < distance) { distance = d; nearest = i; }
    });
    this.nearestCache.set(key, nearest); return nearest;
  }
  get(token: PaletteToken, emissive = 0): PaletteMaterial {
    const key = `${token}:${emissive}`;
    let material = this.cache.get(key);
    if (!material) { material = new PaletteMaterial(token, this.texture, this.lighting, emissive); this.cache.set(key, material); }
    return material;
  }
  /** Imported hero detail swatches retain their authored colors with the same stylized shading. */
  fromColor(name: string, color: Color, emissive = 0, world = false): PaletteMaterial {
    const key = `swatch:${name}:${color.getHexString()}:${emissive}:${world}`;
    let material = this.cache.get(key);
    if (!material) { material = new PaletteMaterial('picketWhite', this.texture, this.lighting, emissive, world ? undefined : color.clone(), false, world ? { base: this.sample(uniform(this.nearest(color))) } : undefined); material.color.copy(color); material.name = name; material.userData.emissiveStrength = emissive; this.cache.set(key, material); }
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
  foliage(world = false): PaletteMaterial {
    const key = `wind-foliage:${world}`;
    let material = this.cache.get(key);
    if (!material) {
      material = this.shaded(world ? varying(this.sample(attribute('_palette', 'float')), 'worldPaletteColor') : attribute('color', 'vec3'));
      const weight = positionGeometry.y.smoothstep(.25, 1.7).mul(.055);
      const gust = sin(positionLocal.x.mul(.7).add(positionLocal.z.mul(.4)).add(this.wind.mul(1.2)));
      material.positionNode = positionLocal.add(vec3(gust.mul(weight), 0, gust.mul(weight).mul(.6)));
      material.name = 'pal_wind-foliage'; this.cache.set(key, material);
    }
    return material;
  }
  uniqueWorld(token: PaletteToken, vertexColors = false): PaletteMaterial {
    const base = this.sample(uniform(paletteTokens.indexOf(token))).mul(vertexColors ? attribute('color', 'vec3') : 1);
    const material = new PaletteMaterial(token, this.texture, this.lighting, 0, undefined, false, { base });
    material.color.set(palette[token]); this.owned.push(material); return material;
  }
  unique(token: PaletteToken, emissive = 0, transparent = false): PaletteMaterial {
    const material = new PaletteMaterial(token, this.texture, this.lighting, emissive);
    material.transparent = transparent; this.owned.push(material); return material;
  }
  dispose(): void {
    for (const material of this.cache.values()) material.dispose();
    for (const material of this.owned) material.dispose();
    this.cache.clear(); this.nearestCache.clear(); this.owned.length = 0; this.texture.dispose();
  }
}
