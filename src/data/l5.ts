/**
 * Level 5 "Aftermath" tuning table (specs/epic-23-level-5-aftermath.md sections 4 and 5; the PO document wins). Data only.
 * Same city as L4 (D-FAIR, world metres, origin at the map centre, X east, Z south), hours later, at sunset: the W5 twin of the
 * layout, no soldiers, no crowds, a few wandering infected, five hidden survivors and the Metro entrance as the destination.
 * Times in seconds, speeds in m/s. Every number is read by the L5 controller, the survivor follower, bots and tests.
 */
import { l4ConvoyStations, l4PhotoSpots, l4Route, l4RoutePose } from './l4';

type P = readonly [number, number];

export const l5 = {
  /** Beat 1: caption, then ~10 s without an objective, then "Look for anyone still alive". */
  emerge: { interactS: 1.0, objectiveAfterS: 10, captionS: 6 },
  /** The five survivors: stand-to-interact time and reach, sign-of-life cues (heard within 25 m, never beyond 30 m), the direction ping. */
  survivors: { interactS: 1.0, reachM: 2.5, cueRangeM: 25, cueMaxM: 30, cueEveryS: 7, pingS: 4, count: 5 },
  /** Followers (E08 escort follow without a fail state): 2-5 m behind, run slower than the player and every infected. */
  follow: { minM: 2, maxM: 5, runMs: 3.8, walkMs: 2.6, waitCallM: 10, waitEveryS: 12, coverM: 8, reactS: 1.2, hp: 60 },
  /** Sparse infected: wanderers at the start (ones and twos), the cap, damage like L4's. */
  infected: { start: { high: 18, low: 12 }, maxGroup: 3, cap: { high: 30, low: 30 }, damage: 1.25, leashM: 14 },
  /** Metro: the trigger at the foot of the entrance, every living follower crosses, the residents are shown briefly, then the shutter rolls shut. */
  metro: { triggerM: 1.2, gatherM: 15, waitS: 10, occupantViewS: 3, lookoutAfterS: 0, occupants: 24, stationX: 37.7854, stationZ: -78 },
  /** Sunset gloom ramp: sun intensity factor from 1 to `endFactor` over the story (time share and the share of survivors accounted for). */
  gloom: { rampS: 240, endFactor: 0.5, atMetroMax: 0.7 },
  /** Ambience only until the first survivor is found; preserve the existing L5 recording. */
  audio: { quietDb: -24 },
  medkits: { heal: 40, positions: [[45.5, 20], [30, -37.2], [-4, -37.2], [-22, 15], [-30.5, -2], [-44, 39.4], [58, 42.5]] as readonly P[] },
  checkpoints: ['outside', 'survivor-1', 'survivor-2', 'survivor-3', 'survivor-4', 'survivor-5'] as const,
  /** Bots (section 8). Keep the original acceptance bands; never pad bot time. */
  bots: { seeds: 20, completeMedianS: [120, 240] as P, newbieMedianS: [150, 300] as P, newbieMinSeeds: 18, newbieMaxMedianDeaths: 1 },
} as const;

/** The L4 end loadout (specs/epic-23 AC12): axe and bat on the left, the machine gun, the handgun and the kick on the right. */
export const l5Loadout = { left: ['weapon.fire-axe', 'weapon.bat'], right: ['weapon.army-mg', 'weapon.handgun', 'weapon.kick'] } as const;

/** How a hiding place hides its survivor. */
export type L5Cover = 'inside' | 'behind';
export interface L5Survivor {
  key: 'dale' | 'rosa' | 'okafor' | 'mia' | 'sam';
  name: string;
  /** Aftermath skin in the asset manifest. */
  model: string;
  role: string;
  /** Hiding place (spec 5.3). */
  place: string;
  cover: L5Cover;
  /** Where the survivor is hidden (inside the building or vehicle: out of sight and out of reach) and where the player stands to find them. */
  hideAt: P;
  ringAt: P;
  /** Reachable discovery anchor: the sound, interaction and reveal all use ringAt. */
  prompt: string;
  outAt: P;
  /** Sign of life: what the player hears within 25 m (subtitle) and the line the survivor says when found. */
  cue: { id: string; text: string };
  found: string;
}
/** Dale hides in the cab of the second convoy truck, where the L4 column parked on the plaza (now a wreck): out of sight of every street. */
const column = l4Route(), truck = l4RoutePose(column, l4ConvoyStations(column.length).end[3]);
const survivors: Omit<L5Survivor, 'outAt'>[] = [
  { key: 'dale', name: 'Dale', model: 'npc.dale.aftermath', role: 'mechanic', place: 'the cab of a wrecked military truck on the plaza', cover: 'behind', hideAt: [truck.x, truck.z], ringAt: [truck.x, truck.z - 3.1], prompt: "Hold still or press E: open the truck cab",
    cue: { id: 'L5.cue.dale', text: 'Someone is banging on metal, close by.' }, found: 'You… you\'re real. Take me with you.' },
  { key: 'rosa', name: 'Rosa', model: 'npc.rosa.aftermath', role: 'paramedic', place: 'the pharmacy back room', cover: 'inside', hideAt: [58, 36.8], ringAt: [58, 41.3], prompt: "Hold still or press E: open the pharmacy door",
    cue: { id: 'L5.cue.rosa', text: 'Knocking from inside the pharmacy.' }, found: 'You\'re real. I have not seen anyone in hours. Take me with you.' },
  { key: 'okafor', name: 'Mr. Okafor', model: 'npc.mr-okafor.aftermath', role: 'retired teacher', place: 'the church vestry', cover: 'inside', hideAt: [-38, -2.7], ringAt: [-33.5, -2.7], prompt: "Hold still or press E: open the vestry door",
    cue: { id: 'L5.cue.okafor', text: 'A voice, softly praying, from the church.' }, found: 'Bless you, child. Please, take me with you.' },
  { key: 'mia', name: 'Mia', model: 'npc.mia.aftermath', role: 'shop clerk', place: 'the apartment stairwell above Harbor Street', cover: 'inside', hideAt: [-77.7, -49.2], ringAt: [-76.2, -44.4], prompt: "Hold still or press E: call up the stairwell",
    cue: { id: 'L5.cue.mia', text: 'A radio crackles above Harbor Street.' }, found: 'Is it over? Please say it\'s over. Take me with you.' },
  { key: 'sam', name: 'Sam', model: 'npc.sam.aftermath', role: 'hunter', place: 'a wrecked bus on Lakeshore Avenue', cover: 'behind', hideAt: [-45, 46.3], ringAt: [-45, 42.6], prompt: "Hold still or press E: pry open the bus door",
    cue: { id: 'L5.cue.sam', text: 'A flashlight blinks inside a wrecked bus.' }, found: 'Thank God. I lost my rifle days ago. Take me with you.' },
];

export const l5Survivors: readonly L5Survivor[] = survivors.map(s => ({ ...s, outAt: s.ringAt }));

/** Named world points authored into the L5 layout copy (the cellar anchors come from the layout's own cellar placement). */
export const l5Anchors: Record<string, P> = {
  // Replaced from the actual shared entry door by levelFiveLayouts.
  'l5-out': [66.4, 41.74],
  'l5-plaza': [-17, 3],
  'l5-metro-foot': [38.1854, -50.6],
  'photo-l5-basement-exit': [66.4, 41.74], 'photo-l5-sign-of-life': [-45, 42.4], 'photo-l5-group-of-five': [10, -39], 'photo-l5-metro-shelter': [40.7854, -60.4], 'photo-l5-metro-doors': [37.7854, -48.5],
};
/** Photo spots (section 6): the four L4 pair cameras (same anchors and framing) plus the L5 ones. */
export const l5PhotoSpots: readonly (readonly [string, readonly [number, number, number]])[] = [
  ...l4PhotoSpots.filter(([name]) => name.startsWith('pair-')),
  ['l5-basement-exit', [-9, 12, -9]], ['l5-sign-of-life', [14, 17, 14]], ['l5-group-of-five', [-28, 24, 0]], ['l5-metro-shelter', [0, 28, -34]], ['l5-metro-doors', [0, 10, 10]],
];

/** Wandering infected at the start, in ones and twos (no group above 3), spread over the streets; the first `low` are kept on the phone tier. */
export const l5Wanderers: readonly { at: P; n: number; alpha?: boolean }[] = [
  { at: [-20, -37.6], n: 2 }, { at: [-56, 22], n: 1 }, { at: [14, 28], n: 2 }, { at: [-22, 10], n: 1 }, { at: [49, 14], n: 1, alpha: true }, { at: [22, -37.4], n: 1 },
  { at: [-26, 40], n: 2 }, { at: [-52, -12], n: 1, alpha: true }, { at: [2, 43.6], n: 1 }, { at: [14, -2], n: 1 }, { at: [-12, 18], n: 1 }, { at: [44, -36.4], n: 2 },
  { at: [-6, -37.4], n: 1 }, { at: [-58, -34], n: 1 }, { at: [10, 13], n: 1 },
];

/** Fires still burning (E27 hazards: flame cards, ground light and a smoke column) and smoke columns of fires deep inside blocks. */
export const l5Fires: readonly { at: P; r: number; deep?: boolean }[] = [
  { at: [-20, 24.6], r: 1.2 }, { at: [12.2, -12], r: 1.4 }, { at: [-12.4, 8], r: 1.2 }, { at: [-12.4, -10], r: 1.2 }, { at: [-6, 44.4], r: 1.0 }, { at: [15.8, 12.6], r: 1.0 },
  { at: [30, -43.4], r: 1.0 }, { at: [-58.4, 22], r: 1.0 },
  { at: [-47, -29], r: 1.6, deep: true }, { at: [23.9, -8.5], r: 1.6, deep: true }, { at: [40, 12.2], r: 1.6, deep: true }, { at: [-68, -1.2], r: 1.6, deep: true }, { at: [-31.9, -51], r: 1.6, deep: true },
];
