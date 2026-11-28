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
  /** Authored set-piece identity used by the L10 route review and content tests. */
  type?: 'lone-pursuer' | 'field-horde' | 'barn-defense' | 'alpha-ambush';
  /** Separate formations can enter as one regional cohort without moving their stations. */
  releaseWith?: string;
  /** Authored dispersal story beat; presentation is fixed in the district and the cohort is admitted by route progress. */
  setPiece?: 'quarantine-gate' | 'propaganda-billboard' | 'scarecrow-field' | 'burning-convoy' | 'dark-underpass' | 'field-hospital';
  /** Low-budget patrol station, after the corridor horde receives its slots. */
  atLow?: Point; regular: readonly [number, number]; dogs: number; alphas: number; alphasLow?: number; tough?: number; roles?: readonly string[]; assault?: boolean;
}
export const cureEncounters: readonly CureEncounter[] = [
  { id: 'crash-singletons', type: 'lone-pursuer', region: 'crash-outskirts', at: [592, -8], regular: [2, 2], dogs: 0, alphas: 0, roles: ['infected.crawler'] },
  { id: 'crash-bend', region: 'crash-outskirts', at: [652, 33], regular: [3, 3], dogs: 0, alphas: 0 },
  { id: 'crash-road-pair', region: 'crash-outskirts', at: [622, -12.5], regular: [2, 2], dogs: 0, alphas: 0, roles: ['infected.crawler'] },
  { id: 'crash-pair', region: 'crash-outskirts', at: [712, 33], regular: [2, 2], dogs: 0, alphas: 0 },
  { id: 'farmhouse-defense', type: 'barn-defense', region: 'residential-fringe', at: [982, 80], regular: [11, 9], dogs: 1, alphas: 0, roles: ['infected.screamer'] },
  { id: 'depot-alpha', type: 'alpha-ambush', region: 'industrial-area', at: [1487, 100], atLow: [1580, 100], regular: [9, 7], dogs: 0, alphas: 1, roles: ['infected.bloated', 'infected.firefighter'] },
  { id: 'military-breach', region: 'military-zone', at: [2012, -75], regular: [8, 6], dogs: 2, alphas: 1, roles: ['infected.riot', 'infected.armored', 'infected.sprinter'] },
  { id: 'military-exit', region: 'military-zone', at: [2327, -75], regular: [7, 5], dogs: 2, alphas: 1, roles: ['infected.riot', 'infected.armored'] },
  { id: 'research-quarantine', region: 'research-campus', at: [2857, -5], regular: [6, 4], dogs: 1, alphas: 1, roles: ['infected.hazmat', 'infected.nurse'] },
  { id: 'corridor-line', region: 'destroyed-corridor', at: [3180, 95], regular: [8, 6], dogs: 2, alphas: 1, roles: ['infected.bloated', 'infected.riot'] },
  // Keep the existing corridor-exit pack on the final approach. The field
  // hospital now owns its own authored cohort at x=3502; stacking both here
  // made that recovery point a two-wave attrition wall.
  { id: 'corridor-exit', region: 'destroyed-corridor', at: [3610, 95], regular: [7, 5], dogs: 1, alphas: 1, roles: ['infected.sprinter', 'infected.firefighter'] },
  { id: 'complex-approach-0', region: 'dispersal-complex', at: [3820, -41], regular: [7, 5], dogs: 1, alphas: 0 },
  { id: 'dispersal-assault', assault: true, region: 'dispersal-complex', at: cure.anchors['cure-console'], regular: [9, 6], dogs: 1, alphas: 0, roles: ['infected.runner', 'infected.runner', 'infected.firefighter'] },
];
/** Route cadence groups intentionally stay outside the vignette exclusion map: they move to the courier's lane on admission. */
export const curePaceEncounters: readonly CureEncounter[] = [
  // L10 PO 2026-11-19: every authored scene has an encounter attached so the courier
  // has to fight through the beat. Route positions follow the eastbound corridor.
  { id: 'setpiece-quarantine-gate', type: 'field-horde', setPiece: 'quarantine-gate', region: 'destroyed-corridor', at: [3010, 95], regular: [4, 4], dogs: 0, alphas: 0, roles: ['infected.hazmat', 'infected.runner', 'infected.runner'] },
  { id: 'setpiece-propaganda-billboard', type: 'field-horde', setPiece: 'propaganda-billboard', region: 'destroyed-corridor', at: [3076, 95], regular: [4, 3], dogs: 0, alphas: 0, roles: ['infected.runner', 'infected.runner'] },
  { id: 'setpiece-scarecrow-field', type: 'field-horde', setPiece: 'scarecrow-field', region: 'destroyed-corridor', at: [3190, 95], regular: [3, 3], dogs: 0, alphas: 0, roles: ['infected.hazmat', 'infected.hazmat', 'infected.runner'] },
  { id: 'setpiece-burning-convoy', type: 'field-horde', setPiece: 'burning-convoy', region: 'destroyed-corridor', at: [3260, 95], regular: [4, 4], dogs: 1, alphas: 0, roles: ['infected.firefighter', 'infected.runner', 'infected.runner'] },
  { id: 'setpiece-dark-underpass', type: 'field-horde', setPiece: 'dark-underpass', region: 'destroyed-corridor', at: [3390, 74], regular: [4, 4], dogs: 0, alphas: 0, roles: ['infected.crawler', 'infected.crawler', 'infected.crawler'] },
  { id: 'setpiece-field-hospital', type: 'field-horde', setPiece: 'field-hospital', region: 'destroyed-corridor', at: [3502, 95], regular: [3, 3], dogs: 0, alphas: 0, roles: ['infected.nurse', 'infected.runner'] },
  { id: 'corn-field-horde', type: 'field-horde', region: 'residential-fringe', at: [830, 80], regular: [14, 7], dogs: 1, alphas: 0 },
  { id: 'shed-field-crossing', type: 'field-horde', region: 'residential-fringe', at: [1205, 25], regular: [12, 7], dogs: 0, alphas: 0 },
  { id: 'farm-road-pair-3', region: 'industrial-area', at: [1305, 100], regular: [7, 6], dogs: 0, alphas: 0 },
  // Keep the armored slot south of the warehouse footprint (ends at z=94).
  { id: 'farm-road-pair-4', region: 'industrial-area', at: [1400, 106], regular: [5, 4], dogs: 0, alphas: 0 },
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
// Destructible fuel drums flank the convoy; damage and blast behavior use the shared hazard catalog.
export const cureConvoyBarrels: readonly Point[] = [[3248, 68], [3264, 70], [3275, 87]];
export const cureConvoyCrates: readonly Point[] = [[3258, 73], [3271, 83]];

export const cureMedkits = [
  { id: 'crash-approach', at: [732, 29] as Point },
  { id: 'field-approach', at: [807, 80] as Point },
  ...['police-medkit', 'industrial-medkit', 'military-medkit', 'research-medkit', 'corridor-medkit'].map(id => ({ id, at: id === 'industrial-medkit' ? [1297, 80] as Point : cure.anchors[id] })),
  { id: 'fringe-detour', at: [937, 76] as Point },
  { id: 'industrial-service', at: [1517, -55] as Point },
  // A medical cache on the field crossing after the depot gives the courier
  // a recovery opportunity before the long industrial exit.
  { id: 'industrial-crossing', at: [1559, -21] as Point },
  { id: 'military-motor-pool', at: [2137, 110] as Point },
];

/** L10 story pickups; the placed objects are retained in the courier's rack and never respawn after collection.
 * PO 2026-11-19: the unarmed crash start takes the machete at the crash site (~6 m from the start, on the
 * river-exit path) instead of the axe, so it leads the list and the farmstead marker points back for it
 * until it is found. */
export const cureWeaponPickups = [
  // Keep the original saved pickup ID so checkpoints made before the move do not spawn a second machete.
  { id: 'barn-machete', action: 'weapon.machete', anchor: 'crash-machete' },
  { id: 'farmhouse-rifle', action: 'weapon.hunting-rifle', anchor: 'farmhouse-rifle' },
  { id: 'shed-molotov', action: 'weapon.molotov', anchor: 'shed-molotov' },
  { id: 'workshop-nailgun', action: 'weapon.nail-gun', anchor: 'workshop-nailgun' },
  { id: 'guard-tower-rifle', action: 'weapon.assault-rifle', anchor: 'guard-tower-rifle' },
] as const;

/** Stable slots allow a full cap/blocked cell to defer individual members without losing or duplicating a group. */
export function cureEncounterSlots(group: CureEncounter, tier: 'high' | 'low') {
  const at = tier === 'low' ? group.atLow ?? group.at : group.at;
  const regular = group.regular[tier === 'high' ? 0 : 1];
  const hunters = ['infected.sprinter', 'infected.firefighter', 'infected.armored', 'infected.runner'];
  const roles = [...Array.from({ length: regular }, (_, i) => group.roles?.[i] ?? (group.setPiece ? 'infected.runner' : i < (group.tough ?? 0) ? 'infected.firefighter' : group.region === 'crash-outskirts' ? 'infected.runner' : hunters[i % hunters.length])),
    ...Array<string>(group.dogs).fill('infected.dog'), ...Array<string>(tier === 'low' ? group.alphasLow ?? group.alphas : group.alphas).fill('infected.alpha')];
  const indices = new Map<string, number>();
  return roles.map((archetype, i) => {
    const index = indices.get(archetype) ?? 0; indices.set(archetype, index + 1);
    // Each small finale wave approaches from three directions around the console.
    // Road arrivals scatter around their fixed authored anchors.
    const assault = group.assault === true, roadFight = group.region === 'crash-outskirts' || group.region === 'destroyed-corridor';
    const angle = assault ? [Math.PI, -Math.PI / 2, Math.PI / 2][i % 3] : group.setPiece === 'burning-convoy' ? [0, -Math.PI / 2, Math.PI / 2][i % 3] : i * 2.399963229728653;
    const fieldHorde = group.type === 'field-horde', stagedAmbush = group.id === 'farmhouse-defense';
    // The barn group stages on the field perimeter so the full crowd does not
    // collapse into a single close lane before a walking player can engage.
    // Each small finale wave approaches from three directions behind the arena's backdrop
    // cover ring (fan housing west, turbine hall south, filtration towers north). The old
    // 48–54 m ring made the announced cohort's own approach the whole ≤20 s first-attack
    // window: a courier who mounts the protected platform gun mows the cohort down at the
    // 8–10 m standoff before any windup starts (qa:threat WAVE_FIRST_ATTACK_OVER_20_SECONDS,
    // 63.4 s at 48 m). Staging at the cover ring's inner edge keeps the surround readable
    // while the arrivals spend their exposure closing the last metres instead of the empty
    // 20 metres outside it; director.safe still rejects any spot within 18 m of her.
    const radius = assault ? finale.holdRadius - 20 + Math.floor(i / 3) % 4 * 2 : group.setPiece === 'burning-convoy' ? 20 + Math.floor(i / 3) * 2 : group.id === 'shed-field-crossing' || group.id === 'depot-alpha' ? 8 + i % 5 * 2 : fieldHorde || stagedAmbush ? 14 + i % 5 * 3 : roadFight ? 2 + i % 5 : 5 + (i % 5) * 2;
    // The checkpoint-bearing patrols approach from the military road side.
    // A circle on the bearing sent bodies around both flanks and funnelled
    // a retreat into the full road groups. Staggered rows retain every slot
    // while leaving the northern verge open for an eastbound escape.
    const militaryPatrol = group.id.startsWith('military-zone-direct-');
    // Roadblock cohorts stage on the courier's approach side. Putting the
    // actors beyond the blocker made the fight impossible to reach and left
    // the rider exposed to the pursuing Mega on a closed gate.
    const roadblock = ['setpiece-quarantine-gate', 'setpiece-burning-convoy', 'setpiece-dark-underpass', 'setpiece-field-hospital'].includes(group.id);
    const gateOffsets = [-20, -26, -32, -38];
    // Moving the industrial Alpha into the first cohort must retain its old
    // once-only slot, so a carried save cannot admit it a second time.
    const slotOwner = group.id === 'depot-workers' && archetype === 'infected.alpha' ? 'depot-alpha' : group.id;
    return { key: `${slotOwner}:${archetype}:${index}`, archetype,
      x: roadblock ? at[0] - 22 - Math.floor(i / 2) * 2 : at[0] + (militaryPatrol ? (i % 4 - 1.5) * 3 : Math.cos(angle) * radius),
      z: roadblock ? at[1] + gateOffsets[i % gateOffsets.length] : at[1] + (militaryPatrol ? -18 - Math.floor(i / 4) * 3 : Math.sin(angle) * radius) };
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
