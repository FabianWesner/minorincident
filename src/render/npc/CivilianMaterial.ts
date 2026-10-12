import { crowdAppearanceColor, crowdSkinColor, crowdHeadwearVisibility } from '../characters/CrowdAppearance';
import { DoubleSide, FrontSide, MeshLambertNodeMaterial, type DataTexture } from 'three/webgpu';
import { attribute, mat4, mix, normalGeometry, positionGeometry, vec3, vec4, cameraViewMatrix, luminance, time, sin, cos, texture } from 'three/tsl';
import { crowdBlendedMatrix } from '../../assets/crowd';
import type { Materials } from '../Materials';

type Entry = { material: MeshLambertNodeMaterial; pose: ReturnType<typeof texture>; uses: number };
const caches = new WeakMap<Materials, Map<string, Entry>>();
/** One graph per side/hand layout. Each draw binds its own immutable geometry,
 * current pose texture, transforms, tint and infection attributes. */
export function civilianMaterial(shading: Materials | undefined, doubleSided: boolean, handIndex: number, initialTexture: DataTexture) {
  let cache = shading && caches.get(shading);
  if (!cache) { cache = new Map(); if (shading) caches.set(shading, cache); }
  const key = `${doubleSided}:${handIndex}`;
  let entry = cache.get(key);
  if (!entry) {
    const pose = texture(initialTexture);
    const parts = attribute('_parts', 'vec4'), variant = attribute('_variant', 'vec4');
    // overlay.y >= 2 flags a pedestrian who is turning (eye glow = y - 2); y in 0..1 is the plain eye glow.
    const overlay = attribute('_overlay', 'vec4'), grip = overlay.z.lessThan(0).select(1, 0), dirt = overlay.z.max(0), turning = overlay.y.greaterThan(1.5).select(1, 0), eyeGlow = overlay.y.sub(turning.mul(2)), eye = parts.z, mark = parts.w.mod(4), vein = mark.equal(1).select(1, 0), blood = mark.equal(2).select(1, 0), socket = mark.equal(3).select(1, 0), decay = overlay.x;
    // parts.y > 0: tinted garment, value = the shade's brightness relative to the main garment colour.
    const clothing = crowdAppearanceColor();
    // Same clothes and body: only the skin blends toward ash-green, blood darkens mouth and bite, eyes ignite.
    // Skin only: drained grey-green (desaturated, darker), at up to 70 % for the 40 % sim blend so it reads at distance.
    // QA1-10: the infected must read at the default zoom - clearly ash-green skin (full shift at the 40 % sim blend),
    // dark sockets, grimy clothes (same colours, 25 % darker) and blood; hair, clothes and body stay the person's own.
    const sick = mix(vec3(luminance(clothing)).mul(.6), crowdSkinColor(true), .8), skinShift = parts.y.equal(-1).select(decay.mul(2.5).min(1), 0);
    const sunken = mix(sick, vec3(.18, .02, .03), socket.mul(.9));
    const grimy = clothing.mul(dirt.mul(-.42).add(1));
    const skin = mix(grimy, sunken, skinShift);
    const bloody = mix(skin, vec3(.36, .02, .03), blood.mul(dirt).mul(.9));
    const base = mix(bloody, mix(vec3(.02), vec3(1, .015, .025), eyeGlow), eye);
    const eyeColor = vec3(1, .005, .02);
    // Red glowing eyes in dark sockets. Kept below the bloom whiteout point: the emissive is a pure red (no luminance
    // normalisation, which pushed it to ~14x and bloomed the whole head white) at a capped strength.
    // The sockets glow a dim red around the eyes so the read survives 10-15 m, still far below the bloom whiteout.
    // A faint ash-green self-glow on infected skin so the colour shift survives building shadow (far below bloom).
    // E19-AC23: while turning, a sickly ash-green pulse throbs on the skin only (hair and clothes keep the person's own
    // colours, so it stays recognisably the same person); it reads at the game camera even when the body is down.
    const pulse = sin(time.mul(7.5).add(variant.x.mod(2).mul(9))).mul(.5).add(.5);
    const glow = eyeColor.mul(eye.mul(2.2).add(socket.mul(.75))).mul(eyeGlow).add(vec3(.05, .1, .03).mul(skinShift).mul(dirt))
      .add(vec3(.22, .4, .08).mul(turning).mul(pulse.mul(.7).add(.3)).mul(parts.y.equal(-1).select(1, 0)));
    const material = shading?.shaded(base, glow) ?? Object.assign(new MeshLambertNodeMaterial(), { colorNode: base, emissiveNode: glow });
    // E25 night readability: crowd silhouettes take the preset's moonlit rim.
    if ('figureRim' in material) material.figureRim.value = 1;
    material.side = doubleSided ? DoubleSide : FrontSide;
    const instance = mat4(attribute('_crowd0', 'vec4'), attribute('_crowd1', 'vec4'), attribute('_crowd2', 'vec4'), attribute('_crowd3', 'vec4')), part = parts.x;
    const outgoing = variant.w.div(2).floor(), weight = variant.w.mod(2);
    const matrix = crowdBlendedMatrix(pose, part, overlay.w, outgoing, weight);
    material.positionNode = instance.mul(matrix.mul(vec4(mix(positionGeometry, attribute('_gripPosition', 'vec3'), grip).mul(crowdHeadwearVisibility()).mul(vein.greaterThan(.5).select(decay.greaterThan(.25).select(1, 0), 1)), 1))).xyz;
    const finger = part.equal(handIndex).and(parts.y.equal(-1)).and(positionGeometry.y.lessThan(-.045)).and(positionGeometry.y.greaterThan(-.2));
    const curl = positionGeometry.y.negate().sub(.045).div(.035).clamp(0, Math.PI).mul(finger.select(grip, 0));
    const bentNormal = vec3(normalGeometry.x.mul(cos(curl)).sub(normalGeometry.y.mul(sin(curl))), normalGeometry.x.mul(sin(curl)).add(normalGeometry.y.mul(cos(curl))), normalGeometry.z);
    material.normalNode = instance.mul(matrix.mul(vec4(bentNormal, 0))).xyz.transformDirection(cameraViewMatrix);
    entry = { material, pose, uses: 0 }; cache.set(key, entry);
  }
  const owned = entry; owned.uses++; let released = false;
  return { material: owned.material,
    bindTexture: (value: DataTexture) => { owned.pose.value = value; },
    release: () => { if (released) return; released = true; if (--owned.uses === 0) { cache!.delete(key); owned.material.dispose(); } },
  };
}
