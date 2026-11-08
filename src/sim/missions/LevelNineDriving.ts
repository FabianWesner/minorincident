import * as RAPIER from '@dimforge/rapier3d-compat';
import { l9Course as cfg } from '../../data/l9';
import { l5Survivors } from '../../data/l5';
import { spawnSetPiece } from './L4Spectacle';
import { allyState, updateAlly } from '../outbreak/Allies';
import { emitEngine, stopEngine } from '../vehicles/ConvoySound';
import type { Mission } from './Mission';
import type { EntitySnapshot } from '../world/types';
import type { DriveIntent } from '../vehicles/VehicleBody';
import { pursueCrossingVehicle } from './LevelNineEncounters';
import { Outbreak } from '../outbreak/Outbreak';

export interface L9DrivingState {
  prepared: boolean; roster: number[]; samId: number; megaId: number; soldiers: number[]; trucks: number[];
  boardersCalled: boolean; route: string | null; checkpoints: string[];
  stallAt: number | null; restarted: boolean; repairTicks: number; repairActive: boolean;
  gateAt: number | null; gateClosed: boolean; fenceBroken: boolean;
  evacuationAt: number | null; evacuated: number[]; evacuating: number[]; evacuationDone: boolean;
  hugAt: number | null; hugDone: boolean;
  busId: number; busPassengers: number[]; busReleased: number; busHitAt: number; busStoppedAt: number | null; busLineAt: number | null;
  tankerId: number; tankerWreckId: number; tankerFuseAt: number | null; tankerExploded: boolean; stampede: number[];
  fireAt: number | null; fireIds: number[]; jumped: string[]; jump: { id: string; airborne: boolean } | null;
  obstacleIds: number[]; waves: number[]; nextWave: number; lines: { id: string; at: number }[];
}
export const emptyDriving = (): L9DrivingState => ({
  prepared: false, roster: [], samId: 0, megaId: 0, soldiers: [], trucks: [], boardersCalled: false, route: null, checkpoints: [],
  stallAt: null, restarted: false, repairTicks: 0, repairActive: false, gateAt: null, gateClosed: false, fenceBroken: false,
  evacuationAt: null, evacuated: [], evacuating: [], evacuationDone: false,
  hugAt: null, hugDone: false,
  busId: 0, busPassengers: [], busReleased: 0, busHitAt: -1000, busStoppedAt: null, busLineAt: null,
  tankerId: 0, tankerWreckId: 0, tankerFuseAt: null, tankerExploded: false, stampede: [], fireAt: null, fireIds: [], jumped: [], jump: null,
  obstacleIds: [], waves: [], nextWave: 0, lines: [],
});
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const alive = (e: EntitySnapshot | undefined): e is EntitySnapshot => !!e && e.health.current > 0 && !e.infected && !e.infection;

/** L9's physical road challenges, exposed hatch defense and visible bridgehead handoff. */
export class LevelNineDriving {
  private readonly rampHandles: number[] = [];
  private gateHandle: number | null = null;
  private bridgeHandle: number | null = null;
  constructor(private readonly mission: Mission) {}
  private get w() { return this.mission.world; }
  get state(): L9DrivingState { return this.mission.l9!.state.driving ??= emptyDriving(); }
  private get car() { return this.w.vehicles!.cars.get(this.mission.l9!.state.carId)!; }
  private signal(name: string, actorId?: number) { this.w.events.emit({ type: 'mission.signal', tick: this.w.tick, name: `l9.${name}`, ...(actorId === undefined ? {} : { actorId }) }); }
  private line(id: string, delay = 0): void { this.state.lines.push({ id, at: this.w.tick + delay }); }
  private checkpoint(id: string): void { if (!this.state.checkpoints.includes(id)) { this.state.checkpoints.push(id); this.mission.checkpoint(id); } }
  prepare(): void {
    const s = this.state, w = this.w;
    w.npcs!.setAmbient(0); w.infected!.director.levelCap = 200; w.infected!.director.ambientTarget = 0; w.infected!.director.strict = true;
    const civilians = w.npcs!.civilians;
    const outbreak = civilians.outbreak ??= new Outbreak(w, { refuges: [], tier: w.infected!.director.tier });
    w.infected!.configureL1v2(outbreak.humans);
    if (s.prepared) { this.rebuild(); return; }
    s.prepared = true;
    w.npcs!.companion.forceSafe = true;
    const vehicle = this.car.entity.vehicle!;
    // Standalone level starts use the surviving campaign keys; transferred
    // occupants retain their identities and losses from the zoo.
    if (!w.progression?.campaign?.transport) for (const [slot, def] of l5Survivors.entries()) {
      if (!(w.progression?.campaign?.survivors ?? l5Survivors.map(r => r.key)).includes(def.key)) continue;
      const id = outbreak.spawnPedestrian({ x: -550, z: 3 + slot }, { role: 'cashier', model: def.model, waypoints: [{ x: -550, z: 3 + slot }] }, false);
      const e = w.entities.get(id)!;
      e.civilian!.survivor = { key: def.key, mode: 'follow', slot, leader: 1, cover: false, waitAt: 0, foundAt: 0 };
      if (def.key === 'sam') e.civilian!.ally = { ...allyState('civilian'), weapon: 'hunting-rifle', gun: { damage: 40, shotS: 1.5, rangeM: 35, nearM: 12, hitNear: .8, hitFar: .3 }, hold: true };
      this.seat(e);
    }
    s.roster = (vehicle.passengers ?? []).map(p => p.id).filter(id => !!w.entities.get(id)?.civilian);
    s.samId = s.roster.find(id => w.entities.get(id)?.civilian?.survivor?.key === 'sam') ?? 0;
    if (!s.samId) {
      const id = outbreak.spawnPedestrian({ x: -550, z: 5 }, { role: 'soldier', model: 'npc.national-guard', waypoints: [{ x: -550, z: 5 }] }, false);
      const e = w.entities.get(id)!; e.civilian!.survivor = { key: 'reyes', mode: 'follow', slot: s.roster.length, leader: 1, cover: false, waitAt: 0, foundAt: 0 };
      this.seat(e); s.roster.push(id); s.samId = id;
    }
    s.megaId = w.infected!.spawn('infected.alpha', { x: -430, z: 0 }, { state: 'chase', variant: 'inf.mega-alpha' });
    const mega = w.entities.get(s.megaId)!; mega.hidden = true; mega.infected!.hidden = true; mega.attachedTo = this.car.entity.id; mega.health.current = mega.health.max = 3000; w.spatial.delete(mega.id);
    // Warm the bus with the starting scene, before its offscreen road entry.
    const busAt = { x: -580, z: -80 };
    s.busId = w.vehicles!.spawn('vehicle.school-bus', busAt); const bus = w.vehicles!.cars.get(s.busId)!;
    bus.entity.hidden = true; bus.entity.vehicle!.braced = true; bus.physics.body.setEnabled(false);
    for (let i = 0; i < 6; i++) {
      const id = w.infected!.spawn(i % 2 ? 'infected.sprinter' : 'infected.runner', busAt, { state: 'chase' }), e = w.entities.get(id)!;
      e.hidden = true; e.infected!.hidden = true; e.attachedTo = s.busId; s.busPassengers.push(id); w.spatial.delete(id);
    }
    for (let i = 0; i < 3; i++) {
      const truck = spawnSetPiece(w, 'veh.military-truck', { x: cfg.evacuation.truckX + i * 9, z: cfg.evacuation.truckZ, yaw: Math.PI / 2 }); s.trucks.push(truck.id);
    }
    for (let i = 0; i < 4; i++) {
      const at = { x: 447 + i * 4, z: -7 }, id = outbreak.spawnPedestrian(at, { role: 'soldier', model: 'npc.national-guard', waypoints: [at] }, false), e = w.entities.get(id)!;
      e.civilian!.ally = { ...allyState('soldier', null), post: at, hold: true, range: 35, gun: { damage: 20, shotS: .7, rangeM: 35, nearM: 12, hitNear: .75, hitFar: .3 } };
      s.soldiers.push(id);
    }
    spawnSetPiece(w, 'bld.gas-station', { x: 418, z: 41 });
    spawnSetPiece(w, 'kit.rail-crossing', { x: cfg.railX, z: 0, yaw: Math.PI / 2 });
    s.tankerId = spawnSetPiece(w, 'veh.fuel-truck', { ...cfg.tanker, yaw: Math.PI / 2 }).id;
    const crater = spawnSetPiece(w, 'decay.fuel-truck-crater', cfg.tanker); crater.hidden = true; s.tankerWreckId = crater.id;
    // The reusable obstacle owner handles native collision, fracture and debris.
    for (const [x, z, kind] of [
      [-468, -4, 'barricade'], [-468, -1.5, 'barricade'], [-468, 1, 'barricade'], [-468, 3.5, 'barricade'],
      [-449, -11, 'jersey-barrier'], [-448, 11, 'jersey-barrier'],
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
    for (const ramp of cfg.ramps) {
      const angle = .18;
      this.rampHandles.push(w.physics.world!.createCollider(RAPIER.ColliderDesc.cuboid(6, .16, 3.3).setTranslation(ramp.x, 1.23, ramp.z).setRotation({ x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) })).handle);
      this.rampHandles.push(w.physics.addBlocker({ x: ramp.x + 12, y: .5, z: ramp.z, halfX: 3, halfY: .5, halfZ: 3.2 }));
    }
    if (this.gateHandle !== null) w.physics.removeBlocker(this.gateHandle); this.gateHandle = null;
    if (this.bridgeHandle !== null) w.physics.removeBlocker(this.bridgeHandle); this.bridgeHandle = null;
    if (s.gateClosed) this.gateHandle = w.physics.addBlocker({ x: cfg.gate.x, y: .8, z: 0, halfX: .25, halfY: .8, halfZ: cfg.gate.halfZ });
    if (!s.evacuationDone) this.bridgeHandle = w.physics.addBlocker({ x: 472, y: 1, z: 0, halfX: .35, halfY: 1, halfZ: 13 });
    w.interactables!.unblock(s.tankerId);
    if (!s.tankerExploded) w.interactables!.block(s.tankerId, { ...cfg.tanker, y: 1, halfX: 1.4, halfY: 1, halfZ: 4, entityId: s.tankerId });
    if (s.busId && s.busLineAt === null) { const bus = w.vehicles!.cars.get(s.busId); if (bus) { bus.physics.body.setEnabled(false); bus.entity.hidden = true; } }
    else if (s.busId && s.busStoppedAt === null) w.vehicles!.autopilot.set(s.busId, this.busIntent);
  }
  holding(id: number): boolean {
    if (id !== this.mission.l9?.state.carId) return false;
    const s = this.state;
    return s.stallAt !== null && !s.restarted || s.repairActive || s.evacuationAt !== null && !s.evacuationDone;
  }
  claims(e: EntitySnapshot): boolean { return this.state.roster.includes(e.id) && (e.passengerOf !== undefined || this.state.evacuationAt !== null); }
  /** The cab stays occupied; only the stopped, open hatch exposes the courier and her carried arsenal. */
  get hatch(): boolean { return this.mission.l9?.state.phase === 'driving' && this.holding(this.car.entity.id); }
  canRepair(): boolean { return distance(this.car.entity.transform, cfg.repair) < cfg.repair.radius && this.car.physics.speed < 1 && this.state.restarted && this.state.evacuationAt === null && this.state.repairTicks < cfg.repair.ticks; }
  update(): void {
    const s = this.state, w = this.w, car = this.car, p = car.entity.transform, tick = w.tick;
    if (!s.boardersCalled && car.entity.vehicle!.attached.length) {
      s.boardersCalled = true;
      if (s.roster.some(id => alive(w.entities.get(id)) && w.entities.get(id)!.civilian?.survivor?.key === 'mia')) this.line('L9.clingers');
    }
    if (!s.route && p.x > -340) { s.route = p.z < -150 ? 'road' : p.z > 120 ? 'countryside' : 'dry-shortcut'; this.signal(`route.${s.route}`); }
    this.course(); this.bus();
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
    s.repairActive = this.canRepair() && (w.inputFrame.interactHeld ?? w.inputFrame.interact);
    if (s.repairActive) {
      s.repairTicks++; car.entity.health.current = Math.min(car.entity.health.max, car.entity.health.current + cfg.repair.durability / cfg.repair.ticks);
      if (s.repairTicks === 1) this.signal('repair-started');
      if (s.repairTicks === cfg.repair.ticks) this.signal('repair-finished');
    }
    this.evacuate(); this.waves(); this.poseHatch();
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
    if (!this.hatch) { if (this.w.vehicles!.active === this.car.entity.id) player.hidden = true; return; }
    const p = this.car.entity.transform, aim = this.w.inputFrame.aim;
    Object.assign(player.transform, { x: p.x - Math.cos(p.yaw) * .5, z: p.z + Math.sin(p.yaw) * .5, y: p.y + .8, yaw: aim ? -Math.atan2(aim.z, aim.x) : p.yaw });
    player.hidden = false;
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
      if (s.tankerFuseAt === null && car.physics.hullDistance(tanker.transform.x, tanker.transform.z) < 3) {
        s.tankerFuseAt = w.tick + 120; this.signal('tanker-armed', tanker.id);
        w.events.emit({ type: 'vfx.effect', tick: w.tick, kind: 'fire', position: { ...tanker.transform }, radius: 1.5 });
      }
      if (s.tankerFuseAt !== null && w.tick >= s.tankerFuseAt) {
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
          if (!w.infected!.director.safe('infected.zebra', start)) continue;
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
    for (const ramp of cfg.ramps) {
      if (s.jumped.includes(ramp.id) || Math.abs(p.z - ramp.z) > 5) continue;
      if (p.x > ramp.x - 3 && p.x < ramp.x + 8 && p.y > 2) s.jump ??= { id: ramp.id, airborne: true };
      if (s.jump?.id === ramp.id && p.x > ramp.x + 16 && p.y < 1.8) {
        s.jumped.push(ramp.id); s.jump = null; this.signal(`jump.${ramp.id}`);
        if (car.physics.speed < 7) w.vehicles!.damage(car.entity.id, 40);
      }
    }
  }
  private readonly busIntent = (intent: DriveIntent, bus: EntitySnapshot): void => {
    const car = this.car.entity.transform, dx = car.x - bus.transform.x, dz = car.z - bus.transform.z;
    const delta = Math.atan2(Math.sin(-Math.atan2(dz, dx) - bus.transform.yaw), Math.cos(-Math.atan2(dz, dx) - bus.transform.yaw));
    intent.throttle = 1; intent.brake = false; intent.steer = Math.max(-1, Math.min(1, delta * 2));
  };
  private bus(): void {
    const s = this.state, w = this.w, car = this.car, p = car.entity.transform;
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
    if (s.busStoppedAt === null && near && w.tick - s.busHitAt >= 120 && Math.max(bus.physics.speed, car.physics.speed) > 2) {
      s.busHitAt = w.tick; w.vehicles!.damage(car.entity.id, 40); this.signal('bus-ram', bus.entity.id);
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
    if (s.evacuationAt === null && distance(p, cfg.evacuation) < cfg.evacuation.radius && this.car.physics.speed < 1) {
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
      const target = { x: cfg.evacuation.truckX + s.evacuated.length % 3 * 9, z: cfg.evacuation.truckZ + 2 };
      e.civilian!.pauseUntil = Number.MAX_SAFE_INTEGER; if (e.civilian!.survivor) e.civilian!.survivor!.mode = 'hidden';
      w.npcs!.move(e, target, 3, e.civilian!, .6, 1600); w.spatial.set(id, e.transform.x, e.transform.z);
      if (distance(e.transform, target) < 1.2) {
        s.evacuated.push(id); e.hidden = true; w.spatial.delete(id);
        this.signal('survivor-evacuated', id);
        if (e.civilian?.survivor?.key === 'okafor') this.line('L9.okafor');
      }
    }
    const living = s.roster.filter(id => id !== s.samId && alive(w.entities.get(id)));
    const corgi = [...w.entities.iterate()].find(e => e.companion);
    const rosaWaiting = s.roster.some(id => { const e = w.entities.get(id); return alive(e) && e.civilian?.survivor?.key === 'rosa' && !s.hugDone; });
    if (corgi && corgi.passengerOf === undefined && !rosaWaiting) {
      const door = w.vehicles!.passengerDoor(this.car.entity.id);
      w.npcs!.move(corgi, door, 2.5, corgi.companion!, .15);
      w.vehicles!.boardPassenger(this.car.entity.id, corgi.id);
    }
    const dogAboard = !corgi || this.car.entity.vehicle!.passengers?.some(p => p.id === corgi.id && p.phase === 'seated');
    if (w.tick - s.evacuationAt >= cfg.evacuation.defendTicks && living.every(id => s.evacuated.includes(id)) && dogAboard) {
      s.evacuationDone = true; this.line('L9.sam-stays'); this.rebuild(); this.signal('evacuation-complete'); this.checkpoint('bridge');
    }
  }
  private hugCorgi(rosa: EntitySnapshot): boolean {
    const w = this.w, s = this.state, corgi = [...w.entities.iterate()].find(e => e.companion);
    if (!corgi) { s.hugDone = true; return true; }
    if (corgi.passengerOf) { w.vehicles!.disembarkPassenger(this.car.entity.id, corgi.id); return false; }
    const p = this.car.entity.transform, spot = { x: p.x - 1, z: p.z + 3.5 };
    w.npcs!.move(rosa, spot, 2, rosa.civilian!, .4);
    if (distance(rosa.transform, spot) > .8) return false;
    s.hugAt ??= w.tick; rosa.civilian!.pauseUntil = Number.MAX_SAFE_INTEGER; rosa.civilian!.story = { clip: 'npc-hug', start: s.hugAt };
    const facing = rosa.transform.yaw;
    Object.assign(corgi.transform, { x: rosa.transform.x + Math.cos(facing) * .3, y: 1.05, z: rosa.transform.z - Math.sin(facing) * .3, yaw: facing + Math.PI / 2 });
    w.spatial.set(corgi.id, corgi.transform.x, corgi.transform.z);
    if (w.tick - s.hugAt < 120) return false;
    s.hugDone = true; rosa.civilian!.story = null; corgi.transform.y = .3; this.signal('corgi-goodbye', rosa.id); return true;
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
    if (s.evacuationDone) return 'Drive onto the bridge';
    if (s.tankerFuseAt !== null && !s.tankerExploded && distance(p, cfg.tanker) < 30) return `Get clear of the tanker · ${Math.max(0, Math.ceil((s.tankerFuseAt - tick) / 60))} s`;
    if (s.fireAt !== null && !s.fireIds.length && distance(p, cfg.fire) < 70) return `Cross the fire line · ${Math.max(0, Math.ceil((cfg.fire.closeTicks - tick + s.fireAt) / 60))} s`;
    if (distance(p, cfg.repair) < 15) return `Hold E to repair from the hatch · ${Math.round(s.repairTicks / cfg.repair.ticks * 100)}%`;
    if (p.x > cfg.gate.x - 12) return 'Stop in the evacuation bay';
    if (s.gateAt !== null) return `Reach the evacuation gate · ${s.gateClosed ? 'Gate shut · ram the side fence' : `${Math.max(0, Math.ceil(cfg.gate.seconds - (tick - s.gateAt) / 60))} s`}`;
    return 'Drive to the evacuation point';
  }
  restore(delta: number): void {
    const s = this.state;
    for (const key of ['stallAt', 'gateAt', 'evacuationAt', 'busStoppedAt', 'busLineAt', 'tankerFuseAt', 'fireAt', 'hugAt'] as const) if (s[key] !== null) s[key]! += delta;
    s.busHitAt += delta; s.nextWave += delta; for (const l of s.lines) l.at += delta;
  }
}
