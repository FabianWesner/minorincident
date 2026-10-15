import { isWorldTier } from '../../levels/districts/types';
import { vehicleDecayFallback } from '../../assets/vehicleDecay';
import type { TimeOfDay } from '../../data/timeOfDay';
import type { DistrictGameplay, DistrictId, DistrictLayout, LevelComposition, Placement, Point, Tier } from '../../levels/districts/types';
import type { AssetDef } from '../../assets/types';

/**
 * Scene Lab spec: an isolated scene composed from real game content (see docs/tools/scene-lab.md).
 * Positions are game metres on the ground plane ([x, z]; props may give [x, y, z]); yaw is in DEGREES about +Y,
 * the same convention as layout placements (a yaw-0 prop faces its authored forward, an actor at yaw 0 faces +X).
 */
export interface SceneSpec {
  /** Native campaign menu over the game camera; run with --query ui=1. */
  menuScreen?: 'title' | 'levels' | 'credits';
  /** Production L4 convoy, population, braking and unload controller on an uncropped Fairhaven layout. */
  l4Convoy?: boolean | 'parked' | 'hold';
  /** Production L3 rendezvous, rescued group and full authored finale crowd. */
  l3Rendezvous?: boolean;
  /** Production L5 discovery/follower controller, with named prior finds restored before the shot. */
  l5Aftermath?: { found: string[]; alphaAt?: Point; metroIngress?: boolean };
  /** One R1–R6 production encounter, with the quality tier's authored crowd. */
  cureEncounter?: string;
  /** Production L10 graph/preset at a region checkpoint; fixture anchors stay on its existing slab. */
  cureProgression?: { checkpoint?: string; authored?: boolean; /** Precharged fixture still needs an explicit release interaction. */ releaseReady?: boolean; /** Restored active hold for exact boundary samples. */ chargeActive?: boolean; /** Release-relative fixture clock for ending frame sequences. */ epilogueElapsed?: number; anchors?: Record<string, Point> };
  /** Use the production L7 formation for authored survivor actors, without starting the mission population. */
  l7Group?: boolean;
  /** With `l7Group`: the production L7 bus (set piece, blocker), boarding of the authored survivors and the departure shot. */
  /** `follow` retains the game camera on the bus instead of the authored departure shot. */
  l7Departure?: boolean | 'follow';
  /** Fixture-only eligibility overrides, restored after view initialization. */
  barArchetypes?: string[];
  /** High-tier fixture cap (low uses half), for E18 stress scenes; defaults to L1 caps. */
  infectedCap?: number;
  name?: string;
  seed?: number;
  /** Flat ground under the scene (default grass). `district` keeps the baked ground of `layout.district`. */
  ground?: 'grass' | 'asphalt' | 'sidewalk' | 'district';
  /** Edge of the square synthetic slab in metres (default 40). Ignored when `layout.bbox` sets the extent. */
  size?: number;
  /** Lighting preset (src/data/timeOfDay.ts): L1 (game morning), L2, L3, L4/golden, L5, L6, night. */
  time?: TimeOfDay;
  weather?: import('../../data/weather').WeatherKind;
  /** Same authored blending path as the campaign, without a player control. */
  weatherTimeline?: readonly import('../../data/weather').WeatherKey[];
  /** Evolve only the weather before assembly (seconds of precipitation accumulation). */
  weatherWarmup?: number;
  /** Decay tier W0-W6 (placements with minTier/maxTier outside it are dropped). */
  tier?: Tier;
  /** Depth of field as in L1 (default true). */
  dof?: boolean;
  /** Copy placements from a shipped district layout. Positions stay in district coordinates unless `recenter`. */
  layout?: { level?: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7'; district: DistrictId; bbox?: [Point, Point]; ids?: string[]; assets?: string[]; anchors?: string[]; recenter?: boolean };
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
  /** Navigation-contrast measurement (E31-AC16): route vs verge from `layouts/<district>/routes.json` or an explicit `route`; gated by `expect.navContrastMin`. */
  contrast?: { district?: string; route?: [number, number][][]; halfWidthM?: number; vergeM?: number; stepM?: number; landmarks?: [number, number, number][] };
  expect?: Expectations;
  /** Canvas edge check for an isolated actor; normalized crop excludes HUD and other figures. */
  edgeNoise?: { rect: [number, number, number, number]; extremeEdgeShareMax: number; /** Outline pixels per sqrt(area) of the dark body mask; every sampled frame must stay under it. */ silhouetteRoughnessMax?: number };
  /** L1 beat 9 house emergence (HouseEmergence, the game's own code): from `frame` (default 30) `count` (default 3)
   * residents come out of `house`'s front door (a placement id in the scene), `staggerS` apart (default [1.5, 4]), and
   * chase the courier. Residents are actors `<id>-0` .. (default id `resident`). */
  /** E32 L10 Mega Alpha: the shipped MegaPursuit with its one Mega (actor `id`, default `mega`) introduced at `at`. Optional authored
   * `route` (nodes/links) and a `resident` box: outside it the pursuit runs coarse (off-region, the L9-S4 seam). `metrics.megaAlpha`. */
  /** Show the production HUD for distance-ring QA, with the game camera. */
  megaHud?: boolean;
  megaAlpha?: { id?: string; at: Point; route?: import('../../sim/ai/MegaPursuit').PursuitRoute | 'cure'; resident?: [Point, Point] };
  /** Exercise the shipped checkpoint closure rule with the scene's courier and live officer followers. */
  crossingCrash?: { health: number; /** Keep the departure anchor and adopt the authored APC for full-route probes. */ driveFromStart?: boolean; handover?: boolean };
  armyBoom?: { x: number; z?: number; closed?: boolean };
  /** L10 dispersal kit rotors/wheels: idle (default) or running at full rate. */
  dispersal?: { active?: boolean };
  /** L10 mounted rotary minigun (the shipped MountedGun, drawn by MountedGunView; do not also place `wpn.minigun-mounted` as a prop): `at` is
   * [x, z] or [x, deckHeight, z] like a 3-element prop, `yaw` the rest aim in degrees. `metrics.minigun`; courier actions mountGun / fireGun / dismountGun. */
  /** Show the real HUD panels in the screenshots (needs the game UI: run with `--query ui=1`). */
  hud?: boolean;
  minigun?: { at: [number, number] | [number, number, number]; yaw?: number };
  emerge?: { house: string; count?: number; staggerS?: number | [number, number]; frame?: number; id?: string; /** Walk-out pace m/s (default the 1.25 m/s house stumble; the L1 lab staff run out at 5.3). */ speedMs?: number };
}
export interface PropSpec { decay?: string; powerGroup?: string; powered?: boolean; id?: string; asset: string; at: [number, number] | [number, number, number]; yaw?: number; /** Initial quaternion for a displaced pushable fixture. */ rotation?: [number, number, number, number]; scale?: number | [number, number, number]; tint?: string }
export type ActorKind = 'courier' | 'pedestrian' | 'infected' | 'corgi' | 'animal';
export interface Look { model?: string; tint?: string; accessories?: string[]; handProp?: string | null; tier?: 'frail' | 'average' | 'athletic'; gearTier?: number; role?: string }
export interface ActorSpec {
  /** Healthy generic dog on the shipped pet lifecycle (seeded coat). */
  pet?: 'dog';
  /** Feet height for a stationary actor on a raised deck (metres above world ground). */
  floorY?: number;
  /** Use the same walking-foot support as the L5 metro followers. */
  supportFeet?: boolean;
  id?: string;
  kind: ActorKind;
  species?: import('../../sim/npc/types').ZooSpecies;
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
export interface VehicleSpec { /** E31: L9 floor policy (zero HP stays driveable at 60% speed, staged damage). `health` sets the durability. */ floor?: boolean; /** The courier drives it (active vehicle): `path` becomes her driving input; lamps, hull rim and aura as in play. */ driven?: boolean; health?: number; decay?: import('../../sim/vehicles/Vehicles').VehicleState['decay']; id?: string; asset: string; at: [number, number]; yaw?: number; path?: Point[]; panic?: boolean; /** Run the real passenger-ride driver, starting at an arc distance (fixture setup only). */ l2Ride?: { distanceM?: number; speedMs?: number } }
/** Actor commands. Strings are shorthands: 'idle' | 'chase' | 'follow' | 'flee' | 'infect'. */
export type Action =
  | 'idle' | 'chase' | 'follow' | 'flee' | 'infect'
  | { idle: true }
  | { walk: Point[]; loop?: boolean }
  | { run: Point[]; loop?: boolean }
  | { moveTo: Point; pace?: 'walk' | 'run' }
  | { turn: number }
  | { sit: string; seconds?: number }
  /** Water a flower placement (id, or nearest asset id): stand within 0.5 m of its footprint, face it, pour (MorningRoutines/Population rule). */
  | { water: string; seconds?: number }
  | { routine: 'sit'|'treat'|'rest'|'talk'|'share' }
  | { attack: string; seconds?: number; side?: 'LEFT' | 'RIGHT'; /** Courier holds the same planted-attack modifier as Shift. */ inPlace?: boolean; /** Simultaneous walking direction for firing-layer QA. */ move?: Point }
  /** Courier: ordinary pointer-target aim without held fire, for pose blending QA. */
  | { aim: string; seconds?: number; move?: Point }
  /** Courier: control the existing damage cheat for impact fixtures. */
  | { god: boolean }
  | { select: 'LEFT' | 'RIGHT'; index?: number }
  /** Courier: one real click on the drawn body part of an actor, resolved by the game's click pick (`metrics.clicks`). */
  | { click: string; part?: 'head' | 'chest' | 'hip' | 'feet' }
  | { hit: { from?: string | Point; heavy?: boolean; amount?: number } }
  | { infect: { by?: string; instant?: boolean } }
  | { drive: { throttle: number; steer?: number; seconds?: number } }
  | { boardCar: string } | { exitCar: string }
  | { mountBike: string }
  | { dismount: true }
  | { interact: true }
  /** Courier: man the mounted minigun (the real interact press), fire it at an actor or point for `seconds` (trigger held), leave it (the quick rocket dismount). */
  | { mountGun: true } | { fireGun: { at?: string | Point; seconds?: number } } | { dismountGun: true }
  | { chase: string }
  /** Infected starts a real outbreak grab of this human (defence/rescue review). */
  | { grab: string }
  /** Deterministic shared scheduler command and retained corpse fixture. */
  | { special: import('../../data/infected').InfectedSpecialMove; target: string }
  | { corpse: true }
  | { flee: Point }
  /** E21 allied fighter v2 (pedestrians only): an officer or soldier with a handgun/rifle who holds its post and shoots
   * visible infected, or (with `follow`) joins the courier's squad at the given slot (0-3), exactly as the L3 squad. */
  /** E21/E22 allied fighter. `weapon` selects the L4 v3 kit (soldier rifle, HMG crew, armed civilian pistol / hunting rifle / improvised melee); without it the L3 officer or soldier gun. */
  | { ally: { role?: 'officer' | 'soldier' | 'civilian' | 'firefighter'; follow?: string; slot?: number; weapon?: 'rifle' | 'hmg' | 'pistol' | 'hunting-rifle' | 'pipe' | 'bat' | 'crowbar' } }
  /** E23 survivor (pedestrians only): follows the courier exactly as the L5 followers do (slot 0-4: behind her, alternating sides, 2-5 m; briefly cowers then regroups when an infected is within 8 m). */
  | { survivor: { slot?: number } }
  /** Pedestrian: the L1 hand-over choreography (src/sim/missions/doorRoute.ts) - out of `building`'s street door (a
   * placement id or asset id), carrying the parcel to `meet` (a point, or an actor id: arm's length in front of it), a
   * `pauseS` give/wave, then back in the same way. `legacy` replays the pre-2026-10-08 straight-line walk (A/B only). */
  | { handover: { building: string; meet: Point | string; pauseS?: number; /** Arm's length in front of an actor `meet` (default 1.05 m, the L1 clerk; the technician uses 1.4). */ standoff?: number; legacy?: boolean } };
export type ScriptStep = { frame: number } & ({ actor: string; do: Action } | { spawnActor: ActorSpec } | { effect: EffectSpec } | { camera: CameraSpec } | { time: TimeOfDay } | { weather: import('../../data/weather').WeatherKind });
export type EffectSpec =
  | { metroShutter: number }
  /** A ground pickup (medkit, soda, ...) at [x, z]: its drawn height is checked by `metrics.grounding`. */
  | { pickup: 'medkit' | 'soda' | 'energy-drink'; at: Point }
  | { weaponPickup: string; at: Point; surfaceY?: number; yaw?: number }
  | { lightning: Point; consequence?: 'fire' | 'blackout' }
  | { blast: string; at: Point }
  | { barricadeHit: string; amount: number }
  /** Move a pushable placement (id) by [dx, dz] metres, optionally tipped on its side: seat-follow QA (the sitter must stand up and re-sit or leave). */
  | { moveProp: string; by: [number, number]; tip?: boolean }
  | { wreck: string }
  | { hazard: import('../../sim/interact/Hazards').HazardKind; at: Point; radius?: number; duration?: number; trigger?: 'bullet' | 'melee' }
  | { fire: Point; radius?: number; duration?: number }
  | { smoke: Point; radius?: number };
export type CameraSpec =
  | { mode: 'game'; target?: [number, number, number] | Point | string; zoom?: number }
  | { mode: 'orbit'; target?: [number, number, number] | Point | string; radius?: number; azimuth?: number; polar?: number; spin?: number }
  | { mode: 'close'; target?: [number, number, number] | Point | string; radius?: number; azimuth?: number }
  | { mode: 'pose'; position: [number, number, number]; target: [number, number, number] }
  | { mode: 'follow'; actor: string; zoom?: number };
/** Optional pass/fail gates; the runner exits non-zero when one fails. */
export interface Expectations {
  /** Numerical committed-body invariant, independent of camera/mesh clipping. */
  collisionFailuresMax?: number;
  collisionPendingMax?: number;
  /** Trace the submitted appearance through LOD/pose/frozen-corpse transitions. */
  appearanceChangesMax?: number;
  appearanceActorsMin?: number;
  appearanceCorpsesMin?: number;
  /** Require a real scheduler activation; dodge controls also retain courier health. */
  specialActiveMin?: number;
  specialActiveMove?: import('../../data/infected').InfectedSpecialMove;
  courierHpMin?: number;
  megaCoarseFramesMin?: number;
  megaDetailedFramesMin?: number;
  /** L4: rendered-hull + 0.3 m versus all live posed actor footprints, every sampled tick. */
  convoyOverlapFramesMax?: number;
  /** Count only visible living figures and channels actually drawn by their selected LOD. */
  infectedVarietyMin?: number;
  pedestrianVarietyMin?: number;
  sameLookShareMax?: number;
  infectedModelShareMax?: number;
  /** Longest consecutive capsule/static-prop footprint penetration (2 mm contact tolerance), sampled every frame. */
  propPenetrationFramesMax?: number;
  consoleErrors?: number;
  clippingMax?: number;
  /** Native hand triangles vs the drawn held prop, sampled every third frame. */
  heldPropIntersectionsMax?: number;
  heldPropSamplesMin?: number;
  /** Mug/phone: lowest drawn prop centre between hip (0) and shoulders (1) over all frames and LOD bands (`metrics.heldProps.holds`). */
  heldPropHoldMin?: number;
  /** Mug/phone: straightest right arm, shoulder-wrist distance over arm length (1 = a hanging straight arm). */
  heldPropArmStraightMax?: number;
  /** Placements lower than an occluder (1.1 m) drawn with the courier-hole cut material (`metrics.seeThrough.cutLowProps`); use 0. */
  seeThroughLowPropsMax?: number;
  /** Minimum frames the solid-occluder hole was open, so a cutaway fixture cannot pass without exercising it. */
  seeThroughOpenFramesMin?: number;
  /** PO 10-14: pixels that differ between the frame and the same frame with the solid-occluder cut forced off, outside the hole disc around the courier (radius = solidRadius, screen heights): buildings and vehicles that are not in the way must stay opaque. Use 0. */
  seeThroughCutPixelsMax?: number;
  /** Minimum differing pixels inside the hole disc: a real occluder must still be cut. */
  seeThroughCutInsideMin?: number;
  /** E32 close camera: while the Mega Alpha is within 14 m, the share of the courier's own screen pixels still visible (frame with the courier vs without her, crowd hidden as reference) on every sheet frame. */
  courierVisibleShareMin?: number;
  /** E32 close camera: while the Mega Alpha is within 6 m, its visible pixels (frame vs frame without the crowd) must stay at least this share of the viewport, so it still reads as a threat. */
  megaVisibleShareMin?: number;
  /** Placement pairs whose LOD0 meshes cut through each other (`clipping.static` only; bone hits not counted). */
  staticOverlapMax?: number;
  footSlideMaxCm?: number;
  /** Deepest sole point below the floor, in cm (feet through the ground). */
  footSinkMaxCm?: number;
  /** Longest run of consecutive frames in which a courier sole zig-zags vertically by >= 0.8 cm (a bobbing body or foot). */
  footJitterRunMax?: number;
  /** Deepest torso/neck/head interpenetration between two living, standing actors, in cm (`metrics.bodies`; 2 cm slack). */
  bodyOverlapMaxCm?: number;
  /** Attacker forearms against the courier's torso/backpack envelope; hands may make contact. */
  attackBodyOverlapMaxCm?: number;
  /** Corgi trunk/head against the courier's drawn body, including both legs. */
  corgiCourierOverlapMaxCm?: number;
  /** Greatest trailing distance along the running courier's velocity (speed > 2.5 m/s). */
  corgiRunLagMaxM?: number;
  /** Most frames any living actor was inside the camera frustum but not drawn (invisible-but-active). */
  undrawnFramesMax?: number;
  /** E32-AC10: |median detailed-mode speed / cruise − 1| of the Mega Alpha (`metrics.megaAlpha.cruiseError`). Use 0.02. */
  megaCruiseErrorMax?: number;
  /** E32-AC10 no teleport: largest single-tick displacement of the Mega Alpha while resident (`metrics.megaAlpha.stepMaxM`). */
  megaStepMaxM?: number;
  /** L10 finale numeric probes: closed ranges; missing probes fail. See metrics.cure. */
  cure?: Partial<Record<'chargeTicks' | 'insideFrames' | 'boundaryFrames' | 'outsideFrames' | 'outsideAdvance' | 'releaseCount' | 'radius' | 'titleFrames' | 'creditsFrames' | 'playableTravel' | 'survivors' | 'fanFrames' | 'pullScale' | 'healthyDamage' | 'lateDeaths' | 'insideMisses' | 'mistPuffs' | 'smokeOverBudget', [number, number]>>;
  /** Named controls must exist; checks final health, including each infected species. */
  actorHealth?: Record<string, [number, number]>;
  /** Actual travelled distance and maximum world X; seam fixtures must cross and return. */
  actorTravel?: Record<string, [number, number]>;
  actorMaxX?: Record<string, [number, number]>;
  /** L10-S6 mounted minigun gates (`metrics.minigun`): rounds fired, peak heat (0..1), frames locked out, frames mounted. */
  minigunRoundsMin?: number; minigunHeatPeakMin?: number; minigunLockedFramesMin?: number; minigunMountedFramesMin?: number;
  /** Lowest feet height of the courier from the first mount on (m): on the finale deck about 3.08, a drop to the street fails it. */
  minigunFeetMin?: number;
  /** Drawn frozen corpses / ground pickups further than this from the support at their xz (cm, `metrics.grounding`); a gate on zero drawn bodies fails (min counts below). */
  groundingMaxCm?: number;
  groundingCorpsesMin?: number;
  groundingPickupsMin?: number;
  yawDriftMaxDeg?: number;
  torsoPitchMaxDeg?: number;
  /** Clicks on a drawn body that did not start (or queue) an attack on that actor within 100 ms (`metrics.clicks`). */
  clickMissMax?: number;
  drawCallsMax?: number;
  trianglesMax?: number;
  /** Low-quality matrix ceiling when it differs from the high-quality ceiling (E18: 500k / 1.5M). */
  trianglesMaxLow?: number;
  /** `emerge`: residents whose first drawn position is past the door threshold, or never drawn (they must be drawn first inside the building). */
  emergeOutsideMax?: number;
  /** Frames any actor drew its far LOD (lod2) within 14 m of the camera. */
  farLodCloseMax?: number;
  /** Frames any placement was drawn from a coarser stand-in mesh than its selected LOD band, i.e. its LOD0/LOD1 had not arrived (`metrics.lodPlaceholders`). Use 0. */
  lodPlaceholderFramesMax?: number;
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
  /** Largest chassis roll/pitch of any vehicle (body up axis vs vertical), in degrees. */
  vehicleTiltMaxDeg?: number;
  /** Largest angle between a moving vehicle's heading and its travel direction (above 3 m/s): sideways sliding. */
  vehicleSlipMaxDeg?: number;
  /** Frames a driven vehicle above its dead-lamp damage stage had its headlights off. */
  headlightsDarkFramesMax?: number;
  /** Median over the sampled frames of the per-frame median route/verge luminance ratio ((hi + .02) / (lo + .02) on relative luminance; the WCAG .05 value is reported as `wcag05`) over the sampled frames; needs `contrast`. E31-AC16: 3. */
  navContrastMin?: number;
  /** The worst sampled frame may not fall below this (same ratio): no black stretch of road. */
  navContrastFloor?: number;
  /** Same ratio for the player's body (90th percentile of a box at the screen centre) against the verge ground. */
  playerContrastMin?: number;
  /** Same ratio for building facade samples (`contrast.landmarks`) against the verge ground. */
  landmarkContrastMin?: number;
  /** Highest final durability of any vehicle: attackers must actually damage the hull. */
  vehicleHealthMax?: number;
  /** At least this many E31 hull attack wind-ups on a vehicle (`metrics.pursuit.hullWindups`): the attackers keep attacking. */
  hullWindupsMin?: number;
}

const rad = (deg: number | undefined) => (deg ?? 0) * Math.PI / 180;
/** Light group that every Scene Lab placement uses: powered at every tier. */
export const labLightGroup = 'scene-lab';
export interface BuiltScene { composition: LevelComposition; layout: DistrictLayout; placements: Placement[]; center: Point; playerStart: Point }

/** Minimal validation with readable messages: a QA agent sees exactly which field is wrong. */
export function validateSpec(spec: SceneSpec, assets: Map<string, AssetDef>): string[] {
  const errors: string[] = [], ids = new Set<string>();
  const point = (p: unknown, label: string) => { if (!Array.isArray(p) || p.length < 2 || p.length > 3 || !p.every(Number.isFinite)) errors.push(`${label}: expected [x, z] numbers`); };
  if (spec.tier !== undefined && !isWorldTier(spec.tier)) errors.push('tier: expected W0..W6 integer');
  if (spec.infectedCap !== undefined && (!Number.isInteger(spec.infectedCap) || spec.infectedCap < 1 || spec.infectedCap > 200)) errors.push('infectedCap: integer 1..200');
  if (spec.size !== undefined && !(spec.size >= 8 && spec.size <= 400)) errors.push('size: 8..400 m');
  if (spec.ground && !['grass', 'asphalt', 'sidewalk', 'district'].includes(spec.ground)) errors.push(`ground: unknown ${spec.ground}`);
  if (spec.ground === 'district' && !spec.layout) errors.push('ground "district" needs layout.district');
  spec.props?.forEach((p, i) => { if (!assets.has(p.asset)) errors.push(`props[${i}].asset: unknown manifest id ${p.asset}`); if (p.decay && assets.has(p.asset) && !assets.get(p.asset)!.decayVariants.includes(p.decay) && !vehicleDecayFallback(assets.get(p.asset)!, p.decay)) errors.push(`props[${i}].decay: unknown variant ${p.decay}`); point(p.at, `props[${i}].at`); if (p.id) { if (ids.has(p.id)) errors.push(`duplicate id ${p.id}`); ids.add(p.id); } });
  let couriers = 0;
  spec.actors?.forEach((a, i) => {
    if (!['courier', 'pedestrian', 'infected', 'corgi', 'animal'].includes(a.kind)) errors.push(`actors[${i}].kind: ${a.kind}`);
    if (a.kind === 'animal' && a.pet !== 'dog' && !['lion', 'gorilla', 'elephant', 'zebra', 'flamingo'].includes(a.species ?? '')) errors.push(`actors[${i}].species: ${a.species}`);
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
  for (const p of kept) { p.position[0] += shift[0]; p.position[2] += shift[1]; for (const k of ['min', 'max'] as const) { p.visualAabb[k][0] += shift[0]; p.visualAabb[k][2] += shift[1]; } if (!(p.assetId === 'kit.highway-onramp' && p.lightGroup === 'l3-highway')) p.lightGroup = labLightGroup; }
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
    decorations: [], lightGroups: [{ id: labLightGroup, offAt: 6 }, ...(kept.some(p => p.lightGroup === 'l3-highway') ? [{ id: 'l3-highway', offAt: 6 as const }] : []), ...[...new Set(spec.props?.map(p => p.powerGroup).filter((group): group is string => !!group) ?? [])].map(id => ({ id, offAt: spec.props?.some(p => p.powerGroup === id && p.powered === false) ? 0 as Tier : 6 as Tier }))], acousticZones: [],
    surfaces: spec.ground === 'district' && source ? source.surfaces : [{ surface: spec.ground === 'asphalt' ? 'asphalt' : spec.ground === 'sidewalk' ? 'tile' : 'grass', polygon: bounds }], layers: [{ tier: 0, remove: [], disableLights: spec.props?.filter(p => p.powerGroup && p.powered === false).map(p => p.powerGroup!) ?? [] }],
  };
  if (spec.ground === 'district' && source?.terrainChunks) layout.terrainChunks = source.terrainChunks
    .filter(c => c.origin[0] + c.size > x0 - shift[0] && c.origin[0] < x1 - shift[0] && c.origin[1] + c.size > z0 - shift[1] && c.origin[1] < z1 - shift[1])
    .map(c => ({ ...c, origin: [c.origin[0] + shift[0], c.origin[1] + shift[1]] }));
  if (spec.ground === 'district' && source?.layers.some(l => l.tier === 6)) layout.layers.push({ tier: 6, remove: [], disableLights: [] });
  // Metro assemblies contain traversable rooms: their authored supports and walls
  // must survive a crop rather than becoming one solid manifest footprint.
  if(source && (source.district==='D-SUBWAY' || kept.some(p=>p.assetId==='int.metro-station')))layout.colliders=source.colliders.filter(c=>kept.some(p=>c.id===p.id||c.id.startsWith(p.id+'/'))).filter(c=>c.aabb.max[0]>=x0-shift[0]&&c.aabb.min[0]<=x1-shift[0]&&c.aabb.max[2]>=z0-shift[1]&&c.aabb.min[2]<=z1-shift[1]).map(c=>{const out=structuredClone(c);for(const k of ['min','max'] as const){out.aabb[k][0]+=shift[0];out.aabb[k][2]+=shift[1];}return out;});
  // Baked district masonry/ponds have no placement empty. Keep their collision
  // and excluded water in district-ground crops so QA uses the visible geometry.
  if (spec.ground === 'district' && source) {
    const placed = new Set(source.placements.map(p => p.id));
    const existing = new Set(layout.colliders.map(c => c.id));
    for (const c of source.colliders) {
      if (placed.has(c.id.split('/')[0]) || existing.has(c.id) || c.aabb.max[0] < x0-shift[0] || c.aabb.min[0] > x1-shift[0] || c.aabb.max[2] < z0-shift[1] || c.aabb.min[2] > z1-shift[1]) continue;
      const copy = structuredClone(c);
      for (const k of ['min', 'max'] as const) { copy.aabb[k][0] += shift[0]; copy.aabb[k][2] += shift[1]; }
      layout.colliders.push(copy);
    }
    layout.walkable.excluded = source.walkable.excluded.map(polygon => polygon.map(([x,z]) => [x+shift[0],z+shift[1]]));
  }
  if ((spec.l4Convoy || spec.l3Rendezvous) && source) layout.colliders = structuredClone(source.colliders);
  for (const name of (spec.l4Convoy || spec.l3Rendezvous || spec.l5Aftermath) && source ? Object.keys(source.anchors) : spec.layout?.anchors ?? []) {
    const anchor = source?.anchors[name];
    if (!anchor) throw new Error(`Unknown layout anchor ${name}`);
    layout.anchors[name] = structuredClone(anchor);
    layout.anchors[name].position[0] += shift[0]; layout.anchors[name].position[2] += shift[1];
  }
  const gameplay: DistrictGameplay = { id: district, playerStart: { x: playerStart[0], z: playerStart[1] }, spawns: [], spawnVolumes: [], triggers: [], objectives: [], interactables: [], civilianRoutes: [], safePoints: [], photoSpots: [], decay: [] };
  gameplay.barricades = spec.barricadeSlots;
  const composition: LevelComposition = {
    id: spec.layout?.level === 'L1' ? 'L1' : 'scene-lab', tier, timeOfDay: spec.time ?? 'L1', districts: [{ id: district, origin: [0, 0], gameplay }],
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
  return { id: prop.id ?? `${prop.asset}:lab${index}`, assetId: prop.asset, position: pos, yaw, scale, minTier: 0, maxTier: 6, allowRoad: true, lightGroup: prop.powerGroup ?? labLightGroup,
    visualAabb: { min: [pos[0] - sx / 2, pos[1], pos[2] - sz / 2], max: [pos[0] + sx / 2, pos[1] + dims[1], pos[2] + sz / 2] }, ...(prop.tint ? { tint: prop.tint } : {}), ...(prop.decay ? { decay: prop.decay } : {}) };
}
