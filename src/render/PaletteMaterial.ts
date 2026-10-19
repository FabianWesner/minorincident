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
  /** Only courier meshes receive the continuous survivor surface fill. */
  readonly heroFigure = uniform(0).setGroup(this._uniformGroup);
  /** Companion coat retains its identity outside the subway headlamp cone. */
  readonly companion = uniform(0).setGroup(this._uniformGroup);
  /** Moving figures shed ash; snow still accumulates as on the rest of the world. */
  readonly movingFigure = uniform(0).setGroup(this._uniformGroup);
  // NodeMaterial.copy skips underscored internals; frozen copies need their own cache.
  private readonly _outputs = new Map<number, Node>();
  private readonly _propertyHashes = new Map<string, number>();
  private readonly _programValues: number[] = [];
  private outputFor: (mode: number) => Node;
  private readonly newCopy: () => PaletteMaterial;
  private weatherMode = -1;
  constructor(readonly token: PaletteToken, palette: Texture, lighting: Lighting, emissive = 0, swatch?: Color, vertexSwatches = false, nodes?: { base: Node<'vec3'>; /** 1 where a merged batch draws asphalt (palette attribute): the night road lift applies there. */ road?: Node<'float'>; glow?: Node<'vec3'>; /** Exclude lit surface/bounce/rim on emissive eye vertices in a merged figure. */ emissiveOnly?: Node<'float'>; opacity?: Node<'float'>; surface?: Node<'float'>; interior?: Node<'float'> }) {
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
      // Atmosphere 2: drifting cloud shadows on day levels (look.cloudShadow, 0 at night) join the sun shadow term,
      // so cloud patches take the authored shadow tint. Two crossed sines: ALU only, no texture fetch.
      const look = lighting.look.nodes, cloudUv = positionWorld.xz.div(look.cloudScale).mul(6.283).add(vec2(lighting.clock.mul(look.cloudSpeed).mul(.3), lighting.clock.mul(look.cloudSpeed).mul(.18)));
      const cloudField = cloudUv.x.add(cloudUv.y.mul(.7).sin().mul(1.3)).sin().mul(cloudUv.y.mul(.9).add(cloudUv.x.mul(.6).add(1.7).sin().mul(1.1)).sin());
      const cloud = cloudField.smoothstep(0, .55).mul(look.cloudShadow);
      const shadow = max(max(core, caughtShadow.oneMinus()), cloud).clamp(0, 1).mul(lighting.look.nodes.shadowIntensity);
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
      const facing = normalView.dot(positionViewDirection).clamp(0, 1);
      const fresnel = facing.oneMinus().smoothstep(.62, .95);
      const heroMask = float(0).toVar();
      if (mode & (flags.hero | flags.fog)) {
        heroMask.assign(positionWorld.xz.sub(lighting.hero.xz).length().smoothstep(1.3, .6).mul(positionWorld.y.sub(lighting.hero.y).smoothstep(.1, .3)));
      }
      const rim = lighting.rimColor.mul(fresnel.mul(max(heroMask, this.figureRim)).mul(lighting.rim.add(lighting.heroSmokeRim.mul(this.heroFigure))));
      // The survivor's own aura fill (readability rule): lifts the hero, not the ground ring around it.
      // Preserve the established aura on other presets (including driven vehicles).
      const fillFigure = lighting.heroSurfaceFill.greaterThan(0).select(this.heroFigure, 1);
      const fill = lighting.heroFillColor.mul(heroMask.mul(fillFigure).mul(lighting.heroFill).mul(normalWorld.y.mul(.3).add(.7)));
      // A narrow Fresnel alone turns dark clothing into disconnected pale seams.
      // Moon bounce carries the whole crowd surface; a restrained rim keeps its outline.
      // Near-black jackets otherwise disappear into the night road between
      // their bright creases. Keep a continuous moonlit surface on figures,
      // including the dark swatches; ordinary world surfaces keep their albedo.
      const figureFill = surface.max(vec3(.12)).mul(lighting.rimColor).mul(this.figureFill).mul(lighting.rim).mul(.9);
      const heroSurfaceFill = surface.mul(lighting.heroFillColor).mul(this.heroFigure).mul(lighting.heroSurfaceFill).mul(normalWorld.y.mul(.3).add(.7));
      const shaded = mix(lit, surface.mul(lighting.shadow), shadow).add(surface.mul(field.add(fill))).add(heroSurfaceFill).add(figureFill).add(rim).toVar();
      // Keep identity colours in the face/clothes; the camera-sized rim carries the silhouette.
      If(this.heroFigure.greaterThan(0), () => {
        const edge = lighting.heroRimEdge;
        const band = facing.smoothstep(edge.sub(.08), edge).oneMinus();
        shaded.addAssign(surface.max(vec3(.06)).mul(lighting.rimColor).mul(band).mul(lighting.heroRim));
      });
      // Distant fire glow (look.glowAmount; 0 except L9's burning city ahead): a warm fill that grows along the authored world
      // direction, strongest on surfaces turned towards it, with a slow breathing flicker. Uniform ALU only, no pass.
      const glowDir = vec2(look.glowDirX, look.glowDirZ), glowAlong = positionWorld.xz.dot(glowDir).smoothstep(look.glowStart, look.glowEnd);
      const glowFacing = normalWorld.xz.dot(glowDir).mul(.5).add(.5).max(normalWorld.y.mul(.45));
      shaded.addAssign(surface.mul(look.glow).mul(glowAlong.mul(glowFacing).mul(look.glowAmount).mul(lighting.clock.mul(.7).sin().mul(.06).add(lighting.clock.mul(2.3).sin().mul(.03)).add(.91))));
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
      const controlled = mix(luminance(shaded), shaded, lighting.look.nodes.saturation).mul(nodes?.emissiveOnly?.oneMinus() ?? 1);
      const output = emissive > 0 ? base.div(luminance(base).max(0.001)).mul(emissive).mul(this.emissivePower) : mix(controlled.add(nodes?.glow ? nodes.glow.mul(this.emissivePower) : 0), lighting.radialFog, rangeFogFactor(lighting.fogNear, lighting.fogFar));
      const result = output.toVar();
      // Atmosphere 2: low camera-relative haze. Starts beyond the focus (the courier never hazes), thickest near the
      // ground so roofs and lamp heads stand out of it; emissive eyes/lamps skip it (threat readability).
      if (!emissive) {
        const low = positionWorld.y.div(lighting.look.nodes.hazeHeight).clamp(0, 1).oneMinus().mul(.6).add(.4);
        result.assign(mix(result, lighting.look.nodes.haze, rangeFogFactor(lighting.hazeNear, lighting.hazeFar).mul(low).mul(lighting.look.nodes.hazeAmount)));
      }
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
        const colour = max(max(max(cone, courierGlow), accent), this.companion);
        const dark = mix(vec3(luminance(result)).mul(.38).add(.006), result, colour);
        result.assign(mix(result, dark, lighting.subwayDarkness));
      }
      const graded = float(1).toVar();
      const courierRead = this.heroFigure.mul(max(lighting.heroSurfaceFill.greaterThan(0).select(1, 0), lighting.subwayDarkness));
      if (!emissive && (mode & flags.hero)) {
        // A soft contact shade separates the courier from the night road without
        // raising her highlights. Moving figures (including the corgi) keep their lighting.
        const contact = positionWorld.xz.sub(lighting.hero.xz).length().smoothstep(4.5, .6)
          .mul(normalWorld.y.smoothstep(.5, .9)).mul(this.movingFigure.oneMinus())
          .mul(lighting.heroSurfaceFill.greaterThan(0).select(1, 0));
        result.mulAssign(contact.mul(-.6).add(1));
        // The same local shade reaches the figures pressed around her (followers, corgi), so the
        // courier's own key light separates her from the crowd instead of a whitening lift.
        const crowded = positionWorld.xz.sub(lighting.hero.xz).length().smoothstep(3.4, 1.6)
          .mul(this.figureFill.greaterThan(0).select(1, 0)).mul(this.heroFigure.oneMinus())
          .mul(lighting.heroSurfaceFill.greaterThan(0).select(1, 0));
        result.mulAssign(crowded.mul(-.55).add(1));
        If(courierRead.greaterThan(0), () => {
          // Hue-preserving albedo lift: scale RGB together so HSV hue/saturation stay authored
          // (auburn hair, teal/yellow outfit, peach skin) while dark swatches climb out of the night.
          const top = max(max(surface.r, surface.g), surface.b).max(1e-4);
          // Exponential shoulder: x2.7 on dark swatches, x1 at the peak, so hair stays darker than skin.
          const lifted = surface.mul(top.min(.9).mul(-3).exp().oneMinus().mul(.92 / (1 - Math.exp(-2.7))).div(top));
          // Daylight-like key after the lift, so the form keeps its light and shade: a camera-relative
          // warm key and neutral fill, plus a little of the night light (pools, moon) so she belongs there.
          const key = normalView.dot(vec3(-.42, .62, .66)).mul(.5).add(.5);
          const keyed = lifted.mul(mix(vec3(.66, .66, .72), vec3(1, .97, .9), key.mul(key))).add(result.max(vec3(0)).mul(.2)).toVar();
          const peak = max(max(keyed.r, keyed.g), keyed.b);
          keyed.mulAssign(float(.9).div(peak.max(.9)));
          // Narrow back rim in her own (brightened) colours, warm-white biased: the outline reads at
          // every zoom without a mint/grey veil over the face and clothes.
          const band = facing.smoothstep(0, lighting.heroRimEdge.mul(.45)).oneMinus();
          const tint = mix(surface.div(max(max(surface.r, surface.g), surface.b).max(.02)), vec3(1, .9, .75), .45).mul(.9);
          result.assign(mix(keyed, tint, band.mul(lighting.heroRim.add(lighting.subwayDarkness.mul(.2)).mul(3.6)).clamp(0, .8)));
        }).Else(() => {
          // Other night presets (L5 dusk aura, practical pools): the aura and pools stack on her and the
          // survivors beside her. Scale RGB together so the brightest channel stays below clipping: the
          // hue and saturation survive instead of bleaching to white (QA #28).
          If(max(this.heroFigure, this.figureFill.greaterThan(0).select(1, 0)).greaterThan(0), () => {
            const top = max(max(result.r, result.g), result.b);
            result.mulAssign(float(.86).div(top.max(.86)));
          });
          // The warm dusk grade would lift her skin/clothes past white again; she keeps the protection mask.
          graded.assign(this.heroFigure.oneMinus());
        });
      }
      result.addAssign(this.hitFlash);
      // Opaque courier meshes use scene alpha as a grade-protection mask. The
      // composite consumes it and writes opaque canvas alpha; no extra render pass.
      return vec4(result, this.fade.mul(nodes?.opacity ?? 1).mul(courierRead.oneMinus()).mul(graded));
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
