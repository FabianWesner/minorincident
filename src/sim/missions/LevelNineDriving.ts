import * as RAPIER from '@dimforge/rapier3d-compat';
import { l9Course as cfg, l9SetPieceTuning } from '../../data/l9';
import { l5Survivors } from '../../data/l5';
import { spawnSetPiece } from './L4Spectacle';
import { allyState, updateAlly } from '../outbreak/Allies';
import { emitEngine, stopEngine } from '../vehicles/ConvoySound';
import type { Mission } from './Mission';
import type { EntitySnapshot } from '../world/types';
import type { DriveIntent } from '../vehicles/VehicleBody';
import { pursueCrossingVehicle } from './LevelNineEncounters';
import { Outbreak } from '../outbreak/Outbreak';
import { clearThreat } from './Respawn';
import { LevelNineSetPieces, emptySetPieces, type L9SetPieceState } from './LevelNineSetPieces';

export interface L9DrivingState {
  prepared: boolean; roster: number[]; samId: number; megaId: number; soldiers: number[]; trucks: number[]; megaSightings?: number[]; megaSighting?: { index: number; startedAt: number; roadZ: number };
  boardersCalled: boolean; route: string | null; checkpoints: string[];
  stallAt: number | null; restarted: boolean; repairTicks: number; repairActive: boolean; hatchOpen?: boolean;
  gateAt: number | null; gateClosed: boolean; gateId: number; bridgeGateId: number; fenceBroken: boolean;
  evacuationAt: number | null; evacuated: number[]; evacuating: number[]; evacuationDone: boolean;
  hugAt: number | null; hugDone: boolean;
  hugSpot?: { x: number; z: number; dogX: number; dogZ: number };
  truckEntering: Record<number, number>;
  busId: number; busPassengers: number[]; busReleased: number; busHitAt: number; busRams: number; busStoppedAt: number | null; busLineAt: number | null;
  tankerId: number; tankerWreckId: number; tankerFuseAt: number | null; tankerExploded: boolean; stampede: number[];
  fireAt: number | null; fireIds: number[]; jumped: string[]; jump: { id: string; airborne: boolean } | null;
  obstacleIds: number[]; waves: number[]; nextWave: number; lines: { id: string; at: number }[];
  /** r32-l9fun: authored set pieces (leapers, throwers, roadblock, packs) and measured jump airtime per ramp. */
  setPieces?: L9SetPieceState; boostUntil?: number; airtime?: { id: string; ticks: number; speed: number; hard: boolean }[]; takeoffAt?: number | null;
}
export const emptyDriving = (): L9DrivingState => ({
  prepared: false, roster: [], samId: 0, megaId: 0, soldiers: [], trucks: [], boardersCalled: false, route: null, checkpoints: [],
  stallAt: null, restarted: false, repairTicks: 0, repairActive: false, gateAt: null, gateClosed: false, gateId: 0, bridgeGateId: 0, fenceBroken: false,
  evacuationAt: null, evacuated: [], evacuating: [], evacuationDone: false,
  hugAt: null, hugDone: false,
  truckEntering: {},
  busId: 0, busPassengers: [], busReleased: 0, busHitAt: -1000, busRams: 0, busStoppedAt: null, busLineAt: null,
  tankerId: 0, tankerWreckId: 0, tankerFuseAt: null, tankerExploded: false, stampede: [], fireAt: null, fireIds: [], jumped: [], jump: null,
  obstacleIds: [], waves: [], nextWave: 0, lines: [],
});
/** r27-l9board: total number of damaging bus rams per level (40 durability each). */
const tuneStall = l9SetPieceTuning.stall;
const busRamCap = 3;
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const alive = (e: EntitySnapshot | undefined): e is EntitySnapshot => !!e && e.health.current > 0 && !e.infected && !e.infection;

/** L9's physical road challenges, exposed hatch defense and visible bridgehead handoff. */
export class LevelNineDriving {
  private readonly rampHandles: number[] = [];
  readonly setPieces: LevelNineSetPieces;
  constructor(private readonly mission: Mission) {
    this.setPieces = new LevelNineSetPieces(mission.world, () => this.mission.l9!.state.carId, () => this.state.route, (name, actorId) => this.signal(name, actorId));
  }
  private get w() { return this.mission.world; }
  get state(): L9DrivingState { return this.mission.l9!.state.driving ??= emptyDriving(); }
  private get car() { return this.w.vehicles!.cars.get(this.mission.l9!.state.carId)!; }
  private signal(name: string, actorId?: number) { this.w.events.emit({ type: 'mission.signal', tick: this.w.tick, name: `l9.${name}`, ...(actorId === undefined ? {} : { actorId }) }); }
  private line(id: string, delay = 0): void { this.state.lines.push({ id, at: this.w.tick + delay }); }
  private checkpoint(id: string): void { if (this.w.entities.get(1)!.health.current > 0 && this.w.vehicles!.active === this.mission.l9!.state.carId && !this.state.checkpoints.includes(id)) { this.state.checkpoints.push(id); this.mission.checkpoint(id); } }
  prepare(): void {
    const s = this.state, w = this.w;
    w.npcs!.setAmbient(0); w.infected!.director.levelCap = 200; w.infected!.director.ambientTarget = 0; w.infected!.director.strict = true;
    const civilians = w.npcs!.civilians;
    const outbreak = civilians.outbreak ??= new Outbreak(w, { refuges: [], tier: w.infected!.director.tier });
    w.infected!.configureL1v2(outbreak.humans);
    w.npcs!.companion.forceSafe = true;
    if (s.prepared) { this.rebuild(); return; }
    s.prepared = true;
    const vehicle = this.car.entity.vehicle!;
    const nav = w.infected!.nav, warmCell = nav.nearestCell(this.car.entity.transform.x, this.car.entity.transform.z, .35);
    if (warmCell < 0) throw new Error('L9 cast needs resident entry navigation');
    const warm = { x: nav.x(warmCell), z: nav.z(warmCell) };
    // Standalone level starts use the surviving campaign keys; transferred
    // occupants retain their identities and losses from the zoo.
    if (!w.progression?.campaign?.transport) for (const [slot, def] of l5Survivors.entries()) {
      if (!(w.progression?.campaign?.survivors ?? l5Survivors.map(r => r.key)).includes(def.key)) continue;
      const id = outbreak.spawnPedestrian(warm, { role: 'cashier', model: def.model, waypoints: [warm] }, false);
      const e = w.entities.get(id)!;
      e.civilian!.survivor = { key: def.key, mode: 'follow', slot, leader: 1, cover: false, waitAt: 0, foundAt: 0 };
      if (def.key === 'sam') e.civilian!.ally = { ...allyState('civilian'), weapon: 'hunting-rifle', gun: { damage: 40, shotS: 1.5, rangeM: 35, nearM: 12, hitNear: .8, hitFar: .3 }, hold: true };
      this.seat(e);
    }
    s.roster = (vehicle.passengers ?? []).map(p => p.id).filter(id => !!w.entities.get(id)?.civilian);
    s.samId = s.roster.find(id => alive(w.entities.get(id)) && ['sam', 'reyes'].includes(w.entities.get(id)?.civilian?.survivor?.key ?? '')) ?? 0;
    s.megaId = w.infected!.spawn('infected.alpha', { x: -430, z: 0 }, { state: 'chase', variant: 'inf.mega-alpha', offNav: true });
    const mega = w.entities.get(s.megaId)!; mega.hidden = true; mega.infected!.hidden = true; mega.attachedTo = this.car.entity.id; mega.health.current = mega.health.max = 3000; w.spatial.delete(mega.id);
    // Warm the bus with the starting scene, before its offscreen road entry.
    const busAt = { x: -570, z: -120 };
    s.busId = w.vehicles!.spawn('vehicle.school-bus', busAt); const bus = w.vehicles!.cars.get(s.busId)!;
    bus.entity.hidden = true; bus.entity.vehicle!.braced = true; bus.physics.body.setEnabled(false);
    for (let i = 0; i < 6; i++) {
      const id = w.infected!.spawn(i % 2 ? 'infected.sprinter' : 'infected.runner', busAt, { state: 'chase', offNav: true }), e = w.entities.get(id)!;
      e.hidden = true; e.infected!.hidden = true; e.attachedTo = s.busId; s.busPassengers.push(id); w.spatial.delete(id);
    }
    for (let i = 0; i < 3; i++) {
      const truck = spawnSetPiece(w, 'veh.military-truck', { x: cfg.evacuation.truckX + i * 9, z: cfg.evacuation.truckZ, yaw: Math.PI / 2 }); s.trucks.push(truck.id);
    }
    for (let i = 0; i < 4; i++) {
      // Prewarm the cast in resident navigation; the bridgehead is streamed
      // later. Hidden truck occupants are deployed before that camp is visible.
      const id = outbreak.spawnPedestrian(warm, { role: 'soldier', model: 'npc.national-guard', waypoints: [warm] }, false), e = w.entities.get(id)!;
      e.hidden = true; e.passengerOf = s.trucks[i % 3]; w.spatial.delete(id);
      e.civilian!.ally = { ...allyState('soldier', null), post: { x: 447 + i * 4, z: -7 }, hold: true, range: 35, gun: { damage: 20, shotS: .7, rangeM: 35, nearM: 12, hitNear: .75, hitFar: .3 } };
      s.soldiers.push(id);
    }
    if (!s.samId) {
      // Reyes joins from the guard line after the civilians leave. Adding him
      // to an already full arriving APC would overwrite a real passenger seat.
      s.samId = s.soldiers[0]; s.roster.push(s.samId);
      w.entities.get(s.samId)!.civilian!.survivor = { key: 'reyes', mode: 'follow', slot: s.roster.length - 1, leader: 1, cover: false, waitAt: 0, foundAt: 0 };
    }
    spawnSetPiece(w, 'bld.gas-station', { x: 418, z: 41 });
    spawnSetPiece(w, 'kit.rail-crossing', { x: cfg.railX, z: 0, yaw: Math.PI / 2 });
    s.tankerId = spawnSetPiece(w, 'veh.fuel-truck', { ...cfg.tanker, yaw: Math.PI / 2 }).id;
    const crater = spawnSetPiece(w, 'decay.fuel-truck-crater', cfg.tanker); crater.hidden = true; s.tankerWreckId = crater.id;
    s.gateId = spawnSetPiece(w, 'l9.evac-gate', cfg.gate).id;
    s.bridgeGateId = spawnSetPiece(w, 'l9.bridge-gate', { x: cfg.bridgeGate.x, z: 0 }).id;
    // The reusable obstacle owner handles native collision, fracture and debris.
    for (const [x, z, kind] of [
      [-468, -4, 'barricade'], [-468, -1.5, 'barricade'], [-468, 1, 'barricade'], [-468, 3.5, 'barricade'],
      [-478, -11, 'jersey-barrier'], [-478, 11, 'jersey-barrier'],
      [-155, -330, 'barricade'], [-155, -327.5, 'barricade'], [-155, -332.5, 'barricade'],
      [-130, 240, 'fence'], [-130, 242.4, 'fence'], [-130, 237.6, 'fence'],
      [cfg.gate.x, cfg.gate.sideZ, 'fence'], [cfg.gate.x, -cfg.gate.sideZ, 'fence'],
    ] as const) s.obstacleIds.push(w.vehicles!.obstacles.spawn(kind, { x, z }));
    this.rebuild();
  }
  private seat(e: EntitySnapshot): void {
    const car = this.car, vehicle = car.entity.vehicle!;
    (vehicle.passengers ??= []).push({ id: e.id, seat: vehicle.passengers?.length ?? 0, phase: 'seated', started: this.w.tick, from: { ...e.transform }, pauseUntil: 0 });
    e.passengerOf = car.entity.id; e.hidden = true; e.civilian!.pauseUntil = Number.MAX_SAFE_INTEGER; this.w.spatial.delete(e.id);
  }
  /** Restored native fixtures share the ordinary entity state and checkpoint. */
  rebuild(): void {
    const w = this.w, s = this.state;
    for (const handle of this.rampHandles) w.physics.removeBlocker(handle); this.rampHandles.length = 0;
    for (const [i, ramp] of cfg.ramps.entries()) {
      const angle = .18;
      this.rampHandles.push(w.physics.world!.createCollider(RAPIER.ColliderDesc.cuboid(6, .16, 3.3).setTranslation(ramp.x, 1.23, ramp.z).setRotation({ x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) })).handle);
      this.rampHandles.push(w.physics.addBlocker({ x: ramp.x + 12, y: .5, z: ramp.z, halfX: 3, halfY: .5, halfZ: 3.2 }));
      w.events.emit({ type: 'world.blocker.changed', tick: w.tick, id: -900_900 - i, blocked: true, wall: { x: ramp.x + 6, y: 1, z: ramp.z, halfX: 12, halfY: 1, halfZ: 3.3 } });
    }
    w.interactables!.unblock(s.gateId); w.interactables!.unblock(s.bridgeGateId);
    const gate = w.entities.get(s.gateId), bridgeGate = w.entities.get(s.bridgeGateId);
    if (gate) gate.health.current = s.gateClosed ? 1 : 0;
    if (bridgeGate) bridgeGate.health.current = s.evacuationDone ? 0 : 1;
    if (s.gateClosed) w.interactables!.block(s.gateId, { x: cfg.gate.x, y: .8, z: 0, halfX: .25, halfY: .8, halfZ: cfg.gate.halfZ });
    if (!s.evacuationDone) w.interactables!.block(s.bridgeGateId, { x: cfg.bridgeGate.x, y: 1, z: 0, halfX: .35, halfY: 1, halfZ: cfg.bridgeGate.halfZ });
    for (const id of s.trucks) {
      w.interactables!.unblock(id);
      const truck = w.entities.get(id);
      if (truck && !s.evacuationDone) w.interactables!.block(id, { x: truck.transform.x, z: truck.transform.z, y: .9, halfX: 1.429, halfY: .9, halfZ: 3.464 });
    }
    w.interactables!.unblock(s.tankerId);
    if (!s.tankerExploded) w.interactables!.block(s.tankerId, { ...cfg.tanker, y: 1, halfX: 1.4, halfY: 1, halfZ: 4, entityId: s.tankerId });
    if (s.busId && s.busLineAt === null) { const bus = w.vehicles!.cars.get(s.busId); if (bus) { bus.physics.body.setEnabled(false); bus.entity.hidden = true; } }
    else if (s.busId && s.busStoppedAt === null) w.vehicles!.autopilot.set(s.busId, this.busIntent);
  }
  /** r30-l9bridge: true when nothing solid lies on the APC's heading (or `yaw`) for `metres`; `bodies` false ignores moving bodies (infected, vehicles). */
  laneClear(metres = 8, yaw = this.car.entity.transform.yaw, bodies = true): boolean {
    const w = this.w, car = this.car, p = car.entity.transform, r = car.physics.def.width / 2 + .2;
    // Probe discs start just past the nose (the hull and its nav margin are not an obstacle) and reach `metres` beyond it.
    for (let d = car.physics.def.length / 2 + r + .5; d <= car.physics.def.length / 2 + r + metres; d += 1) {
      const x = p.x + Math.cos(yaw) * d, z = p.z - Math.sin(yaw) * d;
      if (!w.infected!.nav.clear(x, z, r) || !w.solids.clear({ x, y: p.y, z }, r, car.entity.id, bodies)) return false;
    }
    return true;
  }
  /**
   * r30-l9bridge (P2 "the APC starts nose-to-tail behind the school bus inside a horde"): the `bridge` snapshot is taken where the
   * player happened to park in the bay, with the chasing bus alongside. A retry (`always`) or a resume whose lane is blocked puts the
   * APC on the authored bridge-start pose (clear lane east to the deck), sets the bus back 40-60 m on the approach road and lets
   * nearby infected lose the courier for the usual respawn delay. No infected stat or count changes.
   */
  safeBridgeStart(always: boolean): void {
    const s = this.state, w = this.w;
    if (!s.evacuationDone || this.mission.l9!.state.phase !== 'driving') return;
    const car = this.car, p = car.entity.transform, a = cfg.bridgeStart;
    if (p.x >= cfg.bridge.x) return;
    const bus = s.busId ? w.vehicles!.cars.get(s.busId) : undefined;
    const busNear = !!bus && !bus.entity.hidden && Math.hypot(bus.entity.transform.x - p.x, bus.entity.transform.z - p.z) < 18;
    if (!always && !busNear && this.laneClear()) return;
    const place = (c: { entity: EntitySnapshot; physics: typeof car.physics }, x: number, z: number, yaw: number) => {
      const y = c.physics.def.suspension + c.physics.def.wheelRadius + .15, pose = { x, y, z, yaw };
      Object.assign(c.entity.transform, pose); Object.assign(c.physics.previous, pose); c.physics.body.setTranslation(pose, true);
      c.physics.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
      c.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); c.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      c.physics.speed = c.physics.forwardSpeed = 0; if (c.entity.vehicle) c.entity.vehicle.speed = c.entity.vehicle.forwardSpeed = 0;
      w.spatial.set(c.entity.id, x, z);
    };
    if (bus) {
      let spot: { x: number; z: number } | null = null;
      for (const behind of a.busBehindM) for (const z of a.busZ) {
        const x = a.x - behind;
        if (!spot && w.chunks?.resident(x, z) && w.infected!.nav.clear(x, z, 3) && w.solids.clear({ x, y: .7, z }, 3, bus.entity.id)) spot = { x, z };
      }
      if (spot) place(bus, spot.x, spot.z, 0);
    }
    place(car, a.x, a.z, a.yaw);
    const player = w.entities.get(1)!; Object.assign(player.transform, { x: a.x, z: a.z, yaw: a.yaw });
    w.physics.playerBody!.setTranslation(player.transform, true); w.previousPlayer = { ...player.transform }; w.spatial.set(1, a.x, a.z);
    for (const id of car.entity.vehicle!.attached) { const e = w.entities.get(id); if (e) { e.transform.x = a.x; e.transform.z = a.z; w.spatial.set(id, a.x, a.z); } }
    clearThreat(w, a);
  }
  /** r32-l9fun: the APC is on a boost strip's 4 s engine boost. */
  boosting(id: number): boolean { return id === this.mission.l9?.state.carId && this.w.tick < (this.state.boostUntil ?? -1) && !this.holding(id); }
  holding(id: number): boolean {
    if (id !== this.mission.l9?.state.carId) return false;
    const s = this.state;
    return s.stallAt !== null && !s.restarted || s.repairActive || s.evacuationAt !== null && !s.evacuationDone;
  }
  claims(e: EntitySnapshot): boolean { return this.state.roster.includes(e.id) && (e.passengerOf !== undefined || this.state.evacuationAt !== null); }
  protectsCrew(e: EntitySnapshot): boolean {
    if (e.id === 1) return false; // The courier is exposed when she opens the hatch.
    const l9 = this.mission.l9!, s = this.state;
    return e.id === s.samId && l9.state.phase !== 'driving'
      || e.passengerOf === l9.state.carId && !!this.car.entity.vehicle!.passengers?.some(p => p.id === e.id && p.phase === 'seated');
  }
  ownsPose(e: EntitySnapshot): boolean {
    return e.passengerOf !== undefined || !!e.companion && e.contactExempt !== undefined
      || e.id === this.state.samId && this.mission.l9!.state.phase !== 'driving';
  }
  /** The cab stays occupied; only the stopped, open hatch exposes the courier and her carried arsenal. */
  get hatch(): boolean { return this.mission.l9?.state.phase === 'driving' && this.holding(this.car.entity.id) && !!this.state.hatchOpen; }
  canRepair(): boolean { return distance(this.car.entity.transform, cfg.repair) < cfg.repair.radius && this.car.physics.speed < 1 && this.state.restarted && this.state.evacuationAt === null && this.state.repairTicks < cfg.repair.ticks; }
  update(): void {
    const s = this.state, w = this.w, car = this.car, p = car.entity.transform, tick = w.tick;
    for (const id of s.soldiers) {
      const e = w.entities.get(id); if (!e?.hidden || !e.passengerOf || !e.civilian?.ally?.post) continue;
      const nav = w.infected!.nav, post = e.civilian.ally.post;
      if (!w.chunks?.resident(post.x, post.z)) continue;
      const cell = nav.nearestCell(post.x, post.z, .35); if (cell < 0) continue;
      Object.assign(e.transform, { x: nav.x(cell), z: nav.z(cell), y: .7 });
      e.civilian.ally.post = { x: e.transform.x, z: e.transform.z }; e.hidden = false; delete e.passengerOf;
      w.solids.admit(e, 'l9.guard-post'); w.spatial.set(id, e.transform.x, e.transform.z);
    }
    if (!s.boardersCalled && car.entity.vehicle!.attached.length) {
      s.boardersCalled = true;
      if (s.roster.some(id => alive(w.entities.get(id)) && w.entities.get(id)!.civilian?.survivor?.key === 'mia')) this.line('L9.clingers');
    }
    if (!s.route && p.x > -340) { s.route = p.z < -150 ? 'road' : p.z > 120 ? 'countryside' : 'dry-shortcut'; this.signal(`route.${s.route}`); }
    this.course(); this.bus();
    this.setPieces.update(s.setPieces ??= emptySetPieces(), s.restarted ? null : s.stallAt, this.holding(car.entity.id) && s.stallAt === null);
    if (tick % 10 === 0) for (const id of [...s.waves, ...s.busPassengers.slice(0, s.busReleased)]) pursueCrossingVehicle(w, id);
    if (p.x >= cfg.gate.announceX && s.gateAt === null) { s.gateAt = tick; this.line('L9.gate'); this.signal('gate-countdown'); }
    if (s.gateAt !== null && !s.gateClosed && tick - s.gateAt >= cfg.gate.seconds * 60) {
      s.gateClosed = true; this.rebuild(); this.signal('gate-closed');
    }
    if (p.x > cfg.gate.x + 3 && Math.abs(p.z) > cfg.gate.halfZ) s.fenceBroken = true;
    // Rail lines cross every route. A damaged engine stalls here once; Sam's
    // restart is temporary and never defeats the 0-HP driveable floor.
    if (!s.restarted && s.stallAt === null && p.x >= cfg.railX - 3) {
      s.stallAt = tick; this.line('L9.stall.sam'); this.signal('rail-stall'); this.checkpoint('mid-crossing');
    }
    if (s.stallAt !== null && !s.restarted && tick - s.stallAt >= 1800) { s.restarted = true; this.signal('engine-restarted'); }
    car.entity.vehicle!.boardSpacing = s.stallAt !== null && !s.restarted ? tuneStall.boardSpacingTicks : 0;
    s.repairActive = this.canRepair() && (w.inputFrame.interactHeld ?? w.inputFrame.interact);
    if (s.repairActive) {
      s.repairTicks++; car.entity.health.current = Math.min(car.entity.health.max, car.entity.health.current + cfg.repair.durability / cfg.repair.ticks);
      if (s.repairTicks === 1) this.signal('repair-started');
      if (s.repairTicks === cfg.repair.ticks) this.signal('repair-finished');
    }
    this.evacuate(); this.waves();
    // Once the stopped crew opens it, a bus nudge cannot magically close the
    // hatch and disable the player's weapon in the middle of the defence.
    if (!this.holding(car.entity.id)) s.hatchOpen = false; else if (car.physics.speed < 1) s.hatchOpen = true;
    this.poseHatch();
    for (const id of this.hatch ? s.roster : []) {
      const e = w.entities.get(id);
      if (alive(e) && e.civilian?.ally) updateAlly(w, e, (a, b, target) => w.combat!.query.visible(a, b, target), this.hatch);
    }
  }
  updateDialogue(): void {
    const s = this.state, tick = this.w.tick;
    if (s.lines[0] && tick >= s.lines[0].at && (!this.mission.state.subtitle || this.mission.state.subtitle.until <= tick)) this.mission.radio(s.lines.shift()!.id);
  }
  poseHatch(): void {
    const player = this.w.entities.get(1)!;
    if (!this.hatch) { if (this.w.vehicles!.active === this.car.entity.id) { player.hidden = true; if (player.passengerOf === this.car.entity.id) delete player.passengerOf; } return; }
    const p = this.car.entity.transform, aim = this.w.inputFrame.aim;
    Object.assign(player.transform, { x: p.x - Math.cos(p.yaw) * .5, z: p.z + Math.sin(p.yaw) * .5, y: p.y + .8, yaw: aim ? -Math.atan2(aim.z, aim.x) : p.yaw });
    player.hidden = false; player.passengerOf = this.car.entity.id;
    this.w.physics.playerBody!.setTranslation(player.transform, true); this.w.physics.playerBody!.setNextKinematicTranslation(player.transform);
    for (const [i, id] of this.state.roster.entries()) {
      const e = this.w.entities.get(id);
      if (!e?.civilian?.ally || e.passengerOf !== this.car.entity.id) continue;
      const side = i % 2 ? 1 : -1;
      Object.assign(e.transform, { x: p.x - Math.cos(p.yaw) * 1.8 + Math.sin(p.yaw) * side * .7, z: p.z + Math.sin(p.yaw) * 1.8 + Math.cos(p.yaw) * side * .7, y: p.y + .8 });
      e.hidden = false;
    }
  }
  private course(): void {
    const w = this.w, s = this.state, car = this.car, p = car.entity.transform;
    const tanker = w.entities.get(s.tankerId);
    if (tanker && !s.tankerExploded) {
      // r32-l9fun near miss: the leaking tanker catches as the APC comes within 30 m and goes up just after it has passed
      // (or 2 s after a scrape), so the blast and its slow-motion land behind the hull instead of under it.
      const gap = car.physics.hullDistance(tanker.transform.x, tanker.transform.z), scraped = gap < 3;
      if (s.tankerFuseAt === null && (scraped || gap < 30 && p.x < tanker.transform.x)) {
        s.tankerFuseAt = w.tick + (scraped ? 120 : 300); this.signal('tanker-armed', tanker.id);
        w.events.emit({ type: 'vfx.effect', tick: w.tick, kind: 'fire', position: { ...tanker.transform }, radius: 1.5 });
      }
      if (s.tankerFuseAt !== null && s.tankerFuseAt - w.tick > 120 && scraped) s.tankerFuseAt = w.tick + 120;
      if (s.tankerFuseAt !== null && (w.tick >= s.tankerFuseAt || s.tankerFuseAt - w.tick > 120 && p.x > tanker.transform.x + 10)) {
        s.tankerExploded = true; tanker.health.current = 0; tanker.hidden = true;
        w.entities.get(s.tankerWreckId)!.hidden = false; w.interactables!.unblock(s.tankerId);
        w.explosions!.blast('explosion.gas-tanks', tanker.transform, { sourceId: tanker.id }); this.signal('tanker-exploded', tanker.id);
      }
    }
    if (!s.stampede.length && s.route === 'dry-shortcut' && p.x > -210 && p.x < -110) {
      const at = { x: -80, z: -115 };
      if (distance(at, p) >= 105 && w.chunks?.resident(at.x, at.z)) {
        for (let i = 0; i < 5 && w.infected!.director.count < w.infected!.director.cap && w.infected!.pool.length; i++) {
          const start = { x: at.x + (i - 2) * 4, z: at.z - i % 2 * 5 };
          if (distance(start, p) < 105 || !w.infected!.director.safe('infected.zebra', start)) continue;
          const id = w.infected!.spawn('infected.zebra', start, { state: 'chase', yaw: -Math.PI / 2 });
          w.entities.get(id)!.infected!.scripted = { x: start.x, z: 100 }; s.stampede.push(id);
        }
        if (s.stampede.length) this.signal('zebra-stampede');
      }
    }
    if (s.fireAt === null && distance(p, cfg.fire) < 95) { s.fireAt = w.tick; this.signal('fire-countdown'); }
    if (s.fireAt !== null && !s.fireIds.length && w.tick - s.fireAt >= cfg.fire.closeTicks) {
      for (let z = 232; z <= 248; z += 3) s.fireIds.push(w.hazards!.spawn('fire', { x: cfg.fire.x, z }, { radius: 3, duration: 3600 }));
      this.signal('fire-closed');
    }
    if (s.fireIds.length && Math.abs(p.x - cfg.fire.x) < 5 && Math.abs(p.z - cfg.fire.z) < 12 && w.tick % 30 === 0) w.vehicles!.damage(car.entity.id, 20);
    // r32-l9fun boost strips: crossing one at speed gives a 4 s engine boost (Vehicles reads boosting()).
    for (const b of cfg.boosts) if (Math.abs(p.x - b.x) < cfg.boost.halfX && Math.abs(p.z - b.z) < cfg.boost.halfZ && car.physics.speed > cfg.boost.minSpeed && !(w.tick < (s.boostUntil ?? -1))) {
      s.boostUntil = w.tick + cfg.boost.ticks; this.signal('boost');
    }
    const flying = car.physics.wheels.every(wheel => !wheel.contact);
    for (const ramp of cfg.ramps) {
      if (s.jumped.includes(ramp.id) || Math.abs(p.z - ramp.z) > 5) continue;
      if (p.x > ramp.x - 3 && p.x < ramp.x + 8 && p.y > 2) s.jump ??= { id: ramp.id, airborne: true };
      // Airtime: all four wheels off the ground after the ramp lip (r32-l9fun jump proof).
      if (s.jump?.id === ramp.id && flying) s.takeoffAt ??= w.tick;
      if (s.jump?.id === ramp.id && p.x > ramp.x + 16 && p.y < 1.8 && !flying) {
        const hard = car.physics.speed < 7;
        (s.airtime ??= []).push({ id: ramp.id, ticks: s.takeoffAt == null ? 0 : w.tick - s.takeoffAt, speed: Math.round(car.physics.speed * 10) / 10, hard });
        s.jumped.push(ramp.id); s.jump = null; s.takeoffAt = null; this.signal(`jump.${ramp.id}`);
        if (hard) w.vehicles!.damage(car.entity.id, 40);
      }
    }
  }
  private readonly busIntent = (intent: DriveIntent, bus: EntitySnapshot): void => {
    const car = this.car.entity.transform, dx = car.x - bus.transform.x, dz = car.z - bus.transform.z;
    const delta = Math.atan2(Math.sin(-Math.atan2(dz, dx) - bus.transform.yaw), Math.cos(-Math.atan2(dz, dx) - bus.transform.yaw));
    intent.throttle = 1; intent.brake = false; intent.steer = Math.max(-1, Math.min(1, delta * 2));
    // r27-l9board: a bus glued to a crawling or stalled APC rammed it every 2 s (30 rams, durability 0 by the rail on the
    // countryside route). It now damages the APC at most busRamCap times (r33-l9polish: 3 x 40 = 120 of 1000, was 12 x 40); it still drives and pushes.
    // Evacuation hold: the APC is parked with the brake on. A full-throttle bus
    // pressed against it shoved it ~2.4 m at once and then crept it ~10 m over
    // the hold. The bus now slows on approach and halts a few metres short, so
    // it never pushes the parked APC and never blocks the passenger door
    // (its passengers still spill and attack, see bus()).
    if (this.state.evacuationAt !== null && !this.state.evacuationDone) {
      const gap = this.car.physics.hullDistance(bus.transform.x, bus.transform.z) - this.w.vehicles!.cars.get(this.state.busId)!.physics.def.length / 2;
      const speed = bus.vehicle?.speed ?? 0, allowed = 2.5 + Math.max(0, gap - 4.5) * .6;
      // A bus already alongside when the hold starts (countryside route) backs off the door instead of walling it in.
      if (gap < 3.5) { intent.throttle = -.6; intent.brake = false; intent.steer = 0; }
      else if (gap <= 4.5 || speed > allowed) { intent.throttle = 0; intent.brake = true; }
    }
  };
  private bus(): void {
    const s = this.state, w = this.w, car = this.car, p = car.entity.transform;
    // The first glimpse crosses the road behind the APC; the next two pace
    // the distant fields. The staged actor cannot block or fight the convoy.
    const sightings = s.megaSightings ??= [], mega = w.entities.get(s.megaId);
    if (mega && p.x < 400) {
      if (!s.megaSighting) for (const [index, x] of [-260, -90, 100].entries()) {
        if (sightings.includes(index) || p.x < x || p.x > x + 24) continue;
        sightings.push(index); s.megaSighting = { index, startedAt: w.tick, roadZ: p.z };
        if (index === 0) { this.line('L9.mega-what'); this.line('L9.mega-drive', 120); }
        this.signal(`mega-sighting-${index + 1}`, mega.id); break;
      }
      const sighting = s.megaSighting;
      if (sighting) {
        const t = (w.tick - sighting.startedAt) / 180;
        if (t < 1) {
          const z = sighting.index === 0 ? sighting.roadZ - 12 + t * 24 : p.z + (sighting.index === 1 ? -26 : 28);
          Object.assign(mega.transform, { x: p.x - 20, y: .7, z, yaw: sighting.index === 0 ? -Math.PI / 3 : p.yaw });
          mega.hidden = false; mega.infected!.hidden = false; mega.infected!.state = 'chase';
          mega.contactExempt = car.entity.id; mega.combat!.damageMultiplier = 0;
          w.spatial.set(mega.id, mega.transform.x, mega.transform.z);
        } else { mega.hidden = true; mega.infected!.hidden = true; w.spatial.delete(mega.id); delete s.megaSighting; }
      }
    }
    if (s.busLineAt === null && p.x > 110 && p.x < 330) {
      const at = { x: p.x - Math.cos(p.yaw) * 110, z: p.z + Math.sin(p.yaw) * 110 };
      if (!w.chunks?.resident(at.x, at.z) || !w.infected!.nav.clear(at.x, at.z, 2)) return;
      const bus = w.vehicles!.cars.get(s.busId)!;
      const pose = { ...at, y: bus.physics.def.suspension + bus.physics.def.wheelRadius + .15, yaw: p.yaw };
      Object.assign(bus.entity.transform, pose); Object.assign(bus.physics.previous, pose); bus.physics.body.setTranslation(pose, true);
      bus.physics.body.setRotation({ x: 0, y: Math.sin(p.yaw / 2), z: 0, w: Math.cos(p.yaw / 2) }, true);
      bus.physics.body.setEnabled(true); bus.entity.hidden = false; bus.entity.vehicle!.braced = false;
      w.vehicles!.autopilot.set(s.busId, this.busIntent); s.busLineAt = w.tick;
      if (s.roster.some(id => alive(w.entities.get(id)) && w.entities.get(id)!.civilian?.survivor?.key === 'dale')) { this.line('L9.bus.dale'); this.line('L9.bus.dale-beat', 180); }
      this.signal('bus-chase', s.busId);
    }
    if (s.busLineAt === null) return;
    const bus = w.vehicles!.cars.get(s.busId); if (!bus) return;
    if (s.busStoppedAt === null && w.tick % 6 === 0) emitEngine(w, s.busId, bus.physics.speed);
    const near = car.physics.hullDistance(bus.entity.transform.x, bus.entity.transform.z) < bus.physics.def.length / 2 + 1;
    if (s.busStoppedAt === null && near && s.busRams < busRamCap && w.tick - s.busHitAt >= 120 && Math.max(bus.physics.speed, car.physics.speed) > 2) {
      s.busHitAt = w.tick; s.busRams++; w.vehicles!.damage(car.entity.id, 40); this.signal('bus-ram', bus.entity.id);
    }
    let blocked = false;
    if (bus.physics.stuck) w.physics.world!.contactPairsWith(bus.physics.collider, collider => {
      if (collider.handle === car.physics.collider.handle) return;
      w.physics.world!.contactPair(bus.physics.collider, collider, manifold => { if (Math.abs(manifold.normal().y) < .7) blocked = true; });
    });
    if (s.busStoppedAt === null && (bus.physics.stuck && blocked || bus.entity.health.current <= 0)) {
      s.busStoppedAt = w.tick; w.vehicles!.autopilot.delete(s.busId); stopEngine(w, s.busId); this.signal('bus-stopped', s.busId);
    }
    for (let i = s.busReleased; i < s.busPassengers.length; i++) {
      const e = w.entities.get(s.busPassengers[i]); if (!e) continue;
      Object.assign(e.transform, bus.entity.transform);
      if ((bus.physics.speed < 3 || s.busStoppedAt !== null) && w.tick % 90 === 0 && i === s.busReleased) {
        e.transform.z += 2.1; e.transform.x -= 2; e.hidden = false; e.infected!.hidden = false; delete e.attachedTo;
        w.spatial.set(e.id, e.transform.x, e.transform.z); w.infected!.pursueTarget(e.id, 1); pursueCrossingVehicle(w, e.id); s.busReleased++; this.signal('bus-spill', e.id); break;
      }
    }
  }
  updateConvoy(): void {
    const s = this.state, w = this.w;
    if (!s.evacuationDone) return;
    for (const id of s.trucks) {
      const truck = w.entities.get(id); if (!truck || truck.transform.z < -70) continue;
      truck.transform.z -= 5 / 60;
      if (w.tick % 6 === 0) emitEngine(w, id, 5);
    }
  }
  private evacuate(): void {
    const w = this.w, s = this.state, p = this.car.entity.transform;
    const inBay = p.x >= cfg.bay.x0 && p.x <= cfg.bay.x1 && Math.abs(p.z) <= cfg.bay.halfZ;
    if (s.evacuationAt === null && (distance(p, cfg.evacuation) < cfg.evacuation.radius || inBay) && this.car.physics.speed < 1) {
      s.evacuationAt = w.tick; this.checkpoint('evac-point'); this.signal('evacuation-started');
    }
    if (s.evacuationAt === null || s.evacuationDone) return;
    const passengers = this.car.entity.vehicle!.passengers ?? [];
    if (w.tick % 45 === 0) {
      const next = passengers.find(p => p.id !== s.samId && alive(w.entities.get(p.id)) && !w.entities.get(p.id)?.companion && p.phase === 'seated');
      if (next && w.vehicles!.disembarkPassenger(this.car.entity.id, next.id)) s.evacuating.push(next.id);
    }
    for (const id of s.evacuating) {
      const e = w.entities.get(id); if (!alive(e) || e.passengerOf || s.evacuated.includes(id)) continue;
      if (e.civilian?.survivor?.key === 'rosa' && !s.hugDone && !this.hugCorgi(e)) continue;
      const slot = s.roster.filter(other => other !== s.samId).indexOf(id);
      // The bus can push the camp wreck into the eastern boarding lane.
      // Use the clear side of the actual truck, outside its body/nav margin;
      // routing to the blocked side only reaches a nearby cell and circles.
      const target = { x: cfg.evacuation.truckX + slot % 3 * 9 + 2.5, z: cfg.evacuation.truckZ + 1 + Math.floor(slot / 3) * 1.1 };
      if (!w.infected!.nav.clear(target.x, target.z, .5) || !w.solids.clear({ ...target, y: e.transform.y }, .35, e.id, false)) target.x -= 5;
      e.civilian!.pauseUntil = Number.MAX_SAFE_INTEGER; if (e.civilian!.survivor) e.civilian!.survivor!.mode = 'hidden';
      // The far truck sits beyond the bridge-gate wall end: from an APC parked north of the bay the walk
      // around it exceeds the default 1600-node search (r27-l9apc, --zero run: Okafor stood forever).
      if (s.truckEntering[id] === undefined) w.npcs!.move(e, target, 3, e.civilian!, .6, 8000);
      w.spatial.set(id, e.transform.x, e.transform.z);
      if (distance(e.transform, target) < 1.2) {
        s.truckEntering[id] ??= w.tick; e.civilian!.story = { clip: 'npc-sit-down', start: s.truckEntering[id] };
        if (w.tick - s.truckEntering[id] < 45) continue;
        s.evacuated.push(id); e.hidden = true; e.passengerOf = s.trucks[slot % 3]; w.spatial.delete(id);
        this.signal('survivor-evacuated', id);
        if (e.civilian?.survivor?.key === 'okafor') this.line('L9.okafor');
      }
    }
    const living = s.roster.filter(id => id !== s.samId && alive(w.entities.get(id)));
    const corgi = [...w.entities.iterate()].find(e => e.companion);
    const rosaWaiting = s.roster.some(id => { const e = w.entities.get(id); return alive(e) && e.civilian?.survivor?.key === 'rosa' && !s.hugDone; });
    if (corgi && corgi.passengerOf === undefined && !rosaWaiting) {
      if (corgi.contactExempt !== undefined) { delete corgi.contactExempt; delete corgi.companion!.transitionUntil; corgi.transform.y = .3; }
      corgi.companion!.transitionUntil = w.tick + 2;
      const door = w.vehicles!.passengerDoor(this.car.entity.id);
      w.npcs!.move(corgi, door, 2.5, corgi.companion!, .15);
      w.vehicles!.boardPassenger(this.car.entity.id, corgi.id, this.doorReach(corgi, door));
    }
    const dogAboard = !corgi || this.car.entity.vehicle!.passengers?.some(p => p.id === corgi.id && p.phase === 'seated');
    const research = w.entities.get(s.samId);
    if (alive(research) && research.passengerOf !== this.car.entity.id) {
      w.npcs!.move(research, w.vehicles!.passengerDoor(this.car.entity.id), 3, research.civilian!, .2);
      w.vehicles!.boardPassenger(this.car.entity.id, research.id, this.doorReach(research, w.vehicles!.passengerDoor(this.car.entity.id)));
    }
    const researchAboard = !alive(research) || this.car.entity.vehicle!.passengers?.some(p => p.id === research.id && p.phase === 'seated');
    if (w.tick - s.evacuationAt >= cfg.evacuation.defendTicks && living.every(id => s.evacuated.includes(id)) && dogAboard && researchAboard) {
      s.evacuationDone = true; this.line('L9.sam-stays'); this.rebuild(); this.signal('evacuation-complete'); this.checkpoint('bridge');
    }
  }
  /**
   * r27-l9board: a diagonally parked APC puts the passenger door inside the hull's nav margin, so a companion routed to it
   * halts on the nearest clear cell, 1.3 to 3 m out, just beyond the default 1.2 m / 0.7 m boarding radius, and the evacuation
   * never completes. A companion standing on the outer side of the door (farther from the hull centre than the door) within
   * 2 m may board; one beyond or across the hull may not.
   */
  private doorReach(e: EntitySnapshot, door: { x: number; z: number }): number | undefined {
    const c = this.car.entity.transform;
    const outside = Math.hypot(e.transform.x - c.x, e.transform.z - c.z) >= Math.hypot(door.x - c.x, door.z - c.z);
    return outside ? 2 : undefined;
  }
  private hugCorgi(rosa: EntitySnapshot): boolean {
    const w = this.w, s = this.state, corgi = [...w.entities.iterate()].find(e => e.companion);
    if (!corgi) { s.hugDone = true; return true; }
    // Rosa can already be beside the rear entry when the dog's exit ends.
    // Their shared embrace space must be exempt during disembarking too.
    corgi.contactExempt = rosa.id;
    if (corgi.passengerOf) { w.vehicles!.disembarkPassenger(this.car.entity.id, corgi.id); return false; }
    const p = this.car.entity.transform, c = Math.cos(p.yaw), side = Math.sin(p.yaw), nav = w.infected!.nav;
    const clear = (spot: NonNullable<L9DrivingState['hugSpot']>) => nav.clear(spot.x, spot.z, .35) && nav.clear(spot.dogX, spot.dogZ, .9)
      && w.solids.clear({ ...spot, y: .7 }, .35, rosa.id, false) && w.solids.clear({ x: spot.dogX, z: spot.dogZ, y: .3 }, .9, corgi.id, false);
    if (s.hugAt === null && s.hugSpot && !clear(s.hugSpot)) delete s.hugSpot;
    if (!s.hugSpot) {
      search: for (const sign of [1, -1]) for (const along of [-1, -2, 0, 1]) for (const across of [3.5, 4.5, 5.5]) {
        const x = p.x + c * along + side * across * sign, z = p.z - side * along + c * across * sign;
        const candidate = { x, z, dogX: x + side * .7 * sign, dogZ: z + c * .7 * sign };
        if (clear(candidate)) { s.hugSpot = candidate; break search; }
      }
    }
    const spot = s.hugSpot; if (!spot) return false;
    // They must enter each other's personal space before the authored lift.
    // Keep the same paired exemption through approach and embrace.
    corgi.contactExempt = rosa.id;
    corgi.companion!.transitionUntil = w.tick + 2;
    w.npcs!.move(rosa, spot, 2, rosa.civilian!, .4);
    if (s.hugAt === null) w.npcs!.move(corgi, { x: spot.dogX, z: spot.dogZ }, 2.5, corgi.companion!, .25);
    if (distance(rosa.transform, spot) > .8 || s.hugAt === null && distance(corgi.transform, rosa.transform) > 1.2) return false;
    s.hugAt ??= w.tick; rosa.civilian!.pauseUntil = Number.MAX_SAFE_INTEGER; rosa.civilian!.story = { clip: 'npc-hug', start: s.hugAt };
    corgi.contactExempt = rosa.id; corgi.companion!.transitionUntil = w.tick + 2;
    const facing = rosa.transform.yaw;
    Object.assign(corgi.transform, { x: rosa.transform.x + Math.cos(facing) * .3, y: 1.05, z: rosa.transform.z - Math.sin(facing) * .3, yaw: facing + Math.PI / 2 });
    w.solids.wrote(corgi, 'l9.corgi-goodbye');
    w.spatial.set(corgi.id, corgi.transform.x, corgi.transform.z);
    if (w.tick - s.hugAt < 120) return false;
    s.hugDone = true; rosa.civilian!.story = null; corgi.transform.y = .3; delete corgi.contactExempt; delete corgi.companion!.transitionUntil; this.signal('corgi-goodbye', rosa.id); return true;
  }
  /** Reinforcements enter from beyond the largest driving frame, then run in. */
  private waves(): void {
    const w = this.w, s = this.state;
    if (w.tick < s.nextWave || !this.holding(this.car.entity.id)) return;
    const at = this.car.entity.transform, ai = w.infected!;
    for (let i = 0; i < 8 && ai.director.count + 1 < ai.director.cap && ai.pool.length; i++) {
      const angle = Math.PI + (i - 3.5) * .13, p = { x: at.x + Math.cos(angle) * 105, z: at.z + Math.sin(angle) * 105 }, archetype = ['infected.sprinter', 'infected.dog', 'infected.runner', 'infected.armored'][i % 4];
      if (!w.chunks?.resident(p.x, p.z) || !ai.director.safe(archetype, p)) continue;
      const id = ai.spawn(archetype, p, { state: 'chase' }); ai.pursueTarget(id, 1); pursueCrossingVehicle(w, id); s.waves.push(id);
    }
    s.nextWave = w.tick + 360;
  }
  text(): string {
    const s = this.state, p = this.car.entity.transform, tick = this.w.tick;
    if (s.stallAt !== null && !s.restarted) return `Defend the hatch · Restart ${Math.max(0, Math.ceil((1800 - tick + s.stallAt) / 60))} s`;
    if (s.evacuationAt !== null && !s.evacuationDone) return `Cover the survivors · ${s.evacuated.length}/${s.roster.filter(id => id !== s.samId && alive(this.w.entities.get(id))).length} at the trucks`;
    const alphas = s.setPieces?.alphas ?? [];
    if (alphas.some(a => a.phase === 'hull') && !this.holding(this.car.entity.id)) return 'Leaper on the hull · swerve hard or handbrake (K) to throw it off';
    if (this.car.entity.vehicle!.attached.length && !this.holding(this.car.entity.id)) return 'Shake off boarders · swerve or handbrake (K) while moving';
    if (alphas.some(a => a.role === 'thrower' && (a.phase === 'throw' || a.phase === 'cool' && a.uses < 4)) && !this.holding(this.car.entity.id)) return 'Thrower ahead · dodge the debris or smash through';
    if (s.evacuationDone) return 'Drive onto the bridge';
    if (s.tankerFuseAt !== null && !s.tankerExploded && distance(p, cfg.tanker) < 30) return `Get clear of the tanker · ${Math.max(0, Math.ceil((s.tankerFuseAt - tick) / 60))} s`;
    if (s.fireAt !== null && !s.fireIds.length && distance(p, cfg.fire) < 70) return `Cross the fire line · ${Math.max(0, Math.ceil((cfg.fire.closeTicks - tick + s.fireAt) / 60))} s`;
    if (distance(p, cfg.repair) < 15) return `Hold E to repair from the hatch · ${Math.round(s.repairTicks / cfg.repair.ticks * 100)}%`;
    if (p.x > cfg.gate.x - 12) return 'Stop in the evacuation bay';
    if (this.boosting(this.car.entity.id)) return 'Boost · open road, floor it';
    if (s.gateAt !== null) return `Reach the evacuation gate · ${s.gateClosed ? 'Gate shut · ram the side fence' : `${Math.max(0, Math.ceil(cfg.gate.seconds - (tick - s.gateAt) / 60))} s`}`;
    return 'Drive to the evacuation point';
  }
  restore(delta: number): void {
    const s = this.state;
    for (const key of ['stallAt', 'gateAt', 'evacuationAt', 'busStoppedAt', 'busLineAt', 'tankerFuseAt', 'fireAt', 'hugAt'] as const) if (s[key] !== null) s[key]! += delta;
    if (s.megaSighting) s.megaSighting.startedAt += delta;
    if (s.setPieces) this.setPieces.restore(s.setPieces, delta);
    if (s.takeoffAt != null) s.takeoffAt += delta;
    if (s.boostUntil !== undefined) s.boostUntil += delta;
    s.busHitAt += delta; s.nextWave += delta; for (const l of s.lines) l.at += delta;
    for (const id of Object.keys(s.truckEntering)) s.truckEntering[Number(id)] += delta;
  }
}
