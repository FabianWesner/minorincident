import { spawnSetPiece } from '../../sim/missions/L4Spectacle';
import { l3, l3Anchors } from '../../data/l3';
import { l3BaseCollision } from '../../levels/L3/collision';
import { missionControls } from '../../sim/missions/controls';
import { cure, curePursuitRoute } from '../../levels/L10/district';
import { cureEncounters, cureEncounterSlots, cureEncounterSpot } from '../../levels/L10/encounters';
import { cureReached } from '../../sim/missions/CureFront';
import { levelTenMission } from '../../levels/L10/mission';
import { resolveCampaignMission } from '../../levels/missions';
import { convoyFootprint, convoyOverlaps } from '../../sim/missions/L4ConvoyClearance';
import { preset } from '../../sim/progression/Campaign';
import { applyCampaign } from '../../sim/progression/apply';
import { completeCampaignLevel } from '../../sim/progression/carryover';
import { levelNineMission } from '../../levels/L9/mission';
import { crowdVariety } from '../../render/characters/CrowdAppearance';
import { propFootprint } from '../../sim/interact/PropSystem';
import { Box3, Matrix4, Mesh, Object3D, Raycaster, Vector3, type BufferAttribute, type InstancedMesh, type InterleavedBufferAttribute } from 'three';
import { ArmyCheckpointBoom } from '../../sim/missions/ArmyCheckpointBoom';
import { l2 } from '../../data/l2';
import manifest from '../../assets/manifest.json' with { type: 'json' };
import type { AssetDef } from '../../assets/types';
import { AssetRegistry } from '../../assets/registry';
import { assetUrl } from '../../assets/assetUrl';
import { openFireStationBays } from '../../assets/fireStationBays';
import type { Game } from '../../Game';
import type { DistrictLayout, Point } from '../../levels/districts/types';
import type { CivilianActivity } from '../../sim/npc/types';
import type { EntitySnapshot } from '../../sim/world/types';
import type { SimWorld } from '../../sim/world/SimWorld';
import { emptyInput, type InputFrame } from '../../input/InputFrame';
import { SimPhase } from '../../core/EventBus';
import { l2TruckPath } from '../../data/l2';
import { levelTwoLayouts } from '../../levels/L2/layout';
import { L2TruckDrive, truckPoseAt, truckBodyOverlap, truckWallOverlap, type TruckRideState } from '../../sim/vehicles/L2TruckDrive';
import { installL1Outbreak } from '../../sim/outbreak/install';
import { doorExit, emergeResident, layoutHouseDoors, walkResidents, type HouseEmergence } from '../../sim/outbreak/HouseEmergence';
import { standNear } from '../../sim/npc/gardening';
import { seatAnchor } from '../../sim/npc/seats';
import { allyState } from '../../sim/outbreak/Allies';
import { infectedDef, type InfectedDef } from '../../data/infected';
import { l4 } from '../../data/l4';
import { cameraFraming } from '../../data/cameraFraming';
import { levelThreeLayouts } from '../../levels/L3/layout';
import { levelFourLayouts } from '../../levels/L4/layout';
import { levelSevenLayouts } from '../../levels/L7/layout';
import { levelFiveLayouts } from '../../levels/L5/layout';
import { inside } from '../../levels/districts/validate';
import { CrowdFigureProbe } from '../../render/characters/CrowdFigureProbe';
import type { TimeOfDay } from '../../data/timeOfDay';
import { buildingDoors, doorwayOf, inDoorway, type Doorway } from '../../data/buildingDoors';
import { doorRoute, routeAt, routeLength } from '../../sim/missions/doorRoute';
import { LevelSevenDeparture } from '../../sim/missions/LevelSevenDeparture';
import { LevelSevenEncounters } from '../../sim/missions/LevelSevenEncounters';
import { installMegaPursuit } from '../../sim/ai/MegaPursuit';
import { megaAlpha } from '../../data/megaAlpha';
import { buildScene, validateSpec, type Action, type ActorSpec, type BuiltScene, type CameraSpec, type EffectSpec, type PropSpec, type SceneSpec } from './spec';
import { bodyOverlap, boneClipping, boxOf, staticClipping, type Bone, type BoneHit, type StaticClip, type TriangleSet, type Vec3 } from './geometry';
import { footYaw, summarizeMotion, torsoPitch, unplantedClips, type FootSample, type MotionFrame } from './motion';
import { Status } from '../../sim/combat/Status';
import { seeThrough } from '../../render/SeeThrough';

const assets = new Map((manifest as AssetDef[]).map(a => [a.id, a]));
const rad = (deg: number) => deg * Math.PI / 180;
const ticks = (seconds: number) => Math.round(seconds * 60);
type Plan =
  | { type: 'path'; points: Point[]; index: number; run: boolean; loop: boolean }
  | { type: 'moveTo'; point: Point; run: boolean }
  | { type: 'turn'; yaw: number }
  | { type: 'attack'; target: string; until: number; side: 'LEFT' | 'RIGHT'; move?: Point; aiming?: boolean; inPlace?: boolean }
  | { type: 'mount'; bike: string; at: number }
  | { type: 'click'; entity: number; at: number }
  | { type: 'drive'; throttle: number; steer: number; until: number }
  | { type: 'interact' }
  | { type: 'gun'; at: Point | string | null; until: number };
interface LabActor { distanceM?: number; lastAt?: { x: number; z: number }; maxX?: number; id: string; kind: ActorSpec['kind']; entity: number; spec: ActorSpec; plan: Plan | null; track: MotionFrame[]; lod: Record<string, number>; drawn: number; /** Frames the living actor was inside the camera frustum, and how many of those it was not drawn. */ inView: number; missed: number; sole?: number;
  /** First drawn frame and sim position; for `emerge` residents also how far past the door threshold (m, + = outside). */
  first?: { frame: number; at: [number, number]; outM?: number };
  /** Frames drawn with the far LOD (lod2) within `closeLodM` of the camera. */
  farClose: number;
  /** Spawned by `emerge` (a resident coming out of a building door). */
  emerge?: boolean }
/** Camera distance (m) inside which a crowd figure must not draw its far LOD. */
const closeLodM = 14;
interface Hit extends BoneHit { actor: string; frame: number; count: number }
const toPoint = (p: Point | number[]) => Array.isArray(p) ? { x: p[0], z: p[1] } : p;

/**
 * Scene Lab runtime (window.__SCENE__): builds an isolated scene with the real Game (composition, renderer, materials,
 * LOD, crowd, NPC/infected AI, physics) and steps it with a fixed 60 Hz tick while recording QA metrics.
 * Driven by tools/scenelab (CLI runner and MCP server); see docs/tools/scene-lab.md.
 */
export class SceneLab {
  private convoyOverlapFrames = 0;
  spec: SceneSpec | null = null;
  built: BuiltScene | null = null;
  frame = 0;
  readonly actors = new Map<string, LabActor>();
  readonly vehicles = new Map<string, number>();
  /** `trace`: per-frame vehicle samples (frame, x, y, z, yaw deg, pitch/roll deg of the presented body, ground under it). */
  private vehicleMotion = new Map<string, { yaw: number; yawRateMaxDegS: number; overlaps: number; ride?: TruckRideState; tiltMaxDeg?: number; tiltFrame?: number; slipMaxDeg?: number; slipFrame?: number; darkFrames?: number; firstDarkFrame?: number; x?: number; z?: number }>();
  private vehicleTrack = new Map<string, number[][]>();
  private camera: CameraSpec | null = null;
  /** Frames in which a building/prop placement was drawn from a coarser stand-in mesh than its selected LOD band (lod-pop). */
  private placeholders = { frames: 0, firstFrame: -1, assets: new Set<string>() };
  private perf: { drawCalls: number; triangles: number; shadowDrawCalls: number; shadowTriangles: number; stepMs: number; categories: Record<string, number> }[] = [];
  private specials: { frame: number; sourceId: number; move: string; stage: string }[] = [];
  private hits = new Map<string, Hit>();
  /** Actor pairs whose torsos/heads interpenetrate (worst depth, frame, sampled-frame count). */
  private bodies = new Map<string, { a: string; b: string; depthCm: number; frame: number; count: number }>();
  private attackOverlap = { depthCm: 0, frame: 0, actor: '' };
  private readonly gunBodyHits = new Map<string, Hit>();
  private heldPropSamples = 0;
  private heldPropClips = new Map<string, StaticClip & { actor: string; frame: number }>();
  /** Small hand props (mug, phone) per actor: lowest drawn prop centre between hip (0) and shoulders (1), and the straightest
   * right arm (shoulder-wrist distance over arm length), per LOD band. PO 10-13 "Coffee cup still wrong" (seated, low tier). */
  /** Frames the solid-occluder courier hole was open, its largest radius and low props drawn with a cut material. */
  private seeThroughOpen = { frames: 0, solidRadiusMax: 0, occluders: [] as string[], cutLowProps: [] as string[], cutPlacements: [] as string[] };
  private holds = new Map<string, { prop: string; samples: number; heightMin: number; heightFrame: number; straightMax: number; straightFrame: number; lods: Record<string, number> }>();
  private companion = { overlapMaxCm: 0, overlapFrame: 0, runLagMaxM: 0, runLagFrame: 0, samples: 0, runningSamples: 0 };
  /** Hand-over choreographies in progress (actor id -> route, start frame, pause). */
  private handovers = new Map<string, { route: { x: number; z: number }[]; length: number; start: number; pause: number; face?: number }>();
  /** Door gate per doored placement: frames an actor stood in the aperture/leaf sweep while the door was not fully open. */
  private doors = new Map<string, { way: Doorway; closedFrames: number; firstClosedFrame: number | null; inDoorwayFrames: number; maxOpen: number }>();
  private staticSets: TriangleSet[] | null = null;
  private metroClosed = 0;
  private staticClips: StaticClip[] | null = null;
  private visible: { frame: number; sim: Record<string, number>; drawn: Record<string, number> } | null = null;
  /** Drawn tyre bottom against the drawn ground per vehicle wheel: `${vehicle}|${wheel}` -> gap range (spawn frames 0-2 excluded). */
  private wheels = new Map<string, { vehicle: string; wheel: number; gapMinCm: number; gapMaxCm: number; minFrame: number; maxFrame: number; at: number[]; samples: number; surface: string | null; rayCheckCm: number }>();
  private propSinkMaxCm = 0;
  private propGroundSamples = 0;
  private wheelTrack = new Map<string, (number | string)[][]>();
  /** Hub heights of every wheel over the last two frames, the worst one-frame spike (up then down, or down then up: the smaller
   * of the two moves) and the largest one-frame move, per `${vehicle}|${wheel}`. */
  private hubs = new Map<string, { last: number[]; spikeCm: number; spikeFrame: number; stepCm: number; stepFrame: number }>();
  /** Courier bike presence: frames its sim entity was in view, frames it was then not drawn (or drawn > 0.6 m off its sim spot). */
  private bike = { inViewFrames: 0, missedFrames: 0, offFrames: 0, maxOffsetCm: 0, firstMissedFrame: -1 };
  private groundMeshes: Mesh[] | null = null;
  private readonly ray = new Raycaster();
  private readonly registry = new AssetRegistry(() => {});
  private readonly log: string[] = [];
  private readonly point = new Vector3();
  /** `emerge`: the game's house emergence (HouseEmergence) running in the scene; residents become actors `<id>-N`. */
  private emergence: (HouseEmergence & { count: number; stagger: [number, number]; start: number; base: string; openFrame: number | null }) | null = null;
  constructor(private readonly game: Game) { CrowdFigureProbe.joints = true; }
  private get world(): SimWorld { return this.game.world; }

  /** Build and load a scene; returns the resolved placements/actors so a caller can address them by id. */
  private readonly barOverrides = new Map<InfectedDef, boolean | undefined>();
  async load(spec: SceneSpec) {
    this.specials = [];
    this.attackOverlap = { depthCm: 0, frame: 0, actor: '' };
    this.convoyOverlapFrames = 0;
    // A scene that set a campaign must not leak it into the next scene: a later pickup save would write it against another world.
    this.game.campaign = null;
    if (spec.cureEncounter) {
      const group = cureEncounters.find(g => g.id === spec.cureEncounter);
      if (!group) throw new Error(`Unknown cure encounter: ${spec.cureEncounter}`);
      spec = { ...spec, actors: [...(spec.actors ?? []), ...cureEncounterSlots(group, this.game.quality.tier).map(s => ({
        id: s.key, kind: 'infected' as const, archetype: s.archetype, at: [s.x, s.z] as Point, yaw: 180,
      }))] };
    }
    if (!spec.megaHud) {
      delete this.game.ui.hud.root.dataset.sceneHud;
      if ((this.spec?.hud || this.spec?.megaHud) && !this.game.ui.enabled) this.game.ui.hud.root.remove();
    }
    const errors = validateSpec(spec, assets);
    if (errors.length) throw new Error(`Invalid scene spec:\n${errors.join('\n')}`);
    let source: DistrictLayout | undefined;
    if (spec.layout) {
      const response = await fetch(assetUrl(`/assets/layouts/${spec.layout.district}.layout.json`));
      if (!response.ok) throw new Error(`Layout ${spec.layout.district} not found`);
      source = await response.json() as DistrictLayout;
      // The L3 corridor is played through its layout copy (W2/W3 dressing, wrecks, glass, the army dressing): crop that.
      if (spec.layout.level === 'L2') [source] = levelTwoLayouts([source]);
      if (spec.layout.district === 'D-CORRIDOR') source = levelThreeLayouts([source])[0];
      // Fairhaven likewise (E22): the army reception, sandbag line, nests, parked cars and the L4 anchors.
      // ... and its devastated twin hours later (E23, `level: "L5"`): W5 shells, wrecks, craters, glass, the power out.
      if (spec.layout.district === 'D-FAIR') source = (spec.layout.level === 'L7' ? levelSevenLayouts : spec.layout.level === 'L5' ? levelFiveLayouts : levelFourLayouts)([source])[0];
    }
    this.propSinkMaxCm = 0; this.propGroundSamples = 0; this.propPenetration.clear(); this.propPenetrationSamples = 0; this.propPenetrationTick = -1;
    this.cureStats = null;
    this.vehicleMotion.clear(); this.pursuit.clear(); this.mega = null; this.gunStats = null; this.attacks = { courier: 0, swings: 0, firstFrame: -1, bites: 0, firstBiteFrame: -1, hull: 0, hullHits: 0 };
    this.spec = structuredClone(spec); this.companion = { overlapMaxCm: 0, overlapFrame: 0, runLagMaxM: 0, runLagFrame: 0, samples: 0, runningSamples: 0 }; this.frame = 0; this.heldPropSamples = 0; this.heldPropClips.clear(); this.holds.clear(); this.seeThroughOpen = { frames: 0, solidRadiusMax: 0, occluders: [], cutLowProps: [], cutPlacements: [] }; this.gunBodyHits.clear(); this.actors.clear(); this.vehicles.clear(); this.perf = []; this.hits.clear(); this.bodies.clear(); this.vehicleTrack.clear(); this.handovers.clear(); this.doors.clear(); this.wheels.clear(); this.wheelTrack.clear(); this.hubs.clear(); this.bike = { inViewFrames: 0, missedFrames: 0, offFrames: 0, maxOffsetCm: 0, firstMissedFrame: -1 }; this.groundMeshes = null; this.staticSets = null; this.metroClosed = 0; this.staticClips = null; this.visible = null; this.log.length = 0; this.clicks.length = 0; this.placeholders = { frames: 0, firstFrame: -1, assets: new Set() };
    const built = this.built = buildScene(spec, assets, source);
    this.game.view.labProbes().districts?.setDispersalActive(!!spec.dispersal?.active);
    if (spec.armyBoom && !spec.armyBoom.closed) for (const p of built.layout.placements) if (p.assetId === 'kit.army-checkpoint') p.boomOpen = true;
    for (const p of built.placements) { const way = buildingDoors[p.assetId]?.leaves.length ? doorwayOf(p) : null; if (way) this.doors.set(p.id, { way, closedFrames: 0, firstClosedFrame: null, inDoorwayFrames: 0, maxOpen: 0 }); }
    try {
      for (const id of spec.barArchetypes ?? []) { const def = infectedDef(id); if (!this.barOverrides.has(def)) this.barOverrides.set(def, def.bar); def.bar = true; }
      await this.game.loadLevel('scene-lab', { seed: spec.seed ?? 1, tier: spec.tier, source: { composition: built.composition, layouts: [built.layout] }, setup: world => this.setup(world, spec) });
    } finally {
      for (const [def, bar] of this.barOverrides) def.bar = bar;
      this.barOverrides.clear();
    }
    this.game.clock.pause();
    this.emergence = spec.emerge ? this.emergenceFor(spec.emerge) : null;
    this.game.view.settings({ cameraShake: false, cheapDof: spec.dof ?? true, timeOfDay: spec.time ?? 'L1' });
    this.camera = spec.camera ?? { mode: 'game', target: built.center };
    this.applyCamera();
    if (this.boom) this.game.view.labProbes().districts?.updateArmyBoom(spec.armyBoom?.closed ? 0 : 1);
    if (spec.marketDoors) this.game.view.labProbes().districts?.marketDoors(!!spec.marketDoors.open && spec.marketDoors.openAtFrame === undefined, true);
    // Prop triangles for the per-frame bone checks (LOD0 GLBs, cached by the registry across loads).
    await Promise.all([this.game.screenshotReady(), this.prepareClipping()]);
    if (spec.hud || spec.megaHud) {
      document.body.dataset.uiScreen = 'game';
      this.game.ui.hud.root.dataset.sceneHud = '';
      document.querySelector('#game')!.append(this.game.ui.hud.root);
      this.game.ui.hud.loaded(); this.game.ui.hud.update();
    }
    if (spec.menuScreen) {
      this.game.ui.init(true);
      this.game.campaign = preset('L10-default');
      this.game.ui.show(spec.menuScreen);
    }
    this.calibrateSole();
    return this.describe();
  }
  /** Sim assembly before the view loads: systems, actors and vehicles exist when the presentation is built. */
  private boom: ArmyCheckpointBoom | null = null;
  private boomClosedAt = 0;
  private setup(world: SimWorld, spec: SceneSpec): void {
    if (spec.weather) world.weather?.setOverride(spec.weather);
    if (spec.weatherTimeline) world.weather?.setTimeline(spec.weatherTimeline);
    for (let i = 0; i < Math.round((spec.weatherWarmup ?? 0) * 60); i++) { world.tick++; world.weather?.update(); }
    for (const prop of spec.props ?? []) if (prop.rotation) {
      const item = world.props?.items.find(p => p.id.endsWith(`/${prop.id}`));
      if (!item) throw new Error(`Rotation fixture needs a pushable id: ${prop.id}`);
      world.props!.place(item, { p: [...item.pose.p], q: prop.rotation });
    }
    if (spec.layout?.level === 'L1' || spec.layout?.level === 'L7' || spec.layout?.level === 'L3') world.scenario = spec.layout.level;
    const outbreak = installL1Outbreak(world, { civilians: 0 });
    // Simulation ownership follows the authored actor/vehicle, independently of the shot camera.
    const focus = spec.actors?.find(a => a.kind === 'courier')?.at ?? spec.vehicles?.[0]?.at;
    if (focus) world.chunks?.update(focus);
    if (spec.infectedCap !== undefined) world.infected!.director.levelCap = spec.infectedCap;
    // An L2 layout scene plays with the L2 infected toughness (the mission sets it in LevelTwoRescue; scenes have no mission).
    if (spec.layout?.level === 'L2') world.infectedMeleeHits = l2.infectedMeleeHits;
    // Hand-overs move in the missions phase, like the L1 story beats, so AgentMotion publishes their walking speed.
    world.events.on('sim.tick', () => this.driveHandovers(), SimPhase.missions);
    world.combat!.damage.god = true;
    world.events.on('infected.special', ev => { if (ev.type === 'infected.special') this.specials.push({ frame: this.frame, sourceId: ev.sourceId, move: ev.move, stage: ev.stage }); });
    // Pursuit metrics: infected swings at the courier and bites on pedestrians (first frame of each).
    world.events.on('infected.attack', ev => { if (ev.type === 'infected.attack' && ev.targetId === 1) { this.attacks.courier++; if (this.attacks.firstFrame < 0) this.attacks.firstFrame = this.frame; } });
    world.events.on('telegraph', ev => { if (ev.type === 'telegraph' && ev.sourceId !== undefined && world.entities.get(ev.sourceId)?.infected?.l1?.targetId === 1) this.attacks.swings++; });
    // E31 hull attacks on the APC: wind-ups and landed durability hits (contact and attack sources).
    world.events.on('vehicle.attack-windup', ev => { if (ev.type === 'vehicle.attack-windup') this.attacks.hull++; });
    world.events.on('vehicle.durability-hit', ev => { if (ev.type === 'vehicle.durability-hit' && ev.source === 'attack') this.attacks.hullHits++; });
    world.events.on('outbreak.bite', ev => { if (ev.type === 'outbreak.bite') { this.attacks.bites++; if (this.attacks.firstBiteFrame < 0) this.attacks.firstBiteFrame = this.frame; } });
    const player = world.entities.get(1)!;
    const courier = spec.actors?.find(a => a.kind === 'courier');
    if (!courier) player.hidden = true;
    for (const e of [...world.entities.iterate()]) if (e.companion && !spec.actors?.some(a => a.kind === 'corgi')) { world.entities.delete(e.id); world.spatial.delete(e.id); }
    for (const v of spec.vehicles ?? []) {
      const id = v.id ?? v.asset, pose = v.l2Ride ? truckPoseAt(v.l2Ride.distanceM ?? 0) : null;
      const entity = this.addVehicle(id, v.asset, pose ? [pose.x, pose.z] : v.at, pose ? pose.yaw * 180 / Math.PI : v.yaw ?? 0, v.path, v.panic);
      if (v.decay) world.entities.get(entity)!.vehicle!.decay = v.decay;
      if (v.floor) world.vehicles!.setFloorPolicy(entity, true);
      if (v.health !== undefined) { const car = world.entities.get(entity)!; world.vehicles!.damage(entity, Math.max(0, car.health.current - v.health)); }
      if (v.driven) {
        // The courier drives (L9: the APC is always the player's): her inputs steer the real active-vehicle path, so the
        // view shows what the player sees (headlights, hull rim, aura). The authored path's autopilot supplies the inputs.
        world.vehicles!.active = entity; world.entities.get(entity)!.vehicle!.driver = 1; world.vehicles!.rebuild();
        const frame = emptyInput(), drive = { throttle: 0, steer: 0, brake: true, boost: false };
        world.events.on('sim.tick', () => {
          const car = world.entities.get(entity), pilot = world.vehicles!.autopilot.get(entity); if (!car || world.vehicles!.active !== entity) return;
          drive.throttle = drive.steer = 0; drive.brake = true; pilot?.(drive, car);
          frame.drive = { throttle: drive.throttle, steer: drive.steer }; frame.brake = drive.brake;
          world.applyInput(frame, 'keyboard');
        }, SimPhase.input - .25);
      }
      if (v.l2Ride) {
        const state = { truckId: entity, rideS: v.l2Ride.distanceM ?? 0, rideV: v.l2Ride.speedMs ?? 0 }, driver = new L2TruckDrive(world, state);
        driver.prepare();
        this.vehicleMotion.set(id, { yaw: pose!.yaw, yawRateMaxDegS: 0, overlaps: 0, ride: state });
        let arrived = false;
        world.events.on('sim.tick', () => { if (!arrived) arrived = driver.step(); }, SimPhase.missions);
      }
      if (!v.l2Ride) this.vehicleMotion.set(id, { yaw: world.entities.get(entity)!.transform.yaw, yawRateMaxDegS: 0, overlaps: 0 });
    }
    spec.actors?.forEach((a, i) => {
      if (spec.cureEncounter && a.id?.startsWith(`${spec.cureEncounter}:`)) {
        const at = cureEncounterSpot(world.infected!.nav, { x: a.at![0], z: a.at![1], archetype: a.archetype! }, () => true, spec.cureEncounter === 'dispersal-assault' ? 129 : 17);
        if (!at) throw new Error(`No clear cure encounter slot: ${a.id}`);
        a = { ...a, at: [at.x, at.z] };
      }
      this.spawn(a, i);
      if (spec.cureEncounter === 'dispersal-assault' && a.kind === 'infected') {
        const e = world.entities.get(this.actors.get(a.id!)!.entity)!;
        e.infected!.state = 'chase';
      }
    });
    if (spec.l2Release) {
      world.scenario = 'L2'; applyCampaign(world, preset('L2-default'));
      world.infected!.director.setTier(this.game.quality.tier);
      const mission = world.loadMission(resolveCampaignMission('L2', world.districts!));
      mission.begin();
      if (!world.tick) world.update(); // The production release clock uses zero for "not opened".
      mission.l2!.completed('doors');
      if (spec.l2Release === 'bridge' || spec.l2Release === 'checkpoint') {
        this.teleport(world.entities.get(1)!, { x: -46.5, z: -39 });
        for (let i = 0; i < 20 * 60; i++) world.update();
      }
      const at = spec.actors?.find(a => a.kind === 'courier')?.at;
      if (at) this.teleport(world.entities.get(1)!, toPoint(at));
      if (spec.l2Release === 'checkpoint') {
        mission.l2!.advance();
        for (let i = 0; i < 60 && !mission.state.l2!.gateClosedAt; i++) world.update();
        if (!mission.state.l2!.gateClosedAt) throw new Error('L2 checkpoint fixture did not close its gates');
        // Hold the completed physical closure for inspection, before the normal
        // two-second handover ends this scene. Combat and contact keep running.
        mission.state.l2!.phase = 'done';
        // Reuse production pursuers: the rescue has already filled its cap.
        // Fixture placement must retain identities/counts rather than add extras.
        const probes = world.infected!.active.filter(e => e.health.current > 0 && !e.hidden).slice(0, 2);
        for (const [i, id] of ['jamb-probe', 'panel-probe'].entries()) {
          const e = probes[i]; if (!e) throw new Error('L2 checkpoint fixture needs two living pursuers');
          if (!world.solids.relocate(e, { x: i ? 81.9 : 83.107, y: .7, z: 37 }, 'scene.l2-gate-probe', 0, false)) throw new Error('L2 gate probe placement blocked');
          world.infected!.rush(e.id, world.entities.get(1)!.transform, world.tick + 600);
          this.actors.set(id, { id, kind: 'infected', entity: e.id, spec: { id, kind: 'infected', archetype: e.archetype }, plan: null, track: [], lod: {}, drawn: 0, inView: 0, missed: 0, farClose: 0 });
        }
      }
    }
    if (spec.l6Subway) {
      world.scenario = 'L6'; applyCampaign(world, preset('L6-default'));
      const mission = world.loadMission(resolveCampaignMission('L6', world.districts!)); mission.begin();
      if (spec.l6Subway !== 'pickup') {
        const lamp = world.entities.values().find(e => e.archetype === 'pickup.headlamp')!;
        lamp.interactable!.completed = true; Object.assign(player.transform, lamp.transform);
        world.physics.playerBody!.setTranslation(player.transform, true); world.update(); world.update();
      }
      if (spec.l6Subway === 'gate' || spec.l6Subway === 'entry') {
        mission.completeObjective('shelter'); mission.completeObjective('stop');
        for (const r of mission.state.l6!.survivors) {
          const e = world.entities.get(r.id)!; e.transform.x = 99 + r.hold; e.transform.z = 15;
        }
        mission.state.l6!.leaderX = 105; mission.state.l6!.leaderZ = 15;
      }
      if (courier?.at) {
        Object.assign(player.transform, { x: courier.at[0], y: 1.3, z: courier.at[1] });
        world.physics.playerBody!.setTranslation(player.transform, true); world.spatial.set(1, player.transform.x, player.transform.z);
      }
    }
    if (spec.l3Rendezvous) {
      world.scenario = 'L3';
      world.infected!.excludeInfected(l3BaseCollision);
      applyCampaign(world, preset('L3-default'));
      const mission = world.loadMission(resolveCampaignMission('L3', world.districts!));
      mission.begin(); mission.completeObjective('armory'); mission.completeObjective('defend');
      const state = mission.state.l3!, api = missionControls(world);
      state.pending = []; state.waves = []; state.populated = [true, true, true];
      state.finalePacks = l3.finale.packs.map(p => p[1]);
      for (const id of state.officerIds) api.teleport(id, { x: l3.map.zoneX + 3, z: 3 });
      for (const e of world.entities.iterate()) if (e.companion) api.teleport(e.id, { x: l3.map.zoneX + 3, z: 2 });
      api.teleport('player', { x: l3Anchors['l3-zone'][0], z: 0 });
      const ai = world.infected!, cap = ai.director.cap;
      for (let x = l3.finale.barrierX - .8; x > l3.finale.barrierX - 30 && ai.director.count < cap; x -= .8) {
        for (let z = -9; z <= 9 && ai.director.count < cap; z += .8) {
          if (!ai.infectedNav.clear(x, z, .35)) continue;
          const id = ai.spawn('infected.runner', { x, z });
          ai.rush(id, { x: l3.finale.barrierX + 2, z: 0 }, world.tick + 121 * 60);
        }
      }
    }
    if (spec.l4Convoy) {
      applyCampaign(world, preset('L4-default'));
      world.infected!.director.setTier(this.game.quality.tier);
      const mission = world.loadMission(resolveCampaignMission('L4', world.districts!));
      mission.begin();
      if (spec.l4Convoy === 'parked' || spec.l4Convoy === 'hold') {
        for (let t = 0; t < 60 * 60 && mission.state.l4!.phase === 'convoy'; t++) world.update();
        if (mission.state.l4!.phase === 'convoy') throw new Error('L4 convoy did not arrive for parked fixture');
      }
      if (spec.l4Convoy === 'hold') {
        mission.completeObjective('quartermaster');
        while (!mission.state.l4!.turnAt) world.update();
      }
      for (const [i, id] of mission.state.l4!.convoyIds.entries()) this.vehicles.set(`convoy-${i}`, id);
    }
    if (spec.l5Aftermath) {
      world.scenario = 'L5';
      applyCampaign(world, preset('L5-default'));
      const mission = world.loadMission(resolveCampaignMission('L5', world.districts!));
      mission.begin(); mission.completeObjective('emerge'); mission.l5!.advance();
      // Fixture setup uses the shipped discovery interaction, then restores its checkpoint.
      for (const key of spec.l5Aftermath.found) {
        const ring = mission.def.anchors[`l5-ring-${key}`];
        if (!ring) throw new Error(`Unknown L5 survivor ${key}`);
        Object.assign(player.transform, ring); world.physics.playerBody!.setTranslation(player.transform, true);
        for (let tick = 0; tick < 61; tick++) world.update();
      }
      if (spec.l5Aftermath.found.length) mission.restore(`survivor-${spec.l5Aftermath.found.length}`);
      mission.state.subtitle = null;
      // Isolate discovery and fear from unrelated infected elsewhere in Fairhaven.
      const alphaId = spec.l5Aftermath.alphaAt ? world.infected!.active.find(e => e.archetype === 'infected.alpha')?.id : undefined;
      for (const infected of [...world.infected!.active]) if (infected.id !== alphaId) world.infected!.release(infected);
      if (courier?.at) {
        Object.assign(player.transform, { x: courier.at[0], z: courier.at[1] });
        world.physics.playerBody!.setTranslation(player.transform, true); world.physics.playerBody!.setNextKinematicTranslation(player.transform);
        Object.assign(world.previousPlayer!, player.transform); world.spatial.set(1, player.transform.x, player.transform.z);
      }
      for (const [i, r] of mission.state.l5!.survivors.filter(r => r.status === 'following').entries()) {
        const e = world.entities.get(r.id)!;
        const hp = spec.l5Aftermath.health?.[r.key];
        if (hp !== undefined) {
          if (!Number.isFinite(hp) || hp < 0 || hp > e.health.max) throw new RangeError(`Invalid L5 fixture health for ${r.key}`);
          e.health.current = hp;
        }
        Object.assign(e.transform, { x: player.transform.x - (spec.l5Aftermath.alphaAt ? 4 : 2) - i, z: player.transform.z + (spec.l5Aftermath.alphaAt ? 2 : 0) }); world.spatial.set(e.id, e.transform.x, e.transform.z);
        this.actors.set(r.key, { id: r.key, kind: 'pedestrian', entity: r.id, spec: { id: r.key, kind: 'pedestrian' }, plan: null, track: [], lod: {}, drawn: 0, inView: 0, missed: 0, farClose: 0 });
      }
      if (spec.l5Aftermath.metroIngress) {
        // Recorded real-input jam: the standing corgi and all five people at the
        // stairs. The production controller must walk the group through it.
        const poses = [[38.25599, -47.54761], [37.20675, -48.27262], [37.75909, -48.02834], [37.21383, -47.56967], [38.38523, -48.24918]];
        mission.state.l5!.survivors.forEach((r, i) => {
          const e = world.entities.get(r.id)!;
          Object.assign(e.transform, { x: poses[i][0], z: poses[i][1] }); delete e.locomotion;
          world.spatial.set(e.id, e.transform.x, e.transform.z);
        });
        player.transform.y = world.districts!.groundHeight(player.transform.x, player.transform.z) + .72;
        world.physics.playerBody!.setTranslation(player.transform, true); world.physics.playerBody!.setNextKinematicTranslation(player.transform);
        Object.assign(world.previousPlayer!, player.transform);
        const dog = world.entities.get(world.npcs!.companion.spawn())!;
        Object.assign(dog.transform, { x: 37.77191, z: -49.34055, y: .975 }); delete dog.locomotion;
        Object.assign(dog.companion!, { state: 'follow', following: false, velocity: { x: 0, z: 0 }, pickup: null });
        world.spatial.set(dog.id, dog.transform.x, dog.transform.z);
      }
    }
    if (spec.l5Aftermath?.alphaAt) {
      const at = spec.l5Aftermath.alphaAt, alpha = world.infected!.active.find(e => e.archetype === 'infected.alpha')!;
      const id = alpha.id; Object.assign(alpha.transform, { x: at[0], z: at[1], yaw: 0 }); world.spatial.set(id, at[0], at[1]);
      if (alpha.infected!.territory) Object.assign(alpha.infected!.territory, { x: at[0], z: at[1] });
      this.actors.set('alpha', { id: 'alpha', kind: 'infected', entity: id, spec: { id: 'alpha', kind: 'infected', archetype: 'infected.alpha' }, plan: null, track: [], lod: {}, drawn: 0, inView: 0, missed: 0, farClose: 0 });
    }
    if (spec.crossingCrash) {
      const def = levelNineMission((_district, name) => {
        const a = world.districts!.districts[0].layout.anchors[name];
        if (!a) throw new Error(`Crash fixture missing anchor ${name}`);
        return { x: a.position[0], y: a.position[1], z: a.position[2], radius: 2 };
      });
      if (spec.crossingCrash.driveFromStart) {
        const id = this.vehicles.get('apc'); if (id === undefined) throw new Error('Full crossing needs an authored APC');
        world.vehicles!.active = id; world.entities.get(id)!.vehicle!.driver = 1; world.vehicles!.rebuild();
      } else def.anchors['crossing-start'] = { ...def.anchors['crash-approach'] };
      if (spec.crossingCrash.handover) {
        const save = preset('L8-default'); save.completedLevels = 8; save.unlockedLevel = 9;
        applyCampaign(world, save);
        world.events.on('level.completed', e => { if (e.type === 'level.completed') completeCampaignLevel(save, 9, e.result, world); });
      }
      const mission = world.loadMission(def);
      if (spec.crossingCrash.driveFromStart) {
        const frame = emptyInput(), drive = { throttle: 0, steer: 0, brake: true, boost: false };
        world.events.on('sim.tick', () => {
          if (mission.l9!.state.phase !== 'driving') return;
          const id = mission.l9!.state.carId, car = world.entities.get(id)!;
          world.vehicles!.autopilot.get(id)?.(drive, car);
          frame.drive = { throttle: drive.throttle, steer: drive.steer }; frame.brake = drive.brake;
          world.applyInput(frame, 'keyboard');
        }, SimPhase.input - .25);
      }
      mission.begin();
      const id = mission.l9!.state.carId;
      world.vehicles!.damage(id, 1000 - spec.crossingCrash.health); this.vehicles.set('apc', id);
    }
    if (spec.minigun) {
      const a = spec.minigun.at, three = a.length === 3;
      world.installMountedGun({ x: a[0], z: three ? a[2] : a[1], y: three ? a[1] : 0, yaw: spec.minigun.yaw ?? 0 });
      this.gunStats = { hudFrames: 0, hudHeatErrorMax: 0, rounds: 0, heatPeak: 0, lockedFrames: 0, mountedFrames: 0, firstRoundFrame: -1, dismountTicks: [], feetMin: Infinity };
      world.events.on('combat.attack', ev => { if (ev.type === 'combat.attack' && ev.actionId === 'weapon.rotary-minigun' && this.gunStats) { this.gunStats.rounds++; if (this.gunStats.firstRoundFrame < 0) this.gunStats.firstRoundFrame = this.frame; } });
    }
    if (spec.megaAlpha) {
      const m = spec.megaAlpha, box = m.resident;
      const pursuit = installMegaPursuit(world, { introduceTick: null, route: m.route === 'cure' ? curePursuitRoute : m.route, ...(box ? { resident: (x: number, z: number) => x >= Math.min(box[0][0], box[1][0]) && x <= Math.max(box[0][0], box[1][0]) && z >= Math.min(box[0][1], box[1][1]) && z <= Math.max(box[0][1], box[1][1]) } : {}) });
      const id = m.id ?? 'mega', entity = pursuit.introduce({ x: m.at[0], z: m.at[1] });
      this.actors.set(id, { id, kind: 'infected', entity, spec: { id, kind: 'infected', archetype: megaAlpha.archetype }, plan: null, track: [], lod: {}, drawn: 0, inView: 0, missed: 0, farClose: 0 });
      this.mega = { last: null, speeds: [], stepMaxM: 0, stepFrame: -1, modes: {}, samples: [], stuckLevelMax: 0, distanceMinM: Infinity };
    }
    if (spec.cureProgression) {
      this.cureStats = { mistPuffs: 0, smokeOverBudget: 0, healthyDamage: 0, lateDeaths: 0, insideMisses: 0, health: {}, chargeTicks: 0, insideFrames: 0, boundaryFrames: 0, outsideFrames: 0, outsideAdvance: 0, releaseCount: 0, radius: 0, titleFrames: 0, creditsFrames: 0, playableTravel: 0, survivors: 0, fanFrames: 0, pullScale: 1, last: null, samples: [] };
      world.events.on('mission.signal', event => { if (event.type === 'mission.signal' && event.name === 'cure-released' && this.cureStats) this.cureStats.releaseCount++; });
      const save = preset('L10-default');
      const model = spec.actors?.find(actor => actor.kind === 'courier')?.look?.model;
      if (model === 'male' || model === 'female') save.character = model;
      applyCampaign(world, save);
      this.game.campaign = save;
      const at = { ...world.entities.get(1)!.transform };
      const mission = world.loadMission(levelTenMission(name => {
        const anchor = spec.cureProgression?.anchors?.[name] ?? (spec.cureProgression?.authored ? cure.anchors[name] : undefined);
        return anchor ? { x: anchor[0], z: anchor[1], radius: 2 } : !spec.cureProgression?.checkpoint && name !== 'cure-crash' ? undefined : { x: at.x, z: at.z, radius: 2 };
      }));
      mission.begin();
      if (spec.cureProgression.checkpoint) {
        mission.loadCheckpoint(spec.cureProgression.checkpoint);
        // Reconstructing a later checkpoint replays its prior radio action at tick zero.
        // Its recording has already finished in the real route; keep the finale HUD readable.
        if (mission.state.steps.research.status === 'completed') mission.state.subtitle = null;
      }
      if (spec.cureProgression.chargeActive) mission.state.states['charge-active'] = true;
      if (spec.cureProgression.releaseReady) {
        mission.state.states['charge-active'] = mission.state.states['charge-ready'] = mission.state.states['mega-dead'] = true;
        mission.state.counters['charge-ticks'] = 3600;
        mission.state.steps.hold.status = 'completed'; mission.state.steps.release.status = 'active';
      }
      if (spec.cureProgression.authored) {
        Object.assign(world.entities.get(1)!.transform, at); world.physics.playerBody!.setTranslation(at, true);
      }
      if (spec.cureProgression.epilogueElapsed !== undefined) {
        const ticks = spec.cureProgression.epilogueElapsed;
        if (!Number.isSafeInteger(ticks) || ticks < 0 || ticks > 9000) throw new Error('Invalid epilogue fixture clock');
        mission.state.states['cure-released'] = true;
        mission.state.steps.release.status = 'completed'; mission.state.steps.epilogue.status = 'active';
        mission.l10!.cure.release();
        mission.state.cureFront!.elapsed = ticks; mission.state.cureFront!.radius = ticks / 6;
        mission.l10!.epilogue.update(); mission.l10!.cure.apply();
      }
      world.combat!.runner.loadout.state.selectedSide = spec.cureProgression.checkpoint ? 'RIGHT' : 'LEFT';
    }
    if (spec.l7Group) {
      world.scenario = 'L7';
      world.l7Encounters = new LevelSevenEncounters(world);
      world.l7Encounters.prepare([]);
      for (const e of world.entities.iterate()) if (e.civilian?.survivor) world.l7Encounters.state.roster.push({ id: e.id, key: e.civilian.survivor.key, injured: false, status: 'following', passed: false });
      if (spec.l7Departure) {
        world.l7Departure = new LevelSevenDeparture(world); world.l7Departure.install();
        if (spec.l7Departure === 'follow') world.l7Departure.cameraPose = () => null;
        this.vehicles.set('departure-bus', world.l7Departure.state.busId);
        world.events.on('sim.tick', () => world.l7Departure?.update(), SimPhase.missions);
      }
    }
    // Dress the authored crowd before view initialization. Otherwise its first
    // tick replaces runners with civilian skins whose batches are still loading.
    outbreak.dressInfected();
    this.boom = spec.armyBoom ? new ArmyCheckpointBoom(world, spec.armyBoom.x, spec.armyBoom.z) : null;
    this.boomClosedAt = spec.armyBoom?.closed ? world.tick : 0;
    if (this.boom) {
      this.boom.set(!!spec.armyBoom?.closed);
      world.events.on('sim.tick', () => {
        if (this.boomClosedAt || spec.armyBoom?.closed) return;
        const ids = [1, ...[...world.entities.iterate()].filter(e => e.civilian?.ally?.follow && !e.infection).map(e => e.id)];
        if (this.boom!.ready(ids) || (this.boom!.clearBystanders(ids), this.boom!.ready(ids))) { this.boomClosedAt = world.tick; this.boom!.set(true); }
      }, SimPhase.missions);
    }
    // The emergence runs inside the tick in the mission phase, as LevelOneOutbreak does (motion is published from it).
    world.events.on('sim.tick', () => this.emergeStep(), SimPhase.missions);
  }

  /** The house door of `emerge.house` in this scene's layout (the same door table and doorstep rule as L1 beat 9). */
  private emergenceFor(e: NonNullable<SceneSpec['emerge']>): NonNullable<SceneLab['emergence']> {
    const doors = layoutHouseDoors(this.built!.layout), door = doors.find(d => d.house === e.house);
    if (!door) throw new Error(`emerge.house ${e.house}: no house door in the scene; houses: ${doors.map(d => d.house).join(', ') || 'none'}`);
    const courier = this.world.entities.get(1)!.transform, exit = doorExit(this.world, door, courier);
    if (!exit) throw new Error(`emerge.house ${e.house}: no way out from the door to the courier`);
    const stagger: [number, number] = typeof e.staggerS === 'number' ? [e.staggerS, e.staggerS] : e.staggerS ?? [1.5, 4];
    return { door: door.door, house: door.house, x: door.x, z: door.z, nx: door.nx, nz: door.nz, floor: door.floor, ...exit, next: 0, ids: [], ...(e.speedMs ? { speedMs: e.speedMs } : {}), count: e.count ?? 3, stagger, start: e.frame ?? 30, base: e.id ?? 'resident', openFrame: null };
  }
  /** One tick of the emergence: residents step out of the door one by one, then chase the courier (L1 `rush`). */
  private emergeStep(): void {
    const em = this.emergence; if (!em) return;
    const world = this.world, tick = world.tick, courier = world.entities.get(1)!.transform;
    for (const id of walkResidents(world, em, tick)) world.infected!.rush(id, { x: courier.x, z: courier.z }, tick + 600);
    if (this.frame < em.start || em.ids.length >= em.count || tick < em.next || !world.infected!.pool.length) return;
    const entity = emergeResident(world, em, tick), k = em.ids.length;
    if (em.openFrame === null) em.openFrame = this.frame;
    const id = `${em.base}-${k}`;
    this.actors.set(id, { id, kind: 'infected', entity, spec: { id, kind: 'infected' }, plan: null, track: [], lod: {}, drawn: 0, inView: 0, missed: 0, farClose: 0, emerge: true });
    // Deterministic stagger from the scene seed (L1 draws 1.5-4 s from the world seed).
    const u = ((Math.sin((this.spec?.seed ?? 1) * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
    em.next = tick + Math.round((em.stagger[0] + u * (em.stagger[1] - em.stagger[0])) * 60);
  }
  /** Add a static prop. Static instancing and collision are baked at load, so this reloads the scene (frame resets). */
  async place(prop: PropSpec) { if (!this.spec) throw new Error('load_scene first'); (this.spec.props ??= []).push(prop); return this.load(this.spec); }
  /** Spawn an actor into the running scene (also recorded in the spec, so reset() keeps it). */
  spawnActor(actor: ActorSpec): string[] {
    if (!this.spec) throw new Error('load_scene first');
    (this.spec.actors ??= []).push(actor);
    const ids = this.spawn(actor, this.spec.actors.length - 1); this.game.view.update(1); return ids;
  }
  private spawn(a: ActorSpec, index: number): string[] {
    const world = this.world, base = a.id ?? `${a.kind}${index}`, count = a.count ?? 1, ids: string[] = [];
    for (let k = 0; k < count; k++) {
      const id = count > 1 ? `${base}-${k + 1}` : base;
      const ring = count > 1 ? k / count * Math.PI * 2 : 0, r = count > 1 ? a.spread ?? 1.5 : 0;
      const at = { x: (a.at?.[0] ?? 0) + Math.cos(ring) * r, z: (a.at?.[1] ?? 0) + Math.sin(ring) * r };
      const yaw = rad(a.yaw ?? 0);
      let entity: number;
      if (a.kind === 'courier') {
        entity = 1; const player = world.entities.get(1)!;
        if (a.at) this.teleport(player, at);
        player.transform.yaw = yaw; Object.assign(world.previousPlayer!, player.transform);
        // Game handovers preserve cosmetics; independent lab fixtures must not inherit the preceding scene's campaign gear.
        const variant = a.look?.model === 'male' || a.look?.model === 'female' ? a.look.model : this.game.params.get('survivor') === 'male' ? 'male' : 'female';
        const tier = a.look?.gearTier ?? 0;
        if (![0, 1, 2, 3, 4].includes(tier)) throw new Error('Courier gear tier must be 0–4');
        world.player!.select(variant, tier as import('../../data/survivor').GearTier);
        // L1 parity: the courier starts empty-handed (Game.loadLevel clears the L1 loadout); `loadout` arms her.
        if (a.loadout) world.combat!.setLoadout([a.loadout[0]].flat(), [a.loadout[1]].flat()); else world.combat!.clearLoadout();
        world.combat!.damage.god = a.god ?? true;
      } else if (a.kind === 'pedestrian') {
        const o = world.npcs!.civilians.outbreak!;
        entity = o.spawnPedestrian(at, { model: a.look?.model, tint: a.look?.tint, accessories: a.look?.accessories, handProp: a.look?.handProp ?? null, tier: a.look?.tier, role: a.look?.role, yaw,
          schedule: [this.stand(at, yaw)] });
      } else if (a.kind === 'animal') {
        if (!a.species && !a.pet) throw new Error('Animal fixture requires a zoo species or pet');
        entity = world.npcs!.civilians.spawn(a.species ?? 'dog', at, { ...(a.pet ? { pet: a.pet } : { zooAnimal: a.species }), waypoints: [at] });
        world.entities.get(entity)!.transform.yaw = yaw;
      } else if (a.kind === 'infected') {
        entity = world.infected!.spawn(a.archetype ?? 'infected.runner', at, { yaw, state: 'idle', ...(a.look?.model ? { variant: a.look.model } : {}), ...(a.look?.tier ? { tier: a.look.tier } : {}) });
        // L3 layout fixtures have no mission controller to apply the corridor's contact damage.
        if (world.scenario === 'L3') world.entities.get(entity)!.combat!.damageMultiplier = l3.infectedDamage;
      } else {
        entity = world.npcs!.companion.spawn(); const dog = world.entities.get(entity)!;
        if (a.at) this.teleport(dog, at);
        dog.transform.yaw = yaw;
      }
      if (a.floorY !== undefined) {
        const e = world.entities.get(entity)!; e.transform.y = a.floorY + .7;
        if (e.civilian) e.civilian.floorY = a.floorY;
      }
      if (a.supportFeet && world.entities.get(entity)?.civilian) world.entities.get(entity)!.civilian!.supportFeet = true;
      const actor: LabActor = { id, kind: a.kind, entity, spec: a, plan: null, track: [], lod: {}, drawn: 0, inView: 0, missed: 0, farClose: 0 };
      this.actors.set(id, actor); ids.push(id);
      if (a.state) this.command(id, a.state);
    }
    return ids;
  }
  private teleport(e: EntitySnapshot, p: { x: number; z: number }): void {
    this.world.solids.relocate(e, { ...p, y: (this.world.districts?.groundHeight(p.x,p.z)??0)+(e.companion ? .305 : .705) }, 'scene.teleport');
    if (e.id === 1) { this.world.physics.playerBody!.setTranslation(e.transform, true); this.world.physics.playerBody!.setNextKinematicTranslation(e.transform); this.world.player!.setCheckpoint(e.transform); }
  }
  private stand(at: { x: number; z: number }, yaw: number): CivilianActivity {
    return { activity: 'stand', anchor: 'lab/stand', target: { ...at }, ticks: 1e9, facing: { x: at.x + Math.cos(yaw) * 3, z: at.z - Math.sin(yaw) * 3 } };
  }
  private addVehicle(id: string, asset: string, at: Point, yawDeg: number, path?: Point[], panic?: boolean): number {
    const world = this.world, yaw = rad(yawDeg);
    let entity: number;
    if (asset === 'vehicle.bicycle') entity = world.vehicles!.bicycle.spawn(toPoint(at), -yaw);
    else if (asset.startsWith('veh.')) entity = spawnSetPiece(world, asset, { ...toPoint(at), yaw }).id;
    else if (asset === 'traffic') entity = world.npcs!.traffic.spawn([toPoint(at), ...(path ?? []).map(toPoint)], panic);
    else {
      entity = world.vehicles!.spawn(asset, toPoint(at), yaw);
      if (path?.length) this.drive(entity, path.map(toPoint));
    }
    this.vehicles.set(id, entity); return entity;
  }
  /** Pure-pursuit autopilot on the real vehicle physics (Vehicles.autopilot); brakes at the last point. */
  private drive(entity: number, route: { x: number; z: number }[]): void {
    let index = 0;
    this.world.vehicles!.autopilot.set(entity, (intent, e) => {
      while (index < route.length - 1 && Math.hypot(route[index].x - e.transform.x, route[index].z - e.transform.z) < 3) index++;
      const target = route[index], dx = target.x - e.transform.x, dz = target.z - e.transform.z, distance = Math.hypot(dx, dz);
      const last = index === route.length - 1, delta = Math.atan2(Math.sin(-Math.atan2(dz, dx) - e.transform.yaw), Math.cos(-Math.atan2(dz, dx) - e.transform.yaw));
      intent.steer = Math.max(-1, Math.min(1, delta * 2)); intent.throttle = last && distance < 6 ? 0 : .7; intent.brake = last && distance < 6;
    });
  }

  /** Give an actor an action now (see `Action` in spec.ts). */
  command(id: string, action: Action): void {
    const actor = this.actors.get(id); if (!actor) throw new Error(`Unknown actor ${id}; known: ${[...this.actors.keys()].join(', ')}`);
    const world = this.world, e = world.entities.get(actor.entity);
    if (!e) throw new Error(`Actor ${id} no longer exists`);
    const a: Exclude<Action, string> = typeof action === 'string' ? (action === 'idle' ? { idle: true } : action === 'chase' ? { chase: 'courier' } : action === 'flee' ? { flee: [e.transform.x - 1, e.transform.z] } : action === 'infect' ? { infect: {} } : { idle: true }) : action;
    actor.plan = null;
    if ('boardCar' in a || 'exitCar' in a) {
      const id = this.vehicles.get('boardCar' in a ? a.boardCar : a.exitCar);
      if (id === undefined || !('boardCar' in a ? world.vehicles!.boardPassenger(id, e.id) : world.vehicles!.disembarkPassenger(id, e.id))) throw new Error(`Transport doorway unavailable: ${actor.kind} ${'boardCar' in a ? 'board' : 'exit'} at frame ${this.frame}`);
      return;
    }
    if ('corpse' in a && e.infected) {
      e.health.current = 0; e.infected.state = 'dead'; e.infected.deadAt = world.tick - 120; e.infected.recoverAt = -1; return;
    }
    if (actor.kind === 'courier') {
      if ('god' in a) world.combat!.damage.god = a.god;
      else if ('walk' in a || 'run' in a) actor.plan = { type: 'path', points: 'walk' in a ? a.walk : a.run, index: 0, run: 'run' in a, loop: !!a.loop };
      else if ('moveTo' in a) actor.plan = { type: 'moveTo', point: a.moveTo, run: a.pace !== 'walk' };
      else if ('turn' in a) actor.plan = { type: 'turn', yaw: rad(a.turn) };
      else if ('aim' in a) actor.plan = { type: 'attack', target: a.aim, until: this.frame + ticks(a.seconds ?? 2), side: world.combat!.runner.loadout.state.selectedSide, move: a.move ?? [0, 0], aiming: true };
      else if ('attack' in a) actor.plan = { type: 'attack', target: a.attack, until: this.frame + ticks(a.seconds ?? 2), side: a.side ?? 'LEFT', move: a.move, inPlace: a.inPlace };
      else if ('select' in a) { const l = world.combat!.runner.loadout.state; l.selectedSide = a.select; if (a.index !== undefined) l[a.select].index = a.index; }
      else if ('click' in a) this.click(a.click, a.part ?? 'chest');
      else if ('mountBike' in a) actor.plan = { type: 'mount', bike: a.mountBike, at: this.frame };
      else if ('dismount' in a) actor.plan = { type: 'mount', bike: '', at: this.frame };
      else if ('drive' in a) { this.game.input.scheme = 'keyboard'; actor.plan = { type: 'drive', throttle: a.drive.throttle, steer: a.drive.steer ?? 0, until: this.frame + ticks(a.drive.seconds ?? 1) }; }
      else if ('interact' in a) actor.plan = { type: 'interact' };
      else if ('mountGun' in a || 'dismountGun' in a) actor.plan = { type: 'interact' };
      else if ('fireGun' in a) actor.plan = { type: 'gun', at: a.fireGun.at ?? null, until: this.frame + ticks(a.fireGun.seconds ?? 2) };
      else if ('hit' in a) world.player!.damage(a.hit.amount ?? 5, world.tick);
      return;
    }
    if (actor.kind === 'animal') {
      if ('infect' in a) world.npcs!.civilians.outbreak!.infect(e, a.infect.by ? this.actors.get(a.infect.by)?.entity ?? 0 : 0);
      // Pets on the shipped pet routine: walk (1.5 m/s) or run (jog routine, 2.5 m/s, trot) a waypoint loop, or flee (4.8 m/s).
      else if (e.civilian?.pet && ('walk' in a || 'run' in a)) {
        const c = e.civilian; c.owner = null; c.state = 'calm'; c.pauseUntil = 0; c.routine = 'run' in a ? 'jog' : 'pet';
        c.waypoints = ('walk' in a ? a.walk : a.run).map(toPoint); c.waypoint = 0;
      } else if (e.civilian?.pet && 'flee' in a) { const c = e.civilian; c.threat.x = a.flee[0]; c.threat.z = a.flee[1]; c.state = 'flee'; c.entered = world.tick; }
      return;
    }
    if (actor.kind === 'pedestrian') {
      const c = e.civilian!, reset = (schedule: CivilianActivity[]) => { c.schedule = schedule; c.scheduleStep = 0; c.activityUntil = 0; c.activityStarted = 0; c.pauseUntil = 0; c.path.length = 0; c.goal = -1; c.state = 'calm'; };
      if ('idle' in a) reset([this.stand(e.transform, e.transform.yaw)]);
      else if ('turn' in a) reset([this.stand(e.transform, rad(a.turn))]);
      else if ('walk' in a || 'run' in a) { const points = ('walk' in a ? a.walk : a.run).map(toPoint); if (c.l1) c.l1.walkSpeed = 'run' in a ? 3.2 : c.l1.walkSpeed; reset(points.map(p => ({ activity: 'walk', anchor: 'lab/walk', target: p, ticks: 1 }))); if (!a.loop) c.schedule!.push(this.stand(points[points.length - 1], e.transform.yaw)); }
      else if ('moveTo' in a) { const p = toPoint(a.moveTo); reset([{ activity: 'walk', anchor: 'lab/walk', target: p, ticks: 1 }, this.stand(p, e.transform.yaw)]); }
      else if('routine' in a){reset([this.stand(e.transform,e.transform.yaw)]);c.story={clip:a.routine==='sit'?'npc-sit':a.routine==='rest'?'death-side':a.routine==='talk'?'npc-gesture':a.routine==='share'?'npc-give':'npc-cower',start:world.tick};}
      else if ('sit' in a) reset(this.sitSchedule(a.sit, a.seconds));
      else if ('water' in a) reset(this.waterSchedule(a.water, a.seconds));
      else if ('flee' in a) { c.threat.x = a.flee[0]; c.threat.z = a.flee[1]; c.state = 'flee'; c.entered = world.tick; }
      else if ('infect' in a) { const by = a.infect.by ? this.actors.get(a.infect.by)?.entity ?? 0 : 0; if (a.infect.instant) world.npcs!.civilians.outbreak!.turnNow(e); else world.npcs!.civilians.outbreak!.infect(e, by); }
      else if ('hit' in a) this.hit(e, a.hit);
      else if ('ally' in a && a.ally.role === 'firefighter') {
        // The L1/L2 allied firefighter (axe swing, l2.allies.firefighter numbers), engaged where he stands.
        c.ally = { ...allyState('firefighter', { x: e.transform.x, z: e.transform.z }), engaged: true };
        e.health = { current: l2.allies.firefighter.hp, max: l2.allies.firefighter.hp };
      }
      else if ('ally' in a && (a.ally.weapon || a.ally.role === 'civilian')) {
        // The L4 allied fighter v3 setup (LevelFourWar.spawnSoldiers / engageAll): soldier rifle, HMG crew, armed civilians.
        const w = a.ally.weapon ?? 'rifle', role = a.ally.role ?? 'soldier', post = { x: e.transform.x, z: e.transform.z };
        const gun = w === 'hmg' ? l4.soldiers.hmg : w === 'rifle' ? l4.soldiers.rifle : w === 'pistol' ? l4.civilians.pistol : w === 'hunting-rifle' ? l4.civilians.rifle : null;
        c.ally = { ...allyState(role, gun ? post : null, !!gun), engaged: true, runSpeed: 3.4, ...(gun ? { gun: { ...gun }, weapon: (w === 'rifle' || w === 'hmg' || w === 'pistol' || w === 'hunting-rifle' ? w : 'rifle') as 'rifle', range: gun.rangeM } : { melee: { ...l4.civilians.melee }, range: 8 }) };
        e.health = { current: role === 'soldier' ? l4.soldiers.hp : l4.civilians.hp, max: role === 'soldier' ? l4.soldiers.hp : l4.civilians.hp };
        if (e.appearance) e.appearance.handProp = w === 'hmg' ? 'rifle' : w;
      }
      else if ('ally' in a) {
        // The L3 allied fighter v2 setup (LevelThreeCollapse.officer/fallback): a gun, engaged, a post or a squad slot.
        const role = a.ally.role ?? 'officer', leader = a.ally.follow ? this.actors.get(a.ally.follow)?.entity : undefined, f = l3.officers.squad, slot = a.ally.slot ?? 0;
        c.ally = { ...allyState(role, leader ? null : { x: e.transform.x, z: e.transform.z }, !leader), gun: { ...(role === 'soldier' ? l3.soldiers.gun : leader ? f.gun : l3.officers.gun) }, engaged: true, runSpeed: f.moveMs };
        if (leader) c.ally.follow = { targetId: leader, slot, minM: f.minFollowM, maxM: f.maxFollowM, engageM: f.engageM, leashM: f.leashM, moveMs: f.moveMs - slot * f.slowerMs };
        e.health = { current: role === 'soldier' ? l3.soldiers.hp : l3.officers.hp, max: role === 'soldier' ? l3.soldiers.hp : l3.officers.hp };
      }
      else if ('survivor' in a) { c.survivor = { key: id, mode: 'follow', slot: a.survivor.slot ?? 0, leader: 0, cover: false, waitAt: world.tick + 600, foundAt: world.tick }; c.state = 'calm'; c.schedule = [this.stand(e.transform, e.transform.yaw)]; c.scheduleStep = 0; c.pauseUntil = 0; }
      else if ('handover' in a) this.startHandover(actor, e, a.handover);
      return;
    }
    if (actor.kind === 'infected') {
      const b = e.infected!;
      if ('special' in a) {
        const t = world.entities.get(this.actors.get(a.target)?.entity ?? 0);
        if (!t) throw new Error(`Unknown special target ${a.target}`);
        const dx = t.transform.x - e.transform.x, dz = t.transform.z - e.transform.z, d = Math.hypot(dx, dz) || 1;
        world.infected!.startSpecial(e.id, a.special, { id: t.id, x: t.transform.x, z: t.transform.z }, { x: e.transform.x, z: e.transform.z, radius: a.special === 'alpha.roar' ? 18 : 1, dx: dx / d, dz: dz / d });
      } else if ('idle' in a) { b.state = 'idle'; delete e.noiseTarget; }
      else if ('chase' in a) { b.state = 'chase'; const target = this.actors.get(a.chase); if (target && target.entity !== 1) e.noiseTarget = { id: target.entity, until: world.tick + 1e6 }; }
      else if ('grab' in a) { const target = this.world.entities.get(this.actors.get(a.grab)?.entity ?? 0); if (target?.civilian) world.npcs!.civilians.outbreak!.grab(target, e); }
      else if ('attack' in a) { b.state = 'chase'; }
      else if ('turn' in a) e.transform.yaw = rad(a.turn);
      else if ('hit' in a) this.hit(e, a.hit);
      else if ('moveTo' in a || 'walk' in a || 'run' in a) { const p = toPoint('moveTo' in a ? a.moveTo : ('walk' in a ? a.walk : a.run).slice(-1)[0]); b.state = 'attracted' as typeof b.state; e.noiseTarget = undefined; world.infected!.noise(p, 30, true); }
      return;
    }
    // Corgi: it always follows the courier (Companion); turn/teleport are the only overrides.
    if ('turn' in a) e.transform.yaw = rad(a.turn);
    else if ('moveTo' in a) this.teleport(e, toPoint(a.moveTo));
  }
  /** L1 hand-over: the same door route as L1Story.pickup / LevelOneOutbreak.handover, driven by the frame counter. */
  private startHandover(actor: LabActor, e: EntitySnapshot, h: { building: string; meet: Point | string; pauseS?: number; standoff?: number; legacy?: boolean }): void {
    const placements = this.built!.placements, p = placements.find(q => q.id === h.building) ?? placements.find(q => q.assetId === h.building);
    const way = p && doorwayOf(p); if (!way) throw new Error(`handover: no doored building ${h.building} (src/data/buildingDoors.ts)`);
    let meet: { x: number; z: number };
    if (typeof h.meet === 'string') {
      const t = this.world.entities.get(this.actors.get(h.meet)?.entity ?? -1); if (!t) throw new Error(`handover: unknown actor ${h.meet}`);
      const dx = way.door.x - t.transform.x, dz = way.door.z - t.transform.z, d = Math.hypot(dx, dz) || 1;
      meet = { x: t.transform.x + dx / d * (h.standoff ?? 1.05), z: t.transform.z + dz / d * (h.standoff ?? 1.05) };
    } else meet = toPoint(h.meet);
    let route = doorRoute(this.world.infected!.nav, way, meet);
    if (h.legacy && typeof h.meet === 'string') {
      // Pre-fix geometry (A/B evidence; run with `--query doors=0`): the depot clerk from "behind the counter" on the
      // courier's line (L1Story before 2026-10-08), the technician spawn -> lab-exit-front -> meeting point in straight lines.
      const t = this.world.entities.get(this.actors.get(h.meet)!.entity)!.transform, counter = { x: way.door.x + way.out.x * 2, z: way.door.z + way.out.z * 2 };
      if (p.assetId === 'bld.courier-depot') {
        const dx = counter.x - t.x, dz = counter.z - t.z, d = Math.hypot(dx, dz) || 1, k = Math.max(2.6, d + 1.4), behind = { x: t.x + dx / d * k, z: t.z + dz / d * k };
        const mx = t.x - behind.x, mz = t.z - behind.z, md = Math.hypot(mx, mz) || 1;
        route = [behind, { x: t.x - mx / md * 1.05, z: t.z - mz / md * 1.05 }];
      } else {
        const exit = { x: way.centre.x + way.out.x * 2.2, z: way.centre.z + way.out.z * 2.2 }, dx = t.x - exit.x, dz = t.z - exit.z, d = Math.hypot(dx, dz) || 1;
        route = [{ x: way.centre.x - way.out.x * 1.6, z: way.centre.z - way.out.z * 1.6 }, exit, { x: t.x - dx / d * (h.standoff ?? 1.4), z: t.z - dz / d * (h.standoff ?? 1.4) }];
      }
    }
    const c = e.civilian!;
    c.ambient = false; c.pauseUntil = Number.MAX_SAFE_INTEGER; c.routine = 'staff'; c.state = 'calm'; c.schedule = [this.stand(route[0], e.transform.yaw)]; c.scheduleStep = 0; c.path.length = 0; c.goal = -1;
    this.teleport(e, route[0]);
    this.handovers.set(actor.id, { route, length: routeLength(route), start: this.world.tick + 1, pause: ticks(h.pauseS ?? 2.2), ...(typeof h.meet === 'string' ? { face: this.actors.get(h.meet)!.entity } : {}) });
    this.log.push(`handover ${actor.id}: ${route.map(q => `${q.x.toFixed(2)},${q.z.toFixed(2)}`).join(' > ')}`);
  }
  private driveHandovers(): void {
    for (const [id, h] of this.handovers) {
      const actor = this.actors.get(id), e = actor && this.world.entities.get(actor.entity); if (!e?.civilian) { this.handovers.delete(id); continue; }
      const walk = Math.max(1, Math.round(h.length / 1.6 * 60)), t = this.world.tick - h.start, c = e.civilian;
      const present = (clip: string, prop?: 'parcel') => { if (c.story?.clip !== clip || c.story.prop !== prop) c.story = { clip, start: this.world.tick, ...(prop ? { prop } : {}) }; };
      const put = (m: number, forward: boolean) => {
        const q = routeAt(h.route, m); e.transform.x = q.x; e.transform.z = q.z; this.world.spatial.set(e.id, q.x, q.z);
        if (Math.hypot(q.dx, q.dz) > 1e-6) e.transform.yaw = -Math.atan2(forward ? q.dz : -q.dz, forward ? q.dx : -q.dx);
      };
      if (t < walk) { put(t / walk * h.length, true); present('npc-carry', 'parcel'); }
      else if (t < walk + h.pause) {
        put(h.length, true);
        const f = h.face !== undefined ? this.world.entities.get(h.face) : undefined; if (f) e.transform.yaw = -Math.atan2(f.transform.z - e.transform.z, f.transform.x - e.transform.x);
        present(t - walk < h.pause / 2 ? 'npc-give' : 'npc-wave', t - walk < h.pause / 3 ? 'parcel' : undefined); }
      else if (t < 2 * walk + h.pause) { put(h.length - (t - walk - h.pause) / walk * h.length, false); present('npc-walk'); }
      else { put(0, false); c.story = null; this.handovers.delete(id); }
    }
  }
  /** Sit on a placement id (or the nearest placement of an asset id), the same seat rule as MorningRoutines/Population. */
  private sitSchedule(target: string, seconds = 600): CivilianActivity[] {
    const placements = this.built!.placements;
    const bench = placements.find(p => p.id === target) ?? placements.filter(p => p.assetId === target).sort((a, b) => Math.hypot(a.position[0], a.position[2]) - Math.hypot(b.position[0], b.position[2]))[0];
    if (!bench) throw new Error(`sit: no placement ${target}`);
    // Authored seat anchor (src/sim/npc/seats.ts) where one exists: hip over the seat, root lifted by `seatLift`.
    const anchored = seatAnchor(bench.assetId, bench.position, bench.yaw, bench.scale);
    const seat = anchored ?? { x: bench.position[0], z: bench.position[2] }, front = { x: Math.cos(bench.yaw), z: -Math.sin(bench.yaw) };
    const approach = { x: seat.x + front.x * .9, z: seat.z + front.z * .9 }, facing = { x: seat.x + front.x * 3, z: seat.z + front.z * 3 };
    return [{ activity: 'sit', anchor: bench.id, target: approach, seat: { x: seat.x, z: seat.z }, seatLift: anchored?.lift, facing, ticks: ticks(seconds) }];
  }
  private waterSchedule(target: string, seconds = 600): CivilianActivity[] {
    const placements = this.built!.placements, nav = this.world.infected!.nav;
    const bed = placements.find(p => p.id === target) ?? placements.filter(p => p.assetId === target).sort((a, b) => Math.hypot(a.position[0], a.position[2]) - Math.hypot(b.position[0], b.position[2]))[0];
    if (!bed) throw new Error(`water: no placement ${target}`);
    const box = { x0: bed.visualAabb.min[0], z0: bed.visualAabb.min[2], x1: bed.visualAabb.max[0], z1: bed.visualAabb.max[2] };
    const spot = standNear(box, p => nav.clear(p.x, p.z, .35), { x: bed.position[0], z: bed.position[2] + 3 });
    if (!spot) throw new Error(`water: no standing spot at ${target}`);
    return [{ activity: 'water', anchor: bed.id, target: spot.target, facing: spot.facing, ticks: ticks(seconds), prop: 'watering-can' }];
  }
  private hit(e: EntitySnapshot, hit: { from?: string | Point; heavy?: boolean; amount?: number }): void {
    const from = typeof hit.from === 'string' ? this.world.entities.get(this.actors.get(hit.from)?.entity ?? 1)!.transform : hit.from ? toPoint(hit.from) : { x: e.transform.x - 1, z: e.transform.z };
    const dx = e.transform.x - from.x, dz = e.transform.z - from.z, d = Math.hypot(dx, dz) || 1;
    this.world.combat!.damage.apply({ attackId: 9000 + this.world.tick, actionId: hit.heavy ? 'weapon.kick' : 'weapon.fists', sourceId: 1, targetId: e.id, origin: { x: from.x, z: from.z }, direction: { x: dx / d, z: dz / d }, base: hit.amount ?? 1, multiplier: 1, type: 'melee', knockback: hit.heavy ? 1.5 : .3, stagger: hit.heavy ? 30 : 12, knockdown: hit.heavy });
  }
  effect(fx: EffectSpec): void {
    const world = this.world;
    if ('metroShutter' in fx) {
      const closed = Math.max(0, Math.min(1, fx.metroShutter)), dy = -1.9 * (closed - this.metroClosed);
      this.game.view.metroShutter(closed);
      for (const set of this.staticSets ?? []) if (set.id.endsWith('/shutter')) {
        for (let i = 1; i < set.tris.length; i += 3) set.tris[i] += dy;
        set.box.min[1] += dy; set.box.max[1] += dy;
      }
      this.metroClosed = closed;
      this.staticClips = null;
    }
    else if ('moveProp' in fx) {
      const item = world.props?.items.find(p => p.id.endsWith(`/${fx.moveProp}`));
      if (!item) throw new Error(`moveProp: no pushable ${fx.moveProp}`);
      const h = Math.SQRT1_2;
      world.props!.place(item, { p: [item.pose.p[0] + fx.by[0], item.pose.p[1] + (fx.tip ? .3 : 0), item.pose.p[2] + fx.by[1]], q: fx.tip ? [h, 0, 0, h] : [...item.pose.q] });
    }
    else if ('pickup' in fx) world.pickups!.spawn(fx.pickup, toPoint(fx.at));
    else if ('weaponPickup' in fx) { const id = world.combat!.pickups.spawn(fx.weaponPickup, toPoint(fx.at), false, { surfaceY: fx.surfaceY, retain: true, interactTicks: 36 }); world.entities.get(id)!.transform.yaw = (fx.yaw ?? 0) * Math.PI / 180; }
    else if ('barricadeHit' in fx) { const target = world.entities.values().find(e => e.barricade?.slot.id === fx.barricadeHit); if (!target) throw new Error(`Unknown barricade: ${fx.barricadeHit}`); world.hazards!.hit(target.id, fx.amount, 'bullet'); }
    else if ('lightning' in fx) world.weather?.strike({ ...toPoint(fx.lightning), y: 0 }, fx.consequence);
    else if ('blast' in fx) world.explosions!.blast(fx.blast, toPoint(fx.at));
    else if ('wreck' in fx) { const id = this.vehicles.get(fx.wreck); if (id === undefined) throw new Error(`wreck: unknown vehicle ${fx.wreck}`); world.vehicles!.damage(id, 1e6); }
    else if ('hazard' in fx) { const id = world.hazards!.spawn(fx.hazard, toPoint(fx.at), { radius: fx.radius, duration: fx.duration }); if (fx.trigger) world.hazards!.hit(id, 1, fx.trigger); }
    else if ('fire' in fx && fx.duration !== undefined) { const p = toPoint(fx.fire), id = world.hazards!.spawn('fire',p,{radius:fx.radius??2,duration:fx.duration}); world.entities.get(id)!.transform.y += world.districts?.groundHeight(p.x, p.z) ?? 0; }
    else { const kind = 'fire' in fx ? 'fire' : 'smoke', p = toPoint('fire' in fx ? fx.fire : fx.smoke); world.events.emit({ type: 'vfx.effect', tick: world.tick, kind, position: p, radius: fx.radius ?? 2 } as Parameters<typeof world.events.emit>[0]); }
  }
  setTime(preset: TimeOfDay): void { this.game.view.settings({ timeOfDay: preset }); }
  setCamera(camera: CameraSpec): void { this.camera = camera; this.applyCamera(); this.game.view.update(1); }

  /** Resolve a camera target: actor id, [x, z] or [x, y, z]. */
  private target(t: [number, number, number] | Point | string | undefined, y = .8, feet = false): [number, number, number] {
    // `feet`: the game camera's focus follows the feet height (View.update), so a courier on a deck or stair stays centred.
    if (typeof t === 'string') { const entity = this.actors.get(t)?.entity ?? this.vehicles.get(t), e = entity === undefined ? undefined : this.world.entities.get(entity); if (!e) throw new Error(`camera: unknown actor ${t}`); return [e.transform.x, feet && this.actors.has(t) ? Math.max(0, e.transform.y - .72) : y, e.transform.z]; }
    if (!t) return [this.built!.center[0], y, this.built!.center[1]];
    return t.length === 3 ? [t[0], t[1], t[2]] : [t[0], y, t[1]];
  }
  private applyCamera(): void {
    const c = this.camera; if (!c) return;
    if (this.spec?.cureProgression?.epilogueElapsed !== undefined && c.mode === 'game' && c.target === 'courier') {
      const view = this.game.view.view;
      view.follow(); view.zoom(Math.log((c.zoom ?? 1) / view.getState().targetZoom), true);
      return;
    }
    // Courier follow scenes use the production rig, including narrow-street lens
    // clearance. A fixed preset can put the catalog camera inside a building.
    if (c.mode === 'follow' && this.actors.get(c.actor)?.entity === 1) {
      const rig = this.game.view.view;
      rig.follow();
      const zoom = c.zoom ?? 1, current = rig.getState().targetZoom;
      if (Math.abs(current - zoom) > 1e-6) rig.zoom(Math.log(zoom / current), true);
      return;
    }
    // E32 close camera: Mega fixtures run the real follow rig (boss pull-back, player zoom), not a fixed preset.
    if (this.spec?.megaAlpha && c.mode === 'game' && c.target === 'courier') {
      const rig = this.game.view.view;
      if (rig.getState().spot !== null) rig.follow();
      const zoom = c.zoom ?? 1, current = rig.getState().targetZoom;
      if (Math.abs(current - zoom) > 1e-6) rig.zoom(Math.log(zoom / current), true);
      return;
    }
    const view = this.game.view.view, spherical = (target: [number, number, number], radius: number, polar: number, azimuth: number) => {
      const s = Math.sin(polar) * radius;
      view.preset('scene-lab', { target, position: [target[0] + s * Math.sin(azimuth), target[1] + Math.cos(polar) * radius, target[2] + s * Math.cos(azimuth)] });
    };
    // Match View.resize's portrait framing as well as the desktop game camera.
    const aspect = view.camera.aspect, { radiusM, portraitWidthM, fovDeg } = cameraFraming;
    const radius = aspect >= 1 ? radiusM : Math.max(radiusM, portraitWidthM / (2 * Math.tan(fovDeg * Math.PI / 360) * aspect));
    // Vehicle-focused fixtures mirror View's 15% driving pull-back. Otherwise
    // the APC's bumper clips at the actual closest player zoom (0.5).
    const vehicleTarget = c.mode === 'game' ? typeof c.target === 'string' && this.vehicles.has(c.target) : c.mode === 'follow' && this.vehicles.has(c.actor);
    const gameRadius = radius * (vehicleTarget ? 1.15 : 1);
    if (c.mode === 'game') spherical(this.target(c.target, 0), gameRadius * (c.zoom ?? 1), view.polar, view.azimuth);
    else if (c.mode === 'follow') spherical(this.target(c.actor, 0, true), gameRadius * (c.zoom ?? 1), view.polar, view.azimuth);
    else if (c.mode === 'close') spherical(this.target(c.target), c.radius ?? 5, view.polar, c.azimuth === undefined ? view.azimuth : rad(c.azimuth));
    else if (c.mode === 'orbit') spherical(this.target(c.target), c.radius ?? 10, rad(c.polar ?? 54), rad((c.azimuth ?? 45) + (c.spin ?? 0) * this.frame / 60));
    else view.preset('scene-lab', { position: c.position, target: c.target });
  }

  /** Advance N fixed ticks (sim + render), recording metrics every frame. */
  async step(frames = 1): Promise<number> {
    for (let i = 0; i < frames; i++) {
      // Fixed stepping can consume the two-second walking horizon in one browser task.
      // Let the previous frame's LOD requests finish before advancing again, as they
      // can at game speed. This never repairs or discards a frame already drawn:
      // missing prefetch still fails the zero-stand-in gate on its first visible tick.
      await this.game.view.labProbes().districts?.ready();
      for (const s of this.spec?.script ?? []) if (s.frame === this.frame) {
        if ('actor' in s) this.command(s.actor, s.do);
        else if ('spawnActor' in s) this.spawnActor(s.spawnActor);
        else if ('effect' in s) this.effect(s.effect);
        else if ('camera' in s) { this.camera = s.camera; this.applyCamera(); }
        else if ('weather' in s) this.game.world.weather?.setOverride(s.weather);
        else if ('time' in s) this.setTime(s.time);
      }
      this.drivePlayer();
      if (this.camera?.mode === 'follow' || this.camera?.mode === 'orbit' && this.camera.spin || typeof (this.camera as { target?: unknown })?.target === 'string') this.applyCamera();
      const start = performance.now();
      this.nextRenderFrame();
      if (this.boom) this.game.view.labProbes().districts?.updateArmyBoom(this.spec?.armyBoom?.closed ? 0 : this.boomClosedAt ? Math.max(0, 1 - (this.world.tick - this.boomClosedAt) / 42) : 1);
      if (this.spec?.marketDoors) this.game.view.labProbes().districts?.marketDoors(!!this.spec.marketDoors.open || (this.spec.marketDoors.openAtFrame !== undefined && this.frame >= this.spec.marketDoors.openAtFrame));
      this.game.view.frame(1 / 60); await this.game.step(1);
      // `?profile` (set by the runner) attributes every submitted draw, including the PostFx scene pass and shadows.
      const stepMs = performance.now() - start, info = this.game.view.renderer.info.render, profile = Object.entries(this.game.view.renderer.profile ?? {});
      const view = profile.filter(([k]) => k !== 'shadows'), shadow = profile.find(([k]) => k === 'shadows')?.[1];
      this.perf.push(profile.length ? { drawCalls: view.reduce((n, [, v]) => n + v.drawCalls, 0), triangles: view.reduce((n, [, v]) => n + v.triangles, 0), shadowDrawCalls: shadow?.drawCalls ?? 0, shadowTriangles: shadow?.triangles ?? 0, stepMs, categories: Object.fromEntries(profile.map(([k, v]) => [k, v.drawCalls])) } : { drawCalls: info.drawCalls, triangles: info.triangles, shadowDrawCalls: 0, shadowTriangles: 0, stepMs, categories: {} });
      if (this.spec?.hud || this.spec?.megaHud) this.game.ui.hud.update();
      if (this.spec?.cureProgression) this.game.campaignUI.update();
      this.frame++;
      this.sample();
      const standIns = this.game.view.labProbes().districts?.placeholderDraws() ?? [];
      if (standIns.length) { this.placeholders.frames++; if (this.placeholders.firstFrame < 0) this.placeholders.firstFrame = this.frame - 1; for (const d of standIns) this.placeholders.assets.add(`${d.assetId} ${d.lod}->${d.shown}`); }
      const gaps = this.game.view.labProbes().districts?.propGroundGaps() ?? [];
      this.propGroundSamples += gaps.length;
      this.propSinkMaxCm = Math.max(this.propSinkMaxCm, 0, ...gaps.map(g => -g.gapCm));
    }
    return this.frame;
  }
  /** One three.js node frame per tick, as three's own RAF loop (renderers/common/Animation.js) does. Without it,
   * FRAME-updated nodes such as the PostFx scene pass render once per browser frame, not once per stepped tick. */
  private nextRenderFrame(): void {
    const renderer = this.game.view.renderer, nodes = (renderer as unknown as { _nodes: { nodeFrame: { update(): void; frameId: number } } })._nodes;
    nodes.nodeFrame.update(); (renderer.info as { frame: number }).frame = nodes.nodeFrame.frameId;
  }
  /** Player input for courier plans: keyboard-like `move` for paths (crisp turns), click-like `moveTarget` for moveTo. */
  private drivePlayer(): void {
    const courier = [...this.actors.values()].find(a => a.kind === 'courier'); if (!courier) return;
    const world = this.world, p = world.entities.get(1)!.transform, plan = courier.plan;
    // InputSystem.inject merges into the last frame: name every one-tick field so a click's edges do not persist.
    const frame: InputFrame & Record<string, unknown> = { ...emptyInput(), drive: undefined, brake: undefined, walk: undefined, moveTarget: undefined, attackTarget: undefined, attackInPlace: undefined, navigation: undefined, cancelMove: undefined, mouseAttack: undefined, pointerTarget: undefined };
    if (plan?.type === 'path') {
      let target = toPoint(plan.points[plan.index]);
      if (Math.hypot(target.x - p.x, target.z - p.z) < .35) {
        plan.index++;
        if (plan.index >= plan.points.length) { if (plan.loop) plan.index = 0; else courier.plan = null; }
        if (courier.plan) target = toPoint(plan.points[plan.index]);
      }
      if (courier.plan) { const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz) || 1; frame.move = { x: dx / d, z: dz / d }; frame.walk = !plan.run || undefined; }
    } else if (plan?.type === 'moveTo') {
      if (Math.hypot(plan.point[0] - p.x, plan.point[1] - p.z) < .3) courier.plan = null; else { frame.moveTarget = toPoint(plan.point); frame.walk = !plan.run || undefined; }
    } else if (plan?.type === 'turn') {
      const delta = Math.atan2(Math.sin(plan.yaw - p.yaw), Math.cos(plan.yaw - p.yaw));
      if (Math.abs(delta) < rad(2)) courier.plan = null; else frame.move = { x: Math.cos(plan.yaw) * .04, z: -Math.sin(plan.yaw) * .04 };
    } else if (plan?.type === 'attack') {
      const target = this.actors.get(plan.target);
      if (!target || this.frame >= plan.until) { courier.plan = null; frame.cancelMove = true; }
      else {
        if (plan.inPlace) frame.attackInPlace = true;
        if (plan.move) {
          const t = world.entities.get(target.entity)!.transform, dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz) || 1;
          frame.move = toPoint(plan.move); frame.walk = true; frame.aim = { x: dx / d, z: dz / d }; frame.aimSource = 'pointer';
        } else frame.attackTarget = { id: target.entity, side: plan.side };
        if (plan.aiming) frame.pointerTarget = true;
        else frame[plan.side === 'LEFT' ? 'left' : 'right'] = { down: false, held: true, up: false }; }
    } else if (plan?.type === 'click') {
      // A released LMB on the picked body, as InputSystem resolves a real click (one swing, the feet stay put).
      if (this.frame === plan.at) { frame.attackTarget = { id: plan.entity, side: 'LEFT' }; frame.mouseAttack = true; frame.cancelMove = true; frame.pointerTarget = true; frame.aimSource = 'pointer'; frame.left = { down: true, held: false, up: true }; }
      else { frame.pointerTarget = true; frame.aimSource = 'pointer'; if (this.frame > plan.at + 40) courier.plan = null; }
    } else if (plan?.type === 'drive') {
      if (this.frame >= plan.until) { courier.plan = null; frame.brake = true; }
      else frame.drive = { throttle: plan.throttle, steer: plan.steer };
    } else if (plan?.type === 'gun') {
      if (this.frame >= plan.until) courier.plan = null;
      else {
        const gun = world.mountedGun, target = typeof plan.at === 'string' ? this.actors.get(plan.at) : undefined;
        const to = target ? world.entities.get(target.entity)!.transform : plan.at && typeof plan.at !== 'string' ? toPoint(plan.at) : null;
        if (to && gun) { const dx = to.x - gun.placement.x, dz = to.z - gun.placement.z, d = Math.hypot(dx, dz) || 1; frame.aim = { x: dx / d, z: dz / d }; frame.aimSource = 'pointer'; }
        frame.left = { down: false, held: true, up: false };
      }
    } else if (plan?.type === 'interact') {
      frame.interact = true; courier.plan = null;
    } else if (plan?.type === 'mount') {
      // Mount/dismount is the real interact press next to the bicycle (one tick).
      const bike = plan.bike ? this.vehicles.get(plan.bike) : undefined;
      if (bike !== undefined && this.frame === plan.at) { const b = world.entities.get(bike)!; this.teleport(world.entities.get(1)!, { x: b.transform.x + .9, z: b.transform.z }); }
      if (this.frame === plan.at + 2) { frame.interact = true; courier.plan = null; }
    }
    world.setInput(frame); this.game.input.inject(frame);
  }

  /** Click probes: the drawn body part (rendered rig joints of the last frame) projected to the screen, resolved by the
   * game's own click pick; an attack on that actor must start within 6 ticks, or right after the running swing. */
  private readonly clicks: { frame: number; tick: number; actor: string; part: string; picked: string | null; until: number; started: number | null; approach: boolean }[] = [];
  private click(id: string, part: 'head' | 'chest' | 'hip' | 'feet'): void {
    const target = this.actors.get(id); if (!target) throw new Error(`Unknown actor ${id}`);
    const f = this.game.view.crowdFigures().find(f => f.id === target.entity && f.drawn && f.joints), world = this.world;
    const runner = world.combat?.runner, side = world.entities.get(1)?.weapons?.selectedSide ?? 'LEFT', running = runner?.running[side];
    // Queued behind a running swing: valid until it (and the weapon cooldown) is over, plus 100 ms.
    const ready = Math.max(world.tick, running && world.tick < running.endsAt ? running.endsAt : 0, runner?.loadout.current(side).readyAt ?? 0);
    const tt = world.entities.get(target.entity)!.transform, pp = world.entities.get(1)!.transform, reach = runner ? runner.loadout.definition(runner.loadout.current(side).id).range : 0;
    const row = { frame: this.frame, tick: world.tick, actor: id, part, picked: null as string | null, until: ready + 6, started: null as number | null, approach: Math.hypot(tt.x - pp.x, tt.z - pp.z) > reach * .95 };
    this.clicks.push(row);
    if (!f?.joints) { this.log.push(`click ${id}: not drawn`); return; }
    const j = f.joints, feet = j.footL.map((v, i) => (v + j.footR[i]) / 2), axis = j.head.map((v, i) => v - j.hip[i]), length = Math.hypot(...axis) || 1;
    const p = part === 'head' ? j.head.map((v, i) => v + axis[i] / length * .1) : part === 'chest' ? j.hip.map((v, i) => v + axis[i] * .6) : part === 'hip' ? j.hip : feet;
    const q = this.game.view.project(p[0], p[1], p[2]), rect = this.game.view.renderer.domElement.getBoundingClientRect();
    const picked = this.game.input.picker.pick(rect.left + (q[0] + 1) / 2 * rect.width, rect.top + (1 - q[1]) / 2 * rect.height, world.entities.iterate());
    row.picked = picked ? [...this.actors.values()].find(a => a.entity === picked.id)?.id ?? `#${picked.id}` : null;
    const courier = [...this.actors.values()].find(a => a.kind === 'courier');
    if (picked && courier) courier.plan = { type: 'click', entity: picked.id, at: this.frame };
  }
  private clickReport() {
    for (const row of this.clicks) if (row.started === null) {
      const attack = this.world.events.events(row.tick).find(e => e.type === 'combat.attack' && e.sourceId === 1 && e.tick <= row.until);
      if (attack && row.picked === row.actor) row.started = attack.tick - row.tick;
    }
    // Out of reach, a correct pick is an approach (ControlIntent walks in, then strikes; covered by the sim tests).
    // A newer click before this one's swing came replaces it (latest click wins, one queued swing).
    const rows = this.clicks.map((r, i) => ({ ...r, superseded: r.started === null && (this.clicks[i + 1]?.tick ?? Infinity) < r.until }))
      .map(r => ({ ...r, hit: r.picked === r.actor && (r.started !== null || r.approach || r.superseded) }));
    const swings = this.world.events.events(0).flatMap(e => e.type === 'combat.attack' && e.sourceId === 1 ? [`${e.tick}:${e.actionId.replace('weapon.', '')}${e.style ? `/${e.style}` : ''}`] : []);
    return { total: rows.length, misses: rows.filter(r => !r.hit).length, rows, swings };
  }
  /** Courier ankle height above the sole, in foot-local units, from the frame-0 idle pose (feet flat on the floor). */
  private calibrateSole(): void {
    const courier = [...this.actors.values()].find(a => a.kind === 'courier'), c = this.game.view.labProbes().character, foot = c?.node('footL');
    if (!courier || !c || !foot) return;
    c.updateMatrixWorld(true);
    // Sole depth is an asset-local measurement. The paused initial capsule may
    // still be settling onto raised paving; baking that floor delta into the
    // shoe depth would report every later planted foot as floating or sunk.
    courier.sole = (foot.getWorldPosition(this.point).y - c.position.y) / foot.getWorldScale(new Vector3()).y;
  }
  /** Per-frame probes: foot/torso tracks, LOD and visibility of every actor; bone-vs-prop clipping every 3rd frame. */
  /**
   * Infected pursuit QA (PO 10-09 "Zombies loose track", "not moving at all"), per L1-brain infected actor:
   * `stuckRunMax` longest run of frames it should be moving (chasing beyond arm's reach, searching, attracted, wandering to a
   * goal; not pausing, winding up, biting, staggered or emerging) yet moves < 0.1 m/s; `lostNearFrames` frames it is not
   * chasing/attacking although the living courier is within 6 m in clear line of sight; `overshootMaxM` how far it got ahead
   * of a courier running > 2 m/s while chasing her (along her running direction).
   */
  private readonly pursuit = new Map<string, { stuckRun: number; stuckRunMax: number; stuckFrame: number; lostNearFrames: number; overshootMaxM: number }>();
  private attacks = { courier: 0, swings: 0, firstFrame: -1, bites: 0, firstBiteFrame: -1, hull: 0, hullHits: 0 };
  private samplePursuit(actor: LabActor, e: EntitySnapshot): void {
    const b = e.infected, brain = b?.l1, tick = this.world.tick;
    if (!b || !brain || e.health.current <= 0 || e.corpse || e.hidden || e.emerging) return;
    const p = this.pursuit.get(actor.id) ?? { stuckRun: 0, stuckRunMax: 0, stuckFrame: -1, lostNearFrames: 0, overshootMaxM: 0 }; this.pursuit.set(actor.id, p);
    const busy = tick < brain.pauseUntil || brain.cueUntil > 0 || b.state === 'attack' || brain.mode === 'bite' || Status.stunned(e, tick) || (e.infectionRise && tick < e.infectionRise.until) || e.attachedTo !== undefined;
    const target = brain.mode === 'chase' ? this.world.entities.get(brain.targetId) : undefined;
    const reach = target ? Math.hypot(target.transform.x - e.transform.x, target.transform.z - e.transform.z) : Infinity;
    const shouldMove = !busy && (brain.mode === 'chase' ? reach > 1.6 : brain.mode !== 'wander' || brain.hasGoal);
    p.stuckRun = shouldMove && (e.motion?.speed ?? 0) < .1 ? p.stuckRun + 1 : 0;
    if (p.stuckRun > p.stuckRunMax) { p.stuckRunMax = p.stuckRun; p.stuckFrame = this.frame; }
    const courier = [...this.actors.values()].some(a => a.kind === 'courier'), c = this.world.entities.get(1)!;
    if (courier && !c.hidden && c.health.current > 0) {
      const d = Math.hypot(c.transform.x - e.transform.x, c.transform.z - e.transform.z);
      if (d < 6 && !Status.stunned(e, tick) && !(e.combat?.reaction && tick < e.combat.reaction.until) && brain.mode !== 'chase' && brain.mode !== 'bite' && b.state !== 'attack' && this.world.infected!.l1!.lineOfSight(e.transform, c.transform)) p.lostNearFrames++;
      const v = c.survivor?.velocity, speed = v ? Math.hypot(v.x, v.z) : 0;
      if (brain.mode === 'chase' && brain.targetId === 1 && speed > 2) p.overshootMaxM = Math.max(p.overshootMaxM, ((e.transform.x - c.transform.x) * v!.x + (e.transform.z - c.transform.z) * v!.z) / speed);
    }
  }
  private propPenetration = new Map<string, { actor: string; prop: string; run: number; max: number; frames: number }>();
  private propPenetrationSamples = 0;
  private propPenetrationTick = -1;
  /** Capsule ground footprints against sim colliders, independent of rendering/LOD and nav blockers. */
  /** Sample the current campaign or isolated scene; call once after each fixed sim tick. */
  samplePropPenetration(reset = false) {
    if (reset) { this.propPenetration.clear(); this.propPenetrationSamples = 0; this.propPenetrationTick = -1; }
    this.recordPropPenetration();
    return { samples: this.propPenetrationSamples, framesMax: Math.max(0, ...[...this.propPenetration.values()].map(m => m.max)), pairs: [...this.propPenetration.values()] };
  }
  private recordPropPenetration(): void {
    if (this.propPenetrationTick === this.world.tick) return;
    this.propPenetrationTick = this.world.tick;
    const solids = this.world.districts!.districts.flatMap(d => {
      const assets = new Map(d.decay.placements.map(p => [p.id, p.assetId]));
      return d.decay.colliders.filter(c => {
        const asset = assets.get(c.id.split('/')[0]);
        return !c.walkable && (!asset || /^(prop|veh|haz|kit)\./.test(asset));
      }).map(c => ({
      id: `${d.id}/${c.id}`, x: (c.aabb.min[0] + c.aabb.max[0]) / 2 + d.origin[0], z: (c.aabb.min[2] + c.aabb.max[2]) / 2 + d.origin[1],
      halfX: (c.aabb.max[0] - c.aabb.min[0]) / 2, halfZ: (c.aabb.max[2] - c.aabb.min[2]) / 2,
      y: (c.aabb.min[1] + c.aabb.max[1]) / 2, halfY: (c.aabb.max[1] - c.aabb.min[1]) / 2,
    })); }).concat((this.world.props?.items ?? []).filter(p => p.body.isEnabled() && !p.awake).map(p => ({ id: p.id, ...propFootprint(p) })));
    const touching = new Set<string>();
    for (const e of this.world.entities.iterate()) {
      if (!e.infected && !e.civilian && !e.escort && !e.companion && e.id !== 1) continue;
      const id = [...this.actors.values()].find(a => a.entity === e.id)?.id ?? String(e.id);
      // Seated residents intentionally occupy their bench; hidden/dead figures have no walking capsule.
      if (e.hidden || e.corpse || e.health.current <= 0 || e.infectionRise || ['finished', 'down', 'rising', 'infected'].includes(e.civilian?.state ?? '') || e.civilian?.story?.clip === 'npc-sit' || (e.civilian?.schedule?.[(e.civilian.scheduleStep ?? 0)]?.activity === 'sit' && !!e.civilian.activityUntil) || e.infected?.perched || e.infected?.special === 'flock') continue;
      this.propPenetrationSamples++;
      const r = (e.combat?.radius ?? .35) - .002;
      for (const p of solids) {
        // A raised guard touches its authored deck with its soles. Exempt only
        // that supporting top: the tower posts and rails still count as solids.
        const floor = e.civilian?.floorY;
        if (floor !== undefined && Math.abs(p.y + (p.halfY ?? 0) - floor) <= .002 && Math.abs(e.transform.y - .7 - floor) <= .002) continue;
        const dx = Math.max(0, Math.abs(e.transform.x - p.x) - p.halfX), dz = Math.max(0, Math.abs(e.transform.z - p.z) - p.halfZ);
        if (dx * dx + dz * dz >= r * r) continue;
        const key = `${id}|${p.id}`; touching.add(key);
        let m = this.propPenetration.get(key);
        if (!m) { m = { actor: id, prop: p.id, run: 0, max: 0, frames: 0 }; this.propPenetration.set(key, m); }
        m.run++; m.frames++; m.max = Math.max(m.max, m.run);
      }
    }
    for (const [key, m] of this.propPenetration) if (!touching.has(key)) m.run = 0;
  }
  /** E32-AC10 Mega Alpha pursuit probe: speed in detailed mode, largest resident step (no teleport), modes, distance every 0.5 s. */
  private mega: { last: { x: number; z: number; mode: string } | null; speeds: number[]; stepMaxM: number; stepFrame: number; modes: Record<string, number>; samples: { frame: number; d: number; mode: string; band: string | null }[]; stuckLevelMax: number; distanceMinM: number } | null = null;
  /** L10-S6 mounted minigun probe (`metrics.minigun`). */
  private gunStats: { hudFrames: number; hudHeatErrorMax: number; rounds: number; heatPeak: number; lockedFrames: number; mountedFrames: number; firstRoundFrame: number; dismountTicks: number[]; /** Lowest courier feet height from the first mount on (a dismount that drops her off the deck shows here). */ feetMin: number } | null = null;
  private cureStats: {
    mistPuffs: number; smokeOverBudget: number; healthyDamage: number; lateDeaths: number; insideMisses: number; health: Record<string, number>;
    chargeTicks: number; insideFrames: number; boundaryFrames: number; outsideFrames: number; outsideAdvance: number;
    releaseCount: number; radius: number; titleFrames: number; creditsFrames: number; playableTravel: number;
    survivors: number; fanFrames: number; pullScale: number;
    last: { x: number; z: number; charge: number; angles: Record<string, number> } | null;
    samples: { frame: number; charge: number; distance: number; radius: number; phase: string | null; fanLevel: number }[];
  } | null = null;
  private sampleCure(): void {
    const stats = this.cureStats, mission = this.world.missions, player = this.world.entities.get(1);
    if (!stats || !mission || !player) return;
    const state = mission.state, console = mission.def.anchors['cure-console'];
    const distance = console ? Math.hypot(player.transform.x - console.x, player.transform.z - console.z) : Infinity;
    const charge = state.counters['charge-ticks'] ?? 0, phase = state.epilogue?.phase ?? null;
    if (state.states['charge-active'] && !state.states['cure-released']) {
      if (distance <= 25) {
        stats.insideFrames++;
        if (stats.last && stats.last.charge > 0 && stats.last.charge < 3600 && state.steps.hold.status === 'active' && charge !== stats.last.charge + 1) stats.insideMisses++;
      } else { stats.outsideFrames++; stats.outsideAdvance += Math.max(0, charge - (stats.last?.charge ?? charge)); }
      if (Math.abs(distance - 25) <= .15) stats.boundaryFrames++;
    }
    for (const actor of this.actors.values()) {
      const e = this.world.entities.get(actor.entity); if (!e) continue;
      if (actor.kind !== 'infected') {
        stats.health[actor.id] ??= e.health.current;
        stats.healthyDamage = Math.max(stats.healthyDamage, stats.health[actor.id] - e.health.current);
      } else if (state.cureFront && cureReached(state.cureFront, e.transform) && e.health.current > 0) stats.lateDeaths++;
    }
    if (phase === 'title' && !this.game.campaignUI.root.hidden && this.game.campaignUI.root.querySelector('[data-testid=epilogue-title]')?.textContent === 'Minor Incident') stats.titleFrames++;
    if (phase === 'credits' && !this.game.campaignUI.root.hidden && this.game.campaignUI.root.querySelector('.credits-roll')) stats.creditsFrames++;
    if (phase === 'playable' && stats.last) stats.playableTravel += Math.hypot(player.transform.x - stats.last.x, player.transform.z - stats.last.z);
    const puffs = this.game.view.effectPerf()?.blasts.puffs ?? 0;
    if (state.cureFront) stats.mistPuffs = Math.max(stats.mistPuffs, puffs);
    if (puffs > (this.game.quality.tier === 'low' ? 120 : 400)) stats.smokeOverBudget++;
    const fan = this.game.view.labProbes().districts?.dispersalProbe();
    if (fan?.active && stats.last && Object.entries(fan.angles).some(([key, angle]) => key.includes('fan') && angle !== stats.last!.angles[key])) stats.fanFrames++;
    stats.chargeTicks = charge; stats.radius = state.cureFront?.radius ?? 0; stats.survivors = state.epilogue?.survivors.length ?? 0;
    stats.pullScale = this.game.view.view.epilogueScale;
    if (this.frame % 60 === 0) stats.samples.push({ frame: this.frame, charge, distance, radius: stats.radius, phase, fanLevel: fan?.level ?? 0 });
    stats.last = { x: player.transform.x, z: player.transform.z, charge, angles: fan?.angles ?? {} };
  }
  private sampleGun(): void {
    const g = this.world.mountedGun, s = this.gunStats; if (!g || !s) return;
    if (g.mounted && this.spec?.hud) {
      const root = this.game.ui.hud.root, bar = root.querySelector<HTMLElement>('[data-testid=heat-bar]');
      if (root.isConnected && bar && bar.getBoundingClientRect().width > 0 && getComputedStyle(bar).visibility === 'visible' && !bar.closest('[hidden]')) {
        s.hudFrames++; s.hudHeatErrorMax = Math.max(s.hudHeatErrorMax, Math.abs(Number(bar.getAttribute('aria-valuenow')) - g.heat * 100));
      }
    }
    s.heatPeak = Math.max(s.heatPeak, g.heat); if (g.locked) s.lockedFrames++; if (g.mounted) s.mountedFrames++;
    if (s.mountedFrames > 0) s.feetMin = Math.min(s.feetMin, (this.world.entities.get(1)?.transform.y ?? .7) - .7);
  }
  private gunReport() {
    const g = this.world.mountedGun, s = this.gunStats; if (!g || !s) return null;
    return { ...s, feetMin: Number.isFinite(s.feetMin) ? +s.feetMin.toFixed(3) : null, heatPeak: +s.heatPeak.toFixed(3), heat: +g.heat.toFixed(3), locked: g.locked, mounted: g.mounted, spin: +g.gun.spin.toFixed(2), selected: this.world.combat ? this.world.combat.runner.loadout.current(this.world.combat.runner.loadout.state.selectedSide).id : null };
  }
  private sampleMega(): void {
    const m = this.mega, pursuit = this.world.megaPursuit, e = pursuit?.entity();
    if (!m || !pursuit || !e) return;
    const s = pursuit.state, mode = s.mode, step = m.last ? Math.hypot(e.transform.x - m.last.x, e.transform.z - m.last.z) : 0;
    m.modes[mode] = (m.modes[mode] ?? 0) + 1; m.stuckLevelMax = Math.max(m.stuckLevelMax, s.stuck.level);
    if (m.last && mode !== 'coarse' && m.last.mode !== 'coarse' && step > m.stepMaxM) { m.stepMaxM = step; m.stepFrame = this.frame; }
    if (m.last && mode === 'detailed' && m.last.mode === 'detailed' && !Status.stunned(e, this.world.tick) && step > .5 / 60) m.speeds.push(step * 60);
    const d = pursuit.distance(); m.distanceMinM = Math.min(m.distanceMinM, d);
    if (this.frame % 30 === 0) m.samples.push({ frame: this.frame, d: +d.toFixed(2), mode, band: pursuit.band() });
    m.last = { x: e.transform.x, z: e.transform.z, mode };
  }
  private megaReport() {
    const m = this.mega; if (!m) return null;
    const sorted = [...m.speeds].sort((a, b) => a - b), median = sorted.length ? sorted[sorted.length >> 1] : 0;
    return { cruiseMs: +megaAlpha.cruiseMs.toFixed(3), detailedMedianMs: +median.toFixed(3), cruiseError: sorted.length ? +Math.abs(median / megaAlpha.cruiseMs - 1).toFixed(4) : Infinity, detailedFrames: sorted.length,
      stepMaxM: +m.stepMaxM.toFixed(3), stepFrame: m.stepFrame, modes: m.modes, stuckLevelMax: m.stuckLevelMax, distanceMinM: +m.distanceMinM.toFixed(2), samples: m.samples, state: structuredClone(this.world.megaPursuit?.state ?? null) };
  }
  private sample(): void {
    const convoy = this.world.missions?.state.l4?.convoyIds;
    if (convoy && [...this.world.entities.iterate()].some(e => !e.hidden && !e.corpse && e.health.current > 0 && (e.civilian || e.infected || e.companion || e.escort || e.id === 1) && convoy.some((id, i) => {
      const v = this.world.entities.get(id); return !!v && convoyOverlaps(v.transform, i, e.transform, convoyFootprint(e));
    }))) this.convoyOverlapFrames++;
    this.sampleMega(); this.sampleGun(); this.sampleCure();
    this.recordPropPenetration();
    const probes = this.game.view.labProbes(), figures = new Map(this.game.view.crowdFigures().map(f => [f.id, f]));
    const audit = probes.districts?.seeThroughAudit();
    if (audit) {
      if (audit.strength > .5) { this.seeThroughOpen.frames++; if (audit.occluder && !this.seeThroughOpen.occluders.includes(audit.occluder)) this.seeThroughOpen.occluders.push(audit.occluder); this.seeThroughOpen.solidRadiusMax = Math.max(this.seeThroughOpen.solidRadiusMax, +audit.solidRadius.toFixed(3)); }
      this.seeThroughOpen.cutLowProps = [...new Set([...this.seeThroughOpen.cutLowProps, ...audit.cutLowProps])];
      this.seeThroughOpen.cutPlacements = [...new Set([...this.seeThroughOpen.cutPlacements, ...audit.cutPlacements])];
    }
    const sim: Record<string, number> = {}, drawn: Record<string, number> = {};
    const clip = this.frame % 3 === 0 && this.staticSets;
    const torsos: { id: string; bones: Bone[] }[] = [];
    let courierBody: Bone[] | undefined;
    let courierTorso: Bone[] | undefined;
    const attackerArms: { id: string; bones: Bone[] }[] = [];
    const dogBodies: Bone[][] = [];
    if (this.frame % 3 === 0) for (const contact of probes.heldProps) {
      const actor = [...this.actors.values()].find(a => a.entity === contact.entity);
      if (!actor) continue;
      this.heldPropSamples++;
      const geometry = contact.geometry, positions = geometry.getAttribute('position'), indices = geometry.index;
      const tris = new Float32Array((indices?.count ?? positions.count) * 3);
      for (let i = 0; i < tris.length / 3; i++) this.point.fromBufferAttribute(positions, indices ? indices.getX(i) : i).applyMatrix4(contact.matrix).toArray(tris, i * 3);
      const hand: TriangleSet = { id: `${actor.id}/handR`, assetId: 'handR', tris: contact.hand, box: boxOf(contact.hand) };
      const prop: TriangleSet = { id: `${actor.id}/${contact.prop}`, assetId: contact.prop, tris, box: boxOf(tris) };
      for (const hit of staticClipping([hand, prop])) this.heldPropClips.set(actor.id, { ...hit, actor: actor.id, frame: this.frame });
      const j = figures.get(contact.entity)?.joints, drawnFigure = figures.get(contact.entity);
      if ((contact.prop === 'coffee' || contact.prop === 'phone') && drawnFigure?.drawn && j?.hip && j.armL && j.armR && j.foreArmR && j.handR) {
        const shoulderY = (j.armL[1] + j.armR[1]) / 2, centreY = (prop.box.min[1] + prop.box.max[1]) / 2;
        const height = (centreY - j.hip[1]) / Math.max(.05, shoulderY - j.hip[1]);
        const d = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        const straight = d(j.armR, j.handR) / Math.max(1e-3, d(j.armR, j.foreArmR) + d(j.foreArmR, j.handR));
        let h = this.holds.get(actor.id);
        if (!h) this.holds.set(actor.id, h = { prop: contact.prop, samples: 0, heightMin: Infinity, heightFrame: -1, straightMax: 0, straightFrame: -1, lods: {} });
        h.samples++; const lod = drawnFigure.lod ?? 'lod1'; h.lods[lod] = (h.lods[lod] ?? 0) + 1;
        if (height < h.heightMin) { h.heightMin = +height.toFixed(3); h.heightFrame = this.frame; }
        if (straight > h.straightMax) { h.straightMax = +straight.toFixed(3); h.straightFrame = this.frame; }
      }
    }
    for (const actor of this.actors.values()) {
      const e = this.world.entities.get(actor.entity);
      if (e) {
        actor.distanceM = (actor.distanceM ?? 0) + (actor.lastAt ? Math.hypot(e.transform.x - actor.lastAt.x, e.transform.z - actor.lastAt.z) : 0);
        actor.lastAt = { x: e.transform.x, z: e.transform.z }; actor.maxX = Math.max(actor.maxX ?? -Infinity, e.transform.x);
      }
      if (e && actor.kind === 'infected') this.samplePursuit(actor, e);
      sim[actor.kind] = (sim[actor.kind] ?? 0) + (e && !e.hidden && e.health.current > 0 ? 1 : 0);
      let feet: FootSample[] = [], joints: Record<string, number[]> | null = null, forward: number[] = [1, 0, 0], lod = 'lod0', visible = false, clipName: string | undefined, label: string | undefined;
      if (actor.kind === 'courier') {
        const c = probes.character; visible = !!c?.visible;
        const node = (name: Parameters<NonNullable<typeof c>['node']>[0]) => c?.node(name);
        const footL = node('footL'), footR = node('footR');
        if (c && footL && footR) {
          c.updateMatrixWorld(true);
          actor.sole ??= (footL.getWorldPosition(this.point).y - c.position.y) / footL.getWorldScale(new Vector3()).y;
          feet = [footL, footR].map(f => { const heel = f.localToWorld(new Vector3(-.05, -actor.sole!, 0)).toArray(), toe = f.localToWorld(new Vector3(.085, -actor.sole!, 0)).toArray(); return { heel, toe, yaw: footYaw(heel, toe) }; });
          joints = Object.fromEntries((['hip', 'head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'handL', 'handR', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR'] as const).map(n => [n, node(n)!.getWorldPosition(this.point).toArray()]));
          forward = [Math.cos(c.getState().yaw), 0, -Math.sin(c.getState().yaw)]; clipName = c.getState().clip;
          if (visible && !(clipName && unplantedClips.test(clipName))) courierBody = this.bones(joints, joints.armL.map((v, i) => (v + joints!.armR[i]) / 2));
          if (courierBody) courierTorso = courierBody.filter(b => b.name === 'spine' || b.name === 'neck').map(b => ({ ...b,
            a: b.a.map((v, i) => v - forward[i] * .08) as Vec3, b: b.b.map((v, i) => v - forward[i] * .08) as Vec3, radius: b.name === 'spine' ? .18 : b.radius }));
        }
      } else if (actor.kind === 'corgi' || actor.kind === 'animal' && !!e?.civilian?.pet) {
        const root = probes.npcs?.heroRoot(actor.entity); visible = !!root?.visible; label = probes.npcs?.heroClip(actor.entity);
        if (root) {
          root.updateMatrixWorld(true); feet = ['legFL', 'legFR', 'legBL', 'legBR'].flatMap(n => { const leg = root.getObjectByName(n); if (!leg) return []; const paw = this.paw(leg); return [{ heel: paw, toe: paw, yaw: 0 }]; });
          // The loaded corgi's trunk and head capsules, including the muzzle; compare with the courier's legs too.
          const body = root.getObjectByName('body'), head = root.getObjectByName('head');
          if (visible && body && head) {
            const at = (node: Object3D, x: number, y = 0) => node.localToWorld(new Vector3(x, y, 0)).toArray() as Vec3;
            dogBodies.push([{ name: 'body', a: at(body, -.3), b: at(body, .25), radius: .25 }, { name: 'head', a: at(head, .1, .06), b: at(head, .3, -.01), radius: .24 }]);
          }
          const player = this.world.entities.get(1), v = player?.survivor?.velocity, speed = Math.hypot(v?.x ?? 0, v?.z ?? 0);
          if (actor.kind === 'corgi' && e && player && speed > 2.5) {
            const lag = Math.max(0, ((player.transform.x - e.transform.x) * v!.x + (player.transform.z - e.transform.z) * v!.z) / speed);
            this.companion.runningSamples++;
            if (lag > this.companion.runLagMaxM) { this.companion.runLagMaxM = lag; this.companion.runLagFrame = this.frame; }
          }
        }
      } else {
        const f = figures.get(actor.entity);
        if (f) {
          visible = f.drawn; lod = f.lod ?? 'lod1'; clipName = f.clip; joints = f.joints ?? null; forward = f.forward ?? forward;
          if (f.soles && f.soles.length >= 4) feet = Array.from({ length: f.soles.length / 2 }, (_, i) => [f.soles![i * 2], f.soles![i * 2 + 1]]).map(([heel, toe]) => ({ heel, toe, yaw: footYaw(heel, toe) }));
        }
      }
      if (e && !e.hidden && e.health.current > 0 && !e.corpse && !(e.civilian?.state === 'infected')) {
        const q = this.game.view.project(e.transform.x, e.transform.y + .9, e.transform.z);
        if (Math.abs(q[0]) < .95 && Math.abs(q[1]) < .95 && q[2] < 1) { actor.inView++; if (!visible) actor.missed++; }
      }
      if (visible) { actor.drawn++; drawn[actor.kind] = (drawn[actor.kind] ?? 0) + 1; actor.lod[lod] = (actor.lod[lod] ?? 0) + 1; }
      const em = this.emergence, out = em && e ? (e.transform.x - em.x) * em.nx + (e.transform.z - em.z) * em.nz : 0;
      if (visible && e && !actor.first) actor.first = { frame: this.frame, at: [+e.transform.x.toFixed(3), +e.transform.z.toFixed(3)], ...(actor.emerge ? { outM: +out.toFixed(3) } : {}) };
      if (visible && e && lod === 'lod2' && this.game.view.camera.position.distanceTo(this.point.set(e.transform.x, e.transform.y, e.transform.z)) < closeLodM) actor.farClose++;
      const shoulders = joints?.armL && joints.armR ? joints.armL.map((v, k) => (v + joints!.armR[k]) / 2) : undefined;
      const motion = e?.motion?.speed ?? Math.hypot(e?.survivor?.velocity?.x ?? 0, e?.survivor?.velocity?.z ?? 0);
      actor.track.push({ frame: this.frame, ...(this.spec?.trace && visible && figures.get(actor.entity)?.appearance ? { appearance: figures.get(actor.entity)!.appearance, corpse: !!e?.corpse } : {}), floor: e ? this.world.districts?.pavingHeight(e.transform.x, e.transform.z) ?? 0 : undefined, clip: clipName ?? (e?.civilian?.state === 'calm' && e.civilian.schedule?.[e.civilian.scheduleStep ?? 0]?.activity === 'sit' && e.civilian.activityUntil ? 'sit' : undefined), feet, speed: motion, ...(label ? { label } : {}), ...(this.spec?.trace && e ? { at: [+e.transform.x.toFixed(3), +e.transform.z.toFixed(3)] } : {}), torsoPitchDeg: joints?.hip && shoulders ? torsoPitch(joints.hip, shoulders, forward) : undefined });
      if (this.frame % 3 === 0 && joints?.hip && joints.head && shoulders && visible && e && e.health.current > 0 && !(clipName && unplantedClips.test(clipName))) {
        if (e.infected && e.attachedTo === undefined) attackerArms.push({ id: actor.id, bones: this.bones(joints, shoulders).filter(b => b.name.startsWith('foreArm')) });
        // Torso, neck and the (chibi) head above its pivot: body-vs-body contact between actors (crowding, melee rings).
        const head = joints.head, top: Vec3 = [head[0], head[1] + .2, head[2]];
        torsos.push({ id: actor.id, bones: [{ name: 'spine', a: joints.hip as Vec3, b: shoulders as Vec3, radius: .1 }, { name: 'neck', a: shoulders as Vec3, b: head as Vec3, radius: .06 }, { name: 'head', a: head as Vec3, b: top, radius: .11 }] });
      }
      // Visible gun vs its owner's torso/head and drawn ground, in every state.
      // Hands and forearms deliberately grip the weapon.
      if (this.frame % 3 === 0 && visible && joints?.hip && joints.head && shoulders) {
        const body: Bone[] = [{ name:'torso',a:joints.hip as Vec3,b:shoulders as Vec3,radius:.13 },
          { name:'neck',a:shoulders as Vec3,b:joints.head as Vec3,radius:.06 },
          { name:'head',a:joints.head as Vec3,b:[joints.head[0],joints.head[1]+.2,joints.head[2]],radius:.16 }];
        for (const gun of probes.gunMeshes.filter(g=>g.entity===actor.entity)) {
          const p=gun.geometry.getAttribute('position'),index=gun.geometry.index,tris=new Float32Array((index?.count??p.count)*3);
          for(let i=0;i<tris.length/3;i++)this.point.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(gun.matrix).toArray(tris,i*3);
          const hits = boneClipping(body,[{id:actor.id+'/gun',assetId:'gun',tris,box:boxOf(tris)}],0);
          let bottom = 0; for (let i = 3; i < tris.length; i += 3) if (tris[i + 1] < tris[bottom + 1]) bottom = i;
          const floor = this.renderedGround(tris[bottom], tris[bottom + 2], tris[bottom + 1] + 1);
          if (floor !== null && tris[bottom + 1] < floor) hits.push({ bone: 'ground', prop: actor.id + '/gun', asset: 'gun', crossing: true, clearanceCm: +(100 * (tris[bottom + 1] - floor)).toFixed(1) });
          for(const hit of hits) {
            const key=actor.id+'|'+hit.bone,old=this.gunBodyHits.get(key);
            if(old)old.count++;else this.gunBodyHits.set(key,{...hit,actor:actor.id,frame:this.frame,count:1});
          }
        }
      }
      if (clip && joints && visible) for (const h of boneClipping(this.bones(joints, shoulders), this.near(joints.hip ?? Object.values(joints)[0]), (this.spec?.clipping?.slackCm ?? 2) / 100)) {
        const key = `${actor.id}|${h.prop}|${h.bone}`, old = this.hits.get(key);
        if (!old) this.hits.set(key, { ...h, actor: actor.id, frame: this.frame, count: 1 });
        else { old.count++; if (h.crossing && !old.crossing || h.clearanceCm < old.clearanceCm) Object.assign(old, h, { frame: this.frame }); }
      }
    }
    if (courierBody) for (const body of dogBodies) {
      this.companion.samples++;
      const depth = bodyOverlap(courierBody, body) * 100;
      if (depth > this.companion.overlapMaxCm) { this.companion.overlapMaxCm = depth; this.companion.overlapFrame = this.frame; }
    }
    if (courierTorso) for (const arm of attackerArms) {
      const depthCm = bodyOverlap(courierTorso, arm.bones) * 100;
      if (depthCm > this.attackOverlap.depthCm) this.attackOverlap = { depthCm, frame: this.frame, actor: arm.id };
    }
    for (const [id, entity] of this.vehicles) {
      const e = this.world.entities.get(entity), motion = this.vehicleMotion.get(id); if (!e || !motion) continue;
      const delta = Math.atan2(Math.sin(e.transform.yaw - motion.yaw), Math.cos(e.transform.yaw - motion.yaw));
      motion.yawRateMaxDegS = Math.max(motion.yawRateMaxDegS, Math.abs(delta) * 60 * 180 / Math.PI); motion.yaw = e.transform.yaw;
      const body = this.world.vehicles!.cars.get(entity)?.physics;
      if (body) {
        // Chassis tilt (roll/pitch from the body's up axis) and heading vs travel direction (sideways slide) per frame.
        const q = body.rotation, tilt = Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (q.x * q.x + q.z * q.z)))) * 180 / Math.PI;
        if (tilt > (motion.tiltMaxDeg ?? 0)) { motion.tiltMaxDeg = +tilt.toFixed(1); motion.tiltFrame = this.frame; }
        if (motion.x !== undefined && motion.z !== undefined) {
          const vx = e.transform.x - motion.x, vz = e.transform.z - motion.z;
          if (Math.hypot(vx, vz) * 60 > 3) {
            const fx = Math.cos(e.transform.yaw), fz = -Math.sin(e.transform.yaw), along = Math.abs(vx * fx + vz * fz), side = Math.abs(vx * fz - vz * fx);
            const slip = Math.atan2(side, along) * 180 / Math.PI;
            if (slip > (motion.slipMaxDeg ?? 0)) { motion.slipMaxDeg = +slip.toFixed(1); motion.slipFrame = this.frame; }
          }
        }
        motion.x = e.transform.x; motion.z = e.transform.z;
        // A driven, intact vehicle shines its lamps (L9 dry night: the hull and road must read at the game camera).
        const lamps = this.game.view.labProbes().vehicles;
        if (lamps && this.world.vehicles!.active === entity && e.health.current > 0 && (e.vehicle?.stage ?? 0) < 3 && !lamps.lit(entity)) { motion.darkFrames = (motion.darkFrames ?? 0) + 1; motion.firstDarkFrame ??= this.frame; }
      }
      const def = this.world.vehicles!.cars.get(entity)?.physics.def; if (!def) continue;
      for (const b of this.world.entities.iterate()) if (b.id !== entity && !b.hidden && (b.civilian || b.infected || b.companion || b.vehicle || b.traffic || b.kind === 'physics-prop')) {
        if (truckBodyOverlap(e.transform, def.length, def.width, b, this.world)) motion.overlaps++;
      }
      for (const wall of this.world.infected!.nav.walls) if (truckWallOverlap(e.transform, def.length, def.width, wall)) motion.overlaps++;
    }
    if (this.spec?.trace) for (const [id, entity] of this.vehicles) {
      const v = this.world.entities.get(entity); if (!v) continue;
      const list = this.vehicleTrack.get(id) ?? []; this.vehicleTrack.set(id, list);
      list.push([this.frame, +v.transform.x.toFixed(3), +v.transform.y.toFixed(3), +v.transform.z.toFixed(3), +(v.transform.yaw * 180 / Math.PI).toFixed(1), +(this.world.districts?.pavingHeight(v.transform.x, v.transform.z) ?? 0).toFixed(3)]);
    }
    if (this.frame > 2) { this.sampleWheels(); this.sampleBike(); }
    for (let i = 0; i < torsos.length; i++) for (let j = i + 1; j < torsos.length; j++) {
      const depth = bodyOverlap(torsos[i].bones, torsos[j].bones); if (depth <= .02) continue;   // 2 cm slack: soft contact
      const key = `${torsos[i].id}|${torsos[j].id}`, old = this.bodies.get(key), depthCm = Math.round(depth * 1000) / 10;
      if (!old) this.bodies.set(key, { a: torsos[i].id, b: torsos[j].id, depthCm, frame: this.frame, count: 1 });
      else { old.count++; if (depthCm > old.depthCm) Object.assign(old, { depthCm, frame: this.frame }); }
    }
    if (this.doors.size) {
      const state = this.game.view.labProbes().districts?.doorState() ?? [];
      for (const [pid, d] of this.doors) {
        const p = this.built!.placements.find(q => q.id === pid)!, open = state.find(s => s.assetId === p.assetId && Math.hypot(s.position[0] - p.position[0], s.position[2] - p.position[2]) < .01)?.open ?? 0;
        d.maxOpen = Math.max(d.maxOpen, open);
        const inside = [...this.actors.values()].some(a => { const e = this.world.entities.get(a.entity); return !!e && !e.hidden && e.health.current > 0 && inDoorway(d.way, e.transform); });
        if (inside) { d.inDoorwayFrames++; if (open < .95) { d.closedFrames++; d.firstClosedFrame ??= this.frame; } }
      }
    }
    // Sim-vs-drawn for everything in the world, not only lab actors (pooled or reanimated infected included).
    const all: Record<string, number> = {};
    for (const e of this.world.entities.iterate()) if (!e.hidden && e.health.current > 0 && (e.infected || e.civilian || e.companion || e.vehicle || e.traffic)) { const k = e.infected ? 'infected' : e.civilian ? 'pedestrian' : e.companion ? 'corgi' : 'vehicle'; all[k] = (all[k] ?? 0) + 1; }
    const drawnAll: Record<string, number> = { vehicle: this.game.view.getState().vehicles.length };
    for (const f of figures.values()) if (f.drawn) { const e = this.world.entities.get(f.id); const k = e?.infected ? 'infected' : 'pedestrian'; drawnAll[k] = (drawnAll[k] ?? 0) + 1; }
    this.visible = { frame: this.frame, sim: { ...all, ...sim, actors: this.actors.size }, drawn: { ...drawnAll, ...drawn } };
  }
  /** Height of the ground the district actually draws under (x, z): a ray against its static meshes (baked layout GLB roads,
   * paving, lawns, the Scene Lab slab and the backdrop). Instanced props, foliage and grass blades are not ground. */
  renderedGround(x: number, z: number, from = 1): number | null {
    if (!this.groundMeshes) {
      const list: Mesh[] = [];
      this.game.view.labProbes().districts?.traverse(o => { if ((o as Mesh).isMesh && !(o as InstancedMesh).isInstancedMesh && o.userData.assetId === undefined) list.push(o as Mesh); });
      this.groundMeshes = list;
    }
    const shown = (o: Object3D | null): boolean => !o || o.visible && shown(o.parent);
    this.ray.set(this.point.set(x, from, z), new Vector3(0, -1, 0)); this.ray.far = from + 1;
    const hit = this.ray.intersectObjects(this.groundMeshes, false).find(h => shown(h.object));
    return hit ? hit.point.y : null;
  }
  /** Clearance of every drawn tyre (bike and cars) over the rendered ground: the smallest height of its vertices above
   * the district's drawn height field (DistrictView.groundAt, the highest baked face over each point). Negative: the tyre
   * cuts into the road; positive: the whole wheel floats. A wheel climbing a kerb touches the kerb edge, not the road below
   * its lowest point, so it is taken per vertex. `rayCheckCm` is the worst disagreement between that field and a ray
   * against the drawn meshes at the lowest tyre point (the field must be what is rendered). */
  private sampleWheels(): void {
    const probes = this.game.view.labProbes(), sets: [string, Object3D[]][] = [], field = probes.districts;
    if (!field) return;
    const bike = [...this.vehicles].find(([, e]) => this.world.entities.get(e)?.bicycle);
    if (bike && probes.bicycle) sets.push([bike[0], probes.bicycle.wheelNodes()]);
    const cars = probes.vehicles?.wheelNodes();
    for (const [id, entity] of this.vehicles) { const nodes = cars?.get(entity); if (nodes) sets.push([id, nodes]); }
    const v = new Vector3(), lowest = new Vector3(), contact = new Vector3();
    for (const [id, nodes] of sets) nodes.forEach((node, index) => {
      node.updateWorldMatrix(true, true);
      let gap = Infinity, ground = 0, low = Infinity;
      const meshes: Mesh[] = []; node.traverse(n => { if ((n as Mesh).isMesh && n.visible) meshes.push(n as Mesh); });
      for (const mesh of meshes) { const position = mesh.geometry.getAttribute('position') as BufferAttribute; for (let i = 0; i < position.count; i++) { v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld); if (v.y < low) { low = v.y; lowest.copy(v); } } }
      // The drawn tyre is its faces, not only its vertices (about 6 cm apart on the tread): sample the lower faces at
      // their corners, edge midpoints and centre, so a kerb corner between two vertices is still found.
      const a = new Vector3(), b = new Vector3(), c = new Vector3();
      for (const mesh of meshes) {
        const position = mesh.geometry.getAttribute('position') as BufferAttribute, index = mesh.geometry.index, count = index ? index.count : position.count;
        for (let i = 0; i + 2 < count; i += 3) {
          a.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
          b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld);
          c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld);
          if (Math.min(a.y, b.y, c.y) > low + .1) continue;
          for (const [u, w] of [[1, 0], [0, 1], [0, 0], [.5, .5], [.5, 0], [0, .5], [1 / 3, 1 / 3]]) {
            v.set(0, 0, 0).addScaledVector(a, u).addScaledVector(b, w).addScaledVector(c, 1 - u - w);
            const g = field.groundAt(v.x, v.z); if (g !== null && v.y - g < gap) { gap = v.y - g; ground = g; contact.copy(v); }
          }
        }
      }
      const hub = node.getWorldPosition(v).y, track = this.hubs.get(`${id}|${index}`) ?? { last: [], spikeCm: 0, spikeFrame: 0, stepCm: 0, stepFrame: 0 };
      this.hubs.set(`${id}|${index}`, track); track.last.push(hub); if (track.last.length > 3) track.last.shift();
      if (track.last.length === 3) {
        const [a, b, c] = track.last, d1 = b - a, d2 = c - b, spike = Math.sign(d1) !== Math.sign(d2) ? Math.min(Math.abs(d1), Math.abs(d2)) * 100 : 0;
        if (spike > track.spikeCm) Object.assign(track, { spikeCm: Math.round(spike * 10) / 10, spikeFrame: this.frame - 1 });
        if (Math.abs(d2) * 100 > track.stepCm) Object.assign(track, { stepCm: Math.round(Math.abs(d2) * 1000) / 10, stepFrame: this.frame });
      }
      if (!Number.isFinite(gap)) return;
      const ray = this.renderedGround(lowest.x, lowest.z, lowest.y + .5), drawn = field.groundAt(lowest.x, lowest.z);
      const rayCheck = ray !== null && drawn !== null ? Math.round(Math.abs(ray - drawn) * 1000) / 10 : 0;
      gap = Math.round(gap * 1000) / 10;
      const key = `${id}|${index}`, old = this.wheels.get(key), surface = this.surfaceAt(contact.x, contact.z);
      if (this.spec?.trace) { const list = this.wheelTrack.get(key) ?? []; this.wheelTrack.set(key, list); list.push([this.frame, +contact.x.toFixed(3), +contact.z.toFixed(3), +contact.y.toFixed(4), +ground.toFixed(4), gap, surface ?? '']); }
      const at = [+contact.x.toFixed(2), +contact.z.toFixed(2)];
      if (!old) { this.wheels.set(key, { vehicle: id, wheel: index, gapMinCm: gap, gapMaxCm: gap, minFrame: this.frame, maxFrame: this.frame, at, samples: 1, surface, rayCheckCm: rayCheck }); return; }
      old.samples++; old.rayCheckCm = Math.max(old.rayCheckCm, rayCheck);
      if (gap < old.gapMinCm) Object.assign(old, { gapMinCm: gap, minFrame: this.frame, at, surface });
      if (gap > old.gapMaxCm) Object.assign(old, { gapMaxCm: gap, maxFrame: this.frame });
    });
  }
  /** Is the courier bike drawn where the sim has it (PO 10-08: it vanished after an infected knocked her off)? */
  private sampleBike(): void {
    const bike = [...this.vehicles].map(([, e]) => this.world.entities.get(e)).find(e => e?.bicycle), root = this.game.view.labProbes().bicycle?.drawnRoot();
    if (!bike) return;
    const q = this.game.view.project(bike.transform.x, bike.transform.y + .4, bike.transform.z);
    if (!(Math.abs(q[0]) < .95 && Math.abs(q[1]) < .95 && q[2] < 1)) return;
    this.bike.inViewFrames++;
    let shown = !!root, o: Object3D | null = root ?? null;
    while (o) { if (!o.visible) shown = false; if (!o.parent && o.type !== 'Scene') shown = false; o = o.parent; }
    const off = root ? Math.hypot(root.position.x - bike.transform.x, root.position.z - bike.transform.z) : Infinity;
    if (Number.isFinite(off)) this.bike.maxOffsetCm = Math.max(this.bike.maxOffsetCm, Math.round(off * 1000) / 10);
    if (!shown || off > .6) { if (!shown) this.bike.missedFrames++; else this.bike.offFrames++; if (this.bike.firstMissedFrame < 0) this.bike.firstMissedFrame = this.frame; }
  }
  private surfaceAt(x: number, z: number): string | null {
    let found: string | null = null;
    for (const d of this.world.districts?.districts ?? []) for (const s of d.layout.surfaces) if (inside([x - d.origin[0], z - d.origin[1]], s.polygon)) found = s.surface + (s.height !== undefined ? `@${s.height}` : '');
    return found;
  }
  private readonly paws = new WeakMap<Object3D, Vector3>();
  /** Lowest point of a leg's meshes in leg space (PawContacts rule), returned in world metres. */
  private paw(leg: Object3D): number[] {
    let local = this.paws.get(leg);
    if (!local) { const bounds = new Box3(); leg.traverse(n => { if (n instanceof Mesh) bounds.expandByObject(n); }); const p = bounds.getCenter(new Vector3()); p.y = bounds.min.y; local = leg.worldToLocal(p); this.paws.set(leg, local); }
    return leg.localToWorld(local.clone()).toArray();
  }
  private bones(j: Record<string, number[]>, shoulders?: number[]): Bone[] {
    const list: [string, string | number[] | undefined, string | number[] | undefined, number][] = [
      ['thighL', 'legL', 'shinL', .065], ['shinL', 'shinL', 'footL', .045], ['thighR', 'legR', 'shinR', .065], ['shinR', 'shinR', 'footR', .045],
      ['spine', 'hip', shoulders, .1], ['neck', shoulders, 'head', .06], ['upperArmL', 'armL', 'foreArmL', .04], ['foreArmL', 'foreArmL', 'handL', .035], ['upperArmR', 'armR', 'foreArmR', .04], ['foreArmR', 'foreArmR', 'handR', .035]];
    const at = (v: string | number[] | undefined) => typeof v === 'string' ? j[v] : v;
    return list.flatMap(([name, a, b, radius]) => { const pa = at(a), pb = at(b); return pa && pb ? [{ name, a: pa as Vec3, b: pb as Vec3, radius }] : []; });
  }
  private near(p: number[]): TriangleSet[] { return (this.staticSets ?? []).filter(s => p[0] >= s.box.min[0] - 2 && p[0] <= s.box.max[0] + 2 && p[2] >= s.box.min[2] - 2 && p[2] <= s.box.max[2] + 2); }

  /** World triangles of every placement, from the shipped LOD0 GLB under the placement transform. */
  async prepareClipping(): Promise<void> {
    if (this.staticSets || !this.built) return;
    const sets: TriangleSet[] = [], matrix = new Matrix4(), v = new Vector3();
    for (const p of this.built.placements) {
      const root = await this.registry.loadAsset(p.assetId, 'lod0');
      openFireStationBays(p.assetId, root);
      const holder = new Object3D(); holder.position.fromArray(p.position); holder.rotation.y = p.yaw; holder.scale.fromArray(p.scale); holder.add(root); holder.updateMatrixWorld(true);
      const tris: number[] = [], shutterTris: number[] = [], leaves = buildingDoors[p.assetId]?.leaves.map(l => l.node) ?? [];
      root.traverse(node => {
        if (!(node instanceof Mesh) || !node.visible || node.name.startsWith('stump_')) return;
        // Animated door leaves swing at runtime: the door gate (metrics.doors) checks them, not the rest pose.
        for (let q: Object3D | null = node; q; q = q.parent) if (leaves.includes(q.name)) return;
        let shutter = false;
        for (let q: Object3D | null = node; q; q = q.parent) if (p.assetId === 'bld.metro-entrance' && q.name === 'shutter') shutter = true;
        const position = node.geometry.getAttribute('position') as BufferAttribute | InterleavedBufferAttribute, index = node.geometry.index;
        matrix.copy(node.matrixWorld);
        const count = index ? index.count : position.count;
        for (let i = 0; i < count; i++) { v.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(matrix); (shutter ? shutterTris : tris).push(v.x, v.y + (shutter ? .7 - 1.9 * this.metroClosed : 0), v.z); }
      });
      if (shutterTris.length) { const leaf = new Float32Array(shutterTris); sets.push({ id: `${p.id}/shutter`, assetId: p.assetId, tris: leaf, box: boxOf(leaf) }); }
      const array = new Float32Array(tris);
      if (array.length) sets.push({ id: p.id, assetId: p.assetId, tris: array, box: boxOf(array) });
    }
    this.staticSets = sets;
  }
  /** Mesh-level static clipping (placement vs placement) plus the bone hits gathered so far. */
  async clipping() {
    await this.prepareClipping();
    const ignore = this.spec?.clipping?.ignore ?? [];
    const foliage = (t: TriangleSet) => this.spec?.clipping?.ignoreFoliage === true && /^prop\.(street-tree|garden-bush|hedge)/.test(t.assetId);
    const skip = (a: TriangleSet, b: TriangleSet) => !this.spec?.clipping?.sameAsset && a.assetId === b.assetId || foliage(a) || foliage(b) || ignore.some(([x, y]) => [a.id, a.assetId].includes(x) && [b.id, b.assetId].includes(y) || [a.id, a.assetId].includes(y) && [b.id, b.assetId].includes(x));
    this.staticClips ??= staticClipping(this.staticSets!, skip);
    const actors = [...this.hits.values()].sort((a, b) => Number(b.crossing) - Number(a.crossing) || a.clearanceCm - b.clearanceCm);
    return { static: this.staticClips, actors, gunBodies: [...this.gunBodyHits.values()], heldProps: [...this.heldPropClips.values()], summary: { gunBodyHits: this.gunBodyHits.size, staticPairs: this.staticClips.length, heldPropHits: this.heldPropClips.size, actorHits: actors.length, piercing: actors.filter(h => h.crossing).length } };
  }
  /** Placement LOD bands this frame (from DistrictView), matched back to placement ids. */
  lods() {
    const state = this.game.view.labProbes().districts?.lodState() ?? [];
    const out: Record<string, string> = {};
    for (const p of this.built?.placements ?? []) {
      const s = state.find(s => s.assetId === p.assetId && Math.hypot(s.position[0] + s.origin[0] - p.position[0], s.position[2] + s.origin[1] - p.position[2]) < .01);
      out[p.id] = s?.lod ?? 'n/a';
    }
    return out;
  }
  async metrics() {
    const q = (a: number[], p: number) => a.length ? Math.round(a.slice().sort((x, y) => x - y)[Math.floor((a.length - 1) * p)] * 100) / 100 : null;
    const band = (pick: (p: SceneLab['perf'][number]) => number) => { const a = this.perf.map(pick); return { p50: q(a, .5), p95: q(a, .95), max: q(a, 1) }; };
    const actors = Object.fromEntries([...this.actors.values()].map(a => { const e = this.world.entities.get(a.entity); return [a.id, { kind: a.kind, entity: a.entity, position: e ? [+e.transform.x.toFixed(3), +e.transform.z.toFixed(3)] : null, yawDeg: e ? +(e.transform.yaw * 180 / Math.PI).toFixed(1) : null,
      travelM: a.distanceM ?? 0, maxX: a.maxX ?? null, state: e?.civilian?.state ?? e?.infected?.state ?? e?.companion?.state ?? (a.kind === 'courier' ? e?.survivor?.animation : undefined) ?? null, health: e?.health.current ?? null, drawnFrames: a.drawn, inViewFrames: a.inView, missedInViewFrames: a.missed, lod: a.lod, firstDrawn: a.first ?? null, farLodCloseFrames: a.farClose, ...(a.emerge ? { emerge: true } : {}), motion: summarizeMotion(a.track), ...(this.spec?.trace ? { track: a.track.map(f => ({ ...f, feet: f.feet.map(c => ({ heel: c.heel.map(v => +v.toFixed(3)), toe: c.toe.map(v => +v.toFixed(3)) })) })) } : {}) }]; }));
    const appearance = [...this.actors.values()].map(a => ({ actor: a.id, looks: [...new Set(a.track.flatMap(f => f.appearance ? [f.appearance.key] : []))], corpseFrames: a.track.filter(f => f.appearance && f.corpse).length })).filter(a => a.looks.length);
    const visibleLooks = this.game.view.crowdFigures().filter(f => f.drawn && f.appearance && !this.world.entities.get(f.id)?.corpse && (this.world.entities.get(f.id)?.health.current ?? 0) > 0).sort((a,b) => a.id-b.id);
    const variety = Object.fromEntries((['infected', 'pedestrian'] as const).map(kind => [kind, crowdVariety(visibleLooks.filter(f => {
      const e = this.world.entities.get(f.id)!;
      return kind === 'infected' ? !!e.infected && ['infected.runner', 'infected.sprinter'].includes(e.archetype) && !/firefighter|police|guard|lab-|patient-zero/.test(e.appearance?.asset ?? '') : !!e.civilian && !e.infected;
    }).map(f => f.appearance!))]));
    const clipping = this.staticSets ? await this.clipping() : null;
    const bodies = [...this.bodies.values()].sort((x, y) => y.depthCm - x.depthCm);
    return { collision: this.world.solids.snapshot(), marketDoors: this.spec?.marketDoors ? { openness: this.game.view.labProbes().districts?.marketDoorOpenness() ?? null, posed: this.game.view.labProbes().districts?.marketDoorPlacements() ?? [] } : null, armyBoom: this.boom ? { closedAt: this.boomClosedAt, closed: !!this.spec?.armyBoom?.closed || !!this.boomClosedAt } : null, scene: this.spec?.name ?? null, frame: this.frame, tick: this.world.tick, backend: this.game.view.renderer.selectedBackend, quality: this.game.quality.tier,
      convoyOverlapFrames: this.convoyOverlapFrames,
      propPenetration: { samples: this.propPenetrationSamples, framesMax: Math.max(0, ...[...this.propPenetration.values()].map(m => m.max)), pairs: [...this.propPenetration.values()] },
      props: { sinkMaxCm: this.propSinkMaxCm, samples: this.propGroundSamples, gaps: this.game.view.labProbes().districts?.propGroundGaps() ?? [] },
      bodies, attackOverlap: { ...this.attackOverlap }, wheels: Object.fromEntries([...new Set([...this.wheels.values()].map(w => w.vehicle))].map(id => [id, [...this.wheels.values()].filter(w => w.vehicle === id).map(w => { const h = this.hubs.get(`${w.vehicle}|${w.wheel}`); return { ...w, hubSpikeCm: h?.spikeCm ?? 0, hubSpikeFrame: h?.spikeFrame ?? 0, hubStepCm: h?.stepCm ?? 0, hubStepFrame: h?.stepFrame ?? 0 }; })])), ...(this.spec?.trace ? { vehicleTrack: Object.fromEntries(this.vehicleTrack), wheelTrack: Object.fromEntries(this.wheelTrack) } : {}),
      lodPlaceholders: { frames: this.placeholders.frames, firstFrame: this.placeholders.firstFrame, assets: [...this.placeholders.assets].sort() },
      perf: { drawCalls: band(p => p.drawCalls), triangles: band(p => p.triangles), shadowDrawCalls: band(p => p.shadowDrawCalls), shadowTriangles: band(p => p.shadowTriangles), stepMs: band(p => p.stepMs),
        lastFrame: this.perf.at(-1) ?? null, note: 'view draws/triangles exclude the shadow pass (reported separately); stepMs = CPU ms of one sim tick + render submission, not GPU time' },
      vehicles: Object.fromEntries([...this.vehicles].map(([id, entity]) => { const e = this.world.entities.get(entity); return [id, e ? { entity, position: [+e.transform.x.toFixed(3), +e.transform.z.toFixed(3)], yawDeg: +(e.transform.yaw * 180 / Math.PI).toFixed(1), yawRateMaxDegS: this.vehicleMotion.get(id)?.yawRateMaxDegS ?? 0, bodyOverlaps: this.vehicleMotion.get(id)?.overlaps ?? 0, tiltMaxDeg: this.vehicleMotion.get(id)?.tiltMaxDeg ?? 0, tiltFrame: this.vehicleMotion.get(id)?.tiltFrame ?? -1, slipMaxDeg: this.vehicleMotion.get(id)?.slipMaxDeg ?? 0, slipFrame: this.vehicleMotion.get(id)?.slipFrame ?? -1, driven: this.world.vehicles!.active === entity, headlightsDarkFrames: this.vehicleMotion.get(id)?.darkFrames ?? 0, firstDarkFrame: this.vehicleMotion.get(id)?.firstDarkFrame ?? -1, rideRemainingM: this.vehicleMotion.get(id)?.ride ? l2TruckPath.at(-1)!.s - this.vehicleMotion.get(id)!.ride!.rideS : null, health: Math.round(e.health.current), decay: e.vehicle?.decay ?? null, speed: +(e.vehicle?.speed ?? e.traffic?.speed ?? 0).toFixed(2) } : null]; })),
      grounding: this.grounding(),
      pursuit: { actors: Object.fromEntries([...this.pursuit].map(([id, p]) => [id, { stuckRunMax: p.stuckRunMax, stuckFrame: p.stuckFrame, lostNearFrames: p.lostNearFrames, overshootMaxM: +p.overshootMaxM.toFixed(2) }])), courierSwings: this.attacks.swings, courierAttacks: this.attacks.courier, hullWindups: this.attacks.hull, hullHits: this.attacks.hullHits, firstAttackFrame: this.attacks.firstFrame, bites: this.attacks.bites, firstBiteFrame: this.attacks.firstBiteFrame },
      cure: this.cureStats ? { ...this.cureStats, last: undefined, health: undefined } : null, megaAlpha: this.megaReport(), minigun: this.gunReport(), specials: this.specials,
      heldProps: { samples: this.heldPropSamples, intersections: this.heldPropClips.size, holds: Object.fromEntries(this.holds) }, seeThrough: { ...this.seeThroughOpen }, appearance, companion: { ...this.companion }, bike: { ...this.bike }, variety, actors, clicks: this.clickReport(), visibility: this.visible, lods: this.lods(), clipping: clipping?.summary ?? null,
      emergence: this.emergence ? { building: this.emergence.house, door: { x: +this.emergence.x.toFixed(3), z: +this.emergence.z.toFixed(3), nx: this.emergence.nx, nz: this.emergence.nz }, release: [+this.emergence.ox.toFixed(3), +this.emergence.oz.toFixed(3)], residents: this.emergence.ids.length, doorOpenedFrame: this.emergence.openFrame } : null,
      doors: Object.fromEntries([...this.doors].map(([id, d]) => [id, { closedFrames: d.closedFrames, firstClosedFrame: d.firstClosedFrame, inDoorwayFrames: d.inDoorwayFrames, maxOpen: +d.maxOpen.toFixed(2) }])), log: [...this.log] };
  }
  /** Drawn frozen corpses and ground pickups against the exact support at their drawn xz (cm; one walkable layer per column in these scenes). */
  private grounding() {
    const d = this.world.districts, probes = this.game.view.labProbes(); if (!d) return null;
    const off = (b: { x: number; y: number; z: number }) => Math.abs(b.y - d.pavingHeight(b.x, b.z)) * 100;
    const corpses = probes.drawnCorpses(), pickups = probes.drawnPickups();
    const round = (b: { id: number; x: number; y: number; z: number }) => ({ id: b.id, at: [+b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2)], support: +d.pavingHeight(b.x, b.z).toFixed(2), offCm: +off(b).toFixed(1) });
    return { corpses: corpses.length, corpseOffMaxCm: +Math.max(0, ...corpses.map(off)).toFixed(1), pickups: pickups.length, pickupOffMaxCm: +Math.max(0, ...pickups.map(off)).toFixed(1), worst: [...corpses, ...pickups].map(round).sort((a, b) => b.offCm - a.offCm).slice(0, 5) };
  }
  describe() {
    return { name: this.spec?.name ?? null, frame: this.frame, placements: this.built?.placements.map(p => ({ id: p.id, asset: p.assetId, at: [p.position[0], p.position[2]], yawDeg: Math.round(p.yaw * 1800 / Math.PI) / 10 })) ?? [],
      actors: [...this.actors.values()].map(a => ({ id: a.id, kind: a.kind, entity: a.entity })), vehicles: Object.fromEntries(this.vehicles) };
  }
  async reset() { if (!this.spec) throw new Error('load_scene first'); return this.load(this.spec); }
  /** Lightweight state to sample beside pixels during same-browser reload batches. */
  renderDiagnostics() { return { scene: this.spec?.name ?? null, frame: this.frame, tick: this.world.tick, ...this.game.view.renderDiagnostics() }; }
  /** Screenshot readiness: streamed LOD0 and pending assets resolved, two presented frames. */
  ready(): Promise<void> { return this.game.screenshotReady(); }
  /** Cut-pixel gate: force the solid-occluder cut off (or back on) and report the hole as last drawn (centre in screen UV, top-left origin). */
  cutProbe(off: boolean): { center: [number, number]; solidRadius: number; strength: number; cover: number; occluder: string } | null {
    const audit = this.game.view.labProbes().districts?.seeThroughAudit() ?? null;
    this.game.view.settings({ seeThroughOff: off });
    return audit && { center: audit.center, solidRadius: audit.solidRadius, strength: audit.strength, cover: audit.cover, occluder: audit.occluder };
  }
  /** Courier-visible-share probe: redraw with the courier and/or the crowd (Mega included) hidden; returns the courier-to-Mega distance in metres (Infinity when none). */
  hideProbe(courier: boolean, crowd: boolean, environment = false, bars = false): number { return this.game.view.probeVisibility({ courier, crowd, environment, bars }); }
  /** Exact screen disc used by the boss shader, for comparing body pixels outside the intended courier reveal. */
  bossRevealProbe() { return { center: seeThrough.center.value.toArray(), radius: seeThrough.bossRadius.value, strength: seeThrough.bossStrength.value }; }
  private megaProbeModels = new Map<number, string | undefined>();
  /** Render a regular Alpha at each Mega's exact transform/pose, without advancing simulation.
   * Preserve pursuit/pose; each asset keeps its normal material (Mega alone has the courier cutout). */
  alphaReferenceProbe(enabled: boolean): void {
    for (const e of this.world.entities.iterate()) if (e.infected?.pursuit) {
      if (enabled) {
        if (!this.megaProbeModels.has(e.id)) this.megaProbeModels.set(e.id, e.infected.model);
        e.infected.model = 'inf.alpha';
      } else if (this.megaProbeModels.has(e.id)) {
        e.infected.model = this.megaProbeModels.get(e.id);
        this.megaProbeModels.delete(e.id);
      }
    }
    this.game.view.probeVisibility({ courier: false, crowd: false });
  }
  /** Point-in-scene to client pixels (for cropping close-ups from a screenshot). */
  project(p: [number, number, number]): { x: number; y: number } { const q = this.game.view.project(...p); return { x: (q[0] + 1) / 2 * innerWidth, y: (1 - q[1]) / 2 * innerHeight }; }
}

declare global { interface Window { __SCENE__?: SceneLab } }
export function installSceneLab(game: Game): SceneLab { const lab = new SceneLab(game); window.__SCENE__ = lab; return lab; }
