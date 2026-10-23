import type { EntitySnapshot } from '../sim/world/types';
/** High world detail stays near the camera target; authored distance tiers cover the rest.
 * The whole-screen 45 m LOD0 margin exceeds L1's 1.5M triangle cap even after prop/crowd fixes.
 * Small props additionally consider projected pixels; hysteresis avoids boundary flicker. */
export type Lod = 'lod0' | 'lod1' | 'lod2';
export const lodPolicy = { lod1From: 8, lod2From: 24, hysteresis: 2 } as const;
/** Low tier (phones) keeps its measured budget: LOD1 near, LOD2 beyond 16 m (props always LOD2). */
export const lowLodPolicy = { lod1From: 0, lod2From: 16, hysteresis: 2 } as const;
/** Initial phone download: props only draw LOD2; LOD1 is needed only around the spawn.
 * Other buildings start with LOD2 and acquire their close tier after play starts. */
export function initialDistrictLods(low: boolean, prop: boolean, distance: number, streaming = false): Lod[] {
  // WebGL warms spawn LOD0 before play; WebGPU keeps the original nearby LOD1
  // until its hero swaps. Everything the first frames can draw at LOD0/LOD1 (up to the LOD2 edge) also has its LOD1 resident, so the
  // hero/near batches never open on the crude LOD2 stand-in (lod-pop); tiers beyond the view stream later.
  if (!low) return streaming && distance > lodPolicy.lod2From + lodPolicy.hysteresis ? ['lod2'] : ['lod1', 'lod2'];
  if (prop || distance > lowLodPolicy.lod2From) return ['lod2'];
  return streaming ? ['lod1'] : ['lod1', 'lod2'];
}
const rank: Record<Lod, number> = { lod0: 0, lod1: 1, lod2: 2 };
const bands: Lod[] = ['lod0', 'lod1', 'lod2'];
export function pickLod(distance: number, previous?: Lod, policy: { lod1From: number; lod2From: number; hysteresis: number } = lodPolicy): Lod {
  const target: Lod = distance > policy.lod2From ? 'lod2' : distance > policy.lod1From ? 'lod1' : 'lod0';
  if (!previous || previous === target) return target;
  // Only leave the previous band once the distance is past its boundary by the hysteresis margin.
  const edges = [policy.lod1From, policy.lod2From];
  if (rank[target] > rank[previous]) return distance > edges[rank[target] - 1] + policy.hysteresis ? target : bands[rank[target] - 1] === previous ? previous : target;
  return distance < edges[rank[target]] - policy.hysteresis ? target : bands[rank[target] + 1] === previous ? previous : target;
}
/** Individually loaded models (vehicles, entity assets, interactables). Low tier keeps LOD1/LOD2 at 30 m. */
export function modelLod(distance: number, previous: string | undefined, low: boolean): Lod {
  if (low) return distance > 30 ? 'lod2' : 'lod1';
  return pickLod(distance, previous === 'lod0' || previous === 'lod1' || previous === 'lod2' ? previous : undefined);
}

/** Crowd bands use CSS pixels, so portrait/zoom changes select the detail actually visible.
 * Separate enter/leave thresholds prevent a figure oscillating between batches.
 * The authored figure LOD2 (~1.8k triangles over ~60 rigid parts) is a far silhouette only: at the game camera a
 * figure is 120-180 CSS px (2-3x that on retina/phones), where LOD2 reads as a broken kite torso with floating parts
 * (PROD "this guy looks terrible"). Both tiers therefore keep LOD1 down to ~96 px; the low tier used to force LOD2. */
export const crowdLodPixels = { enter: 104, leave: 88 } as const;
export function crowdLod(pixels: number, previous?: 'lod1' | 'lod2'): 'lod1' | 'lod2' {
  return pixels > (previous === 'lod1' ? crowdLodPixels.leave : previous === 'lod2' ? crowdLodPixels.enter : (crowdLodPixels.enter + crowdLodPixels.leave) / 2) ? 'lod1' : 'lod2';
}

/** High-tier settled infected enter detailed pages inside 8 m; the 2 m exit margin prevents page churn. Low keeps its measured far pages. */
export function corpseLod(distance: number, previous?: 'lod1' | 'lod2'): 'lod1' | 'lod2' {
  return distance < (previous === 'lod1' ? 10 : 8) ? 'lod1' : 'lod2';
}

/** Small dressing keeps its authored silhouette while avoiding subpixel detail.
 * Tall foliage and buildings keep the distance policy. */
export function propLod(pixels: number, previous?: Lod): Lod {
  const hero = previous === 'lod0' ? 112 : previous ? 144 : 128;
  const far = previous === 'lod2' ? 46 : previous ? 34 : 40;
  return pixels > hero ? 'lod0' : pixels > far ? 'lod1' : 'lod2';
}

const phonePosePixels = 160;

/** Infected never use the baked gait (10-14 gate fix): the atlas pose skips the ground solve, so a drawn infected slid up to 37 cm
 * per contact and sank soles up to 21 cm at far zoom on the low tier (corgi-behaviour@low-z1.5), also at a steady run. Their
 * ordinary gait keeps the procedural contacts; only the held-pose reuse below remains. */

/** Ordinary locomotion/idle only: action telegraphs and reactions always update immediately. */
function ordinaryCrowdPose(e: EntitySnapshot, tick: number): boolean {
  const b = e.infected;
  return (e.archetype === 'infected.runner' || e.archetype === 'infected.sprinter')
    && !!b && !b.legLost && !b.roar && !b.specialAttack && !e.infectionRise
    && (!e.combat?.reaction || tick >= e.combat.reaction.until);
}
export function isSimpleCrowdPose(e: EntitySnapshot, tick: number): boolean {
  const b = e.infected;
  return ordinaryCrowdPose(e, tick) && !!b && (b.state === 'idle' || b.state === 'wander' || b.state === 'search' || b.state === 'attracted' || b.state === 'chase');
}
/** Ordinary attack clips may hold one short frame too; clip/stage changes always solve immediately. */
export function canHoldCrowdPose(e: EntitySnapshot, tick: number): boolean {
  return isSimpleCrowdPose(e, tick) || e.infected?.state === 'attack' && ordinaryCrowdPose(e, tick);
}

/** Small ordinary pedestrians use the same phone gait band; props and story/action poses stay procedural. */
export function useBakedCivilianPose(e: EntitySnapshot, low: boolean, distant: boolean, pixels: number, distance: number, clip: string): boolean {
  const c = e.civilian;
  return low && distant && pixels < phonePosePixels && distance > 2 && !!c && !c.story && !c.pet
    && (c.state === 'calm' || c.state === 'flee' || c.state === 'alarmed')
    && (clip === 'npc-walk' || clip === 'npc-walk-relaxed' || clip === 'run' || clip === 'civ-flee' || clip === 'idle' || clip === 'npc-look-around');
}
