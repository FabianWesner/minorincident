import { paintedSkinMask } from '../characters/paintedSkin';
import { crowdRegionOf, crowdRegionSkin, crowdRegionTint } from '../characters/crowdRegions';
import { crowdAppearanceColor, crowdSkinColor, crowdHeadwearVisibility, crowdCoveredScalpColor } from '../characters/CrowdAppearance';
import { type Node, DoubleSide, FrontSide, MeshLambertNodeMaterial, type DataTexture, type Texture } from 'three/webgpu';
import { attribute, mat4, mix, normalGeometry, positionGeometry, vec3, vec4, cameraViewMatrix, luminance, time, sin, cos, texture as sampleTexture, varying, float } from 'three/tsl';
import { crowdBlendedMatrix, poseTexture } from '../../assets/crowd';
import { skinnedCrowdMatrix } from '../characters/skinnedCrowd';
import type { Materials } from '../Materials';

type Entry = { material: MeshLambertNodeMaterial; pose: ReturnType<typeof poseTexture>; atlas?: ReturnType<typeof sampleTexture>; uses: number };
const caches = new WeakMap<Materials, Map<string, Entry>>();
/** One graph per side/hand layout. Each draw binds its own immutable geometry,
 * current pose texture, transforms, tint and infection attributes. */
export function civilianMaterial(shading: Materials | undefined, doubleSided: boolean, handIndex: number, initialTexture: DataTexture, options: { bindRow: number; skinned: boolean; atlas?: Texture; toyEyes?: boolean } = { bindRow: 0, skinned: false }) {
  let cache = shading && caches.get(shading);
  if (!cache) { cache = new Map(); if (shading) caches.set(shading, cache); }
  const key = `${doubleSided}:${handIndex}:${options.skinned}:${options.bindRow}:${!!options.atlas}:${!!options.toyEyes}`;
  let entry = cache.get(key);
  if (!entry) {
    const pose = poseTexture(initialTexture);
    const parts = attribute('_parts', 'vec4'), variant = attribute('_variant', 'vec4');
    // overlay.y >= 2 flags a pedestrian who is turning (eye glow = y - 2); y in 0..1 is the plain eye glow.
    const overlay = attribute('_overlay', 'vec4'), grip = overlay.z.lessThan(0).select(1, 0), dirt = overlay.z.max(0), turning = overlay.y.greaterThan(1.5).select(1, 0), eyeGlow = overlay.y.sub(turning.mul(2)), eye = parts.z.min(1), mark = options.skinned ? float(0) : parts.w.mod(4), vein = mark.equal(1).select(1, 0), blood = mark.equal(2).select(1, 0), socket = mark.equal(3).select(1, 0), decay = overlay.x;
    // parts.y > 0: tinted garment, value = the shade's brightness relative to the main garment colour.
    const atlas = options.atlas ? sampleTexture(options.atlas, attribute('uv', 'vec2')) : undefined;
    const covered = variant.x.div(512).floor().mod(2).equal(1), scalp = options.skinned ? varying(parts.x.equal(3).and(parts.z.lessThan(.5)).and(parts.y.notEqual(-6)).and(parts.w.lessThan(4)).select(parts.w.div(3).mul(covered.select(1, 0)), 0), 'coveredScalp') : float(0);
    // crowd-texture-quality: classed atlas regions take the person's tones (as the rigid crowd did), shading kept.
    const region = atlas ? crowdRegionOf(atlas, attribute('uv', 'vec2')) : undefined;
    const authoredClothing = atlas ? mix(crowdAppearanceColor(), crowdRegionTint(atlas.rgb, region!), parts.y.equal(-4).or(parts.y.equal(-5)).or(parts.y.lessThanEqual(-10)).select(0, 1)) : crowdAppearanceColor();
    const clothing = options.skinned ? mix(authoredClothing, crowdCoveredScalpColor().mul(.8), scalp) : authoredClothing;
    // Eye discs sample the atlas at their own disc UVs; their texel class is meaningless, so they never count as skin.
    // Same clothes and body: only the skin blends toward ash-green, blood darkens mouth and bite, eyes ignite.
    // Skin only: drained grey-green (desaturated, darker), at up to 70 % for the 40 % sim blend so it reads at distance.
    // QA1-10: the infected must read at the default zoom - clearly ash-green skin (full shift at the 40 % sim blend),
    // dark sockets, grimy clothes (same colours, 25 % darker) and blood; hair, clothes and body stay the person's own.
    const skinMask = options.skinned && atlas ? parts.y.equal(-11).select(1, crowdRegionSkin(region!, () => paintedSkinMask(atlas)).mul(scalp.oneMinus()).mul(parts.z.lessThan(1.5).select(1, 0))) : parts.y.equal(-1).select(1, 0);
    const sick = mix(vec3(luminance(clothing)).mul(.6), options.atlas ? vec3(.42, .49, .35).mul(luminance(clothing).max(.2)) : crowdSkinColor(true), .8), skinShift = skinMask.mul(decay.mul(2.5).min(1));
    const sunken = mix(sick, vec3(.18, .02, .03), socket.mul(.9));
    const grimy = parts.y.lessThan(-3).select(clothing, clothing.mul(dirt.mul(-.42).add(1)));
    const skin = mix(grimy, sunken, skinShift);
    const bloody = mix(skin, vec3(.36, .02, .03), blood.mul(dirt).mul(.9));
    const glowing = mix(bloody, options.skinned ? vec3(0) : mix(vec3(.02), vec3(1, .015, .025), eyeGlow), options.atlas ? eye.mul(eyeGlow) : eye);
    // crowd-texture-quality: spectacled faces show their fitted eye discs as the toy eyes of the rigid crowd (white,
    // dark pupil): their small painted eyes vanish behind painted frames at game size, worst on darker skin tones.
    const discUV = attribute('uv', 'vec2').sub(.5).mul(2).length();
    const base = options.atlas && options.toyEyes ? mix(glowing, discUV.lessThan(.62).select(vec3(.015), vec3(.85)), parts.z.greaterThan(1.5).and(eyeGlow.lessThan(.01)).select(1, 0)) : glowing;
    const eyeColor = options.skinned ? vec3(1, .04373, .02843) : vec3(1, .25 / 3, .22 / 3);
    const eyeStrength = options.skinned ? attribute('uv', 'vec2').sub(.5).mul(2).length().smoothstep(1, .55).mul(3).add(3) : float(3);
    // Red glowing eyes in dark sockets. Kept below the bloom whiteout point: the emissive is a pure red (no luminance
    // normalisation, which pushed it to ~14x and bloomed the whole head white) at a capped strength.
    // The sockets glow a dim red around the eyes so the read survives 10-15 m, still far below the bloom whiteout.
    // A faint ash-green self-glow on infected skin so the colour shift survives building shadow (far below bloom).
    // E19-AC23: while turning, a sickly ash-green pulse throbs on the skin only (hair and clothes keep the person's own
    // colours, so it stays recognisably the same person); it reads at the game camera even when the body is down.
    const pulse = sin(time.mul(7.5).add(variant.x.mod(2).mul(9))).mul(.5).add(.5);
    const glow = eyeColor.mul(eye.mul(eyeStrength).add(socket.mul(.75))).mul(eyeGlow).add(vec3(.05, .1, .03).mul(skinShift).mul(dirt))
      .add(vec3(.22, .4, .08).mul(turning).mul(pulse.mul(.7).add(.3)).mul(skinMask));
    const material = shading?.shaded(base, glow, undefined, undefined, undefined, eye.mul(eyeGlow), undefined, undefined, eyeGlow.clamp(0, 1)) ?? Object.assign(new MeshLambertNodeMaterial(), { colorNode: base, emissiveNode: glow });
    // E25 night readability: crowd silhouettes take the preset's moonlit rim.
    if ('figureRim' in material) { material.figureRim.value = .25; material.figureFill.value = 1; }
    material.side = doubleSided ? DoubleSide : FrontSide;
    const instance = mat4(attribute('_crowd0', 'vec4'), attribute('_crowd1', 'vec4'), attribute('_crowd2', 'vec4'), attribute('_crowd3', 'vec4')), part = parts.x;
    const outgoing = variant.w.div(2).floor(), weight = variant.w.mod(2);
    const matrix = options.skinned ? skinnedCrowdMatrix(pose, part, overlay.w, outgoing, weight, options.bindRow) : crowdBlendedMatrix(pose, part, overlay.w, outgoing, weight);
    const alternate = options.skinned ? parts.x.equal(3).select(covered.select(1, 0), grip) : grip;
    const position = mix(positionGeometry, attribute('_gripPosition', 'vec3'), alternate);
    // A skinned vertex is in world bind space. Collapsing hidden crown vertices
    // to zero stretches its seam down to the body origin; discard the surface instead.
    material.positionNode = instance.mul(matrix.mul(vec4(options.skinned ? position : position.mul(crowdHeadwearVisibility()).mul(vein.greaterThan(.5).select(decay.greaterThan(.25).select(1, 0), 1)), 1))).xyz;
    const finger = part.equal(handIndex).and(parts.y.equal(-1)).and(positionGeometry.y.lessThan(-.045)).and(positionGeometry.y.greaterThan(-.2));
    const curl = positionGeometry.y.negate().sub(.045).div(.035).clamp(0, Math.PI).mul(finger.select(grip, 0));
    const bentNormal = vec3(normalGeometry.x.mul(cos(curl)).sub(normalGeometry.y.mul(sin(curl))), normalGeometry.x.mul(sin(curl)).add(normalGeometry.y.mul(cos(curl))), normalGeometry.z);
    const normal = instance.mul(matrix.mul(vec4(options.skinned ? normalGeometry : bentNormal, 0))).xyz.transformDirection(cameraViewMatrix);
    material.normalNode = options.skinned ? varying(normal, 'civilianSkinNormal') : normal;
    if (options.atlas) {
      const eyeDisc = parts.z.greaterThan(1.5), radius = attribute('uv', 'vec2').sub(.5).mul(2).length();
      material.maskNode = eyeDisc.not().or(options.toyEyes ? radius.lessThanEqual(1) : eyeGlow.greaterThan(.01).and(radius.lessThanEqual(1)));
      material.userData.frozenSurfaceMask = eyeDisc.not();
    }
    if (options.skinned) {
      const visible = parts.w.lessThan(1024).and(crowdHeadwearVisibility().greaterThan(.5)).and(vein.lessThan(.5).or(decay.greaterThan(.25)));
      material.maskNode = material.maskNode ? (material.maskNode as Node<'bool'>).and(visible) : visible;
    }
    entry = { material, pose, atlas, uses: 0 }; cache.set(key, entry);
  }
  const owned = entry; owned.uses++; let released = false;
  return { material: owned.material,
    bindTexture: (value: DataTexture, atlas: Texture | undefined = options.atlas) => { owned.pose.value = value; if (owned.atlas && atlas) owned.atlas.value = atlas; },
    release: () => { if (released) return; released = true; if (--owned.uses === 0) { cache!.delete(key); owned.material.dispose(); } },
  };
}
