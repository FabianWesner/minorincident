import { deterministicAtan2 } from '../../core/deterministicMath';
import { l3 } from '../../data/l3';
import { l8BossArenas, l8PlazaCell, l8Route, inRect } from '../../data/l8Bosses';
import type { Mission } from './Mission';
import { FIXED_DT } from '../../core/Clock';
import { vehicleDef } from '../../data/vehicles';
import { actorRadius } from '../world/SolidRegistry';
import { faceMotion, motionResponse, respond } from '../locomotion/MotionResponse';
import { Status } from '../combat/Status';
import { emitEngine } from '../vehicles/ConvoySound';
import { spawnSetPiece } from './L4Spectacle';
import type { EntitySnapshot, Transform } from '../world/types';
import type { Point, ZooSpecies } from '../npc/types';
import { Outbreak } from '../outbreak/Outbreak';
import { zooStaffLook } from '../../data/zooStaff';
import { readyCarriedAlly, allyState, updateAlly } from '../outbreak/Allies';
import { layoutHouseDoors, doorExit, emergeResident, walkResidents, type HouseEmergence } from '../outbreak/HouseEmergence';
import { corpseDetour, formationSlot, leaderHeading, requireClearPoint } from './missionHelpers';
import { L8BossArenas, type L8ArenaState } from './L8BossArenas';
import { surrenderHeavyWeapons, gateToastDelay } from './L8Gate';

export interface L8ZooState {
  arenas: L8ArenaState[];
  startedAt: number; breachedAt: number; nextWave: number; alphas: number; carId: number; busId: number;
  roster: number[]; guards: number[]; animals: number[]; outlets: HouseEmergence[];
  arrivals: { id: number; outlet: number; tick: number; alpha: boolean }[];
  escapeCheckpoint: boolean;
  keeperId: number; pondKeeperId: number; haleId: number; reyesId: number; dogId: number; broadcastAt: number; greetingAt: number; lionSpoken: boolean; haleGreetingAt: number; gateToastAt?: number;
  departureAt: number; chaseAt: number; departureFrom: Transform | null; haleFallAt: number; turnedAnimalId: number; animalInterceptionId: number; animalBiteStarted: boolean; keeperAttacked: boolean;
  /** Nadia's guided walk: 0 leading, 1 aborted (she is gone/turned), 2 arrived at the plaza. */
  guideDone: number; guideLeg: number; guideArrivedAt: number; guideWaiting: boolean; lionUntil: number;
  /** r33-l8route: tick the plaza doors shut (0 = not yet), the route-marker leg/node, and the regions whose first walk-in wave has run (bit 1 north, 2 south, 4 east). */
  sealedAt: number; routeStage: number; routeNode: number; legWaves: number; plazaWaveAt: number; plazaBursts: number;
  /** r36-l8gates: ticks of the "Protect the group" hold the courier spent away from the plaza (the hold pauses meanwhile). */
  protectAway?: number;
}
/** r31-nadia: the sanctuary walk. Leg 2 is the lion enclosure stop (Nadia faces the cat and speaks); the last leg is the plaza centre. */
const guideRoute: Point[] = [{ x: 24, z: 64 }, { x: 24, z: 0 }, { x: 40, z: 0 }, { x: -44, z: -10 }, { x: -40, z: 3 }, { x: 0, z: 0 }];
/** r34-l8qa: the lion line only plays with the lion inside the game camera frame (zoom 1.5 shows ~8 m up/down); the zoo lion paces at (-45,-13), so the stop is ~3 m from the fence, the lion ~5 m away. */
const lionInFrame = 10;
const guideLionLeg = 3, guideIntroTicks = 4 * 60, guideRestTicks = 15 * 60, guideMaxCalmTicks = 120 * 60;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
/** Zoo story owns timing/entrances; the shared outbreak owns all bites, rescues and same-id transformations. */
export class LevelEightZoo {
  readonly bosses: L8BossArenas;
  state: L8ZooState = { arenas: [], startedAt: 0, breachedAt: 0, nextWave: 0, alphas: 0, carId: 0, busId: 0, roster: [], guards: [], animals: [], outlets: [], arrivals: [], escapeCheckpoint: false, keeperId: 0, pondKeeperId: 0, haleId: 0, reyesId: 0, dogId: 0, broadcastAt: 0, greetingAt: 0, lionSpoken: false, haleGreetingAt: 0, departureAt: 0, chaseAt: 0, departureFrom: null, haleFallAt: 0, turnedAnimalId: 0, animalInterceptionId: 0, animalBiteStarted: false, keeperAttacked: false, guideDone: 0, guideLeg: 0, guideArrivedAt: 0, guideWaiting: false, lionUntil: 0, sealedAt: 0, routeStage: -1, routeNode: 0, legWaves: 0, plazaWaveAt: 0, plazaBursts: 0 };
  private prepared = false;
  private rosterCacheTick = -1;
  private rosterCacheRevision = -1;
  private rosterCache: number[] = [];
  private passengersCache: number[] = [];
  private readonly seatedPassengers = new Set<number>();
  private readonly boardingDetours = new Map<number, { goal: Point; path: Point[]; tick: number }>();
  private readonly boardingProgress = new Map<number, { x: number; z: number; tick: number }>();
  private readonly cacheStops: (() => void)[] = [];
  constructor(private readonly mission: Mission) {
    this.bosses = new L8BossArenas(mission);
    const invalidate = () => { this.rosterCacheTick = -1; this.rosterCacheRevision = -1; };
    for (const type of ['entity.spawned', 'civilian.state', 'civilian.finished', 'combat.kill'] as const)
      this.cacheStops.push(mission.world.events.on(type, invalidate));
    this.cacheStops.push(mission.world.events.on('outbreak.bite', event => {
      if (event.type !== 'outbreak.bite' || !event.turns || !this.state.animals.includes(event.targetId)) return;
      const animal = mission.world.entities.get(event.targetId);
      if (animal?.civilian?.zooAnimal && !animal.infection && !animal.infected) mission.world.npcs?.civilians.outbreak?.infect(animal, event.sourceId);
    }));
    this.cacheStops.push(mission.world.events.on('civilian.turned', event => {
      if (event.type !== 'civilian.turned' || !this.state.animals.includes(event.id)) return;
      this.state.turnedAnimalId ||= event.id;
      this.bosses.turned(event.id);
      mission.world.infected!.pursueTarget(event.id, 1);
    }));
  }
  dispose(): void { this.cacheStops.splice(0).forEach(stop => stop()); }
  private get w() { return this.mission.world; }
  private get breached() { return !!this.mission.state.states.breached; }
  private point(at: Point, radius = .4): Point {
    return requireClearPoint(this.w, at, radius, 8, 'zoo');
  }
  prepare(): void {
    if (this.prepared) return;
    this.prepared = true;
    const w = this.w, s = this.state, ai = w.infected!, civilians = w.npcs!.civilians;
    w.npcs!.setAmbient(0);
    const outbreak = civilians.outbreak = new Outbreak(w, { refuges: [], tier: ai.director.tier });
    ai.configureL1v2(outbreak.humans);
    ai.director.levelCap = 200; ai.director.strict = true; ai.director.ambientTarget = 0; ai.director.reserved = 1;
    const carried = w.carriedSurvivors ?? w.progression?.campaign?.results?.L7?.escapedSurvivors;
    const start = this.mission.def.anchors.arrival;
    for (let i = 0; i < (carried?.length ?? 12); i++) {
      const source = carried?.[i];
      if (source && (source.health.current <= 0 || source.infected || source.infection)) continue;
      const at = this.point({ x: start.x + (i % 3 - 1) * 1.2, z: start.z - 3 - Math.floor(i / 3) * 1.2 });
      const e = source ? structuredClone(source) : w.entities.get(outbreak.spawnPedestrian(at, { role: 'cashier' }))!;
      if (source) { if (w.entities.get(e.id)) throw new Error(`L8 incoming survivor collision: ${e.id}`); w.entities.replace(e); }
      Object.assign(e.transform, { ...at, y: .7 }); e.hidden = false; delete e.passengerOf;
      const c = e.civilian!; c.path = []; c.goal = -1; c.pauseUntil = 0; c.story = null; delete c.floorY;
      // Hours pass between levels: recover health and unload into the new level's clock.
      e.health.current = e.health.max;
      c.state = 'calm'; c.entered = w.tick; c.until = 0; c.knockedUntil = 0;
      if (c.l1) c.l1.target = null;
      // Recovery also expires effects whose timestamps belong to L7's clock.
      if (e.combat) { e.combat.staggerUntil = 0; e.combat.attacking = false; e.combat.statuses.length = 0; delete e.combat.reaction; }
      readyCarriedAlly(e, w.tick);
      c.survivor = { key: c.survivor?.key ?? `zoo-carried-${i}`, slot: i, leader: 1, mode: 'follow', cover: false, injured: c.survivor?.injured ?? c.l1?.walkSpeed === 1.4, waitAt: 0, foundAt: w.tick };
      s.roster.push(e.id); w.solids.admit(e, 'l8.roster.arrival');
    }
    const centres: Point[] = [{ x: -60, z: 0 }, { x: 60, z: 0 }, { x: -30, z: -64 }, { x: -45, z: 64 }, { x: 24, z: 64 }];
    for (let i = 0; i < 30; i++) {
      const at = this.point({ x: centres[i % 5].x + (Math.floor(i / 5) - 2) * 1.3, z: centres[i % 5].z });
      const target = this.point({ x: at.x + 2, z: at.z + 2 });
      const soldier = i >= 20 && i < 26, staff = i >= 26;
      const id = outbreak.spawnPedestrian(at, { ...(staff ? zooStaffLook(i - 26) : {}), role: soldier ? 'soldier' : staff ? zooStaffLook(i - 26).role : 'cashier', model: soldier ? 'npc.national-guard' : staff ? zooStaffLook(i - 26).model : undefined,
        child: i === 18 || i === 19, handProp: soldier ? 'rifle' : staff ? zooStaffLook(i - 26).handProp : null, waypoints: [at, target], faces: [target, at] });
      if (soldier) { w.entities.get(id)!.civilian!.ally = { ...allyState('soldier', at), gun: { ...l3.soldiers.gun }, weapon: 'rifle' }; s.guards.push(id); }
    }
    const species: ZooSpecies[] = ['lion', 'gorilla', 'elephant', 'zebra', 'zebra', 'flamingo', 'flamingo', 'flamingo'];
    const offsets = new Map<ZooSpecies, number>();
    for (const speciesId of species) {
      const anchor = this.mission.def.anchors[`animal-${speciesId}`], offset = offsets.get(speciesId) ?? 0; offsets.set(speciesId, offset + 1);
      const radius = speciesId === 'elephant' ? 1.3 : .9;
      // Keep the calm animals at their public-facing enclosure fences so the keeper's boulevard route passes them.
      const compact = speciesId === 'lion' || speciesId === 'gorilla' || speciesId === 'zebra';
      const gateSideZ = compact ? (anchor.z < 0 ? 8 : -8) : anchor.z < 0 ? 18 : -18;
      const gateX = speciesId === 'flamingo' ? 0 : Math.sign(anchor.x) * (compact ? 60 : 45);
      const at = this.point({ x: gateX + offset * 2, z: anchor.z + gateSideZ - (speciesId === 'flamingo' && offset === 0 ? 3 : 0) }, radius);
      const phase = offset + species.indexOf(speciesId);
      const waypoints = Array.from({ length: 4 }, (_, n) => ({ x: at.x + Math.cos((phase + n) * Math.PI / 2) * 1.4, z: at.z + Math.sin((phase + n) * Math.PI / 2) * 1.4 }));
      s.animals.push(civilians.spawn('cashier', at, { zooAnimal: speciesId, waypoints }));
    }
    this.bosses.prepare();
    const tour = [{ x: 24, z: 64 }, { x: 24, z: 0 }, { x: 45, z: 0 }, { x: -45, z: 0 }, { x: 0, z: 0 }];
    const keeper = this.point({ x: 3, z: 66 }), staff = zooStaffLook(6);
    s.keeperId = outbreak.spawnPedestrian(keeper, { ...staff, walkSpeed: 4.6, waypoints: tour,
      schedule: [...tour.map(target => ({ activity: 'walk' as const, anchor: 'zoo/tour', target, ticks: 1 })),
        { activity: 'look', anchor: 'zoo/plaza', target: tour.at(-1)!, facing: { x: -4, z: 0 }, ticks: 36_000 }] });
    const pondPost = this.point({ x: 1, z: -21 });
    s.pondKeeperId = outbreak.spawnPedestrian(pondPost, { ...zooStaffLook(0), waypoints: [pondPost, { x: 2, z: -21 }] });
    // This keeper stays with the birds during the first alarm, still fully
    // biteable and rescuable through the ordinary shared outbreak rules.
    w.entities.get(s.pondKeeperId)!.civilian!.l1!.haven = { ...pondPost, route: [], leg: 0 };
    for (const [key, x] of [['majorHale', -4], ['privateReyes', -2]] as const) {
      const at = this.point({ x, z: 0 });
      const id = outbreak.spawnPedestrian(at, { role: 'soldier', model: 'npc.national-guard', handProp: 'rifle', waypoints: [at, { x, z: 2 }] });
      w.entities.get(id)!.civilian!.ally = { ...allyState('soldier', at), gun: { ...l3.soldiers.gun }, weapon: 'rifle' };
      this.mission.state.actors[key] = id;
      if (key === 'majorHale') s.haleId = id; else s.reyesId = id;
    }
    this.mission.state.actors.nadia = s.keeperId;
    const d = w.districts!.districts[0];
    s.outlets = layoutHouseDoors(d.layout, d.origin, undefined, asset => asset === 'kit.zoo-tunnel-mouth').map((door, index) => {
      const exit = doorExit(w, door, start); if (!exit) throw new Error(`Disconnected zoo outlet ${door.house}`);
      const serviceRoutes: [number, number][][] = [
        [[-96, 32]],
        [], // The eastern apron is already connected; normal pursuit owns the route.
        [[-24, -64], [0, -56], [0, -44], [-11, -40], [-11, -24], [1, -19.2]], // Enter the north gate and walk the dry shore around the pond.
        [[24, 64]], // Leave onto the boulevard toward the plaza instead of walking south around the bunker.
      ];
      // Outlets 5 and 6 are the two hatches inside the plaza cell: they walk straight out at the group.
      const route = [...exit.route, ...(serviceRoutes[index] ?? [])];
      const last = route.at(-1);
      // Alarm runners clear the entrance briskly; the larger high-tier queue
      // must still contact the courier within twenty seconds.
      return { ...door, ...exit, route, finishRoute: true, ox: last?.[0] ?? exit.ox, oz: last?.[1] ?? exit.oz, next: 0, ids: [], speedMs: index === 2 ? 5.6 : index === 3 ? 6.8 : index >= 4 ? 5 : 4.2 };
    });
    if (s.outlets.length < 3) throw new Error('Zoo requires at least three tunnel outlets');
    // The outlet exits above were checked with every route gate open; now the cells close.
    this.mission.def.anchors['l8-route'] = { x: 0, z: 0, radius: 2 };
    this.bosses.updateGates();
    // The carried group has just unloaded from L7's evacuation bus inside the perimeter.
    // Leave the APC's west-side driver door clear for the final approach.
    const busX = start.x - 16;
    const bus = spawnSetPiece(w, 'veh.evac-bus', { x: busX, z: start.z, y: w.districts!.groundHeight(busX, start.z) + .7 });
    s.busId = bus.id;
    const wall = { x: bus.transform.x, y: 1.5, z: bus.transform.z, halfX: 4.68, halfY: 1.5, halfZ: 1.48 };
    w.physics.addBlocker(wall);
    w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: bus.id, blocked: true, wall });
    s.carId = w.vehicles!.spawn('vehicle.military-apc', this.point({ x: 96, z: 74 }, 3.5), -Math.PI / 2);
    Object.assign(this.mission.def.anchors.exit, this.boardingRing(), { radius: 2 });
    this.mission.state.actors.apc = s.carId;
  }
  begin(): void {
    const s = this.state, t = this.w.tick;
    s.startedAt = t; s.greetingAt = t + 9 * 60; s.lionSpoken = false;
    if (surrenderHeavyWeapons(this.w, this.mission).length) s.gateToastAt = t + gateToastDelay;
    s.broadcastAt = t + 20 * 60; s.haleGreetingAt = t + 38 * 60;
    this.mission.checkpoint('sanctuary');
  }
  door(): Point {
    const car = this.w.vehicles!.cars.get(this.state.carId)!, p = car.entity.transform, def = car.physics.def, z = def.width / 2 + 1;
    return { x: p.x + Math.cos(p.yaw) * def.doorX + Math.sin(p.yaw) * z, z: p.z - Math.sin(p.yaw) * def.doorX + Math.cos(p.yaw) * z };
  }
  /** The torus clears the solid hull while remaining within the real door's boarding reach. */
  private boardingRing(): Point {
    const door=this.door(),yaw=this.w.entities.get(this.state.carId)!.transform.yaw;
    return {x:door.x+Math.sin(yaw)*.25,z:door.z+Math.cos(yaw)*.25};
  }
  private release(outlet: HouseEmergence, index: number, alpha = false): void {
    const w = this.w, ai = w.infected!;
    // Keep room for the sanctuary population's systemic turns; these slots are available to bites, never consumed by reinforcements.
    const healthy = [...w.entities.iterate()].filter(e => e.civilian && e.civilian.state !== 'finished' && e.health.current > 0 && !e.hidden && !e.infection);
    const conversionRoom = healthy.filter(e => e.civilian!.zooAnimal).length + Math.min(12, healthy.filter(e => !e.civilian!.zooAnimal).length);
    if (ai.director.count + ai.director.pendingTurns >= ai.director.cap - conversionRoom - 1) return;
    const spearhead = index === 3 && !this.state.arrivals.some(q => q.outlet === 3);
    const id = emergeResident(w, outlet, w.tick, alpha ? { archetype: 'infected.alpha' } : { ...(index === 3 ? { archetype: spearhead ? 'infected.armored' : 'infected.sprinter' } : {}), look: { role: 'cashier' } });
    if (id) {
      this.state.arrivals.push({ id, outlet: index, tick: w.tick, alpha }); if (alpha) this.state.alphas++;
      // The K9 follows the same hidden vestibule/door walk as the human cohort.
      if (!alpha && index === 2 && !this.state.dogId) {
        const dog = emergeResident(w, outlet, w.tick, { archetype: 'infected.dog' });
        w.entities.get(dog)!.infected!.variant = 'inf.dog-k9';
        this.state.dogId = dog;
        this.state.arrivals.push({ id: dog, outlet: index, tick: w.tick, alpha: false });
        this.state.animalInterceptionId = id;
      }
    }
  }
  /** Animal carriers use the same occluded service-door emergence as the announced tunnel cohort. */
  arenaCarrier(targetId: number): number {
    const target = this.w.entities.get(targetId)!;
    // r33-l8route: only a tunnel whose runner can really walk to the animal through the gates that are open now.
    const nav = this.w.infected!.nav, goal = nav.nearestCell(target.transform.x, target.transform.z);
    const outlet = [...this.state.outlets].sort((a, b) => Math.hypot(a.ox - target.transform.x, a.oz - target.transform.z) - Math.hypot(b.ox - target.transform.x, b.oz - target.transform.z))
      .find(o => { const cell = nav.nearestCell(o.ox, o.oz); return cell >= 0 && goal >= 0 && nav.path(cell, goal, [], 400_000); });
    if (!outlet || this.w.infected!.director.count >= this.w.infected!.director.cap - 30) return 0;
    const id = emergeResident(this.w, outlet, this.w.tick, { look: { role: 'cashier' } });
    if (id) this.w.entities.get(id)!.infected!.arenaCarrier = targetId;
    return id;
  }
  /** The living group: companions and rescued survivors that are not aboard. */
  followers(): EntitySnapshot[] {
    return this.passengers().map(id => this.w.entities.get(id)).filter((e): e is EntitySnapshot => !!e && e.health.current > 0 && !e.infected && !e.infection && e.passengerOf === undefined);
  }
  /** After the opening hold the plaza doors shut once the courier and the whole group stand inside the plaza cell (a straggler stuck outside for 45 s is left to rejoin later). */
  private trySeal(): void {
    const s = this.state, w = this.w, p = w.entities.get(1)!.transform;
    if (s.sealedAt || !this.breached || this.protecting() || !inRect(p, l8PlazaCell)) return;
    const outside = this.followers().filter(e => !inRect(e.transform, l8PlazaCell));
    if (outside.length && w.tick < s.breachedAt + (s.protectAway ?? 0) + 75 * 60) return;
    s.sealedAt = w.tick;
    this.bosses.updateGates();
    this.mission.checkpoint('sealed');
    this.say('L8.route-flamingo');
  }
  /** One keeper line: Nadia while she lives, otherwise a soldier. */
  say(key: string): void {
    const keeper = this.w.entities.get(this.state.keeperId), alive = !!keeper?.civilian && !keeper.infection && keeper.health.current > 0;
    this.mission.radio(alive ? key : `${key}.soldier`);
  }
  /** Tunnel runners that walk in from the region the courier is crossing (north path, south field, east lane); the plaza, the lion and the primate leg have none. */
  private region(p: Point): 0 | 1 | 2 | 4 | 8 {
    if (inRect(p, l8PlazaCell)) return 8;
    if (p.x >= 82) return p.z > -64 ? 4 : 0;
    if (p.z < -52 && p.x < 14) return 1;
    if (p.z > 12 && !inRect(p, l8Route[2].zone) && !inRect(p, l8Route[3].zone)) return 2;
    return 0;
  }
  private regionOutlets(region: number, index: number): boolean { return region === 1 ? index === 2 : region === 2 ? index === 0 || index === 3 : region === 4 ? index === 1 : region === 8 ? index >= 4 : false; }
  /** The opening shock keeps the group in the plaza before the APC route appears. */
  protecting(): boolean { return this.breached && this.w.tick < this.state.breachedAt + 30 * 60 + (this.state.protectAway ?? 0); }
  /** r36-l8gates (QA P2 "the courier and some civilians can run far out of the plaza during 'Protect the group'"): the hold is
   * fought in the plaza. Away from the cell (4 m grace) its 30 s pause and the objective calls her back. The group keeps
   * following her: alone in the plaza it would face the two hatch cohorts without her. */
  awayFromPlaza(): boolean {
    const p = this.w.entities.get(1)!.transform, c = l8PlazaCell;
    return p.x < c.x0 - 4 || p.x > c.x1 + 4 || p.z < c.z0 - 4 || p.z > c.z1 + 4;
  }
  private passengersSeated(): boolean {
    const seats = this.w.entities.get(this.state.carId)!.vehicle!.passengers ?? [];
    return this.passengers().every(id => seats.some(seat => seat.id === id && seat.phase === 'seated'));
  }
  /** The calm lasts a minute, but never ends before Nadia has led the group into the plaza and they have had a moment to settle. */
  private calmTicks(): number {
    const s = this.state;
    if (s.guideDone === 0) return guideMaxCalmTicks;
    return s.guideDone === 2 ? Math.max(3600, s.guideArrivedAt - s.startedAt + guideRestTicks) : 3600;
  }
  /** Nadia waits near the courier, speaks, then leads at a walking pace 6-10 m ahead; she stops and turns back when the courier falls behind. */
  private guide(): void {
    const s = this.state, w = this.w, t = w.tick;
    if (s.guideDone) return;
    const keeper = w.entities.get(s.keeperId), c = keeper?.civilian, player = w.entities.get(1)!;
    if (!keeper || !c || keeper.infection || keeper.health.current <= 0 || c.state !== 'calm') { s.guideDone = 1; return; }
    c.pauseUntil = t + 2; // the shared tour schedule stays suspended while she leads
    const stand = (look: Point) => {
      keeper.transform.yaw = deterministicAtan2(look.x - keeper.transform.x, look.z - keeper.transform.z);
      keeper.motion = { velocity: { x: 0, z: 0 }, speed: 0, moving: false, distance: keeper.motion?.distance ?? 0 };
    };
    const lion = w.entities.get(s.animals[0]);
    if (t < s.startedAt + guideIntroTicks) { stand(player.transform); return; }
    if (s.lionUntil > t) { if (lion) stand(lion.transform); return; }
    const gap = distance(keeper.transform, player.transform);
    if (gap > 10) s.guideWaiting = true; else if (gap < 7) s.guideWaiting = false;
    if (s.guideWaiting) { stand(player.transform); return; }
    const target = guideRoute[s.guideLeg];
    w.npcs!.move(keeper, target, gap < 6 ? 3.4 : 2.6, c, .3, 2400);
    if (distance(keeper.transform, target) > 1) return;
    if (s.guideLeg === guideLionLeg && !s.lionSpoken && gap <= 14 && lion && distance(lion.transform, player.transform) <= lionInFrame) { s.lionSpoken = true; s.lionUntil = t + 4 * 60; this.mission.radio('L8.nadia-lion'); }
    if (++s.guideLeg >= guideRoute.length) {
      s.guideDone = 2; s.guideArrivedAt = t;
      c.pauseUntil = 0; c.scheduleStep = c.schedule!.length - 1; c.activityUntil = 0;
    }
  }
  private story(): void {
    const s = this.state, w = this.w, t = w.tick, player = w.entities.get(1)!;
    const keeper = w.entities.get(s.keeperId), hale = w.entities.get(s.haleId);
    if (s.gateToastAt && t >= s.gateToastAt) { s.gateToastAt = 0; this.mission.radio('L8.gate-toast'); }
    if (s.greetingAt && t >= s.greetingAt) { s.greetingAt = 0; this.mission.radio('L8.nadia-path'); }
    if (s.broadcastAt && t >= s.broadcastAt && distance(player.transform, this.mission.def.anchors['central-plaza']) < 25) { s.broadcastAt = 0; this.mission.radio('L8.broadcast'); }
    if (s.haleGreetingAt && t >= s.haleGreetingAt && !s.broadcastAt && s.guideDone !== 0 && distance(player.transform, this.mission.def.anchors['central-plaza']) < 18) { s.haleGreetingAt = 0; this.mission.radio('L8.hale-greeting'); }
    const elephant = w.entities.get(s.animals[2]);
    if (elephant?.infected && s.arenas.some(a => a.id === 'elephant' && a.phase > 0) && !this.mission.state.states['elephant-turning']) {
      this.mission.setState('elephant-turning', true);
      if (keeper?.civilian && !keeper.infection && keeper.health.current > 0) this.mission.radio('L8.nadia-elephant');
    }
    if (elephant?.infected && elephant.health.current <= 0 && elephant.infected.recoverAt < 0 && !this.mission.state.states['elephant-fallen']) {
      this.mission.setState('elephant-fallen', true); this.mission.radio('L8.courier-elephant');
    }
    const dog = w.entities.get(s.dogId), victim = w.entities.get(s.pondKeeperId);
    if (!s.keeperAttacked && dog?.infected && !dog.emerging && dog.health.current > 0 && victim?.civilian && !victim.infection && victim.health.current > 0 && distance(dog.transform, victim.transform) <= 2) {
      w.npcs!.civilians.outbreak!.grab(victim, dog); s.keeperAttacked = true;
    }
    const elephantArena = s.arenas.find(a => a.id === 'elephant');
    const elephantDefeated = elephantArena?.phase === 3;
    if (elephantArena && elephantArena.phase > 0 && elephant && hale && elephant.infected?.specialAttack?.move === 'elephant.charge' && inRect(hale.transform, l8Route.find(stage => stage.id === 'elephant')!.zone) && distance(elephant.transform, hale.transform) < 6 && !this.mission.state.states['hale-keys'] && hale?.civilian && hale.health.current > 0) {
      this.mission.setState('hale-keys', true); this.mission.radio('L8.hale-dying');
      hale.civilian.story = { clip: 'npc-give', start: t - 24 };
      hale.civilian.knockedUntil = t + 120;
      hale.transform.yaw = -deterministicAtan2(player.transform.z - hale.transform.z, player.transform.x - hale.transform.x);
      hale.motion = { velocity: { x: 0, z: 0 }, speed: 0, moving: false, distance: hale.motion?.distance ?? 0 };
      const shot = this.mission.def.cinematics['l8-hale'];
      shot.target = [hale.transform.x, 1, hale.transform.z]; shot.position = [hale.transform.x + 16, 12, hale.transform.z + 18];
      this.mission.cinematic('l8-hale');
      s.haleFallAt = t + 120;
    }
    if (this.mission.state.states['hale-keys'] && !this.mission.state.states['hale-fallen'] && s.haleFallAt && t >= s.haleFallAt && hale?.civilian) {
      hale.health.current = 0; hale.civilian.state = 'finished';
      hale.civilian.story = { clip: 'death-side', start: t };
      this.mission.setState('hale-fallen', true); s.haleFallAt = 0;
    }
    if (!this.mission.state.states['elephant-fallen'] && elephantDefeated) {
      this.mission.setState('elephant-fallen', true); this.mission.radio('L8.courier-elephant');
    }
    if (elephantDefeated && this.mission.state.states['hale-fallen'] &&
        this.mission.state.steps.escape.status === 'active' && this.passengersSeated() &&
        w.vehicles!.active === s.carId && !s.departureFrom) {
      s.departureAt = t;
    }
    if ((s.departureAt || s.departureFrom) && this.mission.state.states['hale-fallen'] && this.passengersSeated() &&
        w.vehicles!.active === s.carId) {
      if (!s.departureFrom) {
        s.chaseAt = t; s.departureFrom = { ...w.entities.get(s.carId)!.transform };
        w.storyLock = { scripted: null, skip: false }; w.clearInput();
        this.mission.radio('L8.departure');
      }
      const elapsed = t - s.chaseAt, from = s.departureFrom, run = Math.max(0, Math.min(1, elapsed / 360));
      const x = from.x + 42 * run, z = from.z;
      const previous = w.entities.get(s.carId)!.transform;
      const speed = Math.hypot(x - previous.x, z - previous.z) * 60;
      w.vehicles!.scriptPose(s.carId, { x, y: from.y, z, yaw: from.yaw }, speed);
      const car = w.entities.get(s.carId)!; car.vehicle!.braking = false;
      if (elapsed % 6 === 0) emitEngine(w, s.carId, speed, true);
      if (elapsed >= 480) { this.mission.setState('departed', true); w.storyLock = null; }
    }
  }
  update(): void {
    const w = this.w, s = this.state, ai = w.infected!, t = w.tick;
    this.bosses.update();
    const hale = w.entities.get(s.haleId);
    if (this.breached && s.arenas.every(a => a.phase === 3) && !this.mission.state.states['hale-keys'] && hale?.civilian && hale.health.current > 0 && distance(hale.transform, this.door()) > 1.8) {
      // Hale's retreat remains physical while he fires. Repeated rifle windups
      // must not pin him hundreds of metres behind the final door staging.
      if (!this.approachBoardingSpot(hale, this.door(), 6)) w.npcs!.move(hale, this.door(), 6, hale.civilian, .2, 48000);
    }
    if (!this.breached) this.guide();
    else this.trySeal();
    this.story();
    let pending = 0; for (const e of w.entities.iterate()) if (e.infection && !e.infected) pending++;
    ai.director.pendingTurns = pending;
    if (!this.breached && t - s.startedAt >= this.calmTicks()) {
      s.breachedAt = t; s.nextWave = t + 600;
      // One ordinary armoured infected leads the southern approach; the authored three/six-member cohorts stay bounded.
      // Only tunnels whose runners can walk to the courier now (the plaza hatches, the pond/north and the south one); the west and east cohorts walk in when
      // the courier crosses their region (a cohort sealed behind hedges would stand harmless against a fence).
      const nav = w.infected!.nav, goal = nav.nearestCell(w.entities.get(1)!.transform.x, w.entities.get(1)!.transform.z);
      s.outlets.forEach((outlet, i) => {
        const cell = nav.nearestCell(outlet.ox, outlet.oz);
        if (i < 4 && !(cell >= 0 && goal >= 0 && nav.path(cell, goal, [], 400_000))) return;
        for (let n = 0; n < (i >= 4 ? (ai.director.tier === 'low' ? 3 : 5) : ai.director.tier === 'low' ? 3 : 6); n++) this.release(outlet, i);
      });
      // The parked hull has settled by the alarm. Capture its boarding action
      // point once; minor physics impulses must not steer the objective ring.
      Object.assign(this.mission.def.anchors.exit, this.boardingRing());
      this.mission.setState('breached', true);
      const door = this.door();
      for (const [i, id] of [s.haleId, s.reyesId, ...s.guards].entries()) {
        const guard = w.entities.get(id); if (!guard?.civilian?.ally || guard.health.current <= 0) continue;
        const yaw = w.entities.get(s.carId)!.transform.yaw, dx = i === 0 ? -.7 : -5 - i * 1.5, dz = i === 0 ? 1.2 : 5.5;
        const at = this.point({ x: door.x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, z: door.z - Math.sin(yaw) * dx + Math.cos(yaw) * dz });
        guard.civilian.ally.run = at; guard.civilian.ally.post = at; guard.civilian.ally.runSpeed = 6; guard.civilian.ally.hold = true;
      }
      this.reyesFallback();
      this.mission.checkpoint('breach');
      this.mission.radio('L8.hale-breach');
    }
    if (this.breached) this.reyesFallback();
    if (this.protecting() && this.awayFromPlaza()) s.protectAway = (s.protectAway ?? 0) + 1;
    this.mission.setState('apc-destroyed', w.entities.get(s.carId)!.health.current <= 0);
    const seated=this.w.vehicles!.active===s.carId;
    this.mission.setState('player-boarded',seated);
    // r25-l8cues: while the group is under the opening shock the marker rings the plaza where they stand (it was blank for the first 30 s).
    if(seated)this.mission.state.marker=null;
    else if(this.protecting())this.mission.state.marker=this.mission.state.steps.escape.status==='active'?'central-plaza':null;
    else if(this.mission.state.steps.escape.status==='active'||this.mission.state.steps.depart.status==='active') {
      const next = s.arenas.find(a => a.phase !== 3);
      const step = this.mission.def.steps.find(value => value.id === 'escape');
      if (next) {
        const def = l8BossArenas.find(value => value.id === next.id)!, stage = l8Route.find(value => value.id === next.id)!, p = w.entities.get(1)!.transform;
        let text: string, at: Point;
        if (!s.sealedAt) { text = 'Return to the plaza'; at = this.mission.def.anchors['central-plaza']; }
        else if (next.phase > 0) {
          const alive = next.ids.filter(id => (w.entities.get(id)?.health.current ?? 0) > 0).length;
          const label = next.id === 'flamingo' ? 'flamingos' : next.id === 'monkey' ? 'monkeys' : next.id === 'zebra' ? 'zebras' : next.id === 'lion' ? 'lions' : next.id;
          text = `Kill ${label} ${next.ids.length - alive}/${next.ids.length}`;
          // r39-markers (r38-vqa P3 'the gorilla fight's distance readout is not the distance to the gorilla'): the marker follows the nearest live animal, not the arena centre.
          let focus: Point = def.centre, best = Infinity;
          for (const id of next.ids) { const a = w.entities.get(id); if (!a?.infected || a.health.current <= 0 || a.hidden) continue; const d = distance(a.transform, p); if (d < best) { best = d; focus = a.transform; } }
          at = focus; }
        else {
          const index = l8Route.indexOf(stage);
          if (inRect(p, stage.zone)) { at = { x: (stage.zone.x0 + stage.zone.x1) / 2, z: (stage.zone.z0 + stage.zone.z1) / 2 }; text = stage.text; }
          else {
            if (s.routeStage !== index) { s.routeStage = index; s.routeNode = 0; }
            while (s.routeNode < stage.nodes.length - 1 && distance(p, stage.nodes[s.routeNode]) < 4) s.routeNode++;
            at = stage.nodes[s.routeNode]; text = stage.text;
          }
        }
        Object.assign(this.mission.def.anchors['l8-route'], { x: at.x, z: at.z });
        if (step) { step.text = text; step.anchor = 'l8-route'; step.waypoint = true; }
        this.mission.state.marker = 'l8-route';
      } else {
        if (step) { const ids = this.passengers(), seats = w.entities.get(s.carId)!.vehicle!.passengers ?? []; const count = ids.filter(id => seats.some(seat => seat.id === id && seat.phase === 'seated')).length; step.text = `Cover the survivors while they board · ${count}/${ids.length} aboard`; step.anchor = 'exit'; step.waypoint = false; }
        this.mission.state.marker = 'exit';
      }
    }
    if (!this.breached) return;
    this.escortGuards();
    if (t >= s.nextWave) {
      // The animal arenas carry the outbreak after the first tunnel surge (PO 11-08).
      // Four ordinary arrivals sustain the opening, without turning the zoo into another horde slaughter.
      s.nextWave = t + 36_000;
      const here = this.region(w.entities.get(1)!.transform);
      s.outlets.forEach((outlet, i) => { if (this.regionOutlets(here, i)) this.release(outlet, i, i < 3 && s.alphas < 3); });
    }
    // The first time the courier crosses a region with tunnels (after the seal), a small cohort walks in from its outlets.
    const here = s.sealedAt ? this.region(w.entities.get(1)!.transform) : 0;
    // "Protect the group!" is a sustained fight: two more bursts come out of the plaza hatches at 12 s and 24 s of the 30 s hold.
    if (this.protecting() && s.plazaBursts < 2 && t >= s.breachedAt + (s.protectAway ?? 0) + (s.plazaBursts + 1) * 12 * 60) {
      s.plazaBursts++;
      s.outlets.forEach((outlet, i) => { if (i >= 4) for (let n = 0; n < (ai.director.tier === 'low' ? 2 : 3); n++) this.release(outlet, i); });
    }
    // A courier camping in the sealed plaza keeps being hunted from the two hatches in the cell (the flamingo fight has not started).
    if (here === 8 && s.arenas[0]?.phase === 0 && t >= (s.plazaWaveAt ||= t + 40 * 60)) {
      s.plazaWaveAt = t + 40 * 60;
      const inCell = [...w.entities.iterate()].filter(e => e.infected && e.health.current > 0 && !e.hidden && inRect(e.transform, l8PlazaCell)).length;
      if (inCell < 6) s.outlets.forEach((outlet, i) => { if (i >= 4) this.release(outlet, i); });
    }
    if (here && here !== 8 && !(s.legWaves & here)) {
      s.legWaves |= here;
      s.outlets.forEach((outlet, i) => { if (this.regionOutlets(here, i)) for (let n = 0; n < (ai.director.tier === 'low' ? 2 : 4); n++) this.release(outlet, i); });
    }
    for (const [index, outlet] of s.outlets.entries()) for (const id of walkResidents(w, outlet, t)) {
      if (w.entities.get(id)?.infected?.arenaCarrier) { ai.pursueTarget(id, w.entities.get(id)!.infected!.arenaCarrier!); continue; }
      else if (id === s.animalInterceptionId) ai.pursueTarget(id, s.animals[5]);
      else if (id === s.dogId) ai.pursueTarget(id, s.pondKeeperId);
      else ai.pursueTarget(id, 1);
      // This gate-side cohort pressures the courier; the other outlets still attack the sanctuary population.
      // Releasing on the apron and retaining that focus avoids spending the whole encounter walking a scripted road.
      if (index === 3) { ai.press(id, 1, t + 3600, 30); ai.rush(id, w.entities.get(1)!.transform, t + 3600, true); }
      if (index === 1 && !w.entities.get(id)!.infected!.arenaCarrier) {
        // The east cohort intercepts the evacuation at its parked APC. Native
        // navigation and ordinary senses own this approach; party contact can
        // interrupt it. A perimeter tour previously arrived after departure.
        const infected = w.entities.get(id)!.infected!;
        infected.scripted = { ...this.door() }; infected.breachApproach = 'inside';
      }
    }
    // Use the real grab window and same-ID infection timer at the public flamingo gate.
    if (!s.animalBiteStarted && s.animalInterceptionId) {
      const attacker = w.entities.get(s.animalInterceptionId), animal = w.entities.get(s.animals[5]);
      if (attacker?.infected && !attacker.emerging && attacker.health.current > 0 && animal?.civilian && !animal.infection && distance(attacker.transform, animal.transform) <= 2.4) {
        w.npcs!.civilians.outbreak!.grab(animal, attacker); s.animalBiteStarted = true;
      }
    }
    const player = w.entities.get(1)!;
    if (!s.escapeCheckpoint && this.mission.state.steps.escape.status === 'active' && distance(player.transform, this.door()) < 12) { s.escapeCheckpoint = true; this.mission.checkpoint('escape-route'); }
    if (w.vehicles!.groupBoarded(s.carId, this.passengers()) && !s.departureAt) this.mission.setState('aboard', true);
  }
  /** The existing evacuation detail covers the living column, using its shared rifle rules. */
  private escortGuards(): void {
    if (!this.breached || this.departing()) return;
    const group = this.state.roster.map(id => this.w.entities.get(id)).filter((e): e is EntitySnapshot => !!e && e.health.current > 0 && !e.infected && !e.infection && e.passengerOf === undefined);
    if (!group.length) return;
    const x = group.reduce((n, e) => n + e.transform.x, 0) / group.length, z = group.reduce((n, e) => n + e.transform.z, 0) / group.length;
    for (const [i, id] of this.state.guards.entries()) {
      const guard = this.w.entities.get(id), ally = guard?.civilian?.ally;
      if (!guard || guard.health.current <= 0 || !ally) continue;
      const angle = i * Math.PI / 3;
      const radius = this.boarding() ? 6 : 4;
      const desired = { x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius };
      if (!ally.post || distance(ally.post, desired) >= 2) {
        const at = this.point(desired); ally.post = at; ally.run = at; ally.runSpeed = 6; ally.hold = true;
      }
      if (ally.run && distance(guard.transform, ally.run) > 2 && distance(guard.transform, ally.run) < 20) this.w.npcs!.move(guard, ally.run, 6, guard.civilian!, .3, 2400);
    }
  }
  /** L8 no longer owns a Mega Alpha reveal; L9 is its first appearance. */
  cameraPose(): { position: [number, number, number]; target: [number, number, number] } | null { return null; }
  private reyesFallback(): void {
    const s = this.state, w = this.w, reyes = w.entities.get(s.reyesId);
    if (!reyes?.civilian || reyes.civilian.survivor) return;
    if (s.roster.some(id => { const e = w.entities.get(id); return e?.civilian?.survivor?.key === 'sam' && e.health.current > 0 && !e.infected && !e.infection; })) return;
    reyes.civilian.survivor = { key: 'reyes', slot: s.roster.length, leader: 1, mode: 'follow', cover: false, injured: false, waitAt: 0, foundAt: w.tick };
    readyCarriedAlly(reyes, w.tick); s.roster.push(reyes.id); this.rosterCacheTick = -1;
    this.mission.setState('reyes-fallback', true);
  }
  /** Complete living boarding group, including companions shown in the HUD. */
  private refreshRoster(): void {
    if (this.rosterCacheTick === this.w.tick && this.rosterCacheRevision === this.w.entities.revision) return;
    this.rosterCache = [...new Set([...this.state.roster, ...[...this.w.entities.iterate()].filter(e=>e.civilian?.survivor?.mode === 'follow' && !e.civilian.zooAnimal).map(e=>e.id)])]
      .filter(id => { const e = this.w.entities.get(id); return e && e.health.current > 0 && !e.infected && e.civilian?.state !== 'finished'; });
    this.passengersCache = [...[...this.w.entities.iterate()].filter(e=>e.companion&&e.health.current>0).map(e=>e.id), ...this.rosterCache];
    this.rosterCacheTick = this.w.tick; this.rosterCacheRevision = this.w.entities.revision;
  }
  passengers(): number[] {
    this.refreshRoster();
    return [...this.passengersCache];
  }
  /** The unarmed cab would remove the courier's cover fire before the queue is safe. */
  canBoardDriver(): boolean {
    const car = this.w.entities.get(this.state.carId)?.vehicle;
    return this.breached && this.state.arenas.every(a => a.phase === 3) && (this.mission.state.steps.escape.status === 'active' || this.mission.state.steps.depart.status === 'active') && this.passengers().every(id => car?.passengers?.some(p => p.id === id && p.phase === 'seated')) && !!this.mission.state.states['hale-fallen'];
  }
  /** E30 departure starts only after the breach and the complete group has boarded. */
  canDrive(): boolean { return this.breached && this.state.arenas.every(a => a.phase === 3) && this.mission.state.steps.sanctuary.status === 'completed' && this.w.vehicles!.groupBoarded(this.state.carId,this.passengers()); }
  /** The completed boarding group shares the courier's run-out protection until handover. */
  departing(): boolean { return !!this.state.departureFrom || this.mission.state.runOutUntil !== undefined || this.mission.state.phase !== 'playing'; }
  /** At the pickup, the evacuation queue owns movement instead of civilian flee/defence. */
  boarding(): boolean {
    return this.breached && !this.protecting() && (this.mission.state.steps.escape.status === 'active' || this.mission.state.steps.depart.status === 'active') && (this.w.vehicles!.active === this.state.carId || distance(this.w.entities.get(1)!.transform, this.door()) < 12);
  }
  /** Cheat/test path (`completeObjective` before the breach): call the real tunnel breach; ordinary completion still requires the plaza rendezvous. */
  advance(): boolean {
    if (this.mission.state.states.breached) return false;
    this.state.startedAt = this.w.tick - guideMaxCalmTicks; this.state.guideDone ||= 1; this.update();
    return !!this.mission.state.states.breached;
  }
  /** Shared follow AI yields to the transport approach only during the escape. */
  companion(e: EntitySnapshot): boolean {
    if (!this.boarding()) return false;
    const w = this.w, door = w.vehicles!.passengerDoor(this.state.carId);
    if (distance(e.transform, door) < .7) w.vehicles!.boardPassenger(this.state.carId, e.id);
    else { const target = this.boardingTarget(e, door); this.unjamBoarding(e, target); if (!this.approachBoardingSpot(e, target, 8)) w.npcs!.move(e, target, 8, e.companion!, .2, 2400); }
    return true;
  }
  /** Newly rescued zoo residents also belong to the complete living group. */
  roster(): number[] {
    this.refreshRoster();
    return [...this.rosterCache];
  }
  /** A boarding member jammed between the fallen elephant and the packed group
   * (r27-l8board: queue head stuck 30+ s) has no legal step: every proposal is
   * rejected by the atomic contact commit. After 1.5 s without progress it is
   * moved at most 1.5 m along its route to the nearest physically clear spot
   * (the same relocation the door approach already uses), then walks on. */
  private unjamBoarding(e: EntitySnapshot, target: Point): void {
    const w = this.w, p = e.transform, seen = this.boardingProgress.get(e.id);
    if (!seen || Math.hypot(p.x - seen.x, p.z - seen.z) > .25) { this.boardingProgress.set(e.id, { x: p.x, z: p.z, tick: w.tick }); return; }
    const toTarget = distance(p, target);
    if (w.tick - seen.tick < 90 || toTarget < 1) return;
    const step = Math.min(1.5, toTarget);
    w.solids.relocate(e, { x: p.x + (target.x - p.x) / toTarget * step, y: p.y, z: p.z + (target.z - p.z) / toTarget * step }, 'l8.board-unjam', 1.5, false);
    this.boardingProgress.set(e.id, { x: e.transform.x, z: e.transform.z, tick: w.tick });
  }
  private boardingTarget(e: EntitySnapshot, goal: Point): Point {
    const w = this.w;
    // Large fallen animals stay solid but do not enter the static nav grid.
    // Retain swept detour legs so a companion cannot hold the queue against
    // the elephant's body after winning the fight.
    let detour = this.boardingDetours.get(e.id);
    if (detour && (w.tick < detour.tick || Math.hypot(detour.goal.x - goal.x, detour.goal.z - goal.z) > .5)) { this.boardingDetours.delete(e.id); detour = undefined; }
    while (detour?.path.length && Math.hypot(e.transform.x - detour.path[0].x, e.transform.z - detour.path[0].z) < .3) detour.path.shift();
    if (!detour?.path.length) {
      const path = corpseDetour(w, e, goal);
      if (path) { detour = { goal: { ...goal }, path, tick: w.tick }; this.boardingDetours.set(e.id, detour); }
      else { this.boardingDetours.delete(e.id); detour = undefined; }
    }
    return detour?.path[0] ?? goal;
  }
  /** The parked nav AABB encloses free space beside a rotated hull. Use the
   * canonical physical sweep for the final clear approach, without changing
   * capsule collision, movement response, speed or the actual boarding reach. */
  private approachBoardingSpot(e: EntitySnapshot, door: Point, speed: number): boolean {
    const w = this.w, radius = actorRadius(e);
    let dx = door.x - e.transform.x, dz = door.z - e.transform.z, distance = Math.hypot(dx, dz), stop = .2;
    if (distance <= stop) return false;
    let direction = { x: dx / distance, z: dz / distance };
    // The nearest nav-grid point can be farther than 3 m from the door.
    // A physically clear approach must be allowed from there as well; otherwise
    // the corgi holds the head of the passenger queue forever.
    if (w.solids.sweep(e, direction, distance, radius, false, false) < distance - .001) {
      // A follower already inside the conservative parked AABB cannot obtain
      // any visible grid start. Walk to its nearest physically clear exterior,
      // then let the ordinary route planner take over around the vehicle.
      const car = w.entities.get(this.state.carId)!, p = car.transform, def = vehicleDef(car.archetype);
      const c = Math.abs(Math.cos(p.yaw)), s = Math.abs(Math.sin(p.yaw));
      const hx = c * def.length / 2 + s * def.width / 2, hz = s * def.length / 2 + c * def.width / 2;
      if (Math.abs(e.transform.x - p.x) >= hx + radius || Math.abs(e.transform.z - p.z) >= hz + radius) return false;
      // Existing contact commits permit up to2cm penetration. Project that
      // shallow contact out before sweeping away; never shrink the capsule.
      if (!w.solids.clear(e.transform, radius, e.id, false, 0)) w.solids.relocate(e, { ...e.transform }, 'l8.apc-door-contact', .02, false);
      const margin = radius + .3;
      const exits = [{ x: p.x - hx - margin, z: e.transform.z }, { x: p.x + hx + margin, z: e.transform.z }, { x: e.transform.x, z: p.z - hz - margin }, { x: e.transform.x, z: p.z + hz + margin }];
      exits.sort((a, b) => Math.hypot(a.x - e.transform.x, a.z - e.transform.z) - Math.hypot(b.x - e.transform.x, b.z - e.transform.z));
      const exit = exits.find(at => {
        const x = at.x - e.transform.x, z = at.z - e.transform.z, length = Math.hypot(x, z);
        return w.infected!.nav.clear(at.x, at.z, radius, true) && length > .05 && w.solids.sweep(e, { x: x / length, z: z / length }, length, radius, false, false) >= length - .001;
      });
      if (!exit) return false;
      dx = exit.x - e.transform.x; dz = exit.z - e.transform.z; distance = Math.hypot(dx, dz); stop = .05;
      direction = { x: dx / distance, z: dz / distance };
    }
    const state = e.locomotion ??= motionResponse();
    if (state.updatedAt === w.tick) return true;
    const velocity = Math.min(speed, Math.max(0, distance - stop) * 4) * Status.speed(e);
    respond(state, direction.x * velocity, direction.z * velocity); state.updatedAt = w.tick;
    const magnitude = Math.hypot(state.vx, state.vz);
    if (magnitude > 0) {
      const heading = { x: state.vx / magnitude, z: state.vz / magnitude };
      // As with normal NPC movement, the shared commit resolves body contacts.
      const step = w.solids.sweep(e, heading, magnitude * FIXED_DT, radius, false, false);
      w.solids.wrote(e, 'l8.apc-door-approach');
      e.transform.x += heading.x * step; e.transform.z += heading.z * step;
      const actualX = heading.x * step / FIXED_DT, actualZ = heading.z * step / FIXED_DT;
      if (e.companion?.velocity) { e.companion.velocity.x = actualX; e.companion.velocity.z = actualZ; }
      if (Math.hypot(actualX - state.vx, actualZ - state.vz) > .05) { state.vx = actualX; state.vz = actualZ; state.ax = state.az = 0; }
      e.transform.yaw = faceMotion(state, e.transform.yaw, actualX, actualZ);
      w.spatial.set(e.id, e.transform.x, e.transform.z);
    }
    return true;
  }
  follower(e: EntitySnapshot): boolean {
    const w = this.w, s = this.state, c = e.civilian!, p = w.entities.get(1)!;
    c.state = 'calm'; c.story = null; c.survivor!.cover = false;
    const door = w.vehicles!.passengerDoor(s.carId), boarding = this.boarding();
    const slot = c.survivor!.slot, velocity = p.survivor!.velocity;
    // Catch-up and the tightly spaced APC queue need the shared follower
    // response: civilian steering overshoots these changing targets.
    if (this.breached) c.survivor!.briskAt = w.tick;
    const goal = formationSlot(p.transform, leaderHeading(p.transform.yaw, velocity), slot);
    const plaza = this.mission.def.anchors['central-plaza'];
    // r31-nadia: once Nadia has led the courier to the plaza the group settles inside the ring around its centre.
    if (!this.breached && s.guideDone === 2 && distance(p.transform, plaza) <= (plaza.radius ?? 6) + 4) {
      const angle = slot * 2.399, r = Math.min(4.6, 1.8 + .72 * Math.sqrt(slot + 1));
      goal.x = plaza.x + Math.cos(angle) * r; goal.z = plaza.z + Math.sin(angle) * r;
    }
    // Keep the evacuees on the courier's rear flank, within the camera and rifle
    // detail's defence. Sending them all the way back to a distant entry left
    // them outside the fight's visible rescue window. The elephant yard retains
    // its outside holding point so the column cannot block the opening charge.
    const encounter = s.arenas.find(a => a.phase > 0 && a.phase < 3);
    const arena = l8BossArenas.find(a => a.id === encounter?.id);
    if (!boarding && arena && distance(p.transform, arena.centre) < arena.radius + 8) {
      const dx = arena.centre.x - arena.entry.x, dz = arena.centre.z - arena.entry.z, length = Math.hypot(dx, dz) || 1;
      const heading = { x: dx / length, z: dz / length };
      const flank = { x: p.transform.x - heading.z * 6, z: p.transform.z + heading.x * 6 };
      const other = { x: p.transform.x + heading.z * 6, z: p.transform.z - heading.x * 6 };
      const hold = arena.id === 'elephant' ? arena.entry : w.infected!.nav.clear(flank.x, flank.z, .4) ? flank : other;
      Object.assign(goal, formationSlot(hold, heading, slot));
      // r33-l8route: the group holds INSIDE the enclosure with the courier (a hold point behind a fence would leave it outside the closing gate).
      const zone = l8Route.find(r => r.id === arena.id)!.zone;
      if (!boarding && arena.id !== 'elephant') { goal.x = Math.min(zone.x1 - 1.5, Math.max(zone.x0 + 1.5, goal.x)); goal.z = Math.min(zone.z1 - 1.5, Math.max(zone.z0 + 1.5, goal.z)); }
    }
    let target = boarding ? door : w.infected!.nav.clear(goal.x, goal.z, .35) ? goal : p.transform;
    let queueIndex = 0;
    if (boarding) {
      const vehicle = w.vehicles!.cars.get(s.carId)!.entity.vehicle!;
      this.refreshRoster();
      const passengers = this.passengersCache;
      // Build the seated lookup once for this call, rather than scanning every
      // vehicle seat for every group member, once again for every follower.
      const seated = this.seatedPassengers; seated.clear();
      for (const passenger of vehicle.passengers ?? []) if (passenger.phase === 'seated') seated.add(passenger.id);
      let ahead = 0;
      for (const id of passengers) {
        if (seated.has(id)) continue;
        if (id === e.id) { queueIndex = ahead; break; }
        ahead++;
      }
      if (queueIndex) {
        const car = w.entities.get(s.carId)!, dx = door.x - car.transform.x, dz = door.z - car.transform.z, length = Math.hypot(dx, dz) || 1;
        // Keep the complete roster near the APC instead of stretching a
        // two-column queue beyond G-13's ten-metre waiting distance. Metre
        // spacing leaves the ordinary 0.35 m capsules clear in both axes.
        const columns = Math.max(2, Math.ceil((passengers.length - 1) / 12) * 2);
        const column = (queueIndex - 1) % columns, row = Math.floor((queueIndex - 1) / columns), half = columns / 2;
        // A 2.5 m centre passage lets the current head (including the corgi's
        // long capsule) reach the entry before the waiting rows advance.
        const side = (column < half ? -1 : 1) * (1.6 + column % half * .9);
        const queue = { x: door.x + dx / length * (2 + row * 1.2) - dz / length * side, z: door.z + dz / length * (2 + row * 1.2) + dx / length * side };
        target = w.infected!.nav.clear(queue.x, queue.z, actorRadius(e)) && w.solids.clear({ ...queue, y: e.transform.y }, actorRadius(e), e.id, false) ? queue : e.transform;
      }
    }
    if (boarding) { target = this.boardingTarget(e, target); this.unjamBoarding(e, target); }
    if (boarding && queueIndex === 0 && distance(e.transform, door) < .7) w.vehicles!.boardPassenger(s.carId, e.id);
    else if (distance(e.transform, target) > .3) {
      // The roster is healed on arrival and must keep pace through the long
      // board-up; a stale carried injury flag must not leave passengers behind.
      // A follower displaced from its assigned slot catches up, then settles
      // back to courier pace. This avoids making the courier stop for it.
      // Nearby evacuees walk with the courier instead of repeatedly sprinting into their slots.
      // Keep R13's full catch-up outside the band and its boarding approach unchanged.
      const courierSpeed = Math.hypot(velocity.x, velocity.z);
      const cap = !boarding && courierSpeed > .8 && distance(e.transform, p.transform) <= 10 ? courierSpeed * 1.05 : 6.4;
      const speed = Math.min(cap, 4.5 + Math.max(0, distance(e.transform, target) - 2) * .6);
      if (!boarding || !this.approachBoardingSpot(e, target, speed)) w.npcs!.move(e, target, speed, c, boarding ? .2 : 0, 2400);
    }
    if (c.ally && !boarding) {
      c.ally.run = null; c.ally.post = null; c.ally.hold = true;
      updateAlly(w, e, (a, b) => w.infected!.nav.visible(a, b, 0));
    }
    return true;
  }
  /** The seated group as a transfer payload; null when nobody is seated (only the debug objective cheat completes the escape unboarded). */
  transferOrNull() { try { return this.w.vehicles!.transfer(this.state.carId); } catch { return this.mission.state.states.aboard ? this.w.vehicles!.transfer(this.state.carId) : null; } }
  result() {
    const transport = this.transferOrNull();
    if (!transport) return { rescued: 0, survivors: [], escapedSurvivors: [] };
    const escaped = transport.occupants.filter(e => e.id !== 1 && !e.companion);
    if (this.w.progression?.campaign) this.w.progression.campaign.transport = transport;
    return { rescued: escaped.length, survivors: escaped.map(e => e.civilian?.survivor?.key ?? `survivor-${e.id}`), escapedSurvivors: escaped };
  }
  snapshot() { return { state: structuredClone(this.state), prepared: this.prepared, doors: [...this.w.openDoors].map(([id, door]) => [id, { ...door }] as const), tick: this.w.tick }; }
  restore(saved: unknown): void {
    const data = saved as ReturnType<LevelEightZoo['snapshot']>, delta = this.w.tick - data.tick;
    this.state = structuredClone(data.state); this.state.arenas ??= []; this.prepared = data.prepared;
    if (!data.state.arenas) {
      this.bosses.prepare();
      for (const arena of this.state.arenas) for (const id of arena.ids) if (this.w.entities.get(id)?.infected && this.w.entities.get(id)!.health.current > 0) this.bosses.turned(id);
    }
    this.bosses.restore(delta);
    this.w.openDoors.clear();
    for (const [id, door] of data.doors) this.w.openDoors.set(id, { ...door, at: door.at + delta });
    // A checkpoint restored on tick zero can have a legitimate breach time of zero.
    this.state.startedAt += delta; if (this.breached) this.state.breachedAt += delta; if (this.state.nextWave) this.state.nextWave += delta;
    this.state.plazaBursts ??= 0; this.state.plazaWaveAt ??= 0; if (this.state.plazaWaveAt) this.state.plazaWaveAt += delta; this.state.sealedAt ??= 0; this.state.routeStage ??= -1; this.state.routeNode ??= 0; this.state.legWaves ??= 0; if (this.state.sealedAt) this.state.sealedAt += delta;
    this.state.guideDone ??= 0; this.state.guideLeg ??= 0; this.state.guideArrivedAt ??= 0; this.state.lionUntil ??= 0;
    for (const key of ['broadcastAt', 'greetingAt', 'haleGreetingAt', 'gateToastAt', 'departureAt', 'haleFallAt', 'guideArrivedAt', 'lionUntil'] as const) if (this.state[key]) this.state[key] += delta;
    if (this.state.departureFrom) this.state.chaseAt += delta;
    this.w.storyLock = this.state.departureFrom && !this.mission.state.states.departed ? { scripted: null, skip: false } : null;
    for (const arrival of this.state.arrivals) arrival.tick += delta;
    for (const outlet of this.state.outlets) { outlet.next += delta; for (const walk of outlet.walking ?? []) walk.until += delta; }
    this.w.infected!.director.levelCap = 200; this.w.infected!.director.strict = true; this.w.infected!.director.reserved = 1;
  }
}
