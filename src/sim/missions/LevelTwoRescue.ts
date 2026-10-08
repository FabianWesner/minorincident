import * as RAPIER from '@dimforge/rapier3d-compat';
import { Rng } from '../../core/Rng';
import { l2, l2TruckRoute, type GlassRole } from '../../data/l2';
import { Outbreak } from '../outbreak/Outbreak';
import { allyState } from '../outbreak/Allies';
import { l2Dressing } from '../../levels/L2/layout';
import type { Mission } from './Mission';
import type { L2State } from './types';
import type { EntitySnapshot } from '../world/types';
import type { CivilianActivity, Point } from '../npc/types';
import type { CoverWall } from '../combat/HitQuery';

const TICKS = 60, ticks = (s: number) => Math.round(s * TICKS);
const NAV_TRUCK = 900_201;
/** Market openings (front east, loading south) and the checkpoint entrances (main gate, north and south side gates). */
const WALLS: Record<string, CoverWall> = {
  'door-front': { x: -51.3, y: .9, z: -42.2, halfX: .2, halfY: .9, halfZ: 4.6 },
  'door-loading': { x: -55.6, y: .9, z: -37.6, halfX: 4.3, halfY: .9, halfZ: .2 },
  'gate-main': { x: l2.checkpoint.gateX, y: .9, z: 30.1, halfX: .25, halfY: .9, halfZ: 5.6 },
  'gate-north': { x: 82, y: .9, z: 24.6, halfX: 3.1, halfY: .9, halfZ: .25 },
  'gate-south': { x: 81.5, y: .9, z: 35.0, halfX: 1.25, halfY: .9, halfZ: .25 },
};
const fresh = (): L2State => ({
  phase: 'calm', alarmAt: 0, departAt: 0, arrivedAt: 0, crewExitAt: 0, atDoorsAt: 0, doorsOpenAt: 0, radioAt: 0, crossedAt: 0, gateClosedAt: 0,
  truckId: 0, seated: false, axe: false, rideS: 0, rideV: 0, crewIds: [], benchIds: [], trappedIds: [], officerIds: [], lineIds: [], doorIds: [], gateIds: [],
  released: 0, ambush: [], ambushIds: [], pending: [], escapeIds: [], clusterIds: [], escapeSpawned: false, clusterSpawned: false, clusterReached: false,
});
type Pending = L2State['pending'][number];
/** Stateless seeded hash in [0, 1): presentation timing that survives checkpoints without extra state. */
const hash = (n: number): number => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const DEG = Math.PI / 180;
/** Rescue set-piece shouts (speech bubbles): beat anchor, seconds after it, speaker (crew index or glass index), line. */
const SHOUTS: readonly (readonly ['arrived' | 'exit' | 'doors', number, 'crew' | 'glass', number, string])[] = [
  ['arrived', .4, 'glass', 0, 'Help! Please, get us out!'],
  ['exit', .3, 'crew', 0, 'Hang on! We’re getting you out!'],
  ['doors', .2, 'crew', 1, 'Stand back from the glass!'],
  ['doors', 1.8, 'glass', 5, 'They’re inside! Hurry!'],
  ['doors', 3.1, 'crew', 4, 'Chain’s going — stand clear!'],
];

/**
 * L2 "The Failed Rescue" controller (specs/epic-20 sections 4 and 5). Scripted only up to `l2.doorsOpen`: the calm bay, the
 * alarm, boarding, the kinematic truck ride, the crew forcing the doors and the release of the trapped civilians; then the
 * ambush emerges from three building doors and the E19 outbreak rules (sight-only perception, bites, transformations,
 * allied fighters) take over. The escape population and the bridge cluster emerge out of view during the ride; the
 * checkpoint gate closes behind the player. All state lives in `mission.state.l2`, so checkpoints restore it.
 */
export class LevelTwoRescue {
  private readonly walls = new Map<string, number>();
  private route: { pts: Point[]; cum: number[]; length: number } | null = null;
  constructor(private readonly mission: Mission) {}
  private get s(): L2State { return this.mission.state.l2!; }
  private get world() { return this.mission.world; }
  private anchor(name: string) { return this.mission.def.anchors[name]; }
  /** Nearest point with `r` clearance (ring search, 0.5 m steps up to 6 m). */
  private snap(p: Point, r = .4): Point {
    const nav = this.world.infected!.nav;
    for (let d = 0; d <= 6; d += .5) for (let k = 0; k < (d ? 16 : 1); k++) {
      const x = p.x + Math.cos(k * Math.PI / 8) * d, z = p.z + Math.sin(k * Math.PI / 8) * d;
      if (nav.clear(x, z, Math.max(r, .36))) return { x, z };
    }
    return { x: p.x, z: p.z };
  }
  private outbreak(): Outbreak { return this.world.npcs!.civilians.outbreak!; }

  prepare(): void {
    const { world, state } = this.mission;
    state.l2 = fresh();
    if (!world.infected || !world.npcs) return;
    const tier = world.infected.director.tier;
    // Refuges are the town edges only: houses near the rescue are locked, so fleeing people run long streets.
    const edges = l2.rescue.refuges.map(id => ({ id, ...this.anchor(id) }));
    const outbreak = world.npcs.civilians.outbreak ?? new Outbreak(world, { refuges: edges, tier });
    world.npcs.civilians.outbreak = outbreak;
    world.infected.director.levelCap = l2.escape.caps.high;
    world.npcs.setAmbient(0);
    // L2-default progression: the bat from L1 is in hand (a campaign load has already applied its racks).
    if (!world.progression || !world.entities.get(1)!.weapons) world.combat?.setLoadout(['weapon.bat'], ['weapon.fists']);
    this.spawnTruck();
    this.spawnStation();
    this.spawnCheckpoint();
    this.spawnCorpses();
    this.s.trappedIds = this.spawnTrapped(tier === 'low' ? l2.rescue.trapped.low : l2.rescue.trapped.high);
    for (const id of ['door-front', 'door-loading']) this.wall(id, true);
    // Seeded calm length: the alarm sounds 20-30 s in (a retry replays the same timing).
    const rng = new Rng(world.seed, 'l2-story');
    this.s.alarmAt = world.tick + ticks(l2.calm.alarmAtS[0] + rng.next() * (l2.calm.alarmAtS[1] - l2.calm.alarmAtS[0]));
    this.mission.radio('L2.briefing');
  }

  // ---------------------------------------------------------------------------------------------------------- setup
  private spawnTruck(): void {
    const v = this.world.vehicles!, a = this.anchor('l2-truck'), id = v.spawn('vehicle.fire-engine', a, Math.PI / 2);
    this.s.truckId = id; this.kinematic();
    this.parkNav(true);
  }
  /** The truck is a ride, never a drivable car: kinematic body, doors inert. */
  private kinematic(): void {
    const car = this.world.vehicles!.cars.get(this.s.truckId); if (!car) return;
    car.physics.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    (car as { noEnterUntil: number }).noEnterUntil = Number.MAX_SAFE_INTEGER;
  }
  private parkNav(blocked: boolean): void {
    const car = this.world.vehicles!.cars.get(this.s.truckId); if (!car) return;
    const p = car.entity.transform, d = car.physics.def, c = Math.abs(Math.cos(p.yaw)), s = Math.abs(Math.sin(p.yaw));
    this.world.events.emit({ type: 'world.blocker.changed', tick: this.world.tick, id: NAV_TRUCK, blocked, wall: { x: p.x, z: p.z, y: .7, halfX: (c * d.length + s * d.width) / 2, halfY: .7, halfZ: (s * d.length + c * d.width) / 2 } });
  }
  private schedule(at: Point, facing: Point, kind: CivilianActivity['activity'] = 'look', seat?: Point): CivilianActivity[] {
    return [{ activity: kind, anchor: 'l2/station', target: at, facing, ticks: 60 * 60, ...(seat ? { seat } : {}) }];
  }
  private spawnStation(): void {
    const o = this.outbreak(), truck = this.anchor('l2-truck');
    // Six named firefighters: checking gear, washing the truck, eating, chatting. Allies, not protected.
    const looks: Point[] = [{ x: -70.6, z: 47.6 }, { x: -72.4, z: 47.6 }, { x: -73.6, z: 42 }, { x: -74.6, z: 42.4 }, truck, truck];
    for (let i = 1; i <= 6; i++) {
      const p = this.snap(this.anchor(`l2-crew-${i}`));
      const id = o.spawnPedestrian(p, { role: 'firefighter', model: 'npc.firefighter-alive', tint: ['#c4473d', '#d4ad32', '#c4473d', '#2f4858', '#d4ad32', '#c4473d'][i - 1], tier: 'average', schedule: this.schedule(p, looks[i - 1], i === 3 || i === 4 ? 'chat' : i === 5 ? 'water' : 'look') });
      const e = this.world.entities.get(id)!; e.civilian!.ally = allyState('firefighter');
      e.health = { current: l2.allies.firefighter.hp, max: l2.allies.firefighter.hp };
      this.s.crewIds.push(id);
    }
    // Three to five frightened, lightly injured civilians on the benches.
    for (let i = 1; i <= l2.calm.civiliansOnBenches; i++) {
      const bench = this.anchor(`l2-bench-${Math.min(3, i)}`), seat = { x: bench.x, z: bench.z + (i === 4 ? 1.2 : 0) }, p = this.snap(seat, .35);
      const id = o.spawnPedestrian(p, { tier: 'frail', schedule: this.schedule(p, { x: -72.3, z: p.z }, 'sit', seat) });
      this.s.benchIds.push(id);
    }
  }
  private spawnCheckpoint(): void {
    const o = this.outbreak();
    // Behind the line, back from the gate: out of sight (> 16 m) of the cluster's block, close enough to cover the gate.
    const posts: Point[] = [{ x: 79.4, z: 27.4 }, { x: 79.4, z: 32.8 }, { x: 80.6, z: 29.2 }, { x: 80.6, z: 31.2 }];
    for (const post of posts.slice(0, l2.checkpoint.officers)) {
      const p = this.snap(post, .35);
      const id = o.spawnPedestrian(p, { role: 'officer', model: 'npc.police-officer', tint: '#2f4858', tier: 'average', schedule: [{ activity: 'look', anchor: 'l2/post', target: p, facing: { x: 60, z: 30 }, ticks: 60 * 60 }] });
      const e = this.world.entities.get(id)!; e.civilian!.ally = allyState('officer', p, true); e.transform.yaw = Math.PI;
      this.s.officerIds.push(id);
    }
    const line: Point[] = [{ x: 82.2, z: 28.6 }, { x: 82.6, z: 30.6 }, { x: 83.2, z: 27.4 }, { x: 84, z: 29.6 }, { x: 83.4, z: 31.8 }, { x: 84.2, z: 33.2 }, { x: 82.2, z: 33 }, { x: 84.4, z: 27.8 }];
    for (const at of line.slice(0, l2.checkpoint.civilians)) {
      const p = this.snap(at, .35);
      this.s.lineIds.push(o.spawnPedestrian(p, { schedule: [{ activity: 'look', anchor: 'l2/line', target: p, facing: { x: 95, z: 30 }, ticks: 60 * 60 }] }));
    }
  }
  /** W1 dead bystanders: pedestrians already finished when L2 starts (lying in the crowd's death pose, never targets). */
  private spawnCorpses(): void {
    const o = this.outbreak();
    for (const d of l2Dressing) if (d.entity && d.kind === 'corpse') {
      const p = this.snap({ x: d.x, z: d.z }, .35), id = o.spawnPedestrian(p, { model: d.assetId, yaw: d.yaw, schedule: this.schedule(p, p) }), e = this.world.entities.get(id)!;
      e.civilian!.state = 'finished'; e.civilian!.entered = this.world.tick - 600; e.appearance!.handProp = null;
    }
  }
  /** Trapped civilians wait inside the market (hidden), released through both doors after the crew forces them. */
  private spawnTrapped(count: number): number[] {
    const o = this.outbreak(), ids: number[] = [], out = this.snap({ x: -49.6, z: -42.2 });
    for (let i = 0; i < count; i++) {
      const glass = l2.rescue.atGlass[i];
      // Children wear an adult look scaled down by the crowd (never the elderly model); they are never targets (E08 rule).
      const id = o.spawnPedestrian(out, { schedule: this.schedule(out, { x: -44, z: -36 }), ...(glass?.[3] === 'child' ? { model: i % 2 ? 'npc.civilian-woman-b' : 'npc.civilian-man-b' } : {}) });
      const e = this.world.entities.get(id)!;
      e.civilian!.pauseUntil = Number.MAX_SAFE_INTEGER; ids.push(id);
      // The first sixteen panic behind the east and south glass, each on its own loop; the rest wait out of sight inside.
      if (glass) {
        Object.assign(e.transform, { x: glass[0], z: glass[1], yaw: glass[2] }); this.world.spatial.set(id, glass[0], glass[1]);
        if (glass[3] === 'child') e.civilian!.adult = false;
        e.civilian!.story = { clip: this.glassClip(glass[3], i, this.world.tick), start: this.world.tick - (i * 23) % 50 };
        continue;
      }
      e.hidden = true; e.transform.x = -55.6 + (i % 5 - 2) * 1.2; e.transform.z = -42.2 + (Math.floor(i / 5) % 6 - 2.5) * 1.1;
      this.world.spatial.delete(id);
    }
    return ids;
  }
  /** Static collider + navigation blocker; recreated from state on checkpoint restore. */
  private wall(id: string, blocked: boolean): void {
    const handle = this.walls.get(id), w = WALLS[id], key = 900_300 + Object.keys(WALLS).indexOf(id);
    if (blocked && handle === undefined) { this.walls.set(id, this.world.physics.addBlocker(w)); this.world.events.emit({ type: 'world.blocker.changed', tick: this.world.tick, id: key, blocked: true, wall: w }); }
    if (!blocked && handle !== undefined) { this.world.physics.removeBlocker(handle); this.walls.delete(id); this.world.events.emit({ type: 'world.blocker.changed', tick: this.world.tick, id: key, blocked: false, wall: w }); }
  }

  // ---------------------------------------------------------------------------------------------------------- beats
  /** Called by the mission when an objective completes (before its onComplete actions). */
  completed(id: string): void {
    if (!this.mission.state.l2) return;
    if (id === 'calm' && this.s.phase === 'calm') this.alarm();
    if (id === 'board') this.board();
    if (id === 'axe') this.takeAxe();
    if (id === 'ride' && (this.s.phase === 'ride' || this.s.phase === 'alarm')) {
      for (const c of this.s.crewIds) { const e = this.world.entities.get(c); if (e) { e.hidden = true; this.world.spatial.delete(c); } }
      if (!this.s.seated) this.board();
      this.s.phase = 'ride'; this.s.departAt ||= this.world.tick; this.s.rideS = this.routeInfo().length; this.ride();
    }
    if (id === 'doors' && !this.s.doorsOpenAt) this.openDoors();
  }
  private alarm(): void {
    const { world } = this.mission, tick = world.tick;
    // A few people still out on the streets, trying to get somewhere (civilians only: the town has no infected yet).
    for (const [x, z] of l2.escape.civilians) { const p = this.snap({ x, z }, .4); this.outbreak().spawnPedestrian(p, { waypoints: [p, this.snap({ x: x + 6, z }, .4)] }); }
    this.s.phase = 'alarm'; this.s.alarmAt = tick;
    world.events.emit({ type: 'l2.alarm', tick });
    if (!this.mission.state.states.alarm) this.mission.setState('alarm', true);
    this.mission.radio('L2.call');
    // The crew drops everything and runs to the truck (within 2 s), then boards.
    for (const [i, id] of this.s.crewIds.entries()) {
      const e = world.entities.get(id), a = e?.civilian?.ally; if (!a) continue;
      e!.civilian!.story = null; a.run = this.seat(i); a.runSpeed = l2.calm.crewRunMs;
    }
  }
  /** Boarding points along the camera-facing (+x) flank (crew) and the crew door (player): the boarding reads from the screen side. */
  private seat(i: number): Point {
    const t = this.world.entities.get(this.s.truckId)!.transform, side = 1, along = -2.4 + i * .95;
    return this.snap({ x: t.x + Math.cos(t.yaw) * along + Math.sin(t.yaw) * side * 1.7, z: t.z - Math.sin(t.yaw) * along + Math.cos(t.yaw) * side * 1.7 }, .35);
  }
  private takeAxe(): void {
    const combat = this.world.combat; if (!combat || this.s.axe) return;
    this.s.axe = true;
    const left = combat.runner.loadout.state.LEFT.rack.map(s => s.id).filter(id => id !== 'weapon.fire-axe' && id !== 'weapon.kick');
    const right = combat.runner.loadout.state.RIGHT.rack.map(s => s.id);
    combat.setLoadout(['weapon.fire-axe', ...left].slice(0, Math.max(2, combat.rackCapacity)), right);
    combat.runner.loadout.state.selectedSide = 'LEFT';
    this.world.events.emit({ type: 'pickup.collected', tick: this.world.tick, sourceId: 1, pickupId: 0, side: 'LEFT', actionId: 'weapon.fire-axe', replaced: null });
  }
  private board(): void {
    const { world } = this.mission, player = world.entities.get(1)!, tick = world.tick;
    if (this.s.seated || this.s.phase !== 'alarm') return;
    this.s.seated = true; player.hidden = true; world.physics.playerCollider!.setEnabled(false); world.player!.locomotion.reset();
    world.storyLock = { scripted: null, skip: false };
    world.events.emit({ type: 'vehicle.entered', tick, sourceId: this.s.truckId, targetId: 1, role: 'passenger' });
    if (this.mission.state.steps.axe.status === 'active') this.mission.state.steps.axe.status = 'cancelled';
  }
  private routeInfo() {
    if (!this.route) {
      const pts = l2TruckRoute.map(([x, z]) => ({ x, z })), cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
      this.route = { pts, cum, length: cum.at(-1)! };
    }
    return this.route;
  }
  /** Kinematic ride along the authored route: accelerate, slow for corners, brake to the forecourt. */
  private ride(): void {
    const { world } = this.mission, r = this.routeInfo(), s = this.s, car = world.vehicles!.cars.get(s.truckId);
    if (!car) return;
    let k = 1; while (k < r.pts.length - 1 && r.cum[k] < s.rideS) k++;
    const toCorner = k < r.pts.length - 1 ? r.cum[k] - s.rideS : Infinity, left = r.length - s.rideS;
    const target = Math.min(l2.ride.cruiseMs, Math.sqrt(2 * l2.ride.accelMs2 * Math.max(0, left)) + .3, toCorner < 7 ? l2.ride.cornerMs + toCorner * .6 : Infinity);
    s.rideV += Math.max(-l2.ride.accelMs2 * 1.6 / TICKS, Math.min(l2.ride.accelMs2 / TICKS, target - s.rideV));
    s.rideS = Math.min(r.length, s.rideS + Math.max(.02, s.rideV) / TICKS);
    k = 1; while (k < r.pts.length - 1 && r.cum[k] < s.rideS) k++;
    const a = r.pts[k - 1], b = r.pts[k], f = (s.rideS - r.cum[k - 1]) / Math.max(1e-6, r.cum[k] - r.cum[k - 1]);
    const x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f, want = -Math.atan2(b.z - a.z, b.x - a.x);
    const yaw0 = car.entity.transform.yaw, delta = Math.atan2(Math.sin(want - yaw0), Math.cos(want - yaw0)), yaw = yaw0 + Math.max(-.045, Math.min(.045, delta));
    const y = car.physics.body.translation().y;
    car.physics.body.setNextKinematicTranslation({ x, y, z }); car.physics.body.setNextKinematicRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
    car.entity.transform.x = x; car.entity.transform.z = z; car.entity.transform.yaw = yaw; car.entity.vehicle!.speed = s.rideV;
    this.carry(x, z);
    if (s.rideS >= r.length - 1e-6) this.arrive();
  }
  /** Seated player, crew and corgi ride with the truck (hidden, no input). */
  private carry(x: number, z: number): void {
    const { world } = this.mission, player = world.entities.get(1)!;
    if (this.s.seated) {
      player.transform.x = x; player.transform.z = z; world.physics.playerBody!.setTranslation(player.transform, true); world.physics.playerBody!.setNextKinematicTranslation(player.transform);
      Object.assign(world.previousPlayer!, player.transform); world.spatial.set(1, x, z);
    }
    for (const e of world.entities.iterate()) if (e.companion || (e.hidden && this.s.crewIds.includes(e.id))) { e.hidden = true; e.transform.x = x; e.transform.z = z; world.spatial.delete(e.id); }
  }
  private arrive(): void {
    const { world } = this.mission, tick = world.tick, s = this.s;
    s.phase = 'arrived'; s.arrivedAt = tick; s.rideV = 0;
    world.events.emit({ type: 'l2.truckArrived', tick });
    this.parkNav(true);
    // Everyone out: the player at the crew door (control back at once), the corgi, the crew on both flanks.
    const t = world.entities.get(s.truckId)!.transform, player = world.entities.get(1)!;
    const side = (lx: number, lz: number) => this.snap({ x: t.x + Math.cos(t.yaw) * lx + Math.sin(t.yaw) * lz, z: t.z - Math.sin(t.yaw) * lx + Math.cos(t.yaw) * lz }, .45);
    const out = side(.6, 1.9);
    Object.assign(player.transform, { x: out.x, z: out.z }); player.hidden = false; s.seated = false;
    world.physics.playerBody!.setTranslation(player.transform, true); world.physics.playerBody!.setNextKinematicTranslation(player.transform); world.physics.playerCollider!.setEnabled(true);
    world.player!.locomotion.reset(); Object.assign(world.previousPlayer!, player.transform); world.spatial.set(1, out.x, out.z); world.player!.setCheckpoint(player.transform);
    world.storyLock = null; world.clearInput();
    world.events.emit({ type: 'vehicle.exited', tick, sourceId: s.truckId, targetId: 1, role: 'passenger' });
    for (const e of world.entities.iterate()) if (e.companion) { e.hidden = false; const p = side(-1.6, 2.2); Object.assign(e.transform, p); world.spatial.set(e.id, p.x, p.z); }
    if (!this.mission.state.states.arrived) this.mission.setState('arrived', true);
  }
  private crewExit(): void {
    const { world } = this.mission, tick = world.tick, s = this.s, t = world.entities.get(s.truckId)!.transform;
    s.crewExitAt = tick;
    for (const [i, id] of s.crewIds.entries()) {
      const e = world.entities.get(id); if (!e?.civilian?.ally) continue;
      const lx = 2.8 - i * 1.15, lz = 1.9 + (i % 2) * .9, p = this.snap({ x: t.x + Math.cos(t.yaw) * lx + Math.sin(t.yaw) * lz, z: t.z - Math.sin(t.yaw) * lx + Math.cos(t.yaw) * lz }, .35);
      e.hidden = false; Object.assign(e.transform, p); world.spatial.set(id, p.x, p.z);
      // Three to the chained front doors, three to the loading door: an urgent run, not a jog.
      const [x, z] = l2.rescue.crewDoors[i];
      e.civilian!.ally.run = this.snap({ x, z }, .35); e.civilian!.ally.runSpeed = l2.rescue.crewRunMs; e.civilian!.pauseUntil = 0;
    }
    world.events.emit({ type: 'l2.crewExit', tick });
  }
  private openDoors(): void {
    const { world } = this.mission, tick = world.tick, s = this.s;
    s.phase = 'collapse'; s.doorsOpenAt = tick;
    for (const id of ['door-front', 'door-loading']) this.wall(id, false);
    this.clearLurkers(); s.say = null;
    for (const door of ['l2-door-front', 'l2-door-loading']) this.cue('prop.break', this.anchor(door), 1);
    world.events.emit({ type: 'gate.changed', tick, id: 'l2-door-front', open: true });
    world.events.emit({ type: 'gate.changed', tick, id: 'l2-door-loading', open: true });
    world.events.emit({ type: 'l2.doorsOpen', tick });
    this.mission.radio('L2.doors');
    world.toys?.armAlarms();
    // The crew turns into fighters: engage whatever they see, regroup at the forecourt.
    for (const id of s.crewIds) { const a = world.entities.get(id)?.civilian?.ally; if (a) { a.engaged = true; a.run = null; a.forceUntil = 0; a.post = { ...this.anchor('l2-forecourt') }; a.runSpeed = l2.allies.firefighter.moveMs; } }
    // The ambush, keyed to this exact moment: ten infected from three building doors, >= 60 degrees apart.
    let k = 0;
    const scale = this.world.infected!.director.tier === 'low' ? l2.escape.lowScale : 1;
    for (const [door, count] of l2.rescue.ambushDoors) for (let i = 0; i < Math.ceil(count * scale); i++) s.ambush.push({ id: 0, door, at: tick + ticks(.05 + i * .45 + (k++ % 3) * .1) });
    this.emergeAmbush(tick);
    if (!this.mission.state.states['doors-open']) this.mission.setState('doors-open', true);
    this.mission.requestCheckpoint('doors');
  }
  private emergeAmbush(tick: number): void {
    const s = this.s;
    for (const a of s.ambush) if (!a.id && tick >= a.at) {
      // Each street runs at the exit nearest to it (the crowd streaming out), not at the courier.
      const [x, z] = l2.rescue.ambushRush[a.door] ?? [-46.5, -38], id = this.emerge(a.door, { x, z });
      a.id = id || -1; if (id) s.ambushIds.push(id);
    }
  }
  /**
   * An infected comes out of a building door: a pedestrian turned in place (same pipeline as L1), stumbling out two metres
   * and joining the ordinary AI toward `toward` (an event position, never a tracked target). Returns the id or 0 at the cap.
   */
  private emerge(door: string, toward: Point, home?: Point): number {
    const { world } = this.mission, ai = world.infected!, o = this.outbreak(), a = this.anchor(door);
    if (!a || ai.director.count >= ai.director.cap || !ai.pool.length) return 0;
    const out = this.snap({ x: a.x, z: a.z }, .45);
    const id = o.spawnPedestrian(out), e = world.entities.get(id)!;
    o.turnNow(e);
    if (!e.infected) return 0;
    if (e.combat) e.combat.staggerUntil = world.tick + 30;
    world.events.emit({ type: 'gate.changed', tick: world.tick, id: door.replace('refuge-door-', 'door-'), open: true });
    const brain = e.infected.l1;
    // Street population: home + leash only (no rush, which would start the panic flow). The ambush runs at the forecourt.
    if (brain && home) { brain.homeX = home.x; brain.homeZ = home.z; brain.leashM = l2.escape.leashM; }
    else ai.rush(id, toward, world.tick + ticks(12));
    return id;
  }
  /** Escape population and the bridge cluster: planned at the alarm, each member emerges once its door is out of view. */
  private spawnEscape(): void {
    const s = this.s, doors = Object.keys(this.mission.def.anchors).filter(n => n.startsWith('refuge-door-'));
    const forecourt = this.anchor('l2-forecourt'), market = this.anchor('l2-door-front');
    const near = (home: Point) => doors.map(d => ({ d, a: this.anchor(d) })).filter(({ a }) => Math.hypot(a.x - forecourt.x, a.z - forecourt.z) >= 42 && Math.hypot(a.x - market.x, a.z - market.z) >= 42)
      .sort((p, q) => Math.hypot(p.a.x - home.x, p.a.z - home.z) - Math.hypot(q.a.x - home.x, q.a.z - home.z));
    const scale = this.world.infected!.director.tier === 'low' ? l2.escape.lowScale : 1;
    // The bridge cluster first: under the shared cap it must exist before the looser street groups.
    const [cx, cz] = l2.cluster.home, home = { x: cx, z: cz }, list = near(home).slice(0, 4);
    for (let i = 0; i < Math.ceil(l2.cluster.count * scale); i++) s.pending.push({ id: -2, door: list[i % list.length].d, at: 0, home });
    for (const [x, z, size] of l2.escape.groups) {
      const home = { x, z }, list = near(home).slice(0, 2);
      for (let i = 0; i < Math.ceil(size * scale); i++) s.pending.push({ id: 0, door: list[i % list.length].d, at: 0, home });
    }
    s.escapeSpawned = true; this.emergePending(true);
  }
  private emergePending(all = false): void {
    const { world } = this.mission, s = this.s, ai = world.infected!, p = world.entities.get(1)!.transform;
    if (!all && world.tick % 10 !== 0) return;
    let spawned = 0;
    for (const q of s.pending as Pending[]) {
      if (q.id > 0 || q.id === -1 || (!all && spawned >= 2)) continue;
      const a = this.anchor(q.door);
      if (!ai.director.offscreen(a) || Math.hypot(a.x - p.x, a.z - p.z) < 25) continue;
      const cluster = q.id === -2, id = this.emerge(q.door, q.home, q.home);
      if (!id) { if (ai.director.count >= ai.director.cap) break; continue; }
      const e = world.entities.get(id)!; q.id = id; q.at = world.tick; q.x = e.transform.x; q.z = e.transform.z; q.seen = !ai.director.offscreen(e.transform); spawned++;
      (cluster ? s.clusterIds : s.escapeIds).push(id);
    }
  }

  // ---------------------------------------------------------------------------------------------------------- tick
  update(): void {
    const { world, state } = this.mission, s = state.l2; if (!s) return;
    const tick = world.tick, player = world.entities.get(1)!;
    if (s.phase === 'calm') {
      if (tick === s.alarmAt - ticks(14)) this.mission.radio('L2.captain');
      if (tick >= s.alarmAt) this.mission.setState('alarm', true);
      return;
    }
    if (s.phase === 'alarm') {
      // The firefighter points at the optional axe a few seconds after the call, while it is still on the wall.
      if (tick === s.alarmAt + ticks(5.2) && !s.axe && this.mission.state.steps.axe.status === 'active') this.mission.radio('L2.axe');
      for (const id of s.crewIds) {
        const e = world.entities.get(id), a = e?.civilian?.ally; if (!e || !a || e.hidden) continue;
        if (!a.run) { e.hidden = true; world.spatial.delete(id); }
      }
      const crewIn = s.crewIds.every(id => world.entities.get(id)?.hidden !== false);
      if (s.seated && (crewIn || tick - s.alarmAt > ticks(l2.calm.crewToTruckMaxS + 6))) {
        for (const id of s.crewIds) { const e = world.entities.get(id); if (e) { e.hidden = true; world.spatial.delete(id); } }
        s.phase = 'ride'; s.departAt = tick; this.parkNav(false); world.events.emit({ type: 'l2.truckDeparted', tick });
      }
      if (s.seated) this.carry(world.entities.get(s.truckId)!.transform.x, world.entities.get(s.truckId)!.transform.z);
    }
    if (s.phase === 'ride') this.ride();
    if (s.escapeSpawned) this.emergePending();
    if (s.phase === 'arrived') {
      if (!s.crewExitAt && tick - s.arrivedAt >= ticks(.8)) this.crewExit();
      if (s.crewExitAt && !s.atDoorsAt) {
        const crew = s.crewIds.map(id => world.entities.get(id)).filter((e): e is EntitySnapshot => !!e?.civilian?.ally);
        if (crew.every(e => !e.civilian!.ally!.run || Math.hypot(e.civilian!.ally!.run.x - e.transform.x, e.civilian!.ally!.run.z - e.transform.z) < 1.5) || tick - s.crewExitAt > ticks(8)) {
          s.atDoorsAt = tick; s.phase = 'doors'; world.events.emit({ type: 'l2.firefightersAtDoors', tick });
          for (const e of crew) {
            const a = e.civilian!.ally!, role = l2.rescue.crewDoors[s.crewIds.indexOf(e.id)]?.[2];
            a.forceUntil = tick + ticks(l2.rescue.forceDoorsS); a.run = null; a.forceClip = role === 'direct' ? 'npc-stand-back' : undefined;
            e.transform.yaw = e.transform.x > -52 ? Math.PI : Math.PI / 2;
          }
        }
      }
    }
    if (!s.doorsOpenAt) this.trappedPanic(tick);
    if (s.phase === 'doors' && tick - s.atDoorsAt >= ticks(l2.rescue.forceDoorsS)) this.openDoors();
    if (s.trips?.length) this.tripsUpdate(tick);
    if (s.flee?.length) for (const f of s.flee) if (f.at === tick) { const e = this.world.entities.get(f.id); if (e) this.outbreak().panic(e, this.anchor('l2-door-front')); }
    if (s.doorsOpenAt) {
      this.emergeAmbush(tick);
      this.release(tick);
      const door = this.anchor('l2-door-front'), away = Math.hypot(player.transform.x - door.x, player.transform.z - door.z) >= l2.rescue.radioAwayM;
      // The street population exists once the courier breaks away or the fall-back call goes out (+45 s): the outbreak is
      // already in the streets, whatever happens at the doors. Under the shared cap it waits for free slots.
      if (!s.escapeSpawned && (away || s.radioAt)) this.spawnEscape();
      if (!s.radioAt) {
        if (tick - s.doorsOpenAt >= ticks(l2.rescue.radioAfterS) || away) {
          s.radioAt = tick; s.phase = 'escape'; world.events.emit({ type: 'l2.radio', tick }); this.mission.radio('L2.radio');
          this.mission.setState('radio', true); this.mission.requestCheckpoint('escape');
        }
      }
    }
    if (s.radioAt && !s.clusterReached) {
      const [cx, cz] = l2.cluster.home;
      if (Math.hypot(player.transform.x - cx, player.transform.z - cz) <= l2.cluster.triggerM) { s.clusterReached = true; this.mission.requestCheckpoint('cluster'); }
    }
    this.checkpointGate(tick, player);
    // L2 infected (turned adults in the open) hit harder than L1's first, disoriented victims (section 5.1 tuning).
    if (tick % 15 === 0) for (const e of world.infected!.active) if (e.combat && e.health.current > 0 && e.combat.damageMultiplier === 1) e.combat.damageMultiplier = l2.infectedDamage;
    // Officers cover the courier's approach (they hold fire otherwise) and wave them in while nothing threatens the line.
    const gate = this.anchor('l2-gate'), cover = s.gateClosedAt > 0 || Math.hypot(player.transform.x - gate.x, player.transform.z - gate.z) <= l2.checkpoint.coverM;
    // Always: anything at the line itself. Covering: the whole 15 m in front of the gate.
    for (const id of s.officerIds) { const a = world.entities.get(id)?.civilian?.ally; if (a) { a.engaged = true; a.range = cover ? l2.checkpoint.shootM : 6; } }
    if (s.radioAt && !s.gateClosedAt) for (const id of s.officerIds) {
      const e = world.entities.get(id), c = e?.civilian; if (!c?.ally || c.ally.targetId) continue;
      const near = Math.hypot(player.transform.x - e!.transform.x, player.transform.z - e!.transform.z) < 30;
      if (near && c.story?.clip !== 'npc-wave-in') c.story = { clip: 'npc-wave-in', start: tick }; else if (!near && c.story) c.story = null;
    }
  }
  /**
   * Trapped civilians burst out through both doors over ~11 s, starting the tick the doors open: they run (their own flee
   * speed) in a fan away from their door, on to a farther point, then turn and look back at the shop until something
   * frightens them. Every `tripEvery`-th one trips after a few metres; the next person out of that door stops to help.
   */
  private release(tick: number): void {
    const s = this.s, total = s.trappedIds.length, r = l2.rescue;
    if (s.released >= total) return;
    // `released` counts people through the doors; those at the glass were already visible.
    const due = Math.min(total, 1 + Math.floor((tick - s.doorsOpenAt) / (ticks(r.releaseOverS) / total)));
    for (; s.released < due; s.released++) {
      const i = s.released, id = s.trappedIds[i], e = this.world.entities.get(id); if (!e?.civilian) continue;
      const front = i % 2 === 0, k = Math.floor(i / 2) % 5;
      const at = this.snap(front ? { x: -50.4, z: -44 + k * .9 } : { x: -57.4 + k * .9, z: -36.8 }, .35);
      Object.assign(e.transform, at); e.transform.yaw = front ? 0 : -Math.PI / 2; e.hidden = false; this.world.spatial.set(id, at.x, at.z);
      const c = e.civilian; c.pauseUntil = tick; c.scheduleStep = 0; c.activityUntil = 0; c.story = null;
      if (c.l1) c.l1.walkSpeed = c.l1.fleeSpeed * (.85 + hash(id * 3 + this.world.seed) * .15);
      // A fan away from the door (front: east, loading: south), each person its own heading and distance.
      const heading = (front ? 0 : Math.PI / 2) + ((i * .618 + hash(id + this.world.seed * 31)) % 1 * 2 - 1) * r.burstSpreadDeg * DEG;
      const d1 = r.burstM[0] + hash(id * 5) * (r.burstM[1] - r.burstM[0]), burst = this.snap({ x: at.x + Math.cos(heading) * d1, z: at.z + Math.sin(heading) * d1 }, .35);
      const look = r.lookBackS[0] + hash(id * 7) * (r.lookBackS[1] - r.lookBackS[0]);
      c.schedule = [{ activity: 'walk', anchor: 'l2/out', target: burst, ticks: 1 }, { activity: 'look', anchor: 'l2/out', target: burst, facing: this.anchor('l2-door-front'), ticks: ticks(look + 30) }];
      // Then the checkpoint, along one of three streets (by street logic, not by knowing where the infected are).
      const route = r.fleeRoutes[(i + Math.floor(hash(id * 13 + this.world.seed) * 3)) % r.fleeRoutes.length].map(([x, z]) => ({ x, z }));
      const hb = r.havenBehind, haven = this.snap({ x: hb.x[0] + hash(id * 17) * (hb.x[1] - hb.x[0]), z: hb.z[0] + hash(id * 19) * (hb.z[1] - hb.z[0]) }, .35);
      if (c.l1) c.l1.haven = { route, leg: 0, ...haven };
      (s.flee ??= []).push({ id, at: tick + ticks(d1 / Math.max(1, c.l1?.walkSpeed ?? 3) + .4 + look) + (i % r.tripEvery === 3 ? ticks(1.5) : 0) });
      if (i % r.tripEvery === 3) (s.trips ??= []).push({ id, at: tick + ticks(.55 + hash(id * 11) * .35), helper: s.trappedIds[i + 2] ?? 0 });
    }
  }
  /** Tripped: down (knockdown) for half a second, back up, running on; the helper runs over and waves them up. */
  private tripsUpdate(tick: number): void {
    const s = this.s, trips = s.trips!;
    for (const t of trips) {
      const e = this.world.entities.get(t.id), c = e?.civilian; if (!c || c.state !== 'calm') continue;
      const helper = this.world.entities.get(t.helper)?.civilian;
      if (tick === t.at) {
        c.pauseUntil = tick + ticks(1.5); c.story = { clip: 'knockdown', start: tick };
        this.cue('l1.chaos.fall', e!.transform, .8);
        const h = this.world.entities.get(t.helper);
        if (h && helper?.state === 'calm' && !h.hidden && Math.hypot(h.transform.x - e!.transform.x, h.transform.z - e!.transform.z) < 9) {
          const side = this.snap({ x: e!.transform.x + .8, z: e!.transform.z + .5 }, .35);
          helper.schedule = [{ activity: 'look', anchor: 'l2/help', target: side, facing: { x: e!.transform.x, z: e!.transform.z }, ticks: ticks(1) }, ...(helper.schedule ?? []).slice(-2)];
          helper.scheduleStep = 0; helper.activityUntil = 0; helper.pauseUntil = tick; helper.story = { clip: 'npc-wave-in', start: tick };
        }
      }
      if (tick === t.at + ticks(.5)) c.story = { clip: 'get-up', start: tick };
      if (tick === t.at + ticks(1.5)) { c.story = null; if (helper?.story?.clip === 'npc-wave-in') helper.story = null; }
    }
  }
  // ------------------------------------------------------------------------------------------------- rescue presentation
  /** Behaviour of a trapped person at the glass this tick: a seeded loop per person, more frantic once the truck is there. */
  private glassClip(role: GlassRole, i: number, tick: number): string {
    const h = hash(i * 7 + 1 + this.world.seed * 131), period = ticks(3.2 + h * 2.6), t = (tick + Math.floor(h * period)) % period;
    const urgent = !!this.mission.state.l2?.arrivedAt, glance = t > period - ticks(1.25);
    switch (role) {
      case 'bang': return glance ? 'npc-glance' : urgent || t < period / 2 ? 'npc-bang' : 'npc-press';
      case 'press': return glance ? 'npc-glance' : urgent && t < period * .4 ? 'npc-bang' : 'npc-press';
      case 'plead': return glance ? 'npc-glance' : 'npc-plead';
      case 'look': return urgent && t < period * .45 ? 'npc-plead' : 'npc-glance';
      case 'hug': return 'npc-hug';
      default: return 'npc-cower';
    }
  }
  /** Audio-only set-piece sound at a world point (existing licensed banks; `lowpass` muffles it behind the glass). */
  private cue(cue: string, at: Point, gain?: number, lowpass?: number): void {
    this.world.events.emit({ type: 'l2.cue', tick: this.world.tick, cue, position: { x: at.x, z: at.z }, ...(gain === undefined ? {} : { gain }), ...(lowpass === undefined ? {} : { lowpass }) });
  }
  private say(id: number, text: string, seconds = 1.9): void {
    const e = this.world.entities.get(id), tick = this.world.tick; if (!e || e.hidden) return;
    this.s.say = { id, text, at: tick, until: tick + ticks(seconds) };
    this.world.events.emit({ type: 'story.say', tick, id, text, position: { x: e.transform.x, z: e.transform.z } });
  }
  private clearLurkers(): void {
    for (const id of this.s.lurkers ?? []) { this.world.spatial.delete(id); this.world.entities.delete(id); }
    this.s.lurkers = [];
  }
  /**
   * Until the doors open (PO 10-08 "there is no emergency"): the people behind the glass panic on desynced loops, muffled
   * banging and screams come through the glass, the crew shouts and heaves on the chains, the radio crackles, and the town
   * gets louder around the forecourt: distant screams, a car alarm, a snarl, figures crossing a far street end that vanish.
   */
  private trappedPanic(tick: number): void {
    const s = this.s, r = l2.rescue, glassN = Math.min(r.atGlass.length, s.trappedIds.length);
    if (tick % 6 === 0) for (let i = 0; i < glassN; i++) {
      const c = this.world.entities.get(s.trappedIds[i])?.civilian; if (!c) continue;
      const clip = this.glassClip(r.atGlass[i][3], i, tick);
      if (c.story?.clip !== clip) c.story = { clip, start: tick - (i * 23) % 50 };
    }
    if (!s.arrivedAt) return;
    const market = this.anchor('l2-market'), since = (at: number, sec: number) => at > 0 && tick === at + ticks(sec);
    // Behind the glass: fists on the panes, screams and a crowd in panic, muffled.
    const bangers = r.atGlass.slice(0, glassN).flatMap(([x, z, , role]) => role === 'bang' || role === 'press' ? [{ x, z }] : []);
    if (bangers.length && hash(tick * 3 + 1) < .055) this.cue('l1.glass.rattle', bangers[Math.floor(hash(tick) * bangers.length)], .55, 2400);
    if (hash(tick * 5 + 2) < .009) this.cue('l1.scream', market, .4, 1300);
    if ((tick - s.arrivedAt) % ticks(1.6) === 0) this.cue('l1.chaos.distant', market, .55, 900);
    if (since(s.arrivedAt, 1.4)) this.mission.radio('L2.dispatch');
    for (const [anchor, sec, who, index, text] of SHOUTS) {
      const at = anchor === 'arrived' ? s.arrivedAt : anchor === 'exit' ? s.crewExitAt : s.atDoorsAt;
      if (since(at, sec)) this.say(who === 'crew' ? s.crewIds[index] : s.trappedIds[index], text);
    }
    if (s.phase !== 'doors') return;
    // The forcing: metal on metal and the chain creaking at both doors, the crew grunting on each heave.
    const pryers = s.crewIds.map(id => this.world.entities.get(id)).filter((e): e is EntitySnapshot => e?.civilian?.story?.clip === 'ff-pry');
    for (const [k, e] of pryers.entries()) {
      const beat = (tick - s.atDoorsAt + k * 13) % ticks(.9);
      if (beat === 0) this.cue(k % 2 ? 'prop.creak' : 'impact.body.metal', e.transform, .6);
      if (beat === 20 && k % 2 === 0) this.cue('bark.male.effort', e.transform, .45);
    }
    // Danger rising during the 4 s: only sounds and far figures (nothing hunts the courier before the doors open).
    const d = r.danger;
    for (const [sec, x, z] of d.screams) if (since(s.atDoorsAt, sec)) this.cue('ambient.scream', { x, z }, 1);
    for (let b = 0; b < d.carAlarm.beeps; b++) if (since(s.atDoorsAt, d.carAlarm.atS + b * d.carAlarm.everyS)) this.cue('l1.chaos.car-alarm', d.carAlarm, .9);
    if (since(s.atDoorsAt, d.snarl.atS)) this.cue('l1.chaos.infected', d.snarl, .7);
    for (const [sec, x0, z0, x1, z1] of d.lurkers) if (since(s.atDoorsAt, sec)) {
      const from = this.snap({ x: x0, z: z0 }, .4), to = this.snap({ x: x1, z: z1 }, .4);
      const id = this.outbreak().spawnPedestrian(from, { walkSpeed: 1.05, yaw: -Math.atan2(to.z - from.z, to.x - from.x), schedule: [{ activity: 'walk', anchor: 'l2/lurk', target: to, ticks: 1 }, { activity: 'inside', anchor: 'l2/lurk', target: to, ticks: ticks(60) }] });
      const e = this.world.entities.get(id)!, c = e.civilian!;
      c.pauseUntil = tick; c.veins = .9; c.eyesGlow = true; c.story = { clip: 'shamble', start: tick }; e.appearance!.handProp = null;
      (s.lurkers ??= []).push(id);
    }
  }
  private inZone(p: Point): boolean { const [z0, z1] = l2.checkpoint.gateZ; return p.x >= l2.checkpoint.gateX + .6 && p.z >= z0 + .3 && p.z <= z1 - .3; }
  private checkpointGate(tick: number, player: EntitySnapshot): void {
    const s = this.s;
    if (!s.radioAt || s.phase === 'done') return;
    if (!s.crossedAt && player.health.current > 0 && this.inZone(player.transform)) { s.crossedAt = tick; s.phase = 'checkpoint'; this.mission.radio('L2.checkpoint'); }
    if (s.crossedAt && !s.gateClosedAt && tick - s.crossedAt >= ticks(.6)) {
      s.gateClosedAt = tick; for (const id of ['gate-main', 'gate-north', 'gate-south']) this.wall(id, true);
      // People still on their way can no longer get in: they make for the front of the closed gate instead.
      const g = l2.rescue.havenGate;
      for (const [k, id] of s.trappedIds.entries()) {
        const e = this.world.entities.get(id), h = e?.civilian?.l1?.haven; if (!e || !h || this.inZone(e.transform)) continue;
        Object.assign(h, this.snap({ x: g.x, z: g.z[0] + (k % 9) / 8 * (g.z[1] - g.z[0]) }, .35), { leg: Math.min(h.leg, h.route.length) });
        if (e.civilian!.state === 'calm' && Math.hypot(e.transform.x - h.x, e.transform.z - h.z) > 1.5 && h.leg > 0) this.outbreak().panic(e, { x: e.transform.x - 5, z: e.transform.z });
      }
      for (const id of ['l2-gate-main', 'l2-gate-north', 'l2-gate-south']) this.world.events.emit({ type: 'gate.changed', tick, id, open: false });
      this.world.events.emit({ type: 'l2.gateClosed', tick });
      // The corgi always makes it through with the courier.
      for (const e of this.world.entities.iterate()) if (e.companion && !this.inZone(e.transform)) { const p = this.snap({ x: player.transform.x + 1, z: player.transform.z }, .35); Object.assign(e.transform, p); this.world.spatial.set(e.id, p.x, p.z); }
    }
    if (s.gateClosedAt && tick - s.gateClosedAt >= ticks(l2.checkpoint.holdS) && !this.mission.state.states.crossed) { s.phase = 'done'; this.mission.setState('crossed', true); }
  }

  /** Cheat/test path (`completeObjective` in the gap after the doors, the only step without an active objective): fires the radio now. Never used by gameplay or bots. */
  advance(): boolean {
    const s = this.mission.state.l2; if (!s || s.radioAt) return false;
    const tick = this.world.tick; s.radioAt = tick; s.phase = 'escape'; this.world.events.emit({ type: 'l2.radio', tick }); this.mission.radio('L2.radio');
    this.mission.setState('radio', true); this.mission.requestCheckpoint('escape'); return true;
  }
  /** Checkpoint restore: shift the timeline, re-seat or re-park the truck, rebuild the walls from state. */
  restore(delta: number): void {
    const s = this.mission.state.l2; if (!s) return;
    for (const key of ['alarmAt', 'departAt', 'arrivedAt', 'crewExitAt', 'atDoorsAt', 'doorsOpenAt', 'radioAt', 'crossedAt', 'gateClosedAt'] as const) if (s[key]) s[key] += delta;
    for (const a of s.ambush) if (a.at) a.at += delta;
    for (const q of s.pending) if (q.at) q.at += delta;
    for (const t of s.trips ?? []) t.at += delta;
    for (const f of s.flee ?? []) f.at += delta;
    s.say = null;
    this.kinematic();
    for (const id of Object.keys(WALLS)) {
      const handle = this.walls.get(id); if (handle !== undefined) { this.world.physics.removeBlocker(handle); this.walls.delete(id); }
      const closed = id.startsWith('door') ? !s.doorsOpenAt : !!s.gateClosedAt;
      if (closed) this.wall(id, true); else this.world.events.emit({ type: 'world.blocker.changed', tick: this.world.tick, id: 900_300 + Object.keys(WALLS).indexOf(id), blocked: false, wall: WALLS[id] });
    }
    this.parkNav(s.phase !== 'ride');
    const player = this.world.entities.get(1)!;
    if (s.seated) { player.hidden = true; this.world.physics.playerCollider!.setEnabled(false); this.world.storyLock = { scripted: null, skip: false }; }
    else this.world.storyLock = null;
  }
}
