import { deterministicAtan2 } from '../../core/deterministicMath';
import { l3 } from '../../data/l3';
import { l8EncounterGates, l8PlazaCell, l8Route, inRect } from '../../data/l8Bosses';
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
import type { HouseEmergence } from '../outbreak/HouseEmergence';
import { corpseDetour, formationSlot, leaderHeading, requireClearPoint } from './missionHelpers';
import { L8BossArenas, type L8ArenaState } from './L8BossArenas';
import { surrenderHeavyWeapons, gateToastDelay } from './L8Gate';

export interface L8ZooState {
  arenas: L8ArenaState[];
  startedAt: number; breachedAt: number; nextWave: number; alphas: number; carId: number; busId: number;
  roster: number[]; guards: number[]; animals: number[]; outlets: HouseEmergence[]; perimeterOutlets?: Point[];
  arrivals: { id: number; outlet: number; tick: number; alpha: boolean }[];
  escapeCheckpoint: boolean;
  keeperId: number; pondKeeperId: number; haleId: number; reyesId: number; dogId: number; broadcastAt: number; greetingAt: number; lionSpoken: boolean; haleGreetingAt: number; gateToastAt?: number;
  departureAt: number; chaseAt: number; departureFrom: Transform | null; haleFallAt: number; turnedAnimalId: number; animalInterceptionId: number; animalBiteStarted: boolean; keeperAttacked: boolean;
  /** Nadia's guided walk: 0 leading, 1 aborted (she is gone/turned), 2 arrived at the entry gate. */
  guideDone: number; guideLeg: number; guideArrivedAt: number; guideWaiting: boolean; lionUntil: number; guideRouteVersion?: number; guideAnimalLines?: number; infectionSetupAt?: number; infectionFeedLineAt?: number; infectionStoryLines?: number;
  lastJoinCue?: number;
  /** Keeper killed during the breach, retained in the lion enclosure. */
  lionStoryKeeperId?: number;
  /** Outbreak arrivals already placed inside the broken zebra paddock. */
  zebraStoryAttackers?: number[];
  perimeterGateBreaks?: (number | null)[]; perimeterGateReleased?: boolean[]; perimeterGateSounded?: boolean[]; gateBreachLineAt?: number;
  /** r33-l8route: tick the plaza doors shut (0 = not yet), the route-marker leg/node, and the regions whose first walk-in wave has run (bit 1 north, 2 south, 4 east). */
  sealedAt: number; routeStage: number; routeNode: number; legWaves: number; plazaWaveAt: number; plazaBursts: number; driverAt?: number; departureRun?: number;
  /** r36-l8gates: ticks of the "Protect the group" hold the courier spent away from the plaza (the hold pauses meanwhile). */
  protectAway?: number;
}
/** One-way perimeter loop on the public lanes, ending at the ticket-gate approach. */
const guideRoute: Point[] = [{ x: -24, z: 64 }, { x: -24, z: 0 }, { x: 24, z: 0 }, { x: 24, z: 64 }, { x: 0, z: 64 }, { x: 0, z: 70 }];
const guideIntroTicks = 4 * 60, guideRestTicks = 15 * 60, guideMaxCalmTicks = 180 * 60;
const guideRemarks: { at: Point; radius: number; bit: number; line: string }[] = [
  { at: { x: 24, z: 32 }, radius: 18, bit: 8, line: 'L8.nadia-zebra-pass' },
  { at: { x: -24, z: 32 }, radius: 18, bit: 64, line: 'L8.nadia-elephant-pass' },
];
const perimeterGates = [
  { x: 0, z: -86, halfX: 2.7, halfZ: .4, spawn: { x: 0, z: -115 } },
  { x: 0, z: 86, halfX: 2.7, halfZ: .4, spawn: { x: 0, z: 89 } },
  { x: -116, z: 0, halfX: .4, halfZ: 2.7, spawn: { x: -126.8, z: 0 } },
  { x: 116, z: 80, halfX: .4, halfZ: 2.7, spawn: { x: 126.8, z: 80 } },
];
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const sIsClosed = (breakAt: number | null | undefined, tick: number) => breakAt == null || tick < breakAt;
/** Keep even a full zoo rescue roster close enough to regroup during real stops. */
function l8FormationSlot(leader: Point, heading: Point, slot: number, natural = true): Point {
  const target = formationSlot(leader, heading, slot, natural), compressedRows = Math.max(0, Math.floor(slot / 3) - 3);
  target.x += heading.x * compressedRows * .45; target.z += heading.z * compressedRows * .45;
  return target;
}
/** Zoo story owns timing/entrances; the shared outbreak owns all bites, rescues and same-id transformations. */
export class LevelEightZoo {
  readonly bosses: L8BossArenas;
  state: L8ZooState = { arenas: [], startedAt: 0, breachedAt: 0, nextWave: 0, alphas: 0, carId: 0, busId: 0, roster: [], guards: [], animals: [], outlets: [], arrivals: [], escapeCheckpoint: false, keeperId: 0, pondKeeperId: 0, haleId: 0, reyesId: 0, dogId: 0, broadcastAt: 0, greetingAt: 0, lionSpoken: false, haleGreetingAt: 0, departureAt: 0, chaseAt: 0, departureFrom: null, haleFallAt: 0, turnedAnimalId: 0, animalInterceptionId: 0, animalBiteStarted: false, keeperAttacked: false, guideDone: 0, guideLeg: 0, guideArrivedAt: 0, guideWaiting: false, lionUntil: 0, infectionStoryLines: 0, sealedAt: 0, routeStage: -1, routeNode: 0, legWaves: 0, plazaWaveAt: 0, plazaBursts: 0 };
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
      const gateSideZ = speciesId === 'flamingo' ? 12.5 : compact ? (anchor.z < 0 ? 8 : -8) : anchor.z < 0 ? 18 : -18;
      const gateX = speciesId === 'flamingo' ? 0 : Math.sign(anchor.x) * (compact ? 60 : 45);
      const at = this.point({ x: gateX + offset * 2, z: anchor.z + gateSideZ }, radius);
      const phase = offset + species.indexOf(speciesId);
      const routineRadius = speciesId === 'flamingo' ? .4 : 1.4;
      const waypoints = Array.from({ length: 4 }, (_, n) => ({ x: at.x + Math.cos((phase + n) * Math.PI / 2) * routineRadius, z: at.z + Math.sin((phase + n) * Math.PI / 2) * routineRadius }));
      s.animals.push(civilians.spawn('cashier', at, { zooAnimal: speciesId, waypoints }));
    }
    this.bosses.prepare();
    const tour = [{ x: 24, z: 64 }, { x: 24, z: 0 }, { x: 45, z: 0 }, { x: -45, z: 0 }, { x: 0, z: 0 }];
    const keeper = this.point({ x: 3, z: 66 }), staff = zooStaffLook(6);
    s.keeperId = outbreak.spawnPedestrian(keeper, { ...staff, walkSpeed: 4.6, waypoints: tour,
      schedule: [...tour.map(target => ({ activity: 'walk' as const, anchor: 'zoo/tour', target, ticks: 1 })),
        { activity: 'look', anchor: 'zoo/plaza', target: tour.at(-1)!, facing: { x: -4, z: 0 }, ticks: 36_000 }] });
    const pondPost = this.point({ x: 0, z: -57 });
    s.pondKeeperId = outbreak.spawnPedestrian(pondPost, { ...zooStaffLook(0), waypoints: [pondPost, { x: 1, z: -57 }] });
    // The keeper stands outside the pond's north fence, reachable by the
    // opening cohort and still rescuable through ordinary outbreak rules.
    w.entities.get(s.pondKeeperId)!.civilian!.l1!.haven = { ...pondPost, route: [], leg: 0 };
    for (const [key, x] of [['majorHale', -4], ['privateReyes', -2]] as const) {
      const at = this.point({ x, z: 0 });
      const id = outbreak.spawnPedestrian(at, { role: 'soldier', model: 'npc.national-guard', handProp: 'rifle', waypoints: [at, { x, z: 2 }] });
      w.entities.get(id)!.civilian!.ally = { ...allyState('soldier', at), gun: { ...l3.soldiers.gun }, weapon: 'rifle' };
      this.mission.state.actors[key] = id;
      if (key === 'majorHale') s.haleId = id; else s.reyesId = id;
    }
    this.mission.state.actors.nadia = s.keeperId;
    // Service tunnel mouths remain scenery, but never emit infected. All four
    // perimeter gates own the outbreak entry and their native blockers.
    s.outlets = [];
    s.perimeterGateBreaks = [null, null, null, null]; s.perimeterGateReleased = [false, false, false, false]; s.perimeterGateSounded = [false, false, false, false];
    s.outlets = []; s.perimeterOutlets = perimeterGates.map(({ x, z }) => ({ x, z }));
    this.syncPerimeterGates();
    this.mission.def.anchors['l8-route'] = { x: 0, z: 0, radius: 6 };
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
    // PO 2026-11-22 "L8 is not starting. Nothing happened after the level started.": the courier starts at the entry gate,
    // which is also the tour's last stop, so a ring there sat under her feet while Nadia walked off. The ring now marks
    // Nadia's next stop (fixed until she reaches it), ending at the entry gate.
    Object.assign(this.mission.def.anchors['l8-route'], { x: guideRoute[0].x, z: guideRoute[0].z });
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
  private syncPerimeterGates(): void {
    const w = this.w, s = this.state;
    s.perimeterGateBreaks ??= [null, null, null, null]; s.perimeterGateReleased ??= [false, false, false, false]; s.perimeterGateSounded ??= [false, false, false, false];
    perimeterGates.forEach((gate, i) => {
      const id = 8200 + i, open = s.perimeterGateBreaks![i] !== null && w.tick >= s.perimeterGateBreaks![i]!;
      if (open) w.interactables!.unblock(id);
      else w.interactables!.block(id, { x: gate.x, y: 2, z: gate.z, halfX: gate.halfX, halfY: 2, halfZ: gate.halfZ, entityId: id });
    });
  }
  /** Gate arrivals begin outside the zoo only when SpawnDirector confirms a safe, unseen, clear point. */
  private releaseGate(index: number, count = 1, targetId = 1, archetype = 'infected.runner'): number[] {
    const w = this.w, ai = w.infected!, gate = perimeterGates[index], spawned: number[] = [];
    if (!gate) return spawned;
    for (let n = 0; n < count; n++) {
      const spread = (n % 3 - 1) * .8, at = gate.halfX > gate.halfZ ? { x: gate.spawn.x + spread, z: gate.spawn.z } : { x: gate.spawn.x, z: gate.spawn.z + spread };
      // Other arrivals and pending turns may fill the director between waves.
      // Keep the mission running and admit only the capacity that remains.
      if (ai.director.count + ai.director.pendingTurns >= ai.director.cap || !ai.pool.length) break;
      if (!ai.director.safe(archetype, at)) continue;
      const id = ai.spawn(archetype, at, { state: 'chase' });
      const entity = w.entities.get(id)!; if (targetId !== 1) entity.infected!.arenaCarrier = targetId;
      ai.pursueTarget(id, targetId, targetId === 1 ? 30 : undefined);
      if (index === 0) {
        // The south cohort crosses the opened perimeter mouth before reacquiring its target.
        entity.infected!.scripted = { x: spread, z: -82 };
        entity.infected!.breachApproach = 'l8-south-gate';
      }
      if (index === 2) {
        // The west opening is narrow in X; keep the cohort lined up within its Z span.
        entity.infected!.scripted = { x: -112, z: spread };
        entity.infected!.breachApproach = 'l8-west-gate';
      }
      if (index === 1) {
        // The ticket pavilion blocks the direct sight line from the north
        // opening; route the outside cohort through the gate and around it.
        entity.infected!.scripted = { x: spread, z: 82 };
        entity.infected!.breachApproach = 'l8-north-gate';
      }
      if (index === 3) {
        // The east perimeter opening is a narrow mouth off the ring road;
        // send its outside cohort through the actual breach before pursuit.
        entity.infected!.scripted = { x: 115, z: 80 };
        entity.infected!.breachApproach = 'l8-gate';
      }
      this.state.arrivals.push({ id, outlet: index, tick: w.tick, alpha: archetype === 'infected.alpha' });
      spawned.push(id);
    }
    return spawned;
  }
  /** Animal carriers enter through an already broken perimeter gate, never a service door. */
  arenaCarrier(targetId: number): number {
    const nearest = perimeterGates.map((gate, index) => ({ index, d: distance(gate.spawn, this.w.entities.get(targetId)!.transform) }))
      .sort((a, b) => a.d - b.d).find(row => !sIsClosed(this.state.perimeterGateBreaks?.[row.index], this.w.tick));
    return nearest ? this.releaseGate(nearest.index, 1, targetId)[0] ?? 0 : 0;
  }
  /** The living group: companions and rescued survivors that are not aboard. */
  followers(): EntitySnapshot[] {
    return this.passengers().map(id => this.w.entities.get(id)).filter((e): e is EntitySnapshot => !!e && e.health.current > 0 && !e.companion && !e.infected && !e.infection && e.passengerOf === undefined);
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
    if (!keeper || !c || keeper.infection || keeper.health.current <= 0 || c.state !== 'calm') {
      s.guideDone = 1; const gate = guideRoute.at(-1)!; Object.assign(this.mission.def.anchors['l8-route'], { x: gate.x, z: gate.z }); return;
    }
    c.pauseUntil = t + 2; // the shared tour schedule stays suspended while she leads
    const stand = (look: Point) => {
      keeper.transform.yaw = deterministicAtan2(look.x - keeper.transform.x, look.z - keeper.transform.z);
      keeper.motion = { velocity: { x: 0, z: 0 }, speed: 0, moving: false, distance: keeper.motion?.distance ?? 0 };
    };
    if (t < s.startedAt + guideIntroTicks) { stand(player.transform); return; }
    const gap = distance(keeper.transform, player.transform);
    if (gap > 10) s.guideWaiting = true; else if (gap < 7) s.guideWaiting = false;
    if (s.guideWaiting) { stand(player.transform); return; }
    const target = guideRoute[s.guideLeg];
    w.npcs!.move(keeper, target, gap < 6 ? 5.2 : 5, c, .3, 16000);
    for (const remark of guideRemarks) {
      if ((s.guideAnimalLines ?? 0) & remark.bit || distance(player.transform, remark.at) > remark.radius) continue;
      s.guideAnimalLines = (s.guideAnimalLines ?? 0) | remark.bit;
      this.mission.radio(remark.line);
      break;
    }
    if (distance(keeper.transform, target) > 1) return;
    const nextStop = guideRoute[Math.min(s.guideLeg + 1, guideRoute.length - 1)];
    Object.assign(this.mission.def.anchors['l8-route'], { x: nextStop.x, z: nextStop.z });
    if (++s.guideLeg >= guideRoute.length) {
      s.guideDone = 2; s.guideArrivedAt = t;
      c.pauseUntil = 0; c.scheduleStep = c.schedule!.length - 1; c.activityUntil = 0;
    }
  }
  private story(): void {
    const s = this.state, w = this.w, t = w.tick, player = w.entities.get(1)!;
    const keeper = w.entities.get(s.keeperId), hale = w.entities.get(s.haleId);
    if (this.breached && (s.zebraStoryAttackers?.length ?? 0) < 2) {
      const arena = s.arenas.find(a => a.id === 'zebra');
      const target = arena?.ids.map(id => w.entities.get(id)).find(e => e?.civilian && !e.infection && e.health.current > 0);
      const ai = w.infected!;
      const index = s.zebraStoryAttackers?.length ?? 0;
      const at = [{ x: 70, z: 39 }, { x: 70, z: 35 }][index];
      // Admit only unseen, physically clear arrivals and preserve their IDs in
      // the checkpoint. They use the same ordinary infected stats and attacks.
      if (target && at && ai.director.count + ai.director.pendingTurns < ai.director.cap && ai.pool.length && ai.director.safe('infected.runner', at)) {
        const id = ai.spawn('infected.runner', at, { state: 'chase' });
        ai.pursueTarget(id, target.id);
        w.entities.get(id)!.infected!.arenaCarrier = target.id;
        (s.zebraStoryAttackers ??= []).push(id);
      }
    }
    if (!s.infectionSetupAt && t >= s.startedAt + 300) {
      s.infectionSetupAt = t;
      this.mission.radio('L8.infection-setup');
    } else if (s.infectionSetupAt && !s.infectionFeedLineAt && t >= s.infectionSetupAt + 240) {
      s.infectionFeedLineAt = t;
      this.mission.radio('L8.infection-feed-store');
    }
    // Replenish the burn-site plume throughout the tour; one VFX burst lasts
    // only a few seconds and disappears well before the player reaches it.
    if (s.infectionSetupAt && !this.breached && (t - s.infectionSetupAt) % 120 === 0)
      w.events.emit({ type: 'vfx.effect', tick: t, kind: 'smoke-column', position: { x: 29, y: 0, z: 4 }, radius: 4 });
    for (const [bit, id, line, position] of [
      [1, 'lion', 'L8.story-lion', { x: -69, y: 0, z: -25 }],
      [2, 'zebra', 'L8.story-zebra', { x: 60, y: 0, z: 32 }],
      [4, 'gorilla', 'L8.story-gorilla', { x: 60, y: 0, z: -32 }],
      [8, 'monkey', 'L8.story-monkey', { x: -15, y: 0, z: 26 }],
      [16, 'flamingo', 'L8.story-flamingo', { x: 0, y: 0, z: -32 }],
    ] as const) {
      const arena = s.arenas.find(a => a.id === id);
      if (arena?.phase === 1 && !((s.infectionStoryLines ?? 0) & bit)) {
        s.infectionStoryLines = (s.infectionStoryLines ?? 0) | bit;
        w.events.emit({ type: 'vfx.effect', tick: t, kind: 'objective', position, radius: 2.5 });
        this.mission.radio(line);
      }
    }
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
    // The first wall breach can drop Hale with the impact while he waits outside
    // the yard. Keep the story beat at the entry, never by moving the group in.
    if (elephantArena?.phase === 1 && t - elephantArena.startedAt < 30 && elephant && hale && elephant.infected?.specialAttack?.move === 'elephant.charge' && !inRect(hale.transform, l8Route.find(stage => stage.id === 'elephant')!.zone) && distance(elephant.transform, hale.transform) < 12 && !this.mission.state.states['hale-keys'] && hale.civilian && hale.health.current > 0) {
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
    if (s.arenas.every(arena => arena.phase === 3) &&
        (this.mission.state.steps.escape.status === 'active' || this.mission.state.steps.depart.status === 'active') && this.passengersSeated() &&
        w.vehicles!.active === s.carId && !s.departureFrom) {
      s.departureAt = t;
    }
    if ((s.departureAt || s.departureFrom) && this.passengersSeated() &&
        w.vehicles!.active === s.carId) {
      if (!s.departureFrom) {
        s.chaseAt = t; s.departureFrom = { ...w.entities.get(s.carId)!.transform };
        w.storyLock = { scripted: null, skip: false }; w.clearInput();
        this.mission.radio('L8.departure');
      }
      // PO 2026-11-21: "the car is moving sideways ... through the wall and is also pushing a soldier". Drive forward along
      // the hull's own heading (forward = (cos yaw, -sin yaw)), only as far as the nav stays walkable, and ease in/out.
      const elapsed = t - s.chaseAt, from = s.departureFrom, fx = Math.cos(from.yaw), fz = -Math.sin(from.yaw);
      if (s.departureRun === undefined) {
        let clear = 0;
        for (let d = 1; d <= 42; d++) { if (!w.districts?.nav.walkable([from.x + fx * (d + 3), from.z + fz * (d + 3)])) break; clear = d; }
        s.departureRun = clear;
      }
      const u = Math.max(0, Math.min(1, elapsed / 360)), run = u * u * (3 - 2 * u);
      const x = from.x + fx * s.departureRun * run, z = from.z + fz * s.departureRun * run;
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
    this.syncPerimeterGates();
    this.bosses.update();
    if (t % 6 === 0) this.pickupNearbyResidents();
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
      s.perimeterGateBreaks = [t, t + 60, t + 120, t + 180];
      s.perimeterGateReleased = [false, false, false, false]; s.perimeterGateSounded = [false, false, false, false];
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
      // The keeper reached the lion rocks with feed before the breach. Use the
      // same finished-civilian representation as the authored L5 bodies so the
      // scene survives the breach checkpoint and later animal fights.
      const bodyAt = this.point({ x: -68, z: -26 }, .35);
      const bodyId = w.npcs!.civilians.outbreak!.spawnPedestrian(bodyAt, { ...zooStaffLook(0), waypoints: [bodyAt] });
      const body = w.entities.get(bodyId)!;
      body.civilian!.state = 'finished'; body.civilian!.entered = t - 600; body.health.current = 0;
      if (body.appearance) body.appearance.handProp = null;
      s.lionStoryKeeperId = bodyId;
      this.mission.checkpoint('breach', this.mission.def.anchors['zoo-entrance']);
      this.mission.radio('L8.nadia-safe');
      s.gateBreachLineAt = t + 60;
      // Admit each outside cohort as the four gates begin breaking. The first three cohorts
      // share the breach tick for the gate-pressure audit; the visible break remains staggered.
      const count = ai.director.tier === 'low' ? 3 : 6;
      for (let i = 0; i < perimeterGates.length; i++) {
        const arrivals = this.releaseGate(i, count);
        s.perimeterGateReleased[i] = arrivals.length > 0;
        if (i === 0 && arrivals.length && s.animals[5]) {
          s.animalInterceptionId = arrivals[0];
          w.entities.get(arrivals[0])!.infected!.arenaCarrier = s.animals[5];
          ai.pursueTarget(arrivals[0], s.animals[5]);
        }
      }
    }
    if (s.gateBreachLineAt && t >= s.gateBreachLineAt) { s.gateBreachLineAt = 0; this.mission.radio('L8.hale-enclosures'); }
    if (this.breached) for (let i = 0; i < perimeterGates.length; i++) {
      if (sIsClosed(s.perimeterGateBreaks?.[i], t)) continue;
      if (!s.perimeterGateSounded![i]) {
        const gate = perimeterGates[i], id = 8200 + i, position = { x: gate.x, y: 1.5, z: gate.z };
        w.events.emit({ type: 'barricade.sound', tick: t, sourceId: id, position, phase: 'break', hp: 0, maxHp: 100 });
        w.events.emit({ type: 'vfx.effect', tick: t, kind: 'objective', position, radius: 2 });
        s.perimeterGateSounded![i] = true;
      }
      const count = ai.director.tier === 'low' ? 3 : 6;
      const arrivals = s.perimeterGateReleased?.[i] ? [] : this.releaseGate(i, count);
      if (arrivals.length) {
        s.perimeterGateReleased![i] = true;
        if (i === 0 && !s.animalInterceptionId && s.animals[5]) {
          s.animalInterceptionId = arrivals[0];
          w.entities.get(arrivals[0])!.infected!.arenaCarrier = s.animals[5];
          ai.pursueTarget(arrivals[0], s.animals[5]);
        }
      }
      if (i === 0 && !s.dogId) {
        const id = this.releaseGate(i, 1, s.pondKeeperId, 'infected.dog')[0];
        if (id) { w.entities.get(id)!.infected!.variant = 'inf.dog-k9'; s.dogId = id; }
      }
    }
    if (this.breached) this.reyesFallback();
    if (this.protecting() && this.awayFromPlaza()) s.protectAway = (s.protectAway ?? 0) + 1;
    this.mission.setState('apc-destroyed', w.entities.get(s.carId)!.health.current <= 0);
    const seated=this.w.vehicles!.active===s.carId;
    this.mission.setState('player-boarded',seated);
    // r25-l8cues: while the group is under the opening shock the marker rings the plaza where they stand (it was blank for the first 30 s).
    if (!this.breached) {
      const guide = w.entities.get(s.keeperId);
      if (guide) {
        // Nadia's next stop while she leads (fixed until she reaches it), then the entry gate.
        const destination = s.guideDone ? guideRoute.at(-1)! : guideRoute[Math.min(s.guideLeg, guideRoute.length - 1)];
        Object.assign(this.mission.def.anchors['l8-route'], { x: destination.x, z: destination.z });
        const step = this.mission.def.steps.find(value => value.id === 'sanctuary');
        if (step) { step.text = 'Follow Nadia'; step.anchor = 'l8-route'; step.waypoint = true; }
        this.mission.state.marker = 'l8-route';
      }
    }
    else if(seated)this.mission.state.marker=null;
    // PO 2026-11-18: "Back to the plaza!" must show the plaza on the radar, whichever step is active.
    else if(this.protecting())this.mission.state.marker=this.mission.state.steps.escape.status==='active'||this.awayFromPlaza()?'central-plaza':null;
    else if(this.mission.state.steps.escape.status==='active'||this.mission.state.steps.depart.status==='active') {
      const next = s.arenas.find(a => a.phase !== 3);
      const step = this.mission.def.steps.find(value => value.id === 'escape');
      if (next) {
        const stage = l8Route.find(value => value.id === next.id)!, p = w.entities.get(1)!.transform;
        let text: string, at: Point;
        if (!s.sealedAt) { text = 'Return to the plaza'; at = this.mission.def.anchors['central-plaza']; }
        else if (next.phase > 0) {
          const alive = next.ids.filter(id => (w.entities.get(id)?.health.current ?? 0) > 0).length;
          const label = next.id === 'flamingo' ? 'flamingos' : next.id === 'monkey' ? 'monkeys' : next.id === 'zebra' ? 'zebras' : next.id === 'lion' ? 'lions' : next.id;
          text = `Kill ${label} ${next.ids.length - alive}/${next.ids.length}`;
          // The bounded-arena objective stays on safe ground rather than following airborne animals.
          at = { x: (stage.zone.x0 + stage.zone.x1) / 2, z: (stage.zone.z0 + stage.zone.z1) / 2 };
          // s78 QA: with the last one or two flamingos idling at the far rim, a centre marker
          // reads as "done here". Point at the nearest survivor, clamped 2 m inside the pen.
          if (next.id === 'flamingo' && alive > 0 && alive <= 2) {
            let best: Point | null = null, bestD = Infinity;
            for (const id of next.ids) {
              const e = w.entities.get(id);
              if (!e || e.health.current <= 0) continue;
              const d = distance(p, e.transform); if (d < bestD) { bestD = d; best = e.transform; }
            }
            if (best) at = { x: Math.min(stage.zone.x1 - 2, Math.max(stage.zone.x0 + 2, best.x)), z: Math.min(stage.zone.z1 - 2, Math.max(stage.zone.z0 + 2, best.z)) };
          } }
        else {
          const index = l8Route.indexOf(stage);
          if (inRect(p, stage.zone)) { at = { x: (stage.zone.x0 + stage.zone.x1) / 2, z: (stage.zone.z0 + stage.zone.z1) / 2 }; text = stage.text; }
          else {
            if (s.routeStage !== index) {
              s.routeStage = index; s.routeNode = 0;
              for (let node = 1; node < stage.nodes.length; node++) if (distance(p, stage.nodes[node]) < distance(p, stage.nodes[s.routeNode])) s.routeNode = node;
            }
            // Keep the world ring on the next real destination (the pen entry).
            // Route-node progress is navigation state; it must not drag the checkpoint ahead of the courier.
            at = stage.nodes.at(-1)!; text = stage.text;
          }
        }
        Object.assign(this.mission.def.anchors['l8-route'], { x: at.x, z: at.z });
        if (step) { step.text = text; step.anchor = 'l8-route'; step.waypoint = true; }
        this.mission.state.marker = 'l8-route';
      } else {
        if (step) {
          const ids = this.passengers(), seats = w.entities.get(s.carId)!.vehicle!.passengers ?? [];
          const count = ids.filter(id => seats.some(seat => seat.id === id && seat.phase === 'seated')).length;
          const boarding = this.boarding();
          const allAboard = count === ids.length;
          step.text = allAboard ? `Board the armored vehicle · ${count}/${ids.length} aboard` : boarding ? `Cover the survivors while they board · ${count}/${ids.length} aboard` : 'Lead the group to the armored vehicle';
          step.anchor = 'exit'; step.waypoint = !boarding || allAboard;
        }
        this.mission.state.marker = 'exit';
      }
    }
    if (!this.breached) return;
    this.escortGuards();
    if (t >= s.nextWave) {
      // The animal arenas carry the outbreak after the first tunnel surge (PO 11-08).
      // Four ordinary arrivals sustain the opening, without turning the zoo into another horde slaughter.
      s.nextWave = t + 36_000;
      for (let i = 0; i < perimeterGates.length; i++) this.releaseGate(i, 1);
    }
    // The first time the courier crosses a region with tunnels (after the seal), a small cohort walks in from its outlets.
    const here = s.sealedAt ? this.region(w.entities.get(1)!.transform) : 0;
    // "Protect the group!" is a sustained fight: two more bursts come out of the plaza hatches at 12 s and 24 s of the 30 s hold.
    if (this.protecting() && s.plazaBursts < 2 && t >= s.breachedAt + (s.protectAway ?? 0) + (s.plazaBursts + 1) * 12 * 60) {
      s.plazaBursts++;
      const burst = ai.director.tier === 'low' ? 1 : 2;
      this.releaseGate(0, burst); this.releaseGate(1, burst);
    }
    // A courier camping in the sealed plaza keeps being hunted from the two hatches in the cell (the flamingo fight has not started).
    if (here === 8 && s.arenas[0]?.phase === 0 && t >= (s.plazaWaveAt ||= t + 40 * 60)) {
      s.plazaWaveAt = t + 40 * 60;
      const inCell = [...w.entities.iterate()].filter(e => e.infected && e.health.current > 0 && !e.hidden && inRect(e.transform, l8PlazaCell)).length;
      if (inCell < 6) { this.releaseGate(0); this.releaseGate(1); }
    }
    if (here && here !== 8 && !(s.legWaves & here)) {
      s.legWaves |= here;
      const gate = here === 1 ? 0 : here === 2 ? 1 : here === 4 ? 3 : 2;
      this.releaseGate(gate, ai.director.tier === 'low' ? 2 : 4);
    }
    for (const arrival of s.arrivals) {
      const infected = w.entities.get(arrival.id)?.infected;
      if (!infected) continue;
      if (arrival.id === s.dogId) {
        if (infected.pressureTarget?.id !== s.pondKeeperId && infected.l1?.focusId !== s.pondKeeperId) ai.pursueTarget(arrival.id, s.pondKeeperId);
      } else if (arrival.id === s.animalInterceptionId && s.animals[5]) {
        if (infected.pressureTarget?.id !== s.animals[5] && infected.l1?.focusId !== s.animals[5]) ai.pursueTarget(arrival.id, s.animals[5]);
      } else if (infected.arenaCarrier) {
        const target = w.entities.get(infected.arenaCarrier);
        if (!target || target.health.current <= 0 || distance(w.entities.get(arrival.id)!.transform, w.entities.get(1)!.transform) <= 9) {
          delete infected.arenaCarrier; ai.pursueTarget(arrival.id, 1);
        }
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
    // PO 2026-11-21: "The level is not ending. I'm standing in the final yellow circle and nothing happens." A follower that
    // never reaches the door (guards on their own escort AI, a jammed queue) held the departure forever. Once the courier
    // has sat in the driver's seat for 10 s, every living group member still outside climbs in.
    if (w.vehicles!.active === s.carId && s.arenas.every(arena => arena.phase === 3) && !s.departureAt) {
      s.driverAt ||= t;
      if (t - s.driverAt >= 600) {
        const seats = w.entities.get(s.carId)!.vehicle!.passengers ?? [], door = w.vehicles!.passengerDoor(s.carId);
        for (const id of this.passengers()) {
          const e = w.entities.get(id);
          if (!e || e.health.current <= 0 || e.infected || e.passengerOf !== undefined || seats.some(seat => seat.id === id)) continue;
          e.transform.x = door.x; e.transform.z = door.z;
          w.vehicles!.boardPassenger(s.carId, id, 99);
        }
      }
    } else if (!s.departureAt) s.driverAt = 0;
    if (w.vehicles!.groupBoarded(s.carId, this.passengers()) && !s.departureAt) this.mission.setState('aboard', true);
  }
  /** Nearby civilians and guards join without a prompt; their existing ally component (and weapon) is retained. */
  private pickupNearbyResidents(): void {
    const w = this.w, s = this.state, player = w.entities.get(1);
    if (!player || this.departing() || this.mission.state.phase !== 'playing') return;
    const roster = new Set(s.roster), nearby = w.spatial.query({ x: player.transform.x, z: player.transform.z, r: 8 }, [], false);
    for (const id of nearby) {
      const e = w.entities.get(id), c = e?.civilian;
      if (!e || !c || c.zooAnimal || c.survivor || e.health.current <= 0 || e.infected || e.infection || e.hidden || roster.has(id)) continue;
      if (id === s.keeperId && s.guideDone !== 2) continue;
      if (Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) > 8
        || !w.infected!.nav.visible(player.transform, e.transform, .2)
        || !w.combat?.query.visible(player.transform, e.transform, id)) continue;
      c.survivor = { key: `zoo-resident-${id}`, slot: s.roster.length, leader: 1, mode: 'follow', cover: false, injured: false, waitAt: 0, foundAt: w.tick };
      readyCarriedAlly(e, w.tick);
      s.roster.push(id); roster.add(id); this.rosterCacheTick = -1;
      if (w.tick - (s.lastJoinCue ?? -10000) >= 180) {
        s.lastJoinCue = w.tick;
        this.mission.radio('L8.survivor-joined');
      }
    }
  }
  /** The existing evacuation detail covers the living column, using its shared rifle rules. */
  private escortGuards(): void {
    if (!this.breached || this.departing()) return;
    const group = this.state.roster.map(id => this.w.entities.get(id)).filter((e): e is EntitySnapshot => !!e && e.health.current > 0 && !e.infected && !e.infection && e.passengerOf === undefined);
    const player = this.w.entities.get(1)!;
    const x = group.length ? group.reduce((n, e) => n + e.transform.x, 0) / group.length : player.transform.x;
    const z = group.length ? group.reduce((n, e) => n + e.transform.z, 0) / group.length : player.transform.z;
    const next = this.state.arenas.find(a => a.phase === 1 || a.phase === 2) ?? this.state.arenas.find(a => a.phase !== 3);
    const index = next ? this.state.arenas.indexOf(next) : -1;
    const routeOpen = index === 0 ? !!this.state.sealedAt : index > 0 && this.state.arenas[index - 1].phase === 3;
    const stage = next && l8Route.find(r => r.id === next.id);
    const gate = stage?.entry ?? (next?.id === 'elephant' ? l8EncounterGates.elephantEntry : undefined);
    const wait = !!stage && !!gate && routeOpen && (next!.phase > 0 || inRect(player.transform, stage.zone) || distance(player.transform, gate) <= 12);
    const detail = [...this.state.guards, this.state.haleId, this.state.reyesId].filter((id, i, all) => id && all.indexOf(id) === i);
    for (const [i, id] of detail.entries()) {
      const guard = this.w.entities.get(id), ally = guard?.civilian?.ally;
      if (!guard || guard.health.current <= 0 || !ally) continue;
      if (guard.civilian?.survivor) continue;
      if (wait && stage && gate) {
        const dx = gate.x - (stage.zone.x0 + stage.zone.x1) / 2, dz = gate.z - (stage.zone.z0 + stage.zone.z1) / 2, length = Math.hypot(dx, dz) || 1;
        const nx = dx / length, nz = dz / length, side = id === this.state.haleId && next?.id === 'elephant' ? 0 : (i - (detail.length - 1) / 2) * 1.3;
        const at = { x: gate.x + nx * 4 - nz * side, z: gate.z + nz * 4 + nx * side };
        ally.arenaWait = true; ally.post = at; ally.run = at; ally.hold = true;
        if (distance(guard.transform, at) > .5) this.w.npcs!.move(guard, at, 6, guard.civilian!, .3, 2400);
        continue;
      }
      if (ally.arenaWait) { delete ally.arenaWait; ally.post = null; ally.run = null; ally.hold = false; }
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
    if (!reyes?.civilian || reyes.civilian.survivor?.key === 'reyes') return;
    if (s.roster.some(id => { const e = w.entities.get(id); return e?.civilian?.survivor?.key === 'sam' && e.health.current > 0 && !e.infected && !e.infection; })) return;
    if (reyes.civilian.survivor) reyes.civilian.survivor.key = 'reyes';
    else reyes.civilian.survivor = { key: 'reyes', slot: s.roster.length, leader: 1, mode: 'follow', cover: false, injured: false, waitAt: 0, foundAt: w.tick };
    readyCarriedAlly(reyes, w.tick); if (!s.roster.includes(reyes.id)) s.roster.push(reyes.id); this.rosterCacheTick = -1;
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
    return this.breached && this.state.arenas.every(a => a.phase === 3) && (this.mission.state.steps.escape.status === 'active' || this.mission.state.steps.depart.status === 'active') && this.passengers().every(id => car?.passengers?.some(p => p.id === id && p.phase === 'seated'));
  }
  /** E30 departure starts only after the breach and the complete group has boarded. */
  canDrive(): boolean { return this.breached && this.state.arenas.every(a => a.phase === 3) && this.mission.state.steps.sanctuary.status === 'completed' && this.w.vehicles!.groupBoarded(this.state.carId,this.passengers()); }
  /** The completed boarding group shares the courier's run-out protection until handover. */
  departing(): boolean { return !!this.state.departureFrom || this.mission.state.runOutUntil !== undefined || this.mission.state.phase !== 'playing'; }
  /** At the pickup, the evacuation queue owns movement instead of civilian flee/defence. */
  boarding(): boolean {
    return this.breached && this.state.arenas.every(a => a.phase === 3) && !this.protecting() && (this.mission.state.steps.escape.status === 'active' || this.mission.state.steps.depart.status === 'active') && (this.w.vehicles!.active === this.state.carId || distance(this.w.entities.get(1)!.transform, this.door()) < 12);
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
    const routeHeading = leaderHeading(p.transform.yaw, velocity);
    const goal = this.breached ? l8FormationSlot(p.transform, routeHeading, slot) : formationSlot(p.transform, routeHeading, slot, true);
    // A resident recruited off the route should catch the moving party before
    // taking its permanent tail slot. Long-tail slots can otherwise leave a
    // new joiner behind a gate while the courier has already moved on.
    if (this.breached) {
      // Bring the formation closer without squeezing successive rows into
      // one another; arena holding positions remain authored below.
      const forward = .9;
      goal.x += routeHeading.x * forward; goal.z += routeHeading.z * forward;
    }
    const plaza = this.mission.def.anchors['l8-route'];
    // The one-way route ends at the zoo entry gate; the party gathers around
    // that fixed destination while Nadia delivers the safe-zone line.
    if (!this.breached && s.guideDone === 2 && distance(p.transform, plaza) <= (plaza.radius ?? 6) + 4) {
      const angle = slot * 2.399, r = Math.min(4.6, 1.8 + .72 * Math.sqrt(slot + 1));
      goal.x = plaza.x + Math.cos(angle) * r; goal.z = plaza.z + Math.sin(angle) * r;
    }
    // The survivor group stops outside the next cage before the courier reaches
    // its gate. Only the courier and corgi enter; followers resume after clear.
    const active = s.arenas.find(a => a.phase === 1 || a.phase === 2);
    const next = active ?? s.arenas.find(a => a.phase !== 3);
    const nextIndex = next ? s.arenas.indexOf(next) : -1, prior = nextIndex > 0 ? s.arenas[nextIndex - 1] : undefined;
    const routeOpen = nextIndex === 0 ? !!s.sealedAt : prior?.phase === 3;
    const stage = next && l8Route.find(r => r.id === next.id);
    const gate = stage?.entry ?? (next?.id === 'elephant' ? l8EncounterGates.elephantEntry : undefined);
    const waitingOutside = !boarding && routeOpen && !!stage && !!gate && (!!active || inRect(p.transform, stage.zone) || distance(p.transform, gate) <= 12);
    const ally = c.ally;
    if (waitingOutside && stage && gate) {
      const outwardX = gate.x - (stage.zone.x0 + stage.zone.x1) / 2, outwardZ = gate.z - (stage.zone.z0 + stage.zone.z1) / 2;
      const length = Math.hypot(outwardX, outwardZ) || 1, nx = outwardX / length, nz = outwardZ / length, tx = -nz, tz = nx;
      Object.assign(goal, { x: gate.x + nx * (2.8 + Math.floor(slot / 5) * 1.6) + tx * ((slot % 5 - 2) * 1.2), z: gate.z + nz * (2.8 + Math.floor(slot / 5) * 1.6) + tz * ((slot % 5 - 2) * 1.2) });
      // Hale's first elephant charge beat requires him at the yard entrance,
      // including when he has joined the survivor roster.
      if (e.id === s.haleId && next?.id === 'elephant') Object.assign(goal, { x: gate.x + nx * 4, z: gate.z + nz * 4 });
      c.survivor!.arenaWait = true;
      if (ally) { ally.arenaWait = true; ally.post = { ...goal }; ally.run = { ...goal }; ally.hold = true; }
    } else if (c.survivor!.arenaWait || ally?.arenaWait) {
      delete c.survivor!.arenaWait;
      if (ally?.arenaWait) { delete ally.arenaWait; ally.post = null; ally.run = null; ally.hold = false; }
    }
    // A resident can join beside the courier with a high roster slot, then be
    // assigned a tail position beyond the moving party. Keep separated
    // followers on a short, reachable catch-up target until they rejoin.
    if (this.breached && !boarding && !waitingOutside && distance(e.transform, p.transform) > 10) {
      const side = slot % 2 ? 1 : -1;
      goal.x = p.transform.x - routeHeading.x * 2.5 - routeHeading.z * side * 1.1;
      goal.z = p.transform.z - routeHeading.z * 2.5 + routeHeading.x * side * 1.1;
    }
    // A blocked outside slot must never fall back to the courier inside the
    // cage. Search nearby clear ground on the outside of this encounter.
    if (waitingOutside && stage && !w.infected!.nav.clear(goal.x, goal.z, .35)) {
      const original = { ...goal };
      for (let radius = 1; radius <= 8 && !w.infected!.nav.clear(goal.x, goal.z, .35); radius++) {
        for (let i = 0; i < 16; i++) {
          const angle = i * Math.PI / 8, candidate = { x: original.x + Math.cos(angle) * radius, z: original.z + Math.sin(angle) * radius };
          if (!inRect(candidate, stage.zone) && w.infected!.nav.clear(candidate.x, candidate.z, .35)) { Object.assign(goal, candidate); break; }
        }
      }
    }
    let target = boarding ? door : w.infected!.nav.clear(goal.x, goal.z, .35) ? goal : waitingOutside ? e.transform : p.transform;
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
        const side = (column < half ? -1 : 1) * (1.45 + column % half * .85);
        // Keep the double-file tail within the courier's nearby escort ring
        // while preserving clearance for ordinary 0.35 m capsules.
        const queue = { x: door.x + dx / length * (1.7 + row * .82) - dz / length * side, z: door.z + dz / length * (1.7 + row * .82) + dx / length * side };
        // Queue slots may be occupied by another follower. That is a soft
        // crowding condition, not a reason to give this survivor its current
        // position as a target and leave it stranded across the plaza.
        target = w.infected!.nav.clear(queue.x, queue.z, actorRadius(e)) ? queue : door;
      }
    }
    if (boarding) { target = this.boardingTarget(e, target); this.unjamBoarding(e, target); }
    else if (this.breached && !waitingOutside && distance(e.transform, p.transform) > 10) {
      // A fallen animal can obstruct the catch-up route before boarding starts.
      // Use the same physical corpse detour that already serves the APC queue.
      target = this.boardingTarget(e, target);
    }
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
    if (!this.breached) {
      const guide = guideRoute.at(-1)!;
      Object.assign(this.mission.def.anchors['l8-route'], { x: guide.x, z: guide.z });
      this.mission.state.marker = 'l8-route';
    }
    this.w.openDoors.clear();
    for (const [id, door] of data.doors) this.w.openDoors.set(id, { ...door, at: door.at + delta });
    // A checkpoint restored on tick zero can have a legitimate breach time of zero.
    this.state.startedAt += delta; if (this.state.infectionSetupAt) this.state.infectionSetupAt += delta; if (this.state.infectionFeedLineAt) this.state.infectionFeedLineAt += delta; if (this.breached) this.state.breachedAt += delta; if (this.state.nextWave) this.state.nextWave += delta;
    if (this.state.gateBreachLineAt) this.state.gateBreachLineAt += delta;
    if (this.state.perimeterGateBreaks) this.state.perimeterGateBreaks = this.state.perimeterGateBreaks.map(at => at === null ? null : at + delta);
    this.state.plazaBursts ??= 0; this.state.plazaWaveAt ??= 0; if (this.state.plazaWaveAt) this.state.plazaWaveAt += delta; this.state.sealedAt ??= 0; this.state.routeStage ??= -1; this.state.routeNode ??= 0; this.state.legWaves ??= 0; if (this.state.sealedAt) this.state.sealedAt += delta;
    this.state.guideDone ??= 0; this.state.guideLeg ??= 0; this.state.guideArrivedAt ??= 0; this.state.lionUntil ??= 0;
    if (!this.state.guideDone && this.state.guideRouteVersion !== 6) {
      const keeper = this.w.entities.get(this.state.keeperId);
      if (keeper) this.state.guideLeg = guideRoute.reduce((best, point, index) => distance(keeper.transform, point) < distance(keeper.transform, guideRoute[best]) ? index : best, 0);
      this.state.lionUntil = 0;
      this.state.guideRouteVersion = 6;
    }
    if (!this.state.guideDone) { const stop = guideRoute[Math.min(this.state.guideLeg, guideRoute.length - 1)]; Object.assign(this.mission.def.anchors['l8-route'], { x: stop.x, z: stop.z }); }
    for (const key of ['broadcastAt', 'greetingAt', 'haleGreetingAt', 'gateToastAt', 'departureAt', 'haleFallAt', 'guideArrivedAt', 'lionUntil'] as const) if (this.state[key]) this.state[key] += delta;
    if (this.state.departureFrom) this.state.chaseAt += delta;
    this.w.storyLock = this.state.departureFrom && !this.mission.state.states.departed ? { scripted: null, skip: false } : null;
    for (const arrival of this.state.arrivals) arrival.tick += delta;
    this.state.outlets = []; this.state.perimeterOutlets = perimeterGates.map(({ x, z }) => ({ x, z }));
    this.syncPerimeterGates();
    this.w.infected!.director.levelCap = 200; this.w.infected!.director.strict = true; this.w.infected!.director.reserved = 1;
  }
}
