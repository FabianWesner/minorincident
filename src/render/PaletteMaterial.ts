// Adapted from folio-2025 Materials/MeshDefaultMaterial.js by Bruno Simon (MIT), commit 41046b5.
import { MeshLambertNodeMaterial, type Texture, type Node, type Color } from 'three/webgpu';
import { Fn, attribute, float, max, mix, normalWorld, positionWorld, texture, uniform, vec2, vec4, luminance, rangeFogFactor, positionGeometry, sin, color } from 'three/tsl';
import { paletteTokens, type PaletteToken } from '../data/palette';
import type { Lighting } from './Lighting';

/** Palette-sampled Lambert node material with Bruno's captured drop-shadow, core shade and terrain bounce. */
export class PaletteMaterial extends MeshLambertNodeMaterial {
  readonly fade = uniform(1);
  /** Render-only procedural surface mask and emissive hit pulse. */
  readonly bloodCoverage = uniform(0);
  readonly hitFlash = uniform(0);
  constructor(readonly token: PaletteToken, palette: Texture, lighting: Lighting, emissive = 0, swatch?: Color, vertexSwatches = false) {
    super(); this.name = `${emissive ? 'emi' : 'pal'}_${token}`;
    this.normalNode = normalWorld;
    const base = vertexSwatches ? attribute('color', 'vec3') : swatch ? uniform(swatch) : texture(palette, vec2((paletteTokens.indexOf(token) + 0.5) / paletteTokens.length, 0.5)).rgb;
    const caughtShadow = float(1).toVar();
    this.receivedShadowNode = Fn(([shadow]: [Node<'vec3'>]) => { caughtShadow.mulAssign(shadow.r); return float(1); }) as unknown as NonNullable<MeshLambertNodeMaterial['receivedShadowNode']>;
    this.outputNode = Fn(() => {
      const core = normalWorld.dot(lighting.direction).smoothstep(0.8, -0.25);
      const shadow = max(core, caughtShadow.oneMinus()).clamp(0, 1);
      const bounce = normalWorld.y.negate().max(0).mul(positionWorld.y.max(0).div(1.5).oneMinus().max(0)).mul(0.15);
      const grain = sin(positionGeometry.x.mul(127.1).add(positionGeometry.y.mul(311.7)).add(positionGeometry.z.mul(74.7))).mul(43758.5453).fract();
      const blood = grain.lessThan(this.bloodCoverage).select(1, 0);
      const surface = mix(base, color('#b3121f'), blood);
      const albedo = mix(surface, lighting.bounce, bounce);
      const ambient = mix(lighting.groundAmbient, lighting.skyAmbient, normalWorld.y.mul(0.5).add(0.5)).mul(0.08);
      const lit = albedo.mul(lighting.color.rgb.add(ambient)).mul(lighting.intensity);
      const shaded = mix(lit, albedo.mul(lighting.shadow), shadow);
      const output = emissive > 0 ? base.div(luminance(base).max(0.001)).mul(emissive) : mix(shaded, lighting.fogColor, rangeFogFactor(lighting.fogNear, lighting.fogFar));
      return vec4(output.add(this.hitFlash), this.fade);
    })();
    this.fog = emissive === 0;
  }
}
