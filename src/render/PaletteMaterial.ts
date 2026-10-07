// Adapted from Bruno Simon folio-2025 Materials/MeshDefaultMaterial.js (MIT).
import { MeshLambertNodeMaterial, type Texture, type Node, type Color } from 'three/webgpu';
import { Fn, Discard, attribute, float, max, vec3, mix, normalWorld, normalView, positionWorld, texture, uniform, vec2, vec4, luminance, rangeFogFactor, positionGeometry, color, positionViewDirection } from 'three/tsl';
import { paletteTokens, type PaletteToken } from '../data/palette';
import type { Lighting } from './Lighting';
import { surfaceDetail } from './SurfaceDetail';
import { seeThroughKeep } from './SeeThrough';

/** Palette-sampled Lambert node material with Bruno's captured drop-shadow, core shade and terrain bounce. */
export class PaletteMaterial extends MeshLambertNodeMaterial {
  readonly fade = uniform(1);
  /** Accumulated blood amount controls broad surface splats, not a fragment probability. */
  readonly bloodCoverage = uniform(0);
  /** Render-only emissive hit pulse. */
  readonly hitFlash = uniform(0);
  /** E25 night readability: 1 on crowd figures (infected/civilians) for a moonlit silhouette rim. */
  readonly figureRim = uniform(0);
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
      // E25 light field: practical pools (lamps, windows, headlights, fires) light ground, walls and figures.
      // At night the moon/hero shadow map also darkens the pools behind casters (fieldShadow).
      // Inside a hero shadow the pool keeps a dim bounce in the shadow tint (specs/06 §4: colored, never black).
      const pool = lighting.field.sample().mul(normalWorld.y.mul(.35).add(.65));
      const shadowedPool = mix(vec3(luminance(pool)).mul(lighting.shadowHue).mul(.3), pool, caughtShadow);
      const field = mix(pool, shadowedPool, lighting.fieldShadow);
      // Night rim: the survivor (a world-space capsule around the feet) and flagged crowd figures.
      const fresnel = normalView.dot(positionViewDirection).clamp(0, 1).oneMinus().smoothstep(.62, .95);
      const heroMask = positionWorld.xz.sub(lighting.hero.xz).length().smoothstep(1.3, .6).mul(positionWorld.y.sub(lighting.hero.y).smoothstep(.1, .3));
      const rim = lighting.rimColor.mul(fresnel.mul(max(heroMask, this.figureRim)).mul(lighting.rim));
      // The survivor's own aura fill (readability rule): lifts the hero, not the ground ring around it.
      const fill = lighting.heroFillColor.mul(heroMask.mul(lighting.heroFill).mul(normalWorld.y.mul(.3).add(.7)));
      const shaded = mix(lit, surface.mul(lighting.shadow), shadow).add(surface.mul(field.add(fill))).add(rim);
      const controlled = mix(luminance(shaded), shaded, lighting.look.nodes.saturation);
      const output = emissive > 0 ? base.div(luminance(base).max(0.001)).mul(emissive) : mix(controlled.add(nodes?.glow ?? 0), lighting.radialFog, rangeFogFactor(lighting.fogNear, lighting.fogFar));
      return vec4(output.add(this.hitFlash), this.fade.mul(nodes?.opacity ?? 1));
    })();
    // Fog is applied above; avoid a second neutral scene-fog blend.
    this.fog = false;
  }
  /** Opt this (world) material into the shared dithered player see-through hole. Idempotent; the
   * shadow pass uses its own override material, so cast shadows stay whole. */
  seeThrough(): this {
    if (this.userData.seeThrough) return this;
    const output = this.outputNode!;
    this.outputNode = Fn(() => { Discard(seeThroughKeep().not()); return output; })();
    this.userData.seeThrough = true; this.needsUpdate = true; return this;
  }
}
