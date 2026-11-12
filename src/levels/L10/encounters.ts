import { cure } from './district';
import type { CureRegion } from './alphaContracts';
import type { Point } from '../districts/types';
import type { NavGrid } from '../../sim/ai/NavGrid';
import { infectedDef } from '../../data/infected';
import { finale } from '../../data/l10Finale';

/** Survival-horror encounters for the PO 2026-11-08 fifteen-minute route.
 * Small moving groups punctuate quiet travel; the final console assault remains the only crowd fight.
 * Low quality thins ordinary humans and stages early corridor patrols at the horde approach.
 * Dogs and regular Alpha encounters keep their mechanics/counts.
 * Checkpoint forecourts and the service/motor-pool roads remain clear of authored groups. */
export interface CureEncounter {
  id: string; region: CureRegion; at: Point;
  /** Separate formations can enter as one regional cohort without moving their stations. */
  releaseWith?: string;
  /** Low-budget patrol station, after the corridor horde receives its slots. */
  atLow?: Point; regular: readonly [number, number]; dogs: number; alphas: number; alphasLow?: number; tough?: number; roles?: readonly string[]; assault?: boolean;
}
export const cureEncounters: readonly CureEncounter[] = [
  { id: 'crash-singletons', region: 'crash-outskirts', at: [592, -8], regular: [2, 2], dogs: 0, alphas: 0, roles: ['infected.crawler'] },
  { id: 'crash-bend', region: 'crash-outskirts', at: [652, 33], regular: [2, 2], dogs: 0, alphas: 0 },
  { id: 'crash-road-pair', region: 'crash-outskirts', at: [622, -12.5], regular: [2, 2], dogs: 0, alphas: 0, roles: ['infected.crawler'] },
  { id: 'crash-pair', region: 'crash-outskirts', at: [712, 33], regular: [2, 2], dogs: 0, alphas: 0 },
  { id: 'fringe-patrol', region: 'residential-fringe', at: [982, 80], regular: [9, 7], dogs: 1, alphas: 0, roles: ['infected.screamer'] },
  { id: 'depot-alpha', region: 'industrial-area', at: [1517, 100], regular: [7, 5], dogs: 0, alphas: 1, roles: ['infected.bloated', 'infected.firefighter'] },
  { id: 'military-breach', region: 'military-zone', at: [2012, -75], regular: [6, 4], dogs: 2, alphas: 1, roles: ['infected.riot', 'infected.armored', 'infected.sprinter'] },
  { id: 'military-exit', region: 'military-zone', at: [2327, -75], regular: [5, 3], dogs: 2, alphas: 1, roles: ['infected.riot', 'infected.armored'] },
  { id: 'research-quarantine', region: 'research-campus', at: [2857, -5], regular: [6, 4], dogs: 1, alphas: 1, roles: ['infected.hazmat', 'infected.nurse'] },
  { id: 'corridor-line', region: 'destroyed-corridor', at: [3180, 95], regular: [6, 4], dogs: 2, alphas: 1, roles: ['infected.bloated', 'infected.riot'] },
  { id: 'corridor-exit', region: 'destroyed-corridor', at: [3510, 95], regular: [5, 3], dogs: 1, alphas: 1, roles: ['infected.sprinter', 'infected.firefighter'] },
  { id: 'complex-approach-0', region: 'dispersal-complex', at: [3820, -41], regular: [7, 5], dogs: 1, alphas: 0 },
  { id: 'dispersal-assault', assault: true, region: 'dispersal-complex', at: cure.anchors['cure-console'], regular: [8, 5], dogs: 1, alphas: 0, roles: ['infected.runner', 'infected.runner', 'infected.firefighter'] },
];
/** Route cadence groups intentionally stay outside the vignette exclusion map: they move to the courier's lane on admission. */
export const curePaceEncounters: readonly CureEncounter[] = [
  { id: 'farm-road-pair-1', region: 'residential-fringe', at: [830, 80], regular: [3, 3], dogs: 0, alphas: 0 },
  { id: 'farm-road-pair-2', region: 'residential-fringe', at: [1125, 25], regular: [3, 3], dogs: 0, alphas: 0 },
  { id: 'farm-road-pair-3', region: 'industrial-area', at: [1305, 100], regular: [3, 3], dogs: 0, alphas: 0 },
  // Keep the armored slot south of the warehouse footprint (ends at z=94).
  { id: 'farm-road-pair-4', region: 'industrial-area', at: [1400, 106], regular: [3, 3], dogs: 0, alphas: 0 },
  { id: 'farm-road-pair-5', region: 'industrial-area', at: [1690, 100], regular: [3, 3], dogs: 1, alphas: 0 },
  { id: 'military-approach-pair', region: 'military-zone', at: [1855, 25], regular: [3, 3], dogs: 0, alphas: 0 },
  { id: 'military-road-pair-1', region: 'military-zone', at: [2170, -75], regular: [3, 3], dogs: 0, alphas: 0 },
  { id: 'military-road-pair-2', region: 'military-zone', at: [2450, -5], regular: [3, 3], dogs: 0, alphas: 0 },
  { id: 'research-road-pair-1', region: 'research-campus', at: [2600, 25], regular: [3, 3], dogs: 0, alphas: 0 },
  { id: 'research-road-pair-2', region: 'research-campus', at: [2730, 25], regular: [3, 3], dogs: 1, alphas: 0 },
  { id: 'corridor-road-pair-1', region: 'destroyed-corridor', at: [2995, 95], regular: [3, 3], dogs: 0, alphas: 0 },
  { id: 'corridor-road-pair-2', region: 'destroyed-corridor', at: [3090, 95], regular: [3, 3], dogs: 0, alphas: 0 },
  { id: 'corridor-road-pair-3', region: 'destroyed-corridor', at: [3330, 95], regular: [3, 3], dogs: 1, alphas: 0 },
  { id: 'corridor-road-pair-4', region: 'destroyed-corridor', at: [3410, 95], regular: [3, 3], dogs: 0, alphas: 0 },
  { id: 'complex-approach-pair-1', region: 'dispersal-complex', at: [3650, 25], regular: [3, 3], dogs: 0, alphas: 0 },
  { id: 'complex-approach-pair-2', region: 'dispersal-complex', at: [3740, -41], regular: [3, 3], dogs: 0, alphas: 0 },
];
export const cureMedkits = [
  { id: 'crash-approach', at: [732, 29] as Point },
  ...['police-medkit', 'industrial-medkit', 'military-medkit', 'research-medkit', 'corridor-medkit'].map(id => ({ id, at: cure.anchors[id] })),
  { id: 'fringe-detour', at: [937, 76] as Point },
  { id: 'industrial-service', at: [1517, -55] as Point },
  { id: 'military-motor-pool', at: [2137, 110] as Point },
];

/** L10 story pickups; the placed objects are retained in the courier's rack and never respawn after collection. */
export const cureWeaponPickups = [
  { id: 'farmhouse-rifle', action: 'weapon.hunting-rifle', anchor: 'farmhouse-rifle' },
  { id: 'barn-machete', action: 'weapon.machete', anchor: 'barn-machete' },
  { id: 'shed-molotov', action: 'weapon.molotov', anchor: 'shed-molotov' },
  { id: 'workshop-nailgun', action: 'weapon.nail-gun', anchor: 'workshop-nailgun' },
  { id: 'guard-tower-rifle', action: 'weapon.assault-rifle', anchor: 'guard-tower-rifle' },
  { id: 'checkpoint-flashbang', action: 'weapon.flashbang', anchor: 'checkpoint-flashbang' },
] as const;

/** Stable slots allow a full cap/blocked cell to defer individual members without losing or duplicating a group. */
export function cureEncounterSlots(group: CureEncounter, tier: 'high' | 'low') {
  const at = tier === 'low' ? group.atLow ?? group.at : group.at;
  const regular = group.regular[tier === 'high' ? 0 : 1];
  const hunters = ['infected.sprinter', 'infected.firefighter', 'infected.armored', 'infected.runner'];
  const roles = [...Array.from({ length: regular }, (_, i) => group.roles?.[i] ?? (i < (group.tough ?? 0) ? 'infected.firefighter' : group.region === 'crash-outskirts' ? 'infected.runner' : hunters[i % hunters.length])),
    ...Array<string>(group.dogs).fill('infected.dog'), ...Array<string>(tier === 'low' ? group.alphasLow ?? group.alphas : group.alphas).fill('infected.alpha')];
  const indices = new Map<string, number>();
  return roles.map((archetype, i) => {
    const index = indices.get(archetype) ?? 0; indices.set(archetype, index + 1);
    // Each small finale wave approaches from three directions outside the hold disc.
    // Road arrivals scatter around their fixed authored anchors.
    const assault = group.assault === true, roadFight = group.region === 'crash-outskirts' || group.region === 'destroyed-corridor';
    const angle = assault ? [Math.PI, -Math.PI / 2, Math.PI / 2][i % 3] : i * 2.399963229728653;
    const radius = assault ? finale.holdRadius + 20 + Math.floor(i / 3) % 4 * 2 : roadFight ? 2 + i % 5 : 5 + (i % 5) * 2;
    // The checkpoint-bearing patrols approach from the military road side.
    // A circle on the bearing sent bodies around both flanks and funnelled
    // a retreat into the full road groups. Staggered rows retain every slot
    // while leaving the northern verge open for an eastbound escape.
    const militaryPatrol = group.id.startsWith('military-zone-direct-');
    // Moving the industrial Alpha into the first cohort must retain its old
    // once-only slot, so a carried save cannot admit it a second time.
    const slotOwner = group.id === 'depot-workers' && archetype === 'infected.alpha' ? 'depot-alpha' : group.id;
    return { key: `${slotOwner}:${archetype}:${index}`, archetype,
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
