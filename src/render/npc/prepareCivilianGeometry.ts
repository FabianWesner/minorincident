import { BufferAttribute, InterleavedBuffer, InterleavedBufferAttribute, Color, type Group } from 'three';
import { deinterleaveGeometry, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { bakeInfected, civilianClips } from '../characters/bakeInfected';
import { simplifyCrowdLod } from '../characters/crowdLodGeometry';
import { prepareGrip, removeAuthoredCane, handTriangles, gripReach } from './civilianGrip';
import { packCrowdParts } from '../../assets/crowdParts';
import { fitCivilianHeight } from './figureHeight';

export type PreparedCivilian = ReturnType<typeof bakeInfected> & { rig?: Group; gripTriangles?: Float32Array; gripReach?: number; /** markCrowdAppearance already applied (retained copies are marked once). */ marked?: boolean };
/** Main garment materials per civilian model (first = reference shade) that take the per-person shirt tint. */
const shirtMaterials: Record<string, string[]> = {
  'npc.civilian-man-a': ['pal_polo', 'pal_poloDark', 'pal_poloLight'],
  'npc.civilian-man-b': ['pal_schoolBusYellow', 'pal_hoodieShade'],
  'npc.civilian-woman-a': ['pal_survivorRed'],
  'npc.civilian-woman-b': ['pal_lavender', 'pal_lavenderLight', 'pal_lavenderShadow'],
  'npc.civilian-elderly': ['pal_vest'],
};
type StandingReset = Record<string, { translation: number[]; rotation: number[]; scale: number[] }>;
/**
 * Sitting/lying skins ship their joints in a rest pose plus an exported `ss_standingPose` and `restOnlyNodes` (cushion).
 * The crowd bakes clips (npc-sit, death-side, ...) over the standing rig, so restore it first; ordinary models have none.
 */
export function restoreStanding(model: Group): void {
  model.traverse(node => {
    const raw = node.userData.ss_standingPose as string | undefined;
    if (!raw) return;
    const reset = JSON.parse(raw) as StandingReset;
    for (const [name, pose] of Object.entries(reset)) {
      const joint = model.getObjectByName(name);
      if (joint) { joint.position.fromArray(pose.translation); joint.quaternion.fromArray(pose.rotation); joint.scale.fromArray(pose.scale); }
    }
    const rest = node.userData.restOnlyNodes as string[] | string | undefined;
    for (const name of typeof rest === 'string' ? [rest] : rest ?? []) model.getObjectByName(name)?.removeFromParent();
  });
  model.updateMatrixWorld(true);
}

export function prepareCivilianRig(model: Group, id: string, placeholder = false): void {
  if (!placeholder) restoreStanding(model);
  fitCivilianHeight(model, id);
  if (id === 'npc.civilian-elderly') removeAuthoredCane(model);
  model.getObjectByName('rifle')?.removeFromParent();
}
/** The worker and fallback prepare the same immutable CPU geometry and vertex layout. */
export async function prepareCivilianGeometry(model: Group, modelId: string, distant: boolean, placeholder = false): Promise<PreparedCivilian> {
  const baked = bakeInfected(model, [], false, civilianClips);
    prepareGrip(baked.geometry, baked.clip.parts.indexOf('handR'));
    const color = baked.geometry.getAttribute('color'), veins = new Float32Array(color.count), veinColor = new Color('#422c68');
    // QA1-07: the civilian GLBs have no tintable `pal_infectedShirt`; their main garment materials take the per-person
    // tint instead, keeping each shade's brightness ratio (dark seams stay darker), so 5 silhouettes x 12 tints differ.
    const garment = shirtMaterials[modelId], shirtColors: Color[] = [];
    if (garment && !placeholder) model.traverse(node => { const m = (node as import('three').Mesh).material as import('three').MeshStandardMaterial | undefined; if (m && !Array.isArray(m) && garment.includes(m.name) && m.color) shirtColors[garment.indexOf(m.name)] = m.color.clone(); });
    const shirtAttr = baked.geometry.getAttribute('_shirt'), main = shirtColors.find(Boolean);
    if (main) for (let i = 0; i < color.count; i++) {
      if (shirtAttr.getX(i) < 0) continue;
      const r = color.getX(i), g = color.getY(i), b = color.getZ(i);
      if (shirtColors.some(c => c && Math.abs(c.r - r) < .002 && Math.abs(c.g - g) < .002 && Math.abs(c.b - b) < .002)) shirtAttr.setX(i, Math.min(1.6, Math.max(.35, (.2126 * r + .7152 * g + .0722 * b) / Math.max(.02, .2126 * main.r + .7152 * main.g + .0722 * main.b))));
    }
    // Packed mark channel: 1 = vein decal vertex, 2 = blood mask (lower face; collar bite on the torso).
    const position = baked.geometry.getAttribute('position'), partOf = baked.geometry.getAttribute('_part_index'), shirtOf = baked.geometry.getAttribute('_shirt');
    const head = baked.clip.parts.indexOf('head'), torso = baked.clip.parts.indexOf('torso'), bounds = [head, torso].map(() => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }));
    for (let i = 0; i < color.count; i++) { const k = [head, torso].indexOf(partOf.getX(i)); if (k < 0) continue; for (let a = 0; a < 3; a++) { const v = position.getComponent(i, a); bounds[k].min[a] = Math.min(bounds[k].min[a], v); bounds[k].max[a] = Math.max(bounds[k].max[a], v); } }
    const rel = (k: number, i: number, a: number) => (position.getComponent(i, a) - bounds[k].min[a]) / Math.max(1e-6, bounds[k].max[a] - bounds[k].min[a]);
    for (let i = 0; i < veins.length; i++) {
      veins[i] = Number(Math.abs(color.getX(i) - veinColor.r) < .0001 && Math.abs(color.getY(i) - veinColor.g) < .0001);
      // Forward is +X: the front-lower third of the face, and the front-upper collar on one side of the torso.
      const p = partOf.getX(i);
      if (veins[i]) continue;
      // Irregular splatter on the shirt front (stable per vertex), so blood reads on clothes at the game camera.
      const splat = p === torso && rel(1, i, 0) > .5 && rel(1, i, 1) > .25 && Math.abs(Math.sin(position.getComponent(i, 0) * 91.7 + position.getComponent(i, 1) * 47.3 + position.getComponent(i, 2) * 63.1) * 43758.5) % 1 > .25;
      if (p === head && shirtOf.getX(i) < 0 && rel(0, i, 0) > .62 && rel(0, i, 1) < .42 || p === torso && rel(1, i, 1) > .8 && rel(1, i, 2) > .55 && rel(1, i, 0) > .35 || splat) veins[i] = 2;
      // Sunken, bruised eye sockets around the (glowing) eyes.
      else if (p === head && shirtOf.getX(i) < 0 && rel(0, i, 0) > .55 && rel(0, i, 1) > .45 && rel(0, i, 1) < .75) veins[i] = 3;
    }
    baked.geometry.setAttribute('_vein', new BufferAttribute(veins, 1));
    deinterleaveGeometry(baked.geometry);
    const indexed = mergeVertices(baked.geometry); baked.geometry.dispose(); baked.geometry = indexed;
    // Index-only reduction retains parts, swatches and infection marks; close figures allow at most 5 mm error.
    // The closed uniform of the distant guard keeps its existing reduction; retaining
    // its tiny folds adds 17,496 triangles to low L5. Near guards keep the full surface.
    const retainSurface = !distant || modelId !== 'npc.national-guard';
    if (!placeholder) await simplifyCrowdLod(baked.geometry, distant ? .01 : .005, distant ? .3 : .5, retainSurface, .98);
  const grip = handTriangles(baked.geometry, baked.clip.parts.indexOf('handR'));
  packCrowdParts(baked.geometry);
  const names = ['position', 'normal', 'color', '_parts', '_gripPosition'], stride = 16;
  const data = new InterleavedBuffer(new Float32Array(baked.geometry.getAttribute('position').count * stride), stride);
  let offset = 0;
  for (const name of names) {
    const input = baked.geometry.getAttribute(name);
    for (let i = 0; i < input.count; i++) for (let c = 0; c < input.itemSize; c++) data.array[i * stride + offset + c] = input.getComponent(i, c);
    baked.geometry.setAttribute(name, new InterleavedBufferAttribute(data, input.itemSize, offset)); offset += input.itemSize;
  }
  return { ...baked, gripTriangles: grip, gripReach: gripReach(grip) };
}
