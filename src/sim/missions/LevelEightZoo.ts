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
import { readyCarriedAlly, allyState } from '../outbreak/Allies';
import { layoutHouseDoors, doorExit, emergeResident, walkResidents, type HouseEmergence } from '../outbreak/HouseEmergence';
import { formationSlot, leaderHeading, requireClearPoint } from './missionHelpers';

export interface L8ZooState {
  startedAt: number; breachedAt: number; nextWave: number; alphas: number; carId: number; busId: number;
  roster: number[]; guards: number[]; animals: number[]; outlets: HouseEmergence[];
  arrivals: { id: number; outlet: number; tick: number; alpha: boolean }[];
  escapeCheckpoint: boolean;
  keeperId: number; pondKeeperId: number; haleId: number; reyesId: number; dogId: number; megaId: number; broadcastAt: number; greetingAt: number; lionAt: number; haleGreetingAt: number;
  sightingAt: number; departureAt: number; chaseAt: number; departureFrom: Transform | null; turnedAnimalId: number; animalInterceptionId: number; animalBiteStarted: boolean; keeperAttacked: boolean;
}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
/** Zoo story owns timing/entrances; the shared outbreak owns all bites, rescues and same-id transformations. */
export class LevelEightZoo {
  state: L8ZooState = { startedAt: 0, breachedAt: 0, nextWave: 0, alphas: 0, carId: 0, busId: 0, roster: [], guards: [], animals: [], outlets: [], arrivals: [], escapeCheckpoint: false, keeperId: 0, pondKeeperId: 0, haleId: 0, reyesId: 0, dogId: 0, megaId: 0, broadcastAt: 0, greetingAt: 0, lionAt: 0, haleGreetingAt: 0, sightingAt: 0, departureAt: 0, chaseAt: 0, departureFrom: null, turnedAnimalId: 0, animalInterceptionId: 0, animalBiteStarted: false, keeperAttacked: false };
  private prepared = false;
  private rosterCacheTick = -1;
  private rosterCacheRevision = -1;
  private rosterCache: number[] = [];
  private passengersCache: number[] = [];
  private readonly seatedPassengers = new Set<number>();
  private readonly cacheStops: (() => void)[] = [];
  constructor(private readonly mission: Mission) {
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
      if (e.combat) { e.combat.staggerUntil = 0; e.combat.attacking = false; delete e.combat.reaction; }
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
      if (soldier) { w.entities.get(id)!.civilian!.ally = allyState('soldier', at); if (i < 23) s.guards.push(id); }
    }
    const species: ZooSpecies[] = ['lion', 'gorilla', 'elephant', 'zebra', 'zebra', 'flamingo', 'flamingo', 'flamingo'];
    const offsets = new Map<ZooSpecies, number>();
    for (const speciesId of species) {
      const anchor = this.mission.def.anchors[`animal-${speciesId}`], offset = offsets.get(speciesId) ?? 0; offsets.set(speciesId, offset + 1);
      const radius = speciesId === 'elephant' ? 1.3 : .9;
      // Keep the calm animals at their public-facing enclosure fences so the keeper's boulevard route passes them.
      const gateSideZ = anchor.z < 0 ? 18 : -18;
      const gateX = speciesId === 'flamingo' ? 0 : Math.sign(anchor.x) * 45;
      const at = this.point({ x: gateX + offset * 2, z: anchor.z + gateSideZ }, radius), to = this.point({ x: at.x + 2, z: at.z }, radius);
      s.animals.push(civilians.spawn('cashier', at, { zooAnimal: speciesId, waypoints: [at, to] }));
    }
    const tour = [{ x: 24, z: 64 }, { x: 24, z: 0 }, { x: 45, z: 0 }, { x: -45, z: 0 }, { x: 0, z: 0 }];
    const keeper = this.point({ x: 3, z: 66 }), staff = zooStaffLook(6);
    s.keeperId = outbreak.spawnPedestrian(keeper, { ...staff, walkSpeed: 4.6, waypoints: tour,
      schedule: [...tour.map(target => ({ activity: 'walk' as const, anchor: 'zoo/tour', target, ticks: 1 })),
        { activity: 'look', anchor: 'zoo/plaza', target: tour.at(-1)!, facing: { x: -4, z: 0 }, ticks: 36_000 }] });
    s.pondKeeperId = outbreak.spawnPedestrian(this.point({ x: -4, z: -10 }), { ...zooStaffLook(0), waypoints: [{ x: -4, z: -10 }, { x: -2, z: -10 }] });
    for (const [key, x] of [['majorHale', -4], ['privateReyes', -2]] as const) {
      const at = this.point({ x, z: 0 });
      const id = outbreak.spawnPedestrian(at, { role: 'soldier', model: 'npc.national-guard', handProp: 'rifle', waypoints: [at, { x, z: 2 }] });
      w.entities.get(id)!.civilian!.ally = allyState('soldier', at);
      this.mission.state.actors[key] = id;
      if (key === 'majorHale') s.haleId = id; else s.reyesId = id;
    }
    this.mission.state.actors.nadia = s.keeperId;
    const d = w.districts!.districts[0];
    s.outlets = layoutHouseDoors(d.layout, d.origin, undefined, asset => asset === 'kit.zoo-tunnel-mouth').map((door, index) => {
      const exit = doorExit(w, door, start); if (!exit) throw new Error(`Disconnected zoo outlet ${door.house}`);
      const serviceRoutes: [number, number][][] = [
        [[-96, 32]],
        [[80, 78]], // Cross the gate-to-APC road before ordinary pursuit.
        [[-24, -64], [-24, 0], [0, -10]], // North cohort reaches the flamingo gate without crossing the pond.
        [[27, 78]], // Clear the bunker onto the gate road before ordinary pursuit.
      ];
      const route = [...exit.route, ...serviceRoutes[index]];
      const last = route.at(-1);
      // Alarm runners clear the entrance briskly; the larger high-tier queue
      // must still contact the courier within twenty seconds.
      return { ...door, ...exit, route, ox: last?.[0] ?? exit.ox, oz: last?.[1] ?? exit.oz, next: 0, ids: [], speedMs: 4.2 };
    });
    if (s.outlets.length < 3) throw new Error('Zoo requires at least three tunnel outlets');
    // The carried group has just unloaded from L7's evacuation bus inside the perimeter.
    const bus = spawnSetPiece(w, 'veh.evac-bus', { x: start.x - 10, z: start.z, y: w.districts!.groundHeight(start.x - 10, start.z) + .7 });
    s.busId = bus.id;
    const wall = { x: bus.transform.x, y: 1.5, z: bus.transform.z, halfX: 4.68, halfY: 1.5, halfZ: 1.48 };
    w.physics.addBlocker(wall);
    w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: bus.id, blocked: true, wall });
    s.carId = w.vehicles!.spawn('vehicle.military-apc', this.point({ x: 96, z: 74 }, 3.5));
    Object.assign(this.mission.def.anchors.exit, this.boardingRing(), { radius: 2 });
    this.mission.state.actors.apc = s.carId;
  }
  begin(): void {
    const s = this.state, t = this.w.tick;
    s.startedAt = t; s.greetingAt = t + 3 * 60; s.lionAt = 0;
    s.broadcastAt = t + 20 * 60; s.haleGreetingAt = t + 38 * 60;
    this.mission.checkpoint('sanctuary');
  }
  door(): Point {
    const car = this.w.vehicles!.cars.get(this.state.carId)!, p = car.entity.transform, def = car.physics.def, z = def.width / 2 + .55;
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
    const id = emergeResident(w, outlet, w.tick, alpha ? { archetype: 'infected.alpha' } : { look: { role: 'cashier' } });
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
  /** The opening shock keeps the group in the plaza before the APC route appears. */
  protecting(): boolean { return this.breached && this.w.tick < this.state.breachedAt + 30 * 60; }
  private passengersSeated(): boolean {
    const seats = this.w.entities.get(this.state.carId)!.vehicle!.passengers ?? [];
    return this.passengers().every(id => seats.some(seat => seat.id === id && seat.phase === 'seated'));
  }
  private story(): void {
    const s = this.state, w = this.w, t = w.tick, player = w.entities.get(1)!;
    const keeper = w.entities.get(s.keeperId), lion = w.entities.get(s.animals[0]);
    if (s.greetingAt && t >= s.greetingAt) { s.greetingAt = 0; this.mission.radio('L8.nadia-path'); }
    if (!s.lionAt && keeper && lion && distance(keeper.transform, lion.transform) <= 18) { s.lionAt = 1; this.mission.radio('L8.nadia-lion'); }
    if (s.broadcastAt && t >= s.broadcastAt && distance(player.transform, this.mission.def.anchors['central-plaza']) < 25) { s.broadcastAt = 0; this.mission.radio('L8.broadcast'); }
    if (s.haleGreetingAt && t >= s.haleGreetingAt && !s.broadcastAt && distance(player.transform, this.mission.def.anchors['central-plaza']) < 18) { s.haleGreetingAt = 0; this.mission.radio('L8.hale-greeting'); }
    const elephant = w.entities.get(s.animals[2]);
    if (elephant?.infected && !this.mission.state.states['elephant-turning']) {
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
    // Passenger completion deliberately excludes the driver: she covers this beat on foot, then boards last.
    if (!s.megaId && this.breached && !this.protecting() && this.mission.state.steps.escape.status === 'active' && this.passengersSeated() && distance(player.transform, this.door()) < 2) {
      s.sightingAt = t; s.departureAt = t + 18 * 60;
      s.megaId = w.infected!.spawn('infected.alpha', this.point({ x: 88, z: -80 }), { variant: 'inf.mega-alpha', state: 'chase', perched: false });
      const mega = w.entities.get(s.megaId)!;
      Object.assign(mega.transform, { x: 88, y: 4.7, z: -88, yaw: -Math.PI / 2 });
      mega.health.current = mega.health.max = 1_000_000;
      mega.emerging = true; mega.combat!.damageMultiplier = 0;
      w.npcs!.civilians.hold(mega.id);
      this.mission.cinematic('l8-north-wall');
    }
    const mega = w.entities.get(s.megaId), hale = w.entities.get(s.haleId);
    if (mega) {
      // Scripted entrance/chase owns this actor, including after a checkpoint rebuild.
      w.npcs!.civilians.hold(mega.id); mega.health.current = mega.health.max;
      if (!this.mission.state.states['hale-fallen']) {
        const elapsed = t - s.sightingAt, f = Math.min(1, elapsed / (14 * 60));
        const target = hale?.transform ?? { x: 88, z: 70 };
        const road = Math.min(1, elapsed / 720), approach = Math.max(0, Math.min(1, (elapsed - 720) / 120));
        const x = 88 + (target.x - 1.6 - 88) * approach;
        const z = elapsed <= 720 ? -88 + 168 * road : 80 + (target.z - 80) * approach;
        const y = elapsed < 21 ? 4.7 : elapsed < 60 ? .7 + 4 * (60 - elapsed) / 39 : .7;
        this.megaPose(x, z, y);
        if (f === 1 && hale?.civilian) {
          if (!this.mission.state.states['hale-keys']) {
            this.mission.setState('hale-keys', true); this.mission.radio('L8.hale-dying');
            hale.civilian.story = { clip: 'npc-give', start: t };
            const shot = this.mission.def.cinematics['l8-hale'];
            shot.target = [hale.transform.x, 1, hale.transform.z]; shot.position = [hale.transform.x + 16, 12, hale.transform.z + 18];
            this.mission.cinematic('l8-hale');
          }
          if (elapsed >= 15 * 60) {
            hale.health.current = 0; hale.civilian.state = 'finished'; hale.civilian.story = { clip: 'death-side', start: t };
            this.mission.setState('hale-fallen', true);
          }
        }
      }
    }
    if (mega && hale && this.mission.state.states['hale-fallen'] && !s.departureFrom) {
      // It strides past the fallen commander, leaving the real cab door clear for the last boarding.
      const f = Math.max(0, Math.min(1, (t - s.sightingAt - 15 * 60) / 180));
      this.megaPose(hale.transform.x - 1.6 - 4 * f, hale.transform.z + 4 * f, .7);
    }
    if (s.departureAt && t >= s.departureAt) s.departureAt = 0;
    if (s.megaId && !s.departureAt && this.mission.state.states['hale-fallen'] && w.vehicles!.groupBoarded(s.carId, this.passengers())) {
      if (!s.departureFrom) {
        s.chaseAt = t; s.departureFrom = { ...w.entities.get(s.carId)!.transform };
        if (mega) mega.doorLane = { x: 116, z: 80, ox: 1, oz: 0, half: 2.7, start: -3, end: 3 };
        w.storyLock = { scripted: null, skip: false }; w.clearInput();
        this.mission.radio('L8.following');
      }
      const elapsed = t - s.chaseAt, from = s.departureFrom, lead = Math.min(1, elapsed / 120), run = Math.max(0, Math.min(1, (elapsed - 120) / 360));
      const x = elapsed <= 120 ? from.x + (104 - from.x) * lead : 104 + 42 * run;
      const z = elapsed <= 120 ? from.z + (80 - from.z) * lead * lead * (3 - 2 * lead) : 80;
      const yaw = elapsed <= 120 ? -Math.atan2((80 - from.z) * 6 * lead * (1 - lead), 104 - from.x) : 0;
      const previous = w.entities.get(s.carId)!.transform;
      const speed = Math.hypot(x - previous.x, z - previous.z) * 60;
      w.vehicles!.scriptPose(s.carId, { x, y: from.y, z, yaw }, speed);
      const car = w.entities.get(s.carId)!; car.vehicle!.braking = false;
      if (elapsed % 6 === 0) emitEngine(w, s.carId, speed, true);
      if (mega) {
        const dx = x - 10 - mega.transform.x, dz = z - mega.transform.z, d = Math.hypot(dx, dz), step = Math.min(d, 11 * FIXED_DT);
        this.megaPose(mega.transform.x + dx / (d || 1) * step, mega.transform.z + dz / (d || 1) * step, .7);
      }
      if (elapsed >= 480) { this.mission.setState('departed', true); w.storyLock = null; }
    }
  }
  private megaPose(x: number, z: number, y: number): void {
    const mega = this.w.entities.get(this.state.megaId)!, dx = x - mega.transform.x, dz = z - mega.transform.z;
    Object.assign(mega.transform, { x, y, z });
    if (Math.hypot(dx, dz) > .001) mega.transform.yaw = -Math.atan2(dz, dx);
    mega.motion = { velocity: { x: dx / FIXED_DT, z: dz / FIXED_DT }, speed: Math.hypot(dx, dz) / FIXED_DT, moving: Math.hypot(dx, dz) > .001, distance: (mega.motion?.distance ?? 0) + Math.hypot(dx, dz) };
    this.w.spatial.set(mega.id, x, z);
  }
  /** The departure camera retains both the APC and the pursuing silhouette. */
  cameraPose(): { position: [number, number, number]; target: [number, number, number] } | null {
    if (!this.state.departureFrom) return null;
    const car = this.w.entities.get(this.state.carId)!.transform;
    return { position: [car.x + 10, 12, car.z + 22], target: [car.x - 6, 1, car.z] };
  }
  update(): void {
    const w = this.w, s = this.state, ai = w.infected!, t = w.tick;
    this.story();
    let pending = 0; for (const e of w.entities.iterate()) if (e.infection && !e.infected) pending++;
    ai.director.pendingTurns = pending;
    if (!this.breached && t - s.startedAt >= 3600) {
      s.breachedAt = t; s.nextWave = t + 600;
      s.outlets.forEach((outlet, i) => { for (let n = 0; n < (ai.director.tier === 'low' ? 3 : 6); n++) this.release(outlet, i); });
      // The parked hull has settled by the alarm. Capture its boarding action
      // point once; minor physics impulses must not steer the objective ring.
      Object.assign(this.mission.def.anchors.exit, this.boardingRing());
      this.mission.setState('breached', true);
      const door = this.door();
      for (const [i, id] of [s.haleId, s.reyesId, ...s.guards].entries()) {
        const guard = w.entities.get(id); if (!guard?.civilian?.ally || guard.health.current <= 0) continue;
        const at = this.point(i === 0 ? { x: door.x - .7, z: door.z + 1.2 } : { x: door.x - 5 - i * 1.5, z: door.z + 5.5 });
        guard.civilian.ally.run = at; guard.civilian.ally.post = at; guard.civilian.ally.runSpeed = 6; guard.civilian.ally.hold = true;
      }
      this.reyesFallback();
      this.mission.checkpoint('breach');
      this.mission.radio('L8.hale-breach');
    }
    if (this.breached) this.reyesFallback();
    this.mission.setState('apc-destroyed', w.entities.get(s.carId)!.health.current <= 0);
    const seated=this.w.vehicles!.active===s.carId;
    this.mission.setState('player-boarded',seated);
    if(seated || this.protecting())this.mission.state.marker=null;
    else if(this.mission.state.steps.escape.status==='active'||this.mission.state.steps.depart.status==='active')this.mission.state.marker='exit';
    if (!this.breached) return;
    if (t >= s.nextWave) {
      s.nextWave = t + 240;
      s.outlets.forEach((outlet, i) => {
        // The first reinforcement brings one Alpha per outlet. The fifth follows
        // the east cohort on the next wave, sustaining the APC approach after its first salvo.
        this.release(outlet, i, s.alphas < 4 || s.alphas === 4 && i === 1);
        for (let n = 0; n < 3; n++) this.release(outlet, i);
      });
    }
    for (const [index, outlet] of s.outlets.entries()) for (const id of walkResidents(w, outlet, t)) {
      if (id === s.animalInterceptionId) ai.pursueTarget(id, s.animals[5]);
      else if (id === s.dogId) ai.pursueTarget(id, s.pondKeeperId);
      else ai.pursueTarget(id, 1);
      // This gate-side cohort pressures the courier; the other outlets still attack the sanctuary population.
      // Releasing on the apron and retaining that focus avoids spending the whole encounter walking a scripted road.
      if (index === 3) ai.press(id, 1, t + 3600, 30);
      if (index === 1) {
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
    if (w.vehicles!.groupBoarded(s.carId, this.passengers()) && (!s.sightingAt || !s.departureAt)) this.mission.setState('aboard', true);
  }
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
    return this.breached && (this.mission.state.steps.escape.status === 'active' || this.mission.state.steps.depart.status === 'active') && this.passengers().every(id => car?.passengers?.some(p => p.id === id && p.phase === 'seated')) && !!this.mission.state.states['hale-fallen'] && !this.state.departureAt;
  }
  /** E30 departure starts only after the breach and the complete group has boarded. */
  canDrive(): boolean { return this.breached && this.mission.state.steps.sanctuary.status === 'completed' && this.w.vehicles!.groupBoarded(this.state.carId,this.passengers()); }
  /** The completed boarding group shares the courier's run-out protection until handover. */
  departing(): boolean { return !!this.state.departureFrom || this.mission.state.runOutUntil !== undefined || this.mission.state.phase !== 'playing'; }
  /** At the pickup, the evacuation queue owns movement instead of civilian flee/defence. */
  boarding(): boolean {
    return this.breached && !this.protecting() && (this.mission.state.steps.escape.status === 'active' || this.mission.state.steps.depart.status === 'active') && (this.w.vehicles!.active === this.state.carId || distance(this.w.entities.get(1)!.transform, this.door()) < 12);
  }
  /** Cheat/test path (`completeObjective` before the breach): call the real tunnel breach; ordinary completion still requires the plaza rendezvous. */
  advance(): boolean {
    if (this.mission.state.states.breached) return false;
    this.state.startedAt = this.w.tick - 3600; this.update();
    return !!this.mission.state.states.breached;
  }
  /** Shared follow AI yields to the transport approach only during the escape. */
  companion(e: EntitySnapshot): boolean {
    if (!this.boarding()) return false;
    const w = this.w, door = w.vehicles!.passengerDoor(this.state.carId);
    if (distance(e.transform, door) < .7) w.vehicles!.boardPassenger(this.state.carId, e.id);
    else if (!this.approachBoardingSpot(e, door, 8)) w.npcs!.move(e, door, 8, e.companion!, .2);
    return true;
  }
  /** Newly rescued zoo residents also belong to the complete living group. */
  roster(): number[] {
    this.refreshRoster();
    return [...this.rosterCache];
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
    const goal = formationSlot(p.transform, leaderHeading(p.transform.yaw, velocity), slot);
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
        const columns = Math.max(2, Math.ceil((passengers.length - 1) / 6));
        const row = Math.floor((queueIndex - 1) / columns), side = ((queueIndex - 1) % columns - (columns - 1) / 2);
        const queue = { x: door.x + dx / length * (1 + row) - dz / length * side, z: door.z + dz / length * (1 + row) + dx / length * side };
        target = w.infected!.nav.clear(queue.x, queue.z, actorRadius(e)) && w.solids.clear({ ...queue, y: e.transform.y }, actorRadius(e), e.id, false) ? queue : e.transform;
      }
    }
    if (boarding && queueIndex === 0 && distance(e.transform, door) < .7) w.vehicles!.boardPassenger(s.carId, e.id);
    else if (distance(e.transform, target) > .3) {
      // The roster is healed on arrival and must keep pace through the long
      // board-up; a stale carried injury flag must not leave passengers behind.
      // A follower displaced from its assigned slot catches up, then settles
      // back to courier pace. This avoids making the courier stop for it.
      const speed = Math.min(4.7, 4.5 + Math.max(0, distance(e.transform, target) - 4) * .35);
      if (!boarding || !this.approachBoardingSpot(e, target, speed)) w.npcs!.move(e, target, speed, c, boarding ? .2 : 0, 2400);
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
    this.state = structuredClone(data.state); this.prepared = data.prepared;
    this.w.openDoors.clear();
    for (const [id, door] of data.doors) this.w.openDoors.set(id, { ...door, at: door.at + delta });
    // A checkpoint restored on tick zero can have a legitimate breach time of zero.
    this.state.startedAt += delta; if (this.breached) this.state.breachedAt += delta; if (this.state.nextWave) this.state.nextWave += delta;
    for (const key of ['broadcastAt', 'greetingAt', 'haleGreetingAt', 'departureAt'] as const) if (this.state[key]) this.state[key] += delta;
    if (this.state.megaId) this.state.sightingAt += delta;
    if (this.state.departureFrom) this.state.chaseAt += delta;
    this.w.storyLock = this.state.departureFrom && !this.mission.state.states.departed ? { scripted: null, skip: false } : null;
    if (this.state.megaId) this.w.npcs!.civilians.hold(this.state.megaId);
    for (const outlet of this.state.outlets) { outlet.next += delta; for (const walk of outlet.walking ?? []) walk.until += delta; }
    this.w.infected!.director.levelCap = 200; this.w.infected!.director.strict = true; this.w.infected!.director.reserved = 1;
  }
}
