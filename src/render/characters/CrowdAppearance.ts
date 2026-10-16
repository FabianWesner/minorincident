import { Color, type BufferGeometry, type InstancedBufferAttribute } from 'three';
import type { Node } from 'three/webgpu';
import { attribute, varying, vec3 } from 'three/tsl';
import { crowdAppearance, hairTones, skinTones, infectedSkinTones, trouserTones, shirtTones } from '../../data/crowdAppearance';
import palette from '../../assets/palette.json';
import manifest from '../../assets/manifest.json' with { type: 'json' };
const accessoryKinds = new Map((manifest as unknown as {id: string; accessory?: {slot: string}}[]).map(a => [a.id, a.accessory?.slot]));
import { infectedDefinitions } from '../../data/infected';
import type { EntitySnapshot } from '../../sim/world/types';
import { characterNodes } from '../../data/survivor';
export const crowdAccessoryIds = manifest.filter(a => a.id.startsWith('acc.') && !a.aliasOf && 'accessory' in a).map(a => a.id).sort();
/** Resolve identity without consulting pose, health, quality, LOD or pool membership. */
export function resolveCrowdAppearance(e: EntitySnapshot, ids: readonly string[] = crowdAccessoryIds) {
  const selected = e.appearance?.asset ?? e.civilian?.model ?? e.infected?.model ?? e.infected?.variant ?? e.archetype;
  const model = selected.startsWith('infected.') ? infectedDefinitions.find(def => def.id === selected)?.asset ?? selected : selected;
  const uniform = /firefighter|police|guard|hazmat|riot|armored|lab-|patient-zero|infected\.(dog|cat|crow|lion|gorilla|elephant|zebra|flamingo)/.test(model);
  const eligible = !uniform && !e.civilian?.zooAnimal && !e.archetype.startsWith('healthy.') && (!e.infected || ['infected.runner', 'infected.sprinter'].includes(e.archetype));
  const channels = crowdAppearance(e.id), explicit = e.appearance?.accessories.find(id => ids.includes(id));
  const slot = eligible ? explicit ? ids.indexOf(explicit) + 1 : channels.accessory % (ids.length + 1) : 0;
  const accessory = slot ? ids[slot - 1] : null, kind = accessoryKinds.get(accessory ?? '');
  const hidesHair = kind === 'hat' || kind === 'hair' || !!accessory?.startsWith('acc.placeholder-');
  return { ...channels, model, outfit: model, head: model, headwear: kind === 'hat' ? accessory : accessory ? null : model,
    accessory, accessories: e.appearance?.accessories.length ? e.appearance.accessories : accessory ? [accessory] : [], slot, hidesHair, tint: e.appearance?.tint ?? shirtTones[channels.shirt], infectedSkin: !!e.infected };
}
const colors = { hair: hairTones.map(c => new Color(c)), skin: skinTones.map(c => new Color(c)), infected: infectedSkinTones.map(c => new Color(c)), trousers: trouserTones.map(c => new Color(c)), shirt: shirtTones.map(c => new Color(c)) };
/** _variant.xyz: shirt RGB in the remainder modulo 2; hair/skin/trousers in integer pairs.
 * X also contains five accessory slot bits and a covered hair/headwear bit above the three hair bits. Z also carries the accessory tint palette index above the trouser bits. W remains the pose blend. */
export function packedAppearance(id: number, shirt: Color, accessory = 0, hidesHair = false): [number, number, number] {
  const a = crowdAppearance(id);
  // Keep the remainder strictly below 2, including HDR story tints.
  return [Math.min(1, shirt.r) + 2 * a.hair + 16 * (accessory % 32) + (hidesHair ? 512 : 0), Math.min(1, shirt.g) + 2 * a.skin, Math.min(1, shirt.b) + 2 * a.trousers + 16 * crowdAppearance(id + 503).shirt];
}
export function writeCrowdAppearance(target: InstancedBufferAttribute, index: number, id: number, shirt: Color, blend: number, accessory = 0, hidesHair = false): void {
  target.setXYZW(index, ...packedAppearance(id, shirt, accessory, hidesHair), blend);
}
export function crowdShirt(id: number): Color { return colors.shirt[crowdAppearance(id).shirt]; }
const pickColor = (palette: Color[], index: Node<'float'>) => {
  let color: Node<'vec3'> = vec3(palette[0].r, palette[0].g, palette[0].b);
  for (let i = 1; i < palette.length; i++) color = index.equal(i).select(vec3(palette[i].r, palette[i].g, palette[i].b), color);
  return color;
};
export function crowdSkinColor(infected = false) {
  return varying(pickColor(infected ? colors.infected : colors.skin, attribute('_variant', 'vec4').y.div(2).floor().mod(6)), 'crowdSkinTone');
}
/** No new vertex attribute: _parts.y tags skin (-1), hair (-2), trousers (-3), accessory hat (-4) and hair (-5); positive values retain shirt shading. */
export function crowdAppearanceColor(infected = false) {
  const variant = attribute('_variant', 'vec4'), parts = attribute('_parts', 'vec4'), source = attribute('color', 'vec3');
  const shirt = variant.xyz.mod(2);
  const hair = pickColor(colors.hair, variant.x.div(2).floor().mod(8));
  const skin = pickColor(infected ? colors.infected : colors.skin, variant.y.div(2).floor().mod(6));
  const trousers = pickColor(colors.trousers, variant.z.div(2).floor().mod(8));
  const accessory = pickColor(colors.shirt, variant.z.div(16).floor().mod(12));
  const garment = parts.y.greaterThan(0).select(shirt.mul(parts.y), source);
  // Preserve the authored highlights and seams instead of flattening every material to one tone.
  const shade = source.dot(vec3(.2126, .7152, .0722));
  // Palette selection belongs to the vertices: repeating eight-tone branches for every shaded pixel costs frame time.
  return varying(parts.y.equal(-1).select(skin.mul(shade.div(infected ? .35 : .45).clamp(.65, 1.2)),
    parts.y.equal(-4).select(source.mul(accessory), parts.y.equal(-5).select(source.mul(hair), parts.y.equal(-2).select(hair.mul(shade.div(.12).clamp(.65, 1.3)), parts.y.equal(-3).select(trousers.mul(shade.div(.1).clamp(.65, 1.25)), garment))))), 'crowdAppearanceColor');
}
const tokenColors = Object.fromEntries(Object.entries(palette).map(([name, hex]) => [name, new Color(hex)])) as Record<keyof typeof palette, Color>;
const headwearColors = Object.entries(palette).filter(([name]) => /^cap/.test(name)).map(([, hex]) => new Color(hex));
const swatches = Object.entries(palette).filter(([name]) => /^(hair|denim|trouser|khaki|navy|skin|infectedSkin)/.test(name)).map(([name, hex]) => ({ name, color: new Color(hex) }));
// The male hoodie export calls its brown hair swatch woodWarm; it is local to the head, never wood props.
swatches.push({ name: 'headHair', color: new Color('#57301f') }, { name: 'headHair', color: new Color(palette.woodWarm) });
/** Also annotates shipped prebuilt civilian bakes, whose material names were folded into vertex colours.
 * Skin/eye/garment flags win over matching colours, keeping lips, pupils and story uniforms intact. */
export function markCrowdAppearance(geometry: BufferGeometry, ordinaryInfected = false): void {
  const parts = geometry.getAttribute('_parts'), color = geometry.getAttribute('color'), position = geometry.getAttribute('position');
  // Ordinary infected: the glowing eyes bound the face; any surface clearly above them belongs to hair or headwear.
  let eyeTop = -Infinity;
  if (ordinaryInfected) for (let i = 0; i < parts.count; i++) if (parts.getX(i) === characterNodes.indexOf('head') && parts.getZ(i) > 0) eyeTop = Math.max(eyeTop, position.getY(i));
  if (eyeTop === -Infinity) eyeTop = Infinity;
  for (let i = 0; i < parts.count; i++) {
    if (parts.getY(i) !== 0 || parts.getZ(i) > 0) continue;
    if (parts.getX(i) === characterNodes.indexOf('head') && headwearColors.some(c => Math.abs(c.r-color.getX(i)) < .003 && Math.abs(c.g-color.getY(i)) < .003 && Math.abs(c.b-color.getZ(i)) < .003)) parts.setW(i, parts.getW(i) % 4 + 4);
    const swatch = swatches.find(({ name, color: c }) => (name !== 'headHair' || parts.getX(i) === characterNodes.indexOf('head')) && Math.abs(c.r-color.getX(i)) < .003 && Math.abs(c.g-color.getY(i)) < .003 && Math.abs(c.b-color.getZ(i)) < .003);
    if (swatch) parts.setY(i, (swatch.name.startsWith('hair') || swatch.name === 'headHair') ? -2 : /skin/i.test(swatch.name) ? -1 : -3);
    if (parts.getY(i) !== 0) continue;
    const same = (token: keyof typeof palette) => { const c = tokenColors[token]; return Math.abs(c.r-color.getX(i)) < .003 && Math.abs(c.g-color.getY(i)) < .003 && Math.abs(c.b-color.getZ(i)) < .003; };
    const part = characterNodes[parts.getX(i)];
    // Cream skirt panels use the world palette's white/grey swatches, identified by their lower-body ownership.
    if (['hip', 'legL', 'legR', 'shinL', 'shinR'].includes(part) && (same('picketWhite') || same('sidewalk') || ordinaryInfected && (same('asphalt') || same('uiDark')))) parts.setY(i, -3);
    else if (ordinaryInfected && part === 'head' && same('uiDark') && geometry.getAttribute('position').getY(i) > .08) parts.setY(i, -2);
    else if (ordinaryInfected && ['torso', 'armL', 'armR', 'foreArmL', 'foreArmR'].includes(part) && (same('picketWhite') || same('survivorRed') || same('woodWarm') || same('cardiganRose') || same('policeBlue'))) parts.setY(i, 1);
    // Spec audit 10-16 (E07-AC13): ordinary infected exports tint their own hair and caps per model (woodWarm/
    // policeBlue/teal/... in model-specific shades), so no token matched them and they poked through every shared
    // hat or hair piece as jagged multicoloured patches. Every remaining head surface except the face tokens
    // (teeth/eye whites, blood, mouth, pupils/brows) is own headwear: hidden whenever an accessory covers the head.
    else if (ordinaryInfected && part === 'head' && (position.getY(i) > eyeTop + .06 || !same('picketWhite') && !same('blood') && !same('survivorRed') && !same('uiDark'))) parts.setW(i, parts.getW(i) % 4 + 4);
  }
}
/** Count unique GPU buffers and attribute locations (an interleaved matrix is one buffer/four locations).
 * The limits apply to the complete crowd layout, including the default instance transform.
 * Pass `instanceMatrix` when a pass may still bind Three's implicit instancing (mask/id passes of static-attribute
 * batches); `explicitMatrix` only for a separate matrix buffer NOT already present as geometry attributes. */
export function crowdVertexLayout(geometry: BufferGeometry, instanceMatrix?: InstancedBufferAttribute, explicitMatrix = false) {
  const attributes = Object.values(geometry.attributes), buffers = new Set<unknown>();
  let locations = attributes.reduce((n, a) => n + Math.ceil(a.itemSize / 4), 0);
  for (const a of attributes) buffers.add('data' in a ? a.data : a);
  if (instanceMatrix) { buffers.add(instanceMatrix); locations += 4; }
  if (explicitMatrix) { buffers.add(Symbol()); locations += 4; }
  return { buffers: buffers.size, locations, webgpu: buffers.size <= 8, webgl2: locations <= 16 };
}

export interface CrowdLook { model: string; key: string; hair: number | null; skin: number | null; trousers: number | null; shirt: string | null; accessory: string | null }
/** Record only channels actually present in this LOD's geometry; an unrendered slot cannot improve the metric. */
export function renderedCrowdLook(id: number, model: string, geometry: BufferGeometry, shirt: Color, accessory: string | null): CrowdLook {
  let tags = geometry.userData.appearanceTags as number[] | undefined;
  if (!tags) {
    const parts = geometry.getAttribute('_parts'); tags = [];
    for (let i = 0; i < parts.count; i++) if (!tags.includes(parts.getY(i))) tags.push(parts.getY(i));
    geometry.userData.appearanceTags = tags;
  }
  // Scene Lab observes this every frame, but these channels change only with identity, outfit or LOD.
  // Avoid repeated colour conversion and JSON allocation in crowded phone scenes.
  let cache = geometry.userData.crowdLooks as Map<number, { r: number; g: number; b: number; look: CrowdLook }> | undefined;
  if (!(cache instanceof Map)) { cache = new Map(); geometry.userData.crowdLooks = cache; }
  const previous = cache.get(id);
  if (previous && previous.r === shirt.r && previous.g === shirt.g && previous.b === shirt.b && previous.look.model === model && previous.look.accessory === accessory) return previous.look;
  const a = crowdAppearance(id), look = { model, hair: accessoryKinds.get(accessory ?? '') === 'hair' || tags.includes(-2) && accessoryKinds.get(accessory ?? '') !== 'hat' ? a.hair : null, skin: tags.includes(-1) ? a.skin : null,
    trousers: tags.includes(-3) ? a.trousers : null, shirt: tags.some(t => t > 0) ? shirt.getHexString() : null, accessory };
  const result = { ...look, key: JSON.stringify(look) };
  if (cache.size >= 512) cache.delete(cache.keys().next().value!);
  cache.set(id, { r: shirt.r, g: shirt.g, b: shirt.b, look: result });
  return result;
}
/** Per twenty submitted, living figures (or the whole crowd if it has fewer); largest share uses the whole crowd. */
export function crowdVariety(looks: readonly CrowdLook[]) {
  const counts = (keys: string[]) => {
    const totals = new Map<string, number>(); for (const key of keys) totals.set(key, (totals.get(key) ?? 0) + 1);
    return { distinct: totals.size, largest: Math.max(0, ...totals.values()) };
  };
  const all = counts(looks.map(l => l.key)), models = counts(looks.map(l => l.model));
  const groups = Array.from({ length: Math.ceil(looks.length / 20) }, (_, i) => { const start = Math.min(i * 20, Math.max(0, looks.length - 20)), sample = looks.slice(start, start + 20); return { figures: sample.length, distinct: counts(sample.map(l => l.key)).distinct }; });
  return { figures: looks.length, distinct: all.distinct, per20: groups, largestSameLookShare: looks.length ? all.largest / looks.length : 0, largestModelShare: looks.length ? models.largest / looks.length : 0 };
}

/** Authored hats give way to the selected rigid accessory without stacking two hats. */
export function crowdHeadwearVisibility() {
  const parts = attribute('_parts', 'vec4');
  const covered = attribute('_variant', 'vec4').x.div(512).floor().mod(2).equal(1);
  return parts.y.equal(-2).or(parts.w.greaterThanEqual(4)).and(covered).select(0, 1);
}
