// Adapted from Bruno Simon folio-2025 Materials/MeshDefaultMaterial.js (MIT).
import { weatherSurface, trackMask, weatherMaterialFlags } from './WeatherView';
import { MeshLambertNodeMaterial, NodeUpdateType, type Texture, type Node, type Color } from 'three/webgpu';
import { sharedUniformGroup, Fn, If, Discard, attribute, float, max, vec3, mix, normalWorld, normalView, positionWorld, texture, uniform, vec2, vec4, luminance, rangeFogFactor, positionGeometry, color, positionViewDirection, cameraPosition, reflect } from 'three/tsl';
import { paletteTokens, type PaletteToken } from '../data/palette';
import type { Lighting } from './Lighting';
import { surfaceDetail } from './SurfaceDetail';
import { seeThroughKeep, seeThroughKeepBoss } from './SeeThrough';
import { hashArray, hashString } from 'three/src/nodes/core/NodeUtils.js';

/** Palette-sampled Lambert node material with Bruno's captured drop-shadow, core shade and terrain bounce. */
export class PaletteMaterial extends MeshLambertNodeMaterial {
  // Material-local values are identical across its meshes during one render.
  // Keep them separate from the global lighting group and per-object matrices.
  private readonly _uniformGroup = sharedUniformGroup('palette', 0, NodeUpdateType.RENDER);
  readonly fade = uniform(1).setGroup(this._uniformGroup);
  readonly emissivePower = uniform(1).setGroup(this._uniformGroup);
  /** Accumulated blood amount controls broad surface splats, not a fragment probability. */
  readonly bloodCoverage = uniform(0).setGroup(this._uniformGroup);
  /** Render-only emissive hit pulse. */
  readonly hitFlash = uniform(0).setGroup(this._uniformGroup);
  /** E27 burned variant: 0 = authored surface, 1 = charred soot (exploded cars). */
  readonly char = uniform(0).setGroup(this._uniformGroup);
  /** E25 silhouette rim strength: restrained on crowds, full on the driven hero vehicle. */
  readonly figureRim = uniform(0).setGroup(this._uniformGroup);
  /** Moon bounce on crowd clothing, independent of the driven vehicle's hero rim. */
  readonly figureFill = uniform(0).setGroup(this._uniformGroup);
  /** Moving figures shed ash; snow still accumulates as on the rest of the world. */
  readonly movingFigure = uniform(0).setGroup(this._uniformGroup);
  // NodeMaterial.copy skips underscored internals; frozen copies need their own cache.
  private readonly _outputs = new Map<number, Node>();
  private readonly _propertyHashes = new Map<string, number>();
  private readonly _programValues: number[] = [];
  private outputFor: (mode: number) => Node;
  private readonly newCopy: () => PaletteMaterial;
  private weatherMode = -1;
  constructor(readonly token: PaletteToken, palette: Texture, lighting: Lighting, emissive = 0, swatch?: Color, vertexSwatches = false, nodes?: { base: Node<'vec3'>; /** 1 where a merged batch draws asphalt (palette attribute): the night road lift applies there. */ road?: Node<'float'>; glow?: Node<'vec3'>; opacity?: Node<'float'>; surface?: Node<'float'>; interior?: Node<'float'> }) {
    super(); this.newCopy = () => new PaletteMaterial(token, palette, lighting, emissive, swatch, vertexSwatches, nodes); this.name = `${emissive ? 'emi' : 'pal'}_${token}`;
    this.normalNode = normalView;
    // The swatch is data: palette colors share shader source instead of embedding
    // a different texture coordinate literal in every fragment program.
    const original = nodes?.base ?? (vertexSwatches ? attribute('color', 'vec3') : swatch ? uniform(swatch).setGroup(this._uniformGroup).rgb : texture(palette, vec2(uniform((paletteTokens.indexOf(token) + 0.5) / (paletteTokens.length * 2)).setGroup(this._uniformGroup), 0.5)).rgb);
    const base = !swatch && !vertexSwatches && !nodes && !emissive ? surfaceDetail(token, original, lighting.look.nodes) : original;
    const caughtShadow = float(1).toVar();
    this.receivedShadowNode = Fn(([shadow]: [Node<'vec3'>]) => { caughtShadow.mulAssign(shadow.r); return float(1); }) as unknown as NonNullable<MeshLambertNodeMaterial['receivedShadowNode']>;
    this.outputFor = mode => Fn(() => {
      const flags = weatherMaterialFlags, probe = mode >> flags.probeShift;
      // Diagnostics use their own graph, rather than adding mask samplers to game shaders.
      if (probe) {
        const snow = weatherSurface.accumulation.mul(normalWorld.y.smoothstep(.5, .75)).mul(trackMask().oneMinus());
        const wet = weatherSurface.wetness.greaterThan(.3).select(weatherSurface.wetness, 0).mul(normalWorld.y.max(0));
        const mask = probe === 1 ? normalWorld.y.greaterThan(.5).select(vec3(1), vec3(0)) : probe === 2 ? vec3(snow) : probe === 3 ? vec3(wet) : vec3(trackMask());
        return vec4(mask, this.fade.mul(nodes?.opacity ?? 1));
      }
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
      // Build only the active surface sections; continuous strengths remain uniforms.
      const snow = float(0).toVar(), weatherBase = base.toVar(), puddle = float(0).toVar();
      if (mode & flags.accumulation) If(weatherSurface.accumulation.greaterThan(0), () => {
        const coating = weatherSurface.accumulation;
        snow.assign(mix(coating, coating.min(.03), weatherSurface.ash.mul(this.movingFigure)).mul(normalWorld.y.smoothstep(.5, .75)).mul(trackMask().oneMinus()));
        weatherBase.assign(mix(base, mix(color('#9da7b4'), color('#bcb9b5'), weatherSurface.ash), snow));
      });
      if (mode & flags.clouds) weatherBase.mulAssign(weatherSurface.clouds.mul(-.12).add(1));
      if (mode & flags.wet) If(weatherSurface.wetness.greaterThan(.3), () => {
        const pattern = positionWorld.x.mul(.65).sin().mul(positionWorld.z.mul(.5).sin()).mul(.5).add(.5);
        puddle.assign(pattern.smoothstep(weatherSurface.wetness.oneMinus(), weatherSurface.wetness.oneMinus().add(.15)).mul(normalWorld.y.max(0).pow(8)).mul(weatherSurface.wetness.smoothstep(.3, .4)));
        weatherBase.assign(mix(weatherBase, weatherBase.mul(.78), puddle));
      });
      const surface = mix(mix(weatherBase, color('#b3121f'), blood), color('#1d1a18'), this.char);
      const albedo = mix(surface, lighting.bounce, bounce);
      const ambient = mix(lighting.groundAmbient, lighting.skyAmbient, normalWorld.y.mul(0.5).add(0.5)).mul(lighting.look.nodes.ambientStrength).mul(lighting.look.nodes.hemisphereIntensity.mul(2));
      const lit = albedo.mul(lighting.color.rgb.add(ambient)).mul(lighting.intensity);
      // E25 light field: practical pools (lamps, windows, headlights, fires) light ground, walls and figures.
      // At night the moon/hero shadow map also darkens the pools behind casters (fieldShadow).
      // Inside a hero shadow the pool keeps a dim bounce in the shadow tint (specs/06 §4: colored, never black).
      const field = vec3(0).toVar();
      if (mode & flags.field) {
        const pool = lighting.field.sample().mul(normalWorld.y.mul(.35).add(.65));
        const shadowedPool = mix(vec3(luminance(pool)).mul(lighting.shadowHue).mul(.3), pool, caughtShadow);
        field.assign(mix(pool, shadowedPool, lighting.fieldShadow));
      }
      // Night rim: the survivor (a world-space capsule around the feet) and flagged crowd figures.
      const fresnel = normalView.dot(positionViewDirection).clamp(0, 1).oneMinus().smoothstep(.62, .95);
      const heroMask = float(0).toVar();
      if (mode & (flags.hero | flags.fog)) {
        heroMask.assign(positionWorld.xz.sub(lighting.hero.xz).length().smoothstep(1.3, .6).mul(positionWorld.y.sub(lighting.hero.y).smoothstep(.1, .3)));
      }
      const rim = lighting.rimColor.mul(fresnel.mul(max(heroMask, this.figureRim)).mul(lighting.rim));
      // The survivor's own aura fill (readability rule): lifts the hero, not the ground ring around it.
      const fill = lighting.heroFillColor.mul(heroMask.mul(lighting.heroFill).mul(normalWorld.y.mul(.3).add(.7)));
      // A narrow Fresnel alone turns dark clothing into disconnected pale seams.
      // Moon bounce carries the whole crowd surface; a restrained rim keeps its outline.
      const figureFill = lighting.rimColor.mul(this.figureFill).mul(lighting.rim).mul(.9);
      const shaded = mix(lit, surface.mul(lighting.shadow), shadow).add(surface.mul(field.add(fill).add(figureFill))).add(rim).toVar();
      // Night route read (E31-AC16): asphalt keeps a moon-pale sheen that no shadow removes, so the road is a pale band between dark verges.
      const road = nodes?.road ?? (token === 'asphalt' && !emissive ? float(1) : undefined);
      // Strongest around the camera focus (the survivor, or the vehicle being driven: the route ahead reads), easing to 40 % towards the screen edge so the night stays dark.
      if (road) shaded.addAssign(surface.mul(lighting.roadLiftColor).mul(lighting.roadLift).mul(road).mul(positionWorld.xz.sub(lighting.roadFocus.xz).length().smoothstep(46, 14).mul(.6).add(.4)));
      // Dense fog keeps E28's visibility fill; daylight haze/ash (L3: .25–.4) must retain dark colours.
      if (mode & flags.fog) shaded.addAssign(surface.mul(.7).add(vec3(.18, .16, .14)).mul(heroMask).mul(weatherSurface.fog).mul(weatherSurface.fog.smoothstep(.4, .8)));
      if (nodes?.surface) If(nodes.surface.greaterThan(0), () => {
        const view = cameraPosition.sub(positionWorld).normalize(), reflected = reflect(view.negate(), normalWorld);
        const metal = nodes.surface!.greaterThan(1.5).select(1, 0);
        const environment = lighting.environmentNode.context({ getUV: () => reflected, getTextureLevel: () => float(.2) });
        const half = view.add(lighting.direction).normalize();
        const highlight = normalWorld.dot(half).max(0).pow(70).mul(lighting.intensity).mul(.8);
        shaded.assign(mix(shaded, environment.rgb.mul(mix(vec3(1), surface, metal)), metal.mul(.75).add(.18)).add(highlight));
      });
      const controlled = mix(luminance(shaded), shaded, lighting.look.nodes.saturation);
      const output = emissive > 0 ? base.div(luminance(base).max(0.001)).mul(emissive).mul(this.emissivePower) : mix(controlled.add(nodes?.glow ? nodes.glow.mul(this.emissivePower) : 0), lighting.radialFog, rangeFogFactor(lighting.fogNear, lighting.fogFar));
      const result = output.toVar();
      if (mode & flags.flash) result.addAssign(weatherSurface.flash);
      if (mode & flags.wet) If(weatherSurface.wetness.greaterThan(.3), () => {
        const wet = weatherSurface.wetness.mul(normalWorld.y.max(0));
        const streak = positionWorld.x.mul(4.1).add(positionWorld.z.mul(.7).sin().mul(1.8)).sin().abs().pow(12).mul(positionWorld.z.mul(1.3).sin().mul(.3).add(.7)).mul(wet).mul(puddle).mul(field).mul(.2).clamp(0, .08);
        result.addAssign(streak);
      });
      if (mode & flags.fog) {
        const mask = weatherSurface.fog.mul(positionWorld.y.negate().add(3).div(3).clamp(0, 1)).mul(positionWorld.xz.sub(lighting.hero.xz).length().smoothstep(2, 18)).clamp(0, .7);
        result.assign(mix(result, lighting.radialFog.add(field.mul(.2)), mask));
      }
      if (!emissive) {
        const offset = positionWorld.xz.sub(lighting.hero.xz), reach = offset.length();
        const facing = offset.dot(lighting.headlampAim).div(reach.max(.01));
        const cone = facing.smoothstep(.78, .92).mul(reach.smoothstep(18, 14)).mul(lighting.headlampOn);
        const courierGlow = reach.smoothstep(2.4, .8);
        // Preserve small coloured practical pools and emissive infected eyes.
        const accent = max(luminance(field).smoothstep(.15, .8), nodes?.glow ? luminance(nodes.glow).mul(this.emissivePower).smoothstep(.05, .15) : float(0));
        const colour = max(max(cone, courierGlow), accent);
        const dark = mix(vec3(luminance(result)).mul(.38).add(.006), result, colour);
        result.assign(mix(result, dark, lighting.subwayDarkness));
      }
      result.addAssign(this.hitFlash);
      return vec4(result, this.fade.mul(nodes?.opacity ?? 1));
    })();
    lighting.paletteMaterials.add(this);
    this.addEventListener('dispose', () => lighting.paletteMaterials.delete(this));
    this.setWeatherMode(lighting.weatherMode);
    // Fog is applied above; avoid a second neutral scene-fog blend.
    this.fog = false;
  }
  /** Frozen geometry keeps the source shading uniforms and follows future weather changes. */
  frozenCopy(): PaletteMaterial {
    const copy = this.newCopy(); copy.copy(this); copy.outputFor = this.outputFor;
    copy._outputs.clear(); copy.weatherMode = -1; copy.setWeatherMode(this.weatherMode);
    return copy;
  }
  /** Same key as NodeMaterial, without allocating a child record and hashing
   * its property name on every submitted mesh. Re-read every node/key so graph
   * replacement and node-version changes still invalidate the pipeline. */
  override customProgramCacheKey(): string {
    const values = this._programValues; values.length = 0;
    for (const property of Object.getOwnPropertyNames(this)) {
      if (property.startsWith('_')) continue;
      const child = (this as unknown as Record<string, { isNode?: boolean; getCacheKey(): number } | null>)[property];
      if (child?.isNode !== true) continue;
      let name = this._propertyHashes.get(property);
      if (name === undefined) { name = hashString(property.slice(0, -4)); this._propertyHashes.set(property, name); }
      values.push(name, child.getCacheKey());
    }
    return this.type + hashArray(values);
  }
  setWeatherMode(mode: number): void {
    if (mode === this.weatherMode) return;
    this.weatherMode = mode;
    let output = this._outputs.get(mode);
    if (!output) {
      const base = this.outputFor(mode);
      output = this.userData.seeThrough ? Fn(() => { Discard((this.userData.seeThrough === 'boss' ? seeThroughKeepBoss() : seeThroughKeep(this.userData.seeThrough === 'placement' ? attribute('_occluder', 'float') : undefined)).not()); return base; })() : base;
      this._outputs.set(mode, output);
    }
    this.outputNode = output; this.needsUpdate = true;
  }
  /** Keep the see-through wrapper on every weather graph; shadow casters remain whole. */
  seeThrough(enabled: boolean | 'boss' | 'placement' = true): this {
    if ((this.userData.seeThrough ?? false) === enabled) return this;
    this.userData.seeThrough = enabled; this._outputs.clear();
    const mode = this.weatherMode; this.weatherMode = -1; this.setWeatherMode(mode);
    return this;
  }
}
