/**
 * Level 5 "Aftermath" tuning table (specs/epic-23-level-5-aftermath.md sections 4 and 5; the PO document wins). Data only.
 * Same city as L4 (D-FAIR, world metres, origin at the map centre, X east, Z south), hours later, at sunset: the W5 twin of the
 * layout, no soldiers or civilian crowds, scattered infected, five hidden survivors and the Metro as the destination.
 * Times in seconds, speeds in m/s. Every number is read by the L5 controller, the survivor follower, bots and tests.
 */
import { l4ConvoyStations, l4PhotoSpots, l4Route, l4RoutePose } from './l4';

type P = readonly [number, number];

export const l5WeaponPickup = 'weapon.shotgun' as const;
/** Street pickups share their positions/assets with the W5 dressing and their action ids with campaign carry-over. */
export const l5DroppedWeapons = ([[-26.2, -11.4, 'wpn.assault-rifle'], [-24.6, 16, 'wpn.assault-rifle'], [-13.4, -2.6, 'wpn.assault-rifle'], [-31.6, 5.4, 'wpn.machine-gun'], [-9, 12.4, 'wpn.assault-rifle'], [7, -8.4, 'wpn.pistol'], [-20, 4, 'wpn.shotgun'], [-72, 44.8, 'wpn.assault-rifle']] as const)
  .map(([x, z, assetId], i) => ({ x, z, assetId, yaw: i * 2.1, actionId: assetId === 'wpn.pistol' ? 'weapon.handgun' : assetId === 'wpn.machine-gun' ? 'weapon.army-mg' : assetId.replace('wpn.', 'weapon.') }));
export const l5 = {
  /** Beat 1: caption, then ~10 s without an objective, then "Look for anyone still alive". */
  emerge: { interactS: 1.0, objectiveAfterS: 10, captionS: 6, /** PO #33: the 150 m cellar-to-street jump hides behind a black dip: fade out, move while black, fade in. */ fadeOutS: .4, fadeHoldS: .25, fadeInS: 1 },
  /** The five survivors: stand-to-interact time and reach, sign-of-life cues (heard within 25 m, never beyond 30 m), the direction ping. */
  survivors: { interactS: 1.0, reachM: 2.5, cueRangeM: 25, cueMaxM: 30, cueEveryS: 7, pingS: 4, count: 5 },
  /** Followers (E08 escort follow without a fail state): 2-5 m behind, run slower than the player and every infected. */
  follow: { minM: 2, maxM: 5, runMs: 3.8, walkMs: 2.6, waitCallM: 10, waitEveryS: 12, coverM: 8, reactS: 1.2, hp: 60, rescueGraceS: 10 },
  /** Scattered street infected (singles, occasional pairs), and the cap. */
  infected: { start: { high: 150, low: 100 }, maxGroup: 2, cap: { high: 150, low: 100 }, leashM: 14 },
  /** First rescue (PO 11-10): no street infected start in a pocket round the first survivor (Mia) and the second (Okafor), nor in a corridor cellar -> Mia -> Okafor. The rest of the level is unchanged; the free slots are not re-spent (road space at 4 m spacing is used up), so the start population is `start` minus the pocket's share. */
  firstRescue: { route: ['mia', 'okafor'] as readonly string[], pocketM: 28, secondPocketM: 22, corridorM: 9 },
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
  { key: 'rosa', name: 'Rosa', model: 'npc.rosa.aftermath', role: 'paramedic', place: 'the pharmacy back room', cover: 'inside', hideAt: [58, 36.8], ringAt: [58, 41.3], prompt: "Hold still 1s or press E: open the pharmacy door",
    cue: { id: 'L5.cue.rosa', text: 'Knocking from inside the pharmacy.' }, found: 'You\'re real. I have not seen anyone in hours. Take me with you.' },
  { key: 'okafor', name: 'Mr. Okafor', model: 'npc.mr-okafor.aftermath', role: 'retired teacher', place: 'the church vestry', cover: 'inside', hideAt: [-38, -2.7], ringAt: [-33.5, -2.7], prompt: "Hold still or press E: open the vestry door",
    cue: { id: 'L5.cue.okafor', text: 'A voice, softly praying, from the church.' }, found: 'Bless you, child. Please, take me with you.' },
  { key: 'mia', name: 'Mia', model: 'npc.mia.aftermath', role: 'shop clerk', place: 'the apartment stairwell above Harbor Street', cover: 'inside', hideAt: [-31.8699, -49.2], ringAt: [-30.3699, -44.4], prompt: "Hold still or press E: call up the stairwell",
    cue: { id: 'L5.cue.mia', text: 'A radio crackles above Harbor Street.' }, found: 'Is it over? Please say it\'s over. Take me with you.' },
  { key: 'sam', name: 'Sam', model: 'npc.sam.aftermath', role: 'hunter', place: 'a wrecked bus on Lakeshore Avenue', cover: 'behind', hideAt: [-45, 46.3], ringAt: [-45, 50], prompt: "Hold still 1s or press E: pry open the bus door",
    cue: { id: 'L5.cue.sam', text: 'A flashlight blinks inside the wrecked bus on Lakeshore Avenue.' }, found: 'Thank God. I lost my rifle in the fighting. Take me with you.' },
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

/** The runner formerly near the new cellar exit patrols Lakeshore instead, keeping the relocated opening quiet.
 * Fixed infected starts are scattered in singles with a few authored pairs; low tier takes the first 100. */
const l5AuthoredWanderers: readonly { at: P; lowAt?: P; n: number; alpha?: boolean; archetype?: string }[] = [
  { at: [18, -50], n: 2 }, { at: [-56, 22], n: 1 }, { at: [14, 28], n: 2, archetype: 'infected.butcher' }, { at: [-22, 10], n: 1 }, { at: [44, 36], n: 1, alpha: true }, { at: [22, -37.4], n: 1 },
  { at: [-26, 40], n: 2 },
  // PO 11-10 ("I cannot rescue my 1st survivor"): the stretch from the cellar to Mia (first survivor) holds no authored group; the Alpha and the pair that stood there moved east to the middle of the level.
  { at: [4, -50], n: 1, alpha: true }, { at: [2, 43.6], n: 1 }, { at: [14, -2], n: 1 }, { at: [-12, 18], n: 1 }, { at: [44, -36.4], n: 2 },
  { at: [-6, -37.4], n: 1 }, { at: [10, 13], n: 1 },
  // PO 10-20 ("L5 feels quite empty"): retain these nine original lone shamblers.
  { at: [52, -37.4], n: 1 }, { at: [36, -37.4], n: 1 }, { at: [-12, 43.6], n: 1 }, { at: [40, 28.5], n: 1 }, { at: [14, -24], n: 1 },
  { at: [-60, 43], n: 1 }, { at: [-4, 28], n: 1 }, { at: [24, 43.6], n: 1 }, { at: [-40, -20], n: 1 },
];
// Interleave singles along the street bands so the population is spread across the reachable city. Skip the
// cellar, authored starts and survivor hiding spots; post-snap spacing keeps added singles distinct from one another.
const l5StreetBands = [-50, -37.4, -24, -12, 2, 14, 28, 43.6];
const l5StreetColumns = [-68, -56, -40, -26, -12, 2, 14, 28, 44, 58, 66];
const l5ProtectedSpots: readonly P[] = [
  ...l5AuthoredWanderers.flatMap(g => Array.from({ length: g.n }, (_, k) => [g.at[0] + k * 2.5, g.at[1] + k * 1.5] as P)),
];
const l5StreetSingles = [...Array.from({ length: 296 }, (_, i) => {
  const n = (i * 73) % 296, row = Math.floor(n / 37), col = n % 37;
  return { at: [-76 + col * 4, l5StreetBands[row]] as P, n: 1, spread: true };
}), ...Array.from({ length: 264 }, (_, i) => {
  const n = (i * 53) % 264;
  return { at: [l5StreetColumns[Math.floor(n / 24)], -48 + n % 24 * 4] as P, n: 1, spread: true };
}), ...Array.from({ length: 296 }, (_, i) => {
  // A second street lattice fills legal gaps left by shell/spacing rejection;
  // the same 100/150 quota and four-metre separation still apply.
  const n = (i * 73) % 296, row = Math.floor(n / 37), col = n % 37;
  return { at: [-74 + col * 4, l5StreetBands[row]] as P, n: 1, spread: true };
}), ...Array.from({ length: 264 }, (_, i) => {
  const n = (i * 53) % 264;
  return { at: [l5StreetColumns[Math.floor(n / 24)], -46 + n % 24 * 4] as P, n: 1, spread: true };
})].filter(({ at }) => l5ProtectedSpots.every(p => Math.hypot(p[0] - at[0], p[1] - at[1]) >= 8));
const l5RescueStreetSingles = l5Survivors.flatMap(s => [-1, 1].map(side => ({ at: [s.ringAt[0] + side * 4.5, s.ringAt[1]] as P, n: 1, spread: true })));
export const l5Wanderers: readonly { at: P; lowAt?: P; n: number; alpha?: boolean; archetype?: string; spread?: boolean }[] = [...l5AuthoredWanderers, ...l5RescueStreetSingles, ...l5StreetSingles];

/** Fires still burning (E27 hazards: flame cards, ground light and a smoke column) and smoke columns of fires deep inside blocks. */
export const l5Fires: readonly { at: P; r: number; deep?: boolean }[] = [
  { at: [-20, 24.6], r: 1.2 }, { at: [12.2, -12], r: 1.4 }, { at: [-12.4, 8], r: 1.2 }, { at: [-12.4, -10], r: 1.2 }, { at: [-6, 44.4], r: 1.0 }, { at: [15.8, 12.6], r: 1.0 },
  { at: [30, -43.4], r: 1.0 }, { at: [-58.4, 22], r: 1.0 },
  { at: [-47, -29], r: 1.6, deep: true }, { at: [23.9, -8.5], r: 1.6, deep: true }, { at: [40, 12.2], r: 1.6, deep: true }, { at: [-68, -1.2], r: 1.6, deep: true }, { at: [-31.9, -51], r: 1.6, deep: true },
];
