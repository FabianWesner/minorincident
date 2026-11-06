import { cure } from './district';
import type { CureRegion } from './alphaContracts';
import type { Point } from '../districts/types';
import type { NavGrid } from '../../sim/ai/NavGrid';
import { infectedDef } from '../../data/infected';

/** R1–R6 resident peaks and R7 console assault, authored independently of arsenal changes.
 * Low quality thins ordinary humans and stages early corridor patrols at the horde approach.
 * Dogs and regular Alpha encounters keep their mechanics/counts.
 * Checkpoint forecourts and the service/motor-pool roads remain clear of authored groups. */
export interface CureEncounter {
  id: string; region: CureRegion; at: Point;
  /** Separate formations can enter as one regional cohort without moving their stations. */
  releaseWith?: string;
  /** Low-budget patrol station, after the corridor horde receives its slots. */
  atLow?: Point; regular: readonly [number, number]; dogs: number; alphas: number; alphasLow?: number; tough?: number; assault?: boolean;
}
export const cureEncounters: readonly CureEncounter[] = [
  { id: 'crash-singletons', region: 'crash-outskirts', at: [592, -8], regular: [2, 2], dogs: 0, alphas: 0 },
  { id: 'crash-bend', region: 'crash-outskirts', at: [652, 33], regular: [2, 2], dogs: 0, alphas: 0 },
  { id: 'crash-road-pair', region: 'crash-outskirts', at: [622, -12.5], regular: [2, 2], dogs: 0, alphas: 0 },
  { id: 'crash-pair', region: 'crash-outskirts', at: [712, 33], regular: [2, 2], dogs: 0, alphas: 0 },
  { id: 'fringe-patrol', region: 'residential-fringe', at: [862, 80], regular: [6, 4], dogs: 2, alphas: 0, tough: 2 },
  { id: 'fringe-hedges', region: 'residential-fringe', at: [982, 80], regular: [6, 4], dogs: 0, alphas: 0, tough: 2 },
  { id: 'fringe-exit', region: 'residential-fringe', at: [1132, 25], regular: [6, 4], dogs: 0, alphas: 0, tough: 2 },
  { id: 'depot-workers', region: 'industrial-area', at: [1372, 100], regular: [25, 16], dogs: 2, alphas: 1, tough: 2 },
  { id: 'depot-alpha', region: 'industrial-area', at: [1517, 100], regular: [4, 2], dogs: 1, alphas: 0, tough: 2 },
  { id: 'depot-exit', region: 'industrial-area', at: [1682, 100], regular: [4, 3], dogs: 0, alphas: 0, tough: 2 },
  { id: 'military-breach', region: 'military-zone', at: [2012, -75], regular: [18, 16], dogs: 2, alphas: 1 },
  { id: 'military-column', region: 'military-zone', at: [2112, -75], regular: [18, 14], dogs: 1, alphas: 0 },
  { id: 'military-exit', region: 'military-zone', at: [2252, -75], regular: [18, 10], dogs: 0, alphas: 1 },
  { id: 'research-approach', region: 'research-campus', at: [2617, 45], regular: [22, 22], dogs: 2, alphas: 1 },
  { id: 'research-lab', region: 'research-campus', at: [2672, 45], releaseWith: 'research-approach', regular: [22, 22], dogs: 0, alphas: 0 },
  { id: 'research-quarantine', region: 'research-campus', at: [2857, -5], regular: [22, 10], dogs: 2, alphas: 1 },
  // The checkpoint bearing is also a playable route. Most travellers cross
  // these open forecourts directly instead of following the winding service
  // road (75–100 m away). Once-only patrols cover that actual corridor; the
  // existing regional concurrent caps still own every admission.
  ...([
    ['residential-fringe', 25, [822, 897, 972, 1047, 1122, 1197]],
    ['industrial-area', 25, [1322, 1397, 1472, 1547, 1622, 1697, 1772]],
    ['military-zone', 25, [1922, 1997, 2072, 2147, 2222, 2297, 2372]],
    ['research-campus', -5, [2532, 2607, 2682, 2757, 2832]],
  ] as [CureRegion, number, number[]][]).flatMap(([region, z, stations]) => stations.map((x, i): CureEncounter => ({
    id: `${region}-direct-${i}`, region, at: [x, z], regular: region === 'residential-fringe' ? [3, 2] : [8, 6],
    dogs: region === 'residential-fringe' ? 0 : 2, alphas: 0, tough: region === 'residential-fringe' ? 0 : 2,
  }))),
  // The three full groups enter together at the first road breach: 20–35
  // members per group, with enough approach distance for the line to engage.
  { id: 'corridor-line', region: 'destroyed-corridor', at: [3060, 84], regular: [32, 20], dogs: 2, alphas: 1 },
  { id: 'corridor-breach', region: 'destroyed-corridor', at: [3060, 95], regular: [32, 20], dogs: 2, alphas: 1 },
  { id: 'corridor-exit', region: 'destroyed-corridor', at: [3060, 106], regular: [32, 20], dogs: 1, alphas: 1 },
  // Small fixed packs occupy the long approach/exit stretches between the
  // retained corridor hordes. Every member is once-only and the director
  // separately limits concurrent regional dogs. Their fixed X stations cover
  // the road and parallel forecourt crossings through the existing director.
  // R5/R6 envelopes overlap by 50 m. Keep the first R6 packs past the R5 edge
  // so their chase cannot briefly inflate the research-campus local dog peak.
  // The low budget stages the first patrols at the horde; high keeps early pressure.
  ...([[2990, 20], [2990, 75], [3030, 95], [3080, 95], [3130, 95], [3180, 95], [3230, 95], [3280, 95], [3330, 95], [3380, 95], [3430, 95], [3480, 95], [3530, 95], [3577, 45]] as Point[]).map((at, i): CureEncounter => ({
    id: `corridor-pack-${i}`, ...(i < 3 ? { atLow: [3060, at[1]] as Point } : {}), region: 'destroyed-corridor', at, regular: [0, 0], dogs: 2, alphas: 0,
  })),
  ...([[3755, -25], [3820, -41], [3890, -41], [3920, -41], [3955, -25], [3970, -25]] as Point[]).map((at, i): CureEncounter => ({
    id: `complex-approach-${i}`, region: 'dispersal-complex', at, regular: [2, 2], dogs: 2, alphas: 0,
  })),
  { id: 'dispersal-assault', assault: true, region: 'dispersal-complex', at: cure.anchors['cure-console'], regular: [178, 88], dogs: 4, alphas: 3, alphasLow: 2 },
];
export const cureMedkits = [
  { id: 'crash-approach', at: [732, 29] as Point },
  ...['police-medkit', 'industrial-medkit', 'military-medkit', 'research-medkit', 'corridor-medkit'].map(id => ({ id, at: cure.anchors[id] })),
  { id: 'fringe-detour', at: [937, 76] as Point },
  { id: 'industrial-service', at: [1517, -55] as Point },
  { id: 'military-motor-pool', at: [2137, 110] as Point },
];

/** Stable slots allow a full cap/blocked cell to defer individual members without losing or duplicating a group. */
export function cureEncounterSlots(group: CureEncounter, tier: 'high' | 'low') {
  const at = tier === 'low' ? group.atLow ?? group.at : group.at;
  const regular = group.regular[tier === 'high' ? 0 : 1];
  const roles = [...Array.from({ length: regular }, (_, i) => i < (group.tough ?? 0) ? 'infected.firefighter' : 'infected.runner'),
    ...Array<string>(group.dogs).fill('infected.dog'), ...Array<string>(tier === 'low' ? group.alphasLow ?? group.alphas : group.alphas).fill('infected.alpha')];
  const indices = new Map<string, number>();
  return roles.map((archetype, i) => {
    const index = indices.get(archetype) ?? 0; indices.set(archetype, index + 1);
    // The finale approaches in four staggered ranks outside the 25 m hold disc.
    // Road arrivals scatter around their fixed authored anchors.
    const assault = group.assault === true, roadFight = group.region === 'crash-outskirts' || group.region === 'destroyed-corridor';
    const angle = i * 2.399963229728653;
    const radius = assault ? 26.5 + (i % 4) * .75 : roadFight ? 2 + i % 5 : 5 + (i % 5) * 2;
    // The checkpoint-bearing patrols approach from the military road side.
    // A circle on the bearing sent bodies around both flanks and funnelled
    // a retreat into the full road groups. Staggered rows retain every slot
    // while leaving the northern verge open for an eastbound escape.
    const militaryPatrol = group.id.startsWith('military-zone-direct-');
    return { key: `${group.id}:${archetype}:${index}`, archetype,
      x: at[0] + (militaryPatrol ? (i % 4 - 1.5) * 3 : Math.cos(angle) * radius),
      z: at[1] + (militaryPatrol ? -18 - Math.floor(i / 4) * 3 : Math.sin(angle) * radius) };
  });
}

/** Same bounded placement search for production and the Scene Lab encounter fixture. */
export function cureEncounterSpot(nav: NavGrid, slot: { x: number; z: number; archetype: string }, eligible: (x: number, z: number) => boolean = () => true, attempts = 17) {
  const radius = infectedDef(slot.archetype).radius;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const angle = attempt * Math.PI / 4, distance = Math.ceil(attempt / 8) * 1.5;
    const at = { x: slot.x + Math.cos(angle) * distance, z: slot.z + Math.sin(angle) * distance };
    if (eligible(at.x, at.z) && nav.clear(at.x, at.z, radius)) return at;
  }
  return null;
}
