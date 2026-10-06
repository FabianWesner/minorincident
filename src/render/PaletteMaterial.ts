// Adapted from Bruno Simon folio-2025 Materials/MeshDefaultMaterial.js (MIT).
import { MeshLambertNodeMaterial, type Texture, type Node, type Color } from 'three/webgpu';
import { Fn, attribute, float, max, mix, normalWorld, normalView, positionWorld, texture, uniform, vec2, vec4, luminance, rangeFogFactor, positionGeometry, color } from 'three/tsl';
import { paletteTokens, type PaletteToken } from '../data/palette';
import type { Lighting } from './Lighting';
import { surfaceDetail } from './SurfaceDetail';

/** Palette-sampled Lambert node material with Bruno's captured drop-shadow, core shade and terrain bounce. */
export class PaletteMaterial extends MeshLambertNodeMaterial {
  readonly fade = uniform(1);
  /** Accumulated blood amount controls broad surface splats, not a fragment probability. */
  readonly bloodCoverage = uniform(0);
  /** Render-only emissive hit pulse. */
  readonly hitFlash = uniform(0);
  constructor(readonly token: PaletteToken, palette: Texture, lighting: Lighting, emissive = 0, swatch?: Color, vertexSwatches = false, nodes?: { base: Node<'vec3'>; glow?: Node<'vec3'>; opacity?: Node<'float'> }) {
    super(); this.name = `${emissive ? 'emi' : 'pal'}_${token}`;
    this.normalNode = normalView;
    // The swatch is data: palette colors share shader source instead of embedding
    // a different texture coordinate literal in every fragment program.
    const original = nodes?.base ?? (vertexSwatches ? attribute('color', 'vec3') : swatch ? uniform(swatch).rgb : texture(palette, vec2(uniform((paletteTokens.indexOf(token) + 0.5) / (paletteTokens.length * 2)), 0.5)).rgb);
    const base = !swatch && !vertexSwatches && !nodes && !emissive ? surfaceDetail(token, original, lighting.look.nodes) : original;
    const caughtShadow = float(1).toVar();
    this.receivedShadowNode = Fn(([shadow]: [Node<'vec3'>]) => { caughtShadow.mulAssign(shadow.r); return float(1); }) as unknown as NonNullable<MeshLambertNodeMaterial['receivedShadowNode']>;
    this.outputNode = Fn(() => {
      const core = normalWorld.dot(lighting.direction).smoothstep(lighting.coreShadowEdgeHigh, lighting.coreShadowEdgeLow);
      const shadow = max(core, caughtShadow.oneMinus()).clamp(0, 1).mul(lighting.look.nodes.shadowIntensity);
      const bounce = normalWorld.y.negate().smoothstep(-.2, 1).mul(positionWorld.y.max(0).div(2).oneMinus().max(0).pow(2)).mul(lighting.look.nodes.bounceStrength);
      // A few soft-edged splats in part-local space follow the animated surface.
      // A fragment hash here turned even one kill into pixel noise on skin/hair.
      const radius = this.bloodCoverage.clamp(0, 1).sqrt().mul(.09).add(.02);
      const splat = (y: number, z: number, size: number) => {
        const distance = positionGeometry.yz.sub(vec2(y, z)).mul(vec2(1, 1.3)).length();
        // Keep the edge at least one pixel wide as the figure turns or zooms.
        const edge = distance.fwidth().mul(1.5).max(.006);
        return distance.smoothstep(radius.mul(size), radius.mul(size).add(edge)).oneMinus();
      };
      const blood = max(max(splat(.07, .09, 1), splat(-.1, -.06, .7)), splat(-.16, .15, .5)).mul(this.bloodCoverage.greaterThan(0).select(1, 0));
      const surface = mix(base, color('#b3121f'), blood);
      const albedo = mix(surface, lighting.bounce, bounce);
      const ambient = mix(lighting.groundAmbient, lighting.skyAmbient, normalWorld.y.mul(0.5).add(0.5)).mul(lighting.look.nodes.ambientStrength).mul(lighting.look.nodes.hemisphereIntensity.mul(2));
      const lit = albedo.mul(lighting.color.rgb.add(ambient)).mul(lighting.intensity);
      const shaded = mix(lit, surface.mul(lighting.shadow), shadow);
      const controlled = mix(luminance(shaded), shaded, lighting.look.nodes.saturation);
      const output = emissive > 0 ? base.div(luminance(base).max(0.001)).mul(emissive) : mix(controlled.add(nodes?.glow ?? 0), lighting.radialFog, rangeFogFactor(lighting.fogNear, lighting.fogFar));
      return vec4(output.add(this.hitFlash), this.fade.mul(nodes?.opacity ?? 1));
    })();
    // Fog is applied above; avoid a second neutral scene-fog blend.
    this.fog = false;
  }
}
