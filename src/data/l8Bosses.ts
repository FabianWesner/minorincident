/** L8 encounter tuning in metres, HP and fixed ticks.
 * r31-flamingo (PO 11-10): HP is sized to the L8 weapons (handgun, axe, shotgun, MG; no rocket). Damage.ts applies x0.6 outside an exposed window (x1.8 inside) and x0.2 from allies,
 * so one hit is handgun 12, MG 8.4, axe ~34, shotgun ~110-145. Flamingo/monkey 36: handgun 3, MG 5, axe 2, shotgun 1. Zebra 150: shotgun 2. Lion 250 ~ 30 MG. Gorilla 500 ~ 60 MG. Elephant 1200 chips; the 3 wall impacts end it. Entries sit on connected public paths. */
export const l8BossArenas = [
  { id: 'flamingo', name: 'Flamingo flock', count: 8, hp: 36, centre: { x: -6, z: -27 }, entry: { x: 0, z: -9 }, radius: 17, counter: 'Step sideways out of the shadow lane; sweep the birds as they land.' },
  { id: 'zebra', name: 'Zebra herd', count: 4, hp: 150, centre: { x: 60, z: 32 }, entry: { x: 60, z: 8 }, radius: 23, counter: 'Leave the dust lane. The fence turns the herd; shoot the stragglers.' },
  { id: 'monkey', name: 'Monkey pack', count: 7, hp: 36, centre: { x: -5, z: 15 }, entry: { x: 1, z: 14 }, radius: 13, counter: 'Use the doorway to stop the pack surrounding you. Melee shakes off a grab.' },
  { id: 'lion', name: 'Lion and lioness', count: 2, hp: 250, centre: { x: -60, z: -32 }, entry: { x: -60, z: -8 }, radius: 23, counter: 'Keep your back to the rocks. Dodge sideways at the glint and fire after the landing.' },
  { id: 'gorilla', name: 'Gorilla', count: 1, hp: 500, centre: { x: 60, z: -32 }, entry: { x: 60, z: -8 }, radius: 23, counter: 'Hit the chest-beat to interrupt it. Put a pillar between you and a throw.' },
  { id: 'elephant', name: 'Elephant', count: 1, hp: 1200, centre: { x: 96, z: 64 }, entry: { x: 96, z: 46 }, radius: 22, counter: 'Lure his charge into the truck or perimeter wall. Three impacts stop him.' },
] as const;
export type L8BossId = typeof l8BossArenas[number]['id'];
export const l8ArenaKeys = l8BossArenas.map(a => `arena-${a.id}`);

/** The service yard has two public approaches. Its keeper gates hold the
 * vehicle route until the five enclosure fights are cleared. */
export const l8YardWalls = [
  { x: 84, z: 51, halfX: .25, halfZ: 5 },
  { x: 84, z: 77, halfX: .25, halfZ: 13 },
  { x: 88, z: 46, halfX: 4, halfZ: .25 },
  { x: 108, z: 46, halfX: 8, halfZ: .25 },
] as const;
export const l8YardGates = [
  { x: 84, z: 60, halfX: .25, halfZ: 4 },
  { x: 96, z: 46, halfX: 4, halfZ: .25 },
] as const;

export const l8EncounterGates = {
  flamingo: { x: 0, z: -52, halfX: 7, halfZ: .25 }, zebra: { x: 60, z: 52, halfX: 7, halfZ: .25 },
  monkey: { x: -20, z: 26, halfX: .25, halfZ: 6 }, lion: { x: -60, z: -52, halfX: 7, halfZ: .25 },
  gorilla: { x: 60, z: -52, halfX: 7, halfZ: .25 }, elephant: { x: 116, z: 80, halfX: .25, halfZ: 8 },
} as const;
