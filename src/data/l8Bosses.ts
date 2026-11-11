/** L8 encounter tuning in metres, HP and fixed ticks.
 * r31-flamingo (PO 11-10): HP is sized to the L8 weapons (handgun, axe, shotgun, MG; no rocket). Damage.ts applies x0.6 outside an exposed window (x1.8 inside) and x0.2 from allies,
 * so one hit is handgun 12, MG 8.4, axe ~34, shotgun ~110-145. Flamingo/monkey 36: handgun 3, MG 5, axe 2, shotgun 1. Zebra 150: shotgun 2. Lion 250 ~ 30 MG. Gorilla 500 ~ 60 MG. Elephant 1200 chips; the 3 wall impacts end it. Entries sit on connected public paths. */
export const l8BossArenas = [
  { id: 'flamingo', name: 'Flamingo flock', count: 8, hp: 36, centre: { x: -6, z: -27 }, entry: { x: 0, z: -9 }, radius: 17, counter: 'Step sideways out of the shadow lane; sweep the birds as they land.' },
  { id: 'lion', name: 'Lion and lioness', count: 2, hp: 250, centre: { x: -60, z: -32 }, entry: { x: -60, z: -56 }, radius: 23, counter: 'Keep your back to the rocks. Dodge sideways at the glint and fire after the landing.' },
  { id: 'monkey', name: 'Monkey pack', count: 7, hp: 36, centre: { x: -6, z: 20 }, entry: { x: -24, z: 4 }, radius: 12, counter: 'Use the doorway to stop the pack surrounding you. Melee shakes off a grab.' },
  { id: 'zebra', name: 'Zebra herd', count: 4, hp: 150, centre: { x: 60, z: 32 }, entry: { x: 60, z: 56 }, radius: 23, counter: 'Leave the dust lane. The fence turns the herd; shoot the stragglers.' },
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

/** The elephant's drive-out gate (the east wall opening); every other gate is part of the route below. */
export const l8EncounterGates = {
  elephant: { x: 116, z: 80, halfX: .25, halfZ: 8 },
} as const;

/** r33-l8route (PO UAT 11-10: "The L8 needs a clear path the user has to move"). The zoo is one line of six cells. Every enclosure is the only door between two cells:
 * in by `entry` (closes behind the group when the fight starts), out by `exit` (opens when the arena clears). Hedge lines and fixed army barricades in
 * layouts/D-ZOO close every other way (docs/reports/r33-l8route). `zone` is the enclosure interior inset 1 m: the courier inside it starts the fight. */
export interface L8Box { x: number; z: number; halfX: number; halfZ: number }
export interface L8RouteStage {
  id: L8BossId; zone: { x0: number; z0: number; x1: number; z1: number };
  entry: L8Box | null; exit: L8Box | null;
  /** Marker nodes of the leg that leads to this arena, in walking order (the last one is just inside its entry gate). */
  nodes: readonly { x: number; z: number }[]; text: string; clearedLine: string;
}
export const l8Route: readonly L8RouteStage[] = [
  { id: 'flamingo', zone: { x0: -13, z0: -51, x1: 13, z1: -13 }, entry: { x: 0, z: -12, halfX: 3, halfZ: .25 }, exit: { x: 0, z: -52, halfX: 3, halfZ: .25 },
    nodes: [{ x: 0, z: -9 }, { x: 0, z: -16 }], text: 'Through the flamingo pond. The keepers have opened the gate', clearedLine: 'L8.route-flamingo' },
  { id: 'lion', zone: { x0: -81, z0: -51, x1: -39, z1: -13 }, entry: { x: -60, z: -52, halfX: 3, halfZ: .25 }, exit: { x: -60, z: -12, halfX: 3, halfZ: .25 },
    nodes: [{ x: 0, z: -52 }, { x: 0, z: -64 }, { x: -60, z: -64 }, { x: -60, z: -56 }], text: 'Take the service path to the lion rocks', clearedLine: 'L8.route-lion' },
  { id: 'monkey', zone: { x0: -27, z0: 9, x1: 13, z1: 31 }, entry: { x: -24, z: 8, halfX: 2.5, halfZ: .25 }, exit: { x: -24, z: 32, halfX: 2.5, halfZ: .25 },
    nodes: [{ x: -60, z: -12 }, { x: -60, z: 0 }, { x: -24, z: 0 }, { x: -24, z: 4 }], text: 'Take the west boulevard to the primate yard', clearedLine: 'L8.route-monkey' },
  { id: 'zebra', zone: { x0: 39, z0: 13, x1: 81, z1: 51 }, entry: { x: 60, z: 52, halfX: 3, halfZ: .25 }, exit: { x: 60, z: 12, halfX: 3, halfZ: .25 },
    nodes: [{ x: -24, z: 32 }, { x: -24, z: 64 }, { x: 60, z: 64 }, { x: 60, z: 56 }], text: 'Cross the visitor field to the zebra paddock', clearedLine: 'L8.route-zebra' },
  { id: 'gorilla', zone: { x0: 39, z0: -51, x1: 81, z1: -13 }, entry: { x: 60, z: -12, halfX: 3, halfZ: .25 }, exit: { x: 82, z: -31.77, halfX: .25, halfZ: 3.6 },
    nodes: [{ x: 60, z: 12 }, { x: 60, z: 0 }, { x: 60, z: -8 }], text: 'Cross the east boulevard into the gorilla house', clearedLine: 'L8.route-gorilla' },
  { id: 'elephant', zone: { x0: 86, z0: 54, x1: 118, z1: 86 }, entry: null, exit: null,
    nodes: [{ x: 82, z: -32 }, { x: 96, z: -32 }, { x: 96, z: 40 }, { x: 96, z: 56 }], text: 'Down the service lane to the armored vehicle', clearedLine: 'L8.route-elephant' },
];
/** The plaza's three doors shut once the group stands inside the plaza cell after the breach hold. */
export const l8PlazaGates = {
  w: { x: -14, z: 0, halfX: .25, halfZ: 3 }, e: { x: 14, z: 0, halfX: .25, halfZ: 3 }, s: { x: 24, z: 12, halfX: 2.5, halfZ: .25 },
} as const;
/** The plaza cell: the group must be inside it for the gates to shut. */
export const l8PlazaCell = { x0: -13, z0: -11, x1: 13, z1: 7 } as const;

export interface L8GateContext { arenas: readonly { id: L8BossId; phase: number; armed?: boolean }[]; sealed: boolean }
/** One rule for the sim barriers and the drawn fences: `<id>.entry`, `<id>.exit` or `plaza.<w|e|s>`. */
export function l8GateClosed(key: string, ctx: L8GateContext): boolean {
  if (key.startsWith('plaza.')) return ctx.sealed;
  const [id, side] = key.split('.') as [L8BossId, 'entry' | 'exit'];
  const index = ctx.arenas.findIndex(a => a.id === id), arena = ctx.arenas[index];
  if (!arena) return true;
  const fighting = arena.phase > 0 && arena.phase < 3;
  if (side === 'entry') return (index > 0 && ctx.arenas[index - 1].phase !== 3) || fighting && !!arena.armed;
  // The pond's north door stays open while the tunnel runners need it (the opening alarm); it shuts with the plaza.
  if (id === 'flamingo') return ctx.sealed && arena.phase !== 3;
  return arena.phase !== 3;
}
export const inRect = (p: { x: number; z: number }, r: { x0: number; z0: number; x1: number; z1: number }) => p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1;
