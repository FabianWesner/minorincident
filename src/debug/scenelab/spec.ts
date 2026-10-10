import type { TimeOfDay } from '../../data/timeOfDay';
import type { DistrictGameplay, DistrictId, DistrictLayout, LevelComposition, Placement, Point, Tier } from '../../levels/districts/types';
import type { AssetDef } from '../../assets/types';

/**
 * Scene Lab spec: an isolated scene composed from real game content (see docs/tools/scene-lab.md).
 * Positions are game metres on the ground plane ([x, z]; props may give [x, y, z]); yaw is in DEGREES about +Y,
 * the same convention as layout placements (a yaw-0 prop faces its authored forward, an actor at yaw 0 faces +X).
 */
export interface SceneSpec {
  name?: string;
  seed?: number;
  /** Flat ground under the scene (default grass). `district` keeps the baked ground of `layout.district`. */
  ground?: 'grass' | 'asphalt' | 'sidewalk' | 'district';
  /** Edge of the square synthetic slab in metres (default 40). Ignored when `layout.bbox` sets the extent. */
  size?: number;
  /** Lighting preset (src/data/timeOfDay.ts): L1 (game morning), L2, L3, L4/golden, L5, L6, night. */
  time?: TimeOfDay;
  weather?: import('../../data/weather').WeatherKind;
  /** Evolve only the weather before assembly (seconds of precipitation accumulation). */
  weatherWarmup?: number;
  /** Decay tier W0-W5 (placements with minTier/maxTier outside it are dropped). */
  tier?: Tier;
  /** Depth of field as in L1 (default true). */
  dof?: boolean;
  /** Copy placements from a shipped district layout. Positions stay in district coordinates unless `recenter`. */
  layout?: { level?: 'L2' | 'L3' | 'L4' | 'L5' | 'L6'; district: DistrictId; bbox?: [Point, Point]; ids?: string[]; assets?: string[]; anchors?: string[]; recenter?: boolean };
  props?: PropSpec[];
  actors?: ActorSpec[];
  vehicles?: VehicleSpec[];
  /** Real E26 rails in the synthetic district, in world metres. */
  barricadeSlots?: import('../../sim/interact/Barricades').BarricadeSlot[];
  /** Effects and actor commands on a frame timeline (frame 0 = right after load). */
  script?: ScriptStep[];
  camera?: CameraSpec;
  /** Default frame count / screenshot frames / video seconds for the runner (CLI flags override). */
  frames?: number;
  shots?: number[];
  video?: number;
  /** Contact sheet: one low-res snapshot every N frames (max 24 cells) written as one `sheet.jpg` grid, frame number in each cell. */
  sheet?: number;
  /** Debug: include each actor's per-frame motion samples (`metrics.actors.<id>.track`: frame, clip/label, speed, feet). */
  trace?: boolean;
  /** Clipping report options: `ignore` pairs of placement ids or asset ids; `sameAsset` also checks chains of one
   * asset (fence/hedge runs share end posts by design, so they are skipped by default); `slackCm` (default 2) is how far
   * a bone's flesh radius may sink into a prop surface before it is reported. */
  clipping?: { ignore?: [string, string][]; /** Tree crowns, bushes and hedges may overlap anything by design (trees rise behind houses, bushes stand in beds). */ ignoreFoliage?: boolean; sameAsset?: boolean; slackCm?: number };
  expect?: Expectations;
  /** L1 beat 9 house emergence (HouseEmergence, the game's own code): from `frame` (default 30) `count` (default 3)
   * residents come out of `house`'s front door (a placement id in the scene), `staggerS` apart (default [1.5, 4]), and
   * chase the courier. Residents are actors `<id>-0` .. (default id `resident`). */
  /** Exercise the shipped checkpoint closure rule with the scene's courier and live officer followers. */
  armyBoom?: { x: number; z?: number; closed?: boolean };
  emerge?: { house: string; count?: number; staggerS?: number | [number, number]; frame?: number; id?: string; /** Walk-out pace m/s (default the 1.25 m/s house stumble; the L1 lab staff run out at 5.3). */ speedMs?: number };
}
export interface PropSpec { id?: string; asset: string; at: [number, number] | [number, number, number]; yaw?: number; /** Initial quaternion for a displaced pushable fixture. */ rotation?: [number, number, number, number]; scale?: number | [number, number, number]; tint?: string }
export type ActorKind = 'courier' | 'pedestrian' | 'infected' | 'corgi';
export interface Look { model?: string; tint?: string; accessories?: string[]; handProp?: string | null; tier?: 'frail' | 'average' | 'athletic'; role?: string }
export interface ActorSpec {
  id?: string;
  kind: ActorKind;
  at?: [number, number];
  yaw?: number;
  /** Pedestrian look (model npc.civilian-*, tint #rrggbb, accessories, handProp); courier: survivor variant via `model: 'female'|'male'`. */
  look?: Look;
  /** Infected archetype (src/data/infected.ts), default infected.runner. */
  archetype?: string;
  /** Spawn N copies on a ring of `spread` metres around `at` (ids get -1, -2 ...). */
  count?: number;
  spread?: number;
  state?: Action;
  /** Courier only: [left, right] weapons, e.g. ["weapon.bat", "weapon.fists"] (default: empty-handed as at the L1 start), and god mode (default true). */
  loadout?: [string | string[], string | string[]];
  god?: boolean;
}
export interface VehicleSpec { id?: string; asset: string; at: [number, number]; yaw?: number; path?: Point[]; panic?: boolean; /** Run the real passenger-ride driver, starting at an arc distance (fixture setup only). */ l2Ride?: { distanceM?: number; speedMs?: number } }
/** Actor commands. Strings are shorthands: 'idle' | 'chase' | 'follow' | 'flee' | 'infect'. */
export type Action =
  | 'idle' | 'chase' | 'follow' | 'flee' | 'infect'
  | { idle: true }
  | { walk: Point[]; loop?: boolean }
  | { run: Point[]; loop?: boolean }
  | { moveTo: Point; pace?: 'walk' | 'run' }
  | { turn: number }
  | { sit: string; seconds?: number }
  | { routine: 'sit'|'treat'|'rest'|'talk'|'share' }
  | { attack: string; seconds?: number; side?: 'LEFT' | 'RIGHT' }
  | { select: 'LEFT' | 'RIGHT'; index?: number }
  /** Courier: one real click on the drawn body part of an actor, resolved by the game's click pick (`metrics.clicks`). */
  | { click: string; part?: 'head' | 'chest' | 'hip' | 'feet' }
  | { hit: { from?: string | Point; heavy?: boolean; amount?: number } }
  | { infect: { by?: string; instant?: boolean } }
  | { mountBike: string }
  | { dismount: true }
  | { interact: true }
  | { chase: string }
  | { flee: Point }
  /** E21 allied fighter v2 (pedestrians only): an officer or soldier with a handgun/rifle who holds its post and shoots
   * visible infected, or (with `follow`) joins the courier's squad at the given slot (0-3), exactly as the L3 squad. */
  /** E21/E22 allied fighter. `weapon` selects the L4 v3 kit (soldier rifle, HMG crew, armed civilian pistol / hunting rifle / improvised melee); without it the L3 officer or soldier gun. */
  | { ally: { role?: 'officer' | 'soldier' | 'civilian' | 'firefighter'; follow?: string; slot?: number; weapon?: 'rifle' | 'hmg' | 'pistol' | 'hunting-rifle' | 'pipe' | 'bat' | 'crowbar' } }
  /** E23 survivor (pedestrians only): follows the courier exactly as the L5 followers do (slot 0-4: behind her, alternating sides, 2-5 m; crouches while an infected is within 8 m). */
  | { survivor: { slot?: number } }
  /** Pedestrian: the L1 hand-over choreography (src/sim/missions/doorRoute.ts) - out of `building`'s street door (a
   * placement id or asset id), carrying the parcel to `meet` (a point, or an actor id: arm's length in front of it), a
   * `pauseS` give/wave, then back in the same way. `legacy` replays the pre-2026-10-08 straight-line walk (A/B only). */
  | { handover: { building: string; meet: Point | string; pauseS?: number; /** Arm's length in front of an actor `meet` (default 1.05 m, the L1 clerk; the technician uses 1.4). */ standoff?: number; legacy?: boolean } };
export type ScriptStep = { frame: number } & ({ actor: string; do: Action } | { effect: EffectSpec } | { camera: CameraSpec } | { time: TimeOfDay } | { weather: import('../../data/weather').WeatherKind });
export type EffectSpec =
  | { lightning: Point; consequence?: 'fire' | 'blackout' }
  | { blast: string; at: Point }
  | { barricadeHit: string; amount: number }
  | { wreck: string }
  | { fire: Point; radius?: number; duration?: number }
  | { smoke: Point; radius?: number };
export type CameraSpec =
  | { mode: 'game'; target?: Point | string; zoom?: number }
  | { mode: 'orbit'; target?: [number, number, number] | Point | string; radius?: number; azimuth?: number; polar?: number; spin?: number }
  | { mode: 'close'; target?: [number, number, number] | Point | string; radius?: number; azimuth?: number }
  | { mode: 'pose'; position: [number, number, number]; target: [number, number, number] }
  | { mode: 'follow'; actor: string; zoom?: number };
/** Optional pass/fail gates; the runner exits non-zero when one fails. */
export interface Expectations {
  consoleErrors?: number;
  clippingMax?: number;
  /** Placement pairs whose LOD0 meshes cut through each other (`clipping.static` only; bone hits not counted). */
  staticOverlapMax?: number;
  footSlideMaxCm?: number;
  /** Deepest sole point below the floor, in cm (feet through the ground). */
  footSinkMaxCm?: number;
  /** Longest run of consecutive frames in which a courier sole zig-zags vertically by >= 0.8 cm (a bobbing body or foot). */
  footJitterRunMax?: number;
  /** Deepest torso/neck/head interpenetration between two living, standing actors, in cm (`metrics.bodies`; 2 cm slack). */
  bodyOverlapMaxCm?: number;
  /** Corgi trunk/head against the courier's drawn body, including both legs. */
  corgiCourierOverlapMaxCm?: number;
  /** Greatest trailing distance along the running courier's velocity (speed > 2.5 m/s). */
  corgiRunLagMaxM?: number;
  /** Most frames any living actor was inside the camera frustum but not drawn (invisible-but-active). */
  undrawnFramesMax?: number;
  yawDriftMaxDeg?: number;
  torsoPitchMaxDeg?: number;
  /** Clicks on a drawn body that did not start (or queue) an attack on that actor within 100 ms (`metrics.clicks`). */
  clickMissMax?: number;
  drawCallsMax?: number;
  trianglesMax?: number;
  /** `emerge`: residents whose first drawn position is past the door threshold, or never drawn (they must be drawn first inside the building). */
  emergeOutsideMax?: number;
  /** Frames any actor drew its far LOD (lod2) within 14 m of the camera. */
  farLodCloseMax?: number;
  /** Frames a living actor stood in a door aperture or leaf sweep (src/data/buildingDoors.ts) while that door was not
   * fully open (`metrics.doors`). */
  doorClosedFramesMax?: number;
  /** Most bone-vs-prop clipping hits (`clipping.actors`, see `clipping` options). */
  actorHitsMax?: number;
  /** Deepest drawn tyre point below the drawn ground (raycast against the district's rendered meshes), in cm, for the bike and cars (`metrics.wheels`). */
  wheelSinkMaxCm?: number;
  /** Infected pursuit (`metrics.pursuit`): longest run of frames an L1 infected that should move stood still (boxed, pocketed). */
  stuckActorFramesMax?: number;
  /** Most frames an infected was not chasing/attacking while the living courier was within 6 m in clear sight. */
  lostTargetNearFramesMax?: number;
  /** Farthest an infected chasing the running courier got ahead of her along her running direction, in metres. */
  overshootMaxM?: number;
  /** At least this many infected wind-ups (telegraphs) aimed at the courier: it closes in and attacks. */
  courierSwingsMin?: number;
  /** At least this many infected attacks that landed on the courier (`infected.attack`). */
  courierAttacksMin?: number;
  /** A pedestrian is bitten (`outbreak.bite`) by this frame. */
  firstBiteFrameMax?: number;
  /** Deepest drawn pushable mesh below the drawn ground. */
  propSinkMaxCm?: number;
  /** Require actual prop contact samples, preventing an empty scene passing. */
  propGroundSamplesMin?: number;
  vehicleYawRateMaxDegS?: number;
  vehicleBodyOverlapsMax?: number;
  /** Prevent a blocked, stationary ride from passing its motion gates. */
  vehicleRideRemainingMaxM?: number;
  /** Highest drawn tyre bottom above the drawn ground, in cm (a floating wheel). */
  wheelFloatMaxCm?: number;
  /** Frames the courier bike was in view but not drawn, or drawn more than 0.6 m from its sim position (`metrics.bike`). */
  bikeUndrawnFramesMax?: number;
  /** Worst one-frame hub height spike of any wheel (up then straight back down), in cm: a height pop, not a real step. */
  wheelSpikeMaxCm?: number;
}

const rad = (deg: number | undefined) => (deg ?? 0) * Math.PI / 180;
/** Light group that every Scene Lab placement uses: powered at every tier. */
export const labLightGroup = 'scene-lab';
export interface BuiltScene { composition: LevelComposition; layout: DistrictLayout; placements: Placement[]; center: Point; playerStart: Point }

/** Minimal validation with readable messages: a QA agent sees exactly which field is wrong. */
export function validateSpec(spec: SceneSpec, assets: Map<string, AssetDef>): string[] {
  const errors: string[] = [], ids = new Set<string>();
  const point = (p: unknown, label: string) => { if (!Array.isArray(p) || p.length < 2 || p.length > 3 || !p.every(Number.isFinite)) errors.push(`${label}: expected [x, z] numbers`); };
  if (spec.size !== undefined && !(spec.size >= 8 && spec.size <= 400)) errors.push('size: 8..400 m');
  if (spec.ground && !['grass', 'asphalt', 'sidewalk', 'district'].includes(spec.ground)) errors.push(`ground: unknown ${spec.ground}`);
  if (spec.ground === 'district' && !spec.layout) errors.push('ground "district" needs layout.district');
  spec.props?.forEach((p, i) => { if (!assets.has(p.asset)) errors.push(`props[${i}].asset: unknown manifest id ${p.asset}`); point(p.at, `props[${i}].at`); if (p.id) { if (ids.has(p.id)) errors.push(`duplicate id ${p.id}`); ids.add(p.id); } });
  let couriers = 0;
  spec.actors?.forEach((a, i) => {
    if (!['courier', 'pedestrian', 'infected', 'corgi'].includes(a.kind)) errors.push(`actors[${i}].kind: ${a.kind}`);
    if (a.kind === 'courier') couriers++;
    if (a.at) point(a.at, `actors[${i}].at`);
    if (a.id) { if (ids.has(a.id)) errors.push(`duplicate id ${a.id}`); ids.add(a.id); }
    if (a.look?.model && a.kind === 'pedestrian' && !assets.has(a.look.model)) errors.push(`actors[${i}].look.model: unknown ${a.look.model}`);
  });
  if (couriers > 1) errors.push('at most one courier (it is the player entity)');
  spec.vehicles?.forEach((v, i) => { point(v.at, `vehicles[${i}].at`); if (v.id) { if (ids.has(v.id)) errors.push(`duplicate id ${v.id}`); ids.add(v.id); } });
  if (spec.emerge && (typeof spec.emerge.house !== 'string' || !spec.layout)) errors.push('emerge: needs a house placement id from layout');
  spec.script?.forEach((s, i) => { if (!Number.isInteger(s.frame) || s.frame < 0) errors.push(`script[${i}].frame: nonnegative integer`); });
  return errors;
}

/** Synthetic one-district composition: kept layout placements plus spec props, minimal gameplay, flat or baked ground. */
export function buildScene(spec: SceneSpec, assets: Map<string, AssetDef>, source?: DistrictLayout): BuiltScene {
  const tier = spec.tier ?? 0, bbox = spec.layout?.bbox;
  let kept: Placement[] = [];
  if (source && spec.layout) {
    const match = (p: Placement) => (!bbox || p.position[0] >= Math.min(bbox[0][0], bbox[1][0]) && p.position[0] <= Math.max(bbox[0][0], bbox[1][0]) && p.position[2] >= Math.min(bbox[0][1], bbox[1][1]) && p.position[2] <= Math.max(bbox[0][1], bbox[1][1]))
      && (!spec.layout!.ids || spec.layout!.ids.includes(p.id)) && (!spec.layout!.assets || spec.layout!.assets.some(a => a.endsWith('*') ? p.assetId.startsWith(a.slice(0, -1)) : p.assetId === a));
    kept = source.placements.filter(p => match(p) && p.minTier <= tier && p.maxTier >= tier).map(p => structuredClone(p));
  }
  // Recentering moves the crop (and its bbox) so its centre lands on the origin.
  const shift: Point = spec.layout?.recenter && bbox ? [-(bbox[0][0] + bbox[1][0]) / 2, -(bbox[0][1] + bbox[1][1]) / 2] : [0, 0];
  for (const p of kept) { p.position[0] += shift[0]; p.position[2] += shift[1]; for (const k of ['min', 'max'] as const) { p.visualAabb[k][0] += shift[0]; p.visualAabb[k][2] += shift[1]; } p.lightGroup = labLightGroup; }
  spec.props?.forEach((prop, i) => kept.push(placementFor(prop, i, assets)));
  const center: Point = bbox && !spec.layout?.recenter ? [(bbox[0][0] + bbox[1][0]) / 2, (bbox[0][1] + bbox[1][1]) / 2] : [0, 0];
  const halfX = bbox ? Math.abs(bbox[1][0] - bbox[0][0]) / 2 + 8 : (spec.size ?? 40) / 2, halfZ = bbox ? Math.abs(bbox[1][1] - bbox[0][1]) / 2 + 8 : (spec.size ?? 40) / 2;
  const [x0, x1, z0, z1] = [center[0] - halfX, center[0] + halfX, center[1] - halfZ, center[1] + halfZ];
  const bounds: Point[] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]];
  const courier = spec.actors?.find(a => a.kind === 'courier');
  // Without a courier the (hidden) player waits in a corner, away from the subject.
  const playerStart: Point = courier?.at ? [courier.at[0], courier.at[1]] : [x1 - 2, z1 - 2];
  const district: DistrictId = spec.layout?.district ?? 'D-GROVE';
  const solid = kept.filter(p => assets.get(p.assetId)?.world?.solid);
  const layout: DistrictLayout = {
    version: 1, district, title: `Scene Lab: ${spec.name ?? 'scene'}`, geometryHash: 'scene-lab', bounds,
    roads: { nodes: [], edges: [] }, placements: kept, anchors: {}, zones: {}, buildings: [],
    colliders: solid.map(p => ({ id: p.id, aabb: structuredClone(p.visualAabb), minTier: p.minTier, maxTier: p.maxTier })),
    walkable: { cellSize: 1, excluded: [] }, lawns: spec.ground === 'district' && source ? source.lawns : spec.ground === undefined || spec.ground === 'grass' ? [{ min: [x0, z0], max: [x1, z1] }] : [],
    decorations: [], lightGroups: [{ id: labLightGroup, offAt: 5 }], acousticZones: [],
    surfaces: spec.ground === 'district' && source ? source.surfaces : [{ surface: spec.ground === 'asphalt' ? 'asphalt' : spec.ground === 'sidewalk' ? 'tile' : 'grass', polygon: bounds }], layers: [],
  };
  // Metro assemblies contain traversable rooms: their authored supports and walls
  // must survive a crop rather than becoming one solid manifest footprint.
  if(source?.district==='D-SUBWAY')layout.colliders=source.colliders.filter(c=>c.aabb.max[0]>=x0-shift[0]&&c.aabb.min[0]<=x1-shift[0]&&c.aabb.max[2]>=z0-shift[1]&&c.aabb.min[2]<=z1-shift[1]).map(c=>{const out=structuredClone(c);for(const k of ['min','max'] as const){out.aabb[k][0]+=shift[0];out.aabb[k][2]+=shift[1];}return out;});
  for (const name of spec.layout?.anchors ?? []) {
    const anchor = source?.anchors[name];
    if (!anchor) throw new Error(`Unknown layout anchor ${name}`);
    layout.anchors[name] = structuredClone(anchor);
    layout.anchors[name].position[0] += shift[0]; layout.anchors[name].position[2] += shift[1];
  }
  const gameplay: DistrictGameplay = { id: district, playerStart: { x: playerStart[0], z: playerStart[1] }, spawns: [], spawnVolumes: [], triggers: [], objectives: [], interactables: [], civilianRoutes: [], safePoints: [], photoSpots: [], decay: [] };
  gameplay.barricades = spec.barricadeSlots;
  const composition: LevelComposition = {
    id: 'scene-lab', tier, timeOfDay: spec.time ?? 'L1', districts: [{ id: district, origin: [0, 0], gameplay }],
    scene: { glb: spec.ground === 'district', ground: spec.ground === 'asphalt' || spec.ground === 'sidewalk' ? spec.ground : 'grass', perimeter: false, courier: true },
  };
  return { composition, layout, placements: kept, center, playerStart };
}

/** Same placement record as the Blender layout exporter (tools/blender/sslib/layout.py `place`). */
export function placementFor(prop: PropSpec, index: number, assets: Map<string, AssetDef>): Placement {
  const def = assets.get(prop.asset);
  if (!def) throw new Error(`Unknown asset ${prop.asset}`);
  const scale: [number, number, number] = typeof prop.scale === 'number' ? [prop.scale, prop.scale, prop.scale] : prop.scale ?? [1, 1, 1];
  const yaw = rad(prop.yaw), pos: [number, number, number] = prop.at.length === 3 ? [prop.at[0], prop.at[1], prop.at[2]] : [prop.at[0], 0, prop.at[1]];
  const dims = [def.dimensions.x * scale[0], def.dimensions.y * scale[1], def.dimensions.z * scale[2]];
  const sx = Math.abs(Math.cos(yaw)) * dims[0] + Math.abs(Math.sin(yaw)) * dims[2], sz = Math.abs(Math.sin(yaw)) * dims[0] + Math.abs(Math.cos(yaw)) * dims[2];
  return { id: prop.id ?? `${prop.asset}:lab${index}`, assetId: prop.asset, position: pos, yaw, scale, minTier: 0, maxTier: 5, allowRoad: true, lightGroup: labLightGroup,
    visualAabb: { min: [pos[0] - sx / 2, pos[1], pos[2] - sz / 2], max: [pos[0] + sx / 2, pos[1] + dims[1], pos[2] + sz / 2] }, ...(prop.tint ? { tint: prop.tint } : {}) };
}
