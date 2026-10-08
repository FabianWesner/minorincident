import { Box3, Matrix4, Mesh, Object3D, Vector3, type BufferAttribute, type InterleavedBufferAttribute } from 'three';
import manifest from '../../assets/manifest.json';
import type { AssetDef } from '../../assets/types';
import { AssetRegistry } from '../../assets/registry';
import { assetUrl } from '../../assets/assetUrl';
import type { Game } from '../../Game';
import type { DistrictLayout, Point } from '../../levels/districts/types';
import type { CivilianActivity } from '../../sim/npc/types';
import type { EntitySnapshot } from '../../sim/world/types';
import type { SimWorld } from '../../sim/world/SimWorld';
import { emptyInput, type InputFrame } from '../../input/InputFrame';
import { installL1Outbreak } from '../../sim/outbreak/install';
import { seatAnchor } from '../../sim/npc/seats';
import { CrowdFigureProbe } from '../../render/characters/CrowdFigureProbe';
import type { TimeOfDay } from '../../data/timeOfDay';
import { buildScene, validateSpec, type Action, type ActorSpec, type BuiltScene, type CameraSpec, type EffectSpec, type PropSpec, type SceneSpec } from './spec';
import { boneClipping, boxOf, staticClipping, type Bone, type BoneHit, type StaticClip, type TriangleSet, type Vec3 } from './geometry';
import { footYaw, summarizeMotion, torsoPitch, type FootSample, type MotionFrame } from './motion';

const assets = new Map((manifest as AssetDef[]).map(a => [a.id, a]));
const rad = (deg: number) => deg * Math.PI / 180;
const ticks = (seconds: number) => Math.round(seconds * 60);
type Plan =
  | { type: 'path'; points: Point[]; index: number; run: boolean; loop: boolean }
  | { type: 'moveTo'; point: Point; run: boolean }
  | { type: 'turn'; yaw: number }
  | { type: 'attack'; target: string; until: number }
  | { type: 'mount'; bike: string; at: number };
interface LabActor { id: string; kind: ActorSpec['kind']; entity: number; spec: ActorSpec; plan: Plan | null; track: MotionFrame[]; lod: Record<string, number>; drawn: number; /** Frames the living actor was inside the camera frustum, and how many of those it was not drawn. */ inView: number; missed: number; sole?: number }
interface Hit extends BoneHit { actor: string; frame: number; count: number }
const toPoint = (p: Point | number[]) => Array.isArray(p) ? { x: p[0], z: p[1] } : p;

/**
 * Scene Lab runtime (window.__SCENE__): builds an isolated scene with the real Game (composition, renderer, materials,
 * LOD, crowd, NPC/infected AI, physics) and steps it with a fixed 60 Hz tick while recording QA metrics.
 * Driven by tools/scenelab (CLI runner and MCP server); see docs/tools/scene-lab.md.
 */
export class SceneLab {
  spec: SceneSpec | null = null;
  built: BuiltScene | null = null;
  frame = 0;
  readonly actors = new Map<string, LabActor>();
  readonly vehicles = new Map<string, number>();
  private camera: CameraSpec | null = null;
  private perf: { drawCalls: number; triangles: number; shadowDrawCalls: number; shadowTriangles: number; stepMs: number; categories: Record<string, number> }[] = [];
  private hits = new Map<string, Hit>();
  private staticSets: TriangleSet[] | null = null;
  private staticClips: StaticClip[] | null = null;
  private visible: { frame: number; sim: Record<string, number>; drawn: Record<string, number> } | null = null;
  private readonly registry = new AssetRegistry(() => {});
  private readonly log: string[] = [];
  private readonly point = new Vector3();
  constructor(private readonly game: Game) { CrowdFigureProbe.joints = true; }
  private get world(): SimWorld { return this.game.world; }

  /** Build and load a scene; returns the resolved placements/actors so a caller can address them by id. */
  async load(spec: SceneSpec) {
    const errors = validateSpec(spec, assets);
    if (errors.length) throw new Error(`Invalid scene spec:\n${errors.join('\n')}`);
    let source: DistrictLayout | undefined;
    if (spec.layout) {
      const response = await fetch(assetUrl(`/assets/layouts/${spec.layout.district}.layout.json`));
      if (!response.ok) throw new Error(`Layout ${spec.layout.district} not found`);
      source = await response.json() as DistrictLayout;
    }
    this.spec = structuredClone(spec); this.frame = 0; this.actors.clear(); this.vehicles.clear(); this.perf = []; this.hits.clear(); this.staticSets = null; this.staticClips = null; this.visible = null; this.log.length = 0;
    const built = this.built = buildScene(spec, assets, source);
    await this.game.loadLevel('scene-lab', { seed: spec.seed ?? 1, tier: spec.tier, source: { composition: built.composition, layouts: [built.layout] }, setup: world => this.setup(world, spec) });
    this.game.clock.pause();
    this.game.view.settings({ cameraShake: false, cheapDof: spec.dof ?? true, timeOfDay: spec.time ?? 'L1' });
    this.camera = spec.camera ?? { mode: 'game', target: built.center };
    this.applyCamera();
    // Prop triangles for the per-frame bone checks (LOD0 GLBs, cached by the registry across loads).
    await Promise.all([this.game.screenshotReady(), this.prepareClipping()]);
    this.calibrateSole();
    return this.describe();
  }
  /** Sim assembly before the view loads: systems, actors and vehicles exist when the presentation is built. */
  private setup(world: SimWorld, spec: SceneSpec): void {
    const outbreak = installL1Outbreak(world, { civilians: 0 });
    void outbreak;
    world.combat!.damage.god = true;
    const player = world.entities.get(1)!;
    const courier = spec.actors?.find(a => a.kind === 'courier');
    if (!courier) player.hidden = true;
    for (const e of [...world.entities.iterate()]) if (e.companion && !spec.actors?.some(a => a.kind === 'corgi')) { world.entities.delete(e.id); world.spatial.delete(e.id); }
    for (const v of spec.vehicles ?? []) this.addVehicle(v.id ?? v.asset, v.asset, v.at, v.yaw ?? 0, v.path, v.panic);
    spec.actors?.forEach((a, i) => this.spawn(a, i));
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
        if (a.look?.model === 'male' || a.look?.model === 'female') world.player!.select(a.look.model, 0);
        // L1 parity: the courier starts empty-handed (Game.loadLevel clears the L1 loadout); `loadout` arms her.
        if (a.loadout) world.combat!.setLoadout([a.loadout[0]], [a.loadout[1]]); else world.combat!.clearLoadout();
        world.combat!.damage.god = a.god ?? true;
      } else if (a.kind === 'pedestrian') {
        const o = world.npcs!.civilians.outbreak!;
        entity = o.spawnPedestrian(at, { model: a.look?.model, tint: a.look?.tint, accessories: a.look?.accessories, handProp: a.look?.handProp ?? null, tier: a.look?.tier, role: a.look?.role, yaw,
          schedule: [this.stand(at, yaw)] });
      } else if (a.kind === 'infected') {
        entity = world.infected!.spawn(a.archetype ?? 'infected.runner', at, { yaw, state: 'idle', ...(a.look?.model ? { variant: a.look.model } : {}), ...(a.look?.tier ? { tier: a.look.tier } : {}) });
      } else {
        entity = world.npcs!.companion.spawn(); const dog = world.entities.get(entity)!;
        if (a.at) this.teleport(dog, at);
        dog.transform.yaw = yaw;
      }
      const actor: LabActor = { id, kind: a.kind, entity, spec: a, plan: null, track: [], lod: {}, drawn: 0, inView: 0, missed: 0 };
      this.actors.set(id, actor); ids.push(id);
      if (a.state) this.command(id, a.state);
    }
    return ids;
  }
  private teleport(e: EntitySnapshot, p: { x: number; z: number }): void {
    e.transform.x = p.x; e.transform.z = p.z; this.world.spatial.set(e.id, p.x, p.z);
    if (e.id === 1) { this.world.physics.playerBody!.setTranslation(e.transform, true); this.world.physics.playerBody!.setNextKinematicTranslation(e.transform); this.world.player!.setCheckpoint(e.transform); }
  }
  private stand(at: { x: number; z: number }, yaw: number): CivilianActivity {
    return { activity: 'stand', anchor: 'lab/stand', target: { ...at }, ticks: 1e9, facing: { x: at.x + Math.cos(yaw) * 3, z: at.z - Math.sin(yaw) * 3 } };
  }
  private addVehicle(id: string, asset: string, at: Point, yawDeg: number, path?: Point[], panic?: boolean): number {
    const world = this.world, yaw = rad(yawDeg);
    let entity: number;
    if (asset === 'vehicle.bicycle') entity = world.vehicles!.bicycle.spawn(toPoint(at), -yaw);
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
    if (actor.kind === 'courier') {
      if ('walk' in a || 'run' in a) actor.plan = { type: 'path', points: 'walk' in a ? a.walk : a.run, index: 0, run: 'run' in a, loop: !!a.loop };
      else if ('moveTo' in a) actor.plan = { type: 'moveTo', point: a.moveTo, run: a.pace !== 'walk' };
      else if ('turn' in a) actor.plan = { type: 'turn', yaw: rad(a.turn) };
      else if ('attack' in a) actor.plan = { type: 'attack', target: a.attack, until: this.frame + ticks(a.seconds ?? 2) };
      else if ('mountBike' in a) actor.plan = { type: 'mount', bike: a.mountBike, at: this.frame };
      else if ('dismount' in a) actor.plan = { type: 'mount', bike: '', at: this.frame };
      else if ('hit' in a) world.player!.damage(a.hit.amount ?? 5, world.tick);
      return;
    }
    if (actor.kind === 'pedestrian') {
      const c = e.civilian!, reset = (schedule: CivilianActivity[]) => { c.schedule = schedule; c.scheduleStep = 0; c.activityUntil = 0; c.activityStarted = 0; c.path.length = 0; c.goal = -1; c.state = 'calm'; };
      if ('idle' in a) reset([this.stand(e.transform, e.transform.yaw)]);
      else if ('turn' in a) reset([this.stand(e.transform, rad(a.turn))]);
      else if ('walk' in a || 'run' in a) { const points = ('walk' in a ? a.walk : a.run).map(toPoint); if (c.l1) c.l1.walkSpeed = 'run' in a ? 3.2 : c.l1.walkSpeed; reset(points.map(p => ({ activity: 'walk', anchor: 'lab/walk', target: p, ticks: 1 }))); if (!a.loop) c.schedule!.push(this.stand(points[points.length - 1], e.transform.yaw)); }
      else if ('moveTo' in a) { const p = toPoint(a.moveTo); reset([{ activity: 'walk', anchor: 'lab/walk', target: p, ticks: 1 }, this.stand(p, e.transform.yaw)]); }
      else if ('sit' in a) reset(this.sitSchedule(a.sit, a.seconds));
      else if ('flee' in a) { c.threat.x = a.flee[0]; c.threat.z = a.flee[1]; c.state = 'flee'; c.entered = world.tick; }
      else if ('infect' in a) { const by = a.infect.by ? this.actors.get(a.infect.by)?.entity ?? 0 : 0; if (a.infect.instant) world.npcs!.civilians.outbreak!.turnNow(e); else world.npcs!.civilians.outbreak!.infect(e, by); }
      else if ('hit' in a) this.hit(e, a.hit);
      return;
    }
    if (actor.kind === 'infected') {
      const b = e.infected!;
      if ('idle' in a) { b.state = 'idle'; delete e.noiseTarget; }
      else if ('chase' in a) { b.state = 'chase'; const target = this.actors.get(a.chase); if (target && target.entity !== 1) e.noiseTarget = { id: target.entity, until: world.tick + 1e6 }; }
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
  private hit(e: EntitySnapshot, hit: { from?: string | Point; heavy?: boolean; amount?: number }): void {
    const from = typeof hit.from === 'string' ? this.world.entities.get(this.actors.get(hit.from)?.entity ?? 1)!.transform : hit.from ? toPoint(hit.from) : { x: e.transform.x - 1, z: e.transform.z };
    const dx = e.transform.x - from.x, dz = e.transform.z - from.z, d = Math.hypot(dx, dz) || 1;
    this.world.combat!.damage.apply({ attackId: 9000 + this.world.tick, actionId: hit.heavy ? 'weapon.kick' : 'weapon.fists', sourceId: 1, targetId: e.id, origin: { x: from.x, z: from.z }, direction: { x: dx / d, z: dz / d }, base: hit.amount ?? 1, multiplier: 1, type: 'melee', knockback: hit.heavy ? 1.5 : .3, stagger: hit.heavy ? 30 : 12, knockdown: hit.heavy });
  }
  effect(fx: EffectSpec): void {
    const world = this.world;
    if ('blast' in fx) world.explosions!.blast(fx.blast, toPoint(fx.at));
    else if ('wreck' in fx) { const id = this.vehicles.get(fx.wreck); if (id === undefined) throw new Error(`wreck: unknown vehicle ${fx.wreck}`); world.vehicles!.damage(id, 1e6); }
    else { const kind = 'fire' in fx ? 'fire' : 'smoke', p = toPoint('fire' in fx ? fx.fire : fx.smoke); world.events.emit({ type: 'vfx.effect', tick: world.tick, kind, position: p, radius: fx.radius ?? 2 } as Parameters<typeof world.events.emit>[0]); }
  }
  setTime(preset: TimeOfDay): void { this.game.view.settings({ timeOfDay: preset }); }
  setCamera(camera: CameraSpec): void { this.camera = camera; this.applyCamera(); this.game.view.update(1); }

  /** Resolve a camera target: actor id, [x, z] or [x, y, z]. */
  private target(t: [number, number, number] | Point | string | undefined, y = .8): [number, number, number] {
    if (typeof t === 'string') { const a = this.actors.get(t), e = a && this.world.entities.get(a.entity); if (!e) throw new Error(`camera: unknown actor ${t}`); return [e.transform.x, y, e.transform.z]; }
    if (!t) return [this.built!.center[0], y, this.built!.center[1]];
    return t.length === 3 ? [t[0], t[1], t[2]] : [t[0], y, t[1]];
  }
  private applyCamera(): void {
    const c = this.camera; if (!c) return;
    const view = this.game.view.view, spherical = (target: [number, number, number], radius: number, polar: number, azimuth: number) => {
      const s = Math.sin(polar) * radius;
      view.preset('scene-lab', { target, position: [target[0] + s * Math.sin(azimuth), target[1] + Math.cos(polar) * radius, target[2] + s * Math.cos(azimuth)] });
    };
    // The game camera: 25° FOV, polar 0.30π, azimuth π/4, radius 19 (View.ts).
    if (c.mode === 'game') spherical(this.target(c.target, 0), 19 * (c.zoom ?? 1), view.polar, view.azimuth);
    else if (c.mode === 'follow') spherical(this.target(c.actor, 0), 19 * (c.zoom ?? 1), view.polar, view.azimuth);
    else if (c.mode === 'close') spherical(this.target(c.target), c.radius ?? 5, view.polar, c.azimuth === undefined ? view.azimuth : rad(c.azimuth));
    else if (c.mode === 'orbit') spherical(this.target(c.target), c.radius ?? 10, rad(c.polar ?? 54), rad((c.azimuth ?? 45) + (c.spin ?? 0) * this.frame / 60));
    else view.preset('scene-lab', { position: c.position, target: c.target });
  }

  /** Advance N fixed ticks (sim + render), recording metrics every frame. */
  async step(frames = 1): Promise<number> {
    for (let i = 0; i < frames; i++) {
      for (const s of this.spec?.script ?? []) if (s.frame === this.frame) {
        if ('actor' in s) this.command(s.actor, s.do);
        else if ('effect' in s) this.effect(s.effect);
        else if ('camera' in s) { this.camera = s.camera; this.applyCamera(); }
        else if ('time' in s) this.setTime(s.time);
      }
      this.drivePlayer();
      if (this.camera?.mode === 'follow' || this.camera?.mode === 'orbit' && this.camera.spin || typeof (this.camera as { target?: unknown })?.target === 'string') this.applyCamera();
      const start = performance.now();
      this.nextRenderFrame();
      this.game.view.frame(1 / 60); await this.game.step(1);
      // `?profile` (set by the runner) attributes every submitted draw, including the PostFx scene pass and shadows.
      const stepMs = performance.now() - start, info = this.game.view.renderer.info.render, profile = Object.entries(this.game.view.renderer.profile ?? {});
      const view = profile.filter(([k]) => k !== 'shadows'), shadow = profile.find(([k]) => k === 'shadows')?.[1];
      this.perf.push(profile.length ? { drawCalls: view.reduce((n, [, v]) => n + v.drawCalls, 0), triangles: view.reduce((n, [, v]) => n + v.triangles, 0), shadowDrawCalls: shadow?.drawCalls ?? 0, shadowTriangles: shadow?.triangles ?? 0, stepMs, categories: Object.fromEntries(profile.map(([k, v]) => [k, v.drawCalls])) } : { drawCalls: info.drawCalls, triangles: info.triangles, shadowDrawCalls: 0, shadowTriangles: 0, stepMs, categories: {} });
      this.frame++;
      this.sample();
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
    const frame: InputFrame & Record<string, unknown> = { ...emptyInput(), walk: undefined, moveTarget: undefined, attackTarget: undefined, navigation: undefined };
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
      if (!target || this.frame >= plan.until) courier.plan = null;
      else { frame.attackTarget = { id: target.entity, side: 'LEFT' }; frame.left = { down: false, held: true, up: false }; }
    } else if (plan?.type === 'mount') {
      // Mount/dismount is the real interact press next to the bicycle (one tick).
      const bike = plan.bike ? this.vehicles.get(plan.bike) : undefined;
      if (bike !== undefined && this.frame === plan.at) { const b = world.entities.get(bike)!; this.teleport(world.entities.get(1)!, { x: b.transform.x + .9, z: b.transform.z }); }
      if (this.frame === plan.at + 2) { frame.interact = true; courier.plan = null; }
    }
    world.setInput(frame); this.game.input.inject(frame);
  }

  /** Courier ankle height above the sole, in foot-local units, from the frame-0 idle pose (feet flat on the floor). */
  private calibrateSole(): void {
    const courier = [...this.actors.values()].find(a => a.kind === 'courier'), c = this.game.view.labProbes().character, foot = c?.node('footL');
    if (!courier || !c || !foot) return;
    c.updateMatrixWorld(true);
    courier.sole = (foot.getWorldPosition(this.point).y - (this.world.districts?.pavingHeight(c.position.x, c.position.z) ?? 0)) / foot.getWorldScale(new Vector3()).y;
  }
  /** Per-frame probes: foot/torso tracks, LOD and visibility of every actor; bone-vs-prop clipping every 3rd frame. */
  private sample(): void {
    const probes = this.game.view.labProbes(), figures = new Map(this.game.view.crowdFigures().map(f => [f.id, f]));
    const sim: Record<string, number> = {}, drawn: Record<string, number> = {};
    const clip = this.frame % 3 === 0 && this.staticSets;
    for (const actor of this.actors.values()) {
      const e = this.world.entities.get(actor.entity);
      sim[actor.kind] = (sim[actor.kind] ?? 0) + (e && !e.hidden && e.health.current > 0 ? 1 : 0);
      let feet: FootSample[] = [], joints: Record<string, number[]> | null = null, forward: number[] = [1, 0, 0], lod = 'lod0', visible = false, clipName: string | undefined;
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
        }
      } else if (actor.kind === 'corgi') {
        const root = probes.npcs?.heroRoot(actor.entity); visible = !!root?.visible;
        if (root) { root.updateMatrixWorld(true); feet = ['legFL', 'legFR', 'legBL', 'legBR'].flatMap(n => { const leg = root.getObjectByName(n); if (!leg) return []; const paw = this.paw(leg); return [{ heel: paw, toe: paw, yaw: 0 }]; }); }
      } else {
        const f = figures.get(actor.entity);
        if (f) {
          visible = f.drawn; lod = f.lod ?? 'lod1'; clipName = f.clip; joints = f.joints ?? null; forward = f.forward ?? forward;
          if (f.soles?.length === 4) feet = [[f.soles[0], f.soles[1]], [f.soles[2], f.soles[3]]].map(([heel, toe]) => ({ heel, toe, yaw: footYaw(heel, toe) }));
        }
      }
      if (e && !e.hidden && e.health.current > 0 && !e.corpse && !(e.civilian?.state === 'infected')) {
        const q = this.game.view.project(e.transform.x, e.transform.y + .9, e.transform.z);
        if (Math.abs(q[0]) < .95 && Math.abs(q[1]) < .95 && q[2] < 1) { actor.inView++; if (!visible) actor.missed++; }
      }
      if (visible) { actor.drawn++; drawn[actor.kind] = (drawn[actor.kind] ?? 0) + 1; actor.lod[lod] = (actor.lod[lod] ?? 0) + 1; }
      const shoulders = joints?.armL && joints.armR ? joints.armL.map((v, k) => (v + joints!.armR[k]) / 2) : undefined;
      const motion = e?.motion?.speed ?? Math.hypot(e?.survivor?.velocity?.x ?? 0, e?.survivor?.velocity?.z ?? 0);
      actor.track.push({ frame: this.frame, floor: e ? this.world.districts?.pavingHeight(e.transform.x, e.transform.z) ?? 0 : undefined, clip: clipName ?? (e?.civilian?.state === 'calm' && e.civilian.schedule?.[e.civilian.scheduleStep ?? 0]?.activity === 'sit' && e.civilian.activityUntil ? 'sit' : undefined), feet, speed: motion, torsoPitchDeg: joints?.hip && shoulders ? torsoPitch(joints.hip, shoulders, forward) : undefined });
      if (clip && joints && visible) for (const h of boneClipping(this.bones(joints, shoulders), this.near(joints.hip ?? Object.values(joints)[0]), (this.spec?.clipping?.slackCm ?? 2) / 100)) {
        const key = `${actor.id}|${h.prop}|${h.bone}`, old = this.hits.get(key);
        if (!old) this.hits.set(key, { ...h, actor: actor.id, frame: this.frame, count: 1 });
        else { old.count++; if (h.crossing && !old.crossing || h.clearanceCm < old.clearanceCm) Object.assign(old, h, { frame: this.frame }); }
      }
    }
    // Sim-vs-drawn for everything in the world, not only lab actors (pooled or reanimated infected included).
    const all: Record<string, number> = {};
    for (const e of this.world.entities.iterate()) if (!e.hidden && e.health.current > 0 && (e.infected || e.civilian || e.companion || e.vehicle || e.traffic)) { const k = e.infected ? 'infected' : e.civilian ? 'pedestrian' : e.companion ? 'corgi' : 'vehicle'; all[k] = (all[k] ?? 0) + 1; }
    const drawnAll: Record<string, number> = { vehicle: this.game.view.getState().vehicles.length };
    for (const f of figures.values()) if (f.drawn) { const e = this.world.entities.get(f.id); const k = e?.infected ? 'infected' : 'pedestrian'; drawnAll[k] = (drawnAll[k] ?? 0) + 1; }
    this.visible = { frame: this.frame, sim: { ...all, ...sim, actors: this.actors.size }, drawn: { ...drawnAll, ...drawn } };
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
      const holder = new Object3D(); holder.position.fromArray(p.position); holder.rotation.y = p.yaw; holder.scale.fromArray(p.scale); holder.add(root); holder.updateMatrixWorld(true);
      const tris: number[] = [];
      root.traverse(node => {
        if (!(node instanceof Mesh) || !node.visible || node.name.startsWith('stump_')) return;
        const position = node.geometry.getAttribute('position') as BufferAttribute | InterleavedBufferAttribute, index = node.geometry.index;
        matrix.copy(node.matrixWorld);
        const count = index ? index.count : position.count;
        for (let i = 0; i < count; i++) { v.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(matrix); tris.push(v.x, v.y, v.z); }
      });
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
    return { static: this.staticClips, actors, summary: { staticPairs: this.staticClips.length, actorHits: actors.length, piercing: actors.filter(h => h.crossing).length } };
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
      state: e?.civilian?.state ?? e?.infected?.state ?? e?.companion?.state ?? (a.kind === 'courier' ? e?.survivor?.animation : undefined) ?? null, drawnFrames: a.drawn, inViewFrames: a.inView, missedInViewFrames: a.missed, lod: a.lod, motion: summarizeMotion(a.track) }]; }));
    const clipping = this.staticSets ? await this.clipping() : null;
    return { scene: this.spec?.name ?? null, frame: this.frame, tick: this.world.tick, backend: this.game.view.renderer.selectedBackend, quality: this.game.quality.tier,
      perf: { drawCalls: band(p => p.drawCalls), triangles: band(p => p.triangles), shadowDrawCalls: band(p => p.shadowDrawCalls), shadowTriangles: band(p => p.shadowTriangles), stepMs: band(p => p.stepMs),
        lastFrame: this.perf.at(-1) ?? null, note: 'view draws/triangles exclude the shadow pass (reported separately); stepMs = CPU ms of one sim tick + render submission, not GPU time' },
      vehicles: Object.fromEntries([...this.vehicles].map(([id, entity]) => { const e = this.world.entities.get(entity); return [id, e ? { entity, position: [+e.transform.x.toFixed(3), +e.transform.z.toFixed(3)], yawDeg: +(e.transform.yaw * 180 / Math.PI).toFixed(1), health: Math.round(e.health.current), speed: +(e.vehicle?.speed ?? e.traffic?.speed ?? 0).toFixed(2) } : null]; })),
      actors, visibility: this.visible, lods: this.lods(), clipping: clipping?.summary ?? null, log: [...this.log] };
  }
  describe() {
    return { name: this.spec?.name ?? null, frame: this.frame, placements: this.built?.placements.map(p => ({ id: p.id, asset: p.assetId, at: [p.position[0], p.position[2]], yawDeg: Math.round(p.yaw * 1800 / Math.PI) / 10 })) ?? [],
      actors: [...this.actors.values()].map(a => ({ id: a.id, kind: a.kind, entity: a.entity })), vehicles: Object.fromEntries(this.vehicles) };
  }
  async reset() { if (!this.spec) throw new Error('load_scene first'); return this.load(this.spec); }
  /** Screenshot readiness: streamed LOD0 and pending assets resolved, two presented frames. */
  ready(): Promise<void> { return this.game.screenshotReady(); }
  /** Point-in-scene to client pixels (for cropping close-ups from a screenshot). */
  project(p: [number, number, number]): { x: number; y: number } { const q = this.game.view.project(...p); return { x: (q[0] + 1) / 2 * innerWidth, y: (1 - q[1]) / 2 * innerHeight }; }
}

declare global { interface Window { __SCENE__?: SceneLab } }
export function installSceneLab(game: Game): SceneLab { const lab = new SceneLab(game); window.__SCENE__ = lab; return lab; }
