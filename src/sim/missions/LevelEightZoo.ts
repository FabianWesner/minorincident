import type { Mission } from './Mission';
import { spawnSetPiece } from './L4Spectacle';
import type { EntitySnapshot } from '../world/types';
import type { Point, ZooSpecies } from '../npc/types';
import { Outbreak } from '../outbreak/Outbreak';
import { zooStaffLook } from '../../data/zooStaff';
import { allyState } from '../outbreak/Allies';
import { layoutHouseDoors, doorExit, emergeResident, walkResidents, type HouseEmergence } from '../outbreak/HouseEmergence';

export interface L8ZooState {
  startedAt: number; breachedAt: number; nextWave: number; alphas: number; carId: number; busId: number;
  roster: number[]; animals: number[]; outlets: HouseEmergence[];
  arrivals: { id: number; outlet: number; tick: number; alpha: boolean }[];
  escapeCheckpoint: boolean;
}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
/** Zoo story owns timing/entrances; the shared outbreak owns all bites, rescues and same-id transformations. */
export class LevelEightZoo {
  state: L8ZooState = { startedAt: 0, breachedAt: 0, nextWave: 0, alphas: 0, carId: 0, busId: 0, roster: [], animals: [], outlets: [], arrivals: [], escapeCheckpoint: false };
  private prepared = false;
  constructor(private readonly mission: Mission) {}
  private get w() { return this.mission.world; }
  private point(at: Point, radius = .4): Point {
    const nav = this.w.infected!.nav;
    for (let d = 0; d <= 8; d += .5) for (let i = 0; i < (d ? 16 : 1); i++) {
      const p = { x: at.x + Math.cos(i * Math.PI / 8) * d, z: at.z + Math.sin(i * Math.PI / 8) * d };
      if (nav.clear(p.x, p.z, radius)) return p;
    }
    throw new Error(`No clear zoo point at ${at.x},${at.z}`);
  }
  prepare(): void {
    if (this.prepared) return;
    this.prepared = true;
    const w = this.w, s = this.state, ai = w.infected!, civilians = w.npcs!.civilians;
    w.npcs!.setAmbient(0);
    const outbreak = civilians.outbreak = new Outbreak(w, { refuges: [], tier: ai.director.tier });
    ai.configureL1v2(outbreak.humans);
    ai.director.levelCap = 200; ai.director.strict = true; ai.director.ambientTarget = 0;
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
      if (c.ally) { c.ally.post = null; c.ally.hold = false; delete c.ally.follow; }
      c.survivor = { key: c.survivor?.key ?? `zoo-carried-${i}`, slot: i, leader: 1, mode: 'follow', cover: false, waitAt: 0, foundAt: w.tick };
      s.roster.push(e.id); w.solids.admit(e, 'l8.roster.arrival');
    }
    const centres: Point[] = [{ x: -60, z: 0 }, { x: 60, z: 0 }, { x: -30, z: -64 }, { x: -45, z: 64 }, { x: 24, z: 64 }];
    for (let i = 0; i < 30; i++) {
      const at = this.point({ x: centres[i % 5].x + (Math.floor(i / 5) - 2) * 1.3, z: centres[i % 5].z });
      const target = this.point({ x: at.x + 2, z: at.z + 2 });
      const soldier = i >= 20 && i < 26, staff = i >= 26;
      const id = outbreak.spawnPedestrian(at, { ...(staff ? zooStaffLook(i - 26) : {}), role: soldier ? 'soldier' : staff ? zooStaffLook(i - 26).role : 'cashier', model: soldier ? 'npc.national-guard' : staff ? zooStaffLook(i - 26).model : undefined,
        handProp: soldier ? 'rifle' : staff ? zooStaffLook(i - 26).handProp : null, waypoints: [at, target], faces: [target, at] });
      if (soldier) w.entities.get(id)!.civilian!.ally = allyState('soldier', at);
    }
    const species: ZooSpecies[] = ['lion', 'gorilla', 'elephant', 'zebra', 'zebra', 'flamingo', 'flamingo', 'flamingo'];
    const offsets = new Map<ZooSpecies, number>();
    for (const speciesId of species) {
      const anchor = this.mission.def.anchors[`animal-${speciesId}`], offset = offsets.get(speciesId) ?? 0; offsets.set(speciesId, offset + 1);
      const radius = speciesId === 'elephant' ? 1.3 : .9;
      const at = this.point({ x: anchor.x + offset * 2, z: anchor.z }, radius), to = this.point({ x: at.x + 3, z: at.z + 2 }, radius);
      s.animals.push(civilians.spawn('cashier', at, { zooAnimal: speciesId, waypoints: [at, to] }));
    }
    const d = w.districts!.districts[0];
    s.outlets = layoutHouseDoors(d.layout, d.origin, undefined, asset => asset === 'kit.zoo-tunnel-mouth').map((door, index) => {
      const exit = doorExit(w, door, start); if (!exit) throw new Error(`Disconnected zoo outlet ${door.house}`);
      const serviceRoutes: [number, number][][] = [
        [[-96, 32], [-96, 0], [-60, 0], [-60, 32]],
        [[96, -48], [96, -64], [60, -64], [60, -32]],
        [[-30, -64], [-60, -64], [-60, -44]],
        [],
      ];
      const route = [...exit.route, ...serviceRoutes[index]];
      const last = route.at(-1);
      return { ...door, ...exit, route, ox: last?.[0] ?? exit.ox, oz: last?.[1] ?? exit.oz, next: 0, ids: [], speedMs: 3.8 };
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
  begin(): void { this.state.startedAt = this.w.tick; this.mission.checkpoint('sanctuary'); }
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
    if (ai.director.count + ai.director.pendingTurns >= ai.director.cap - conversionRoom) return;
    const id = emergeResident(w, outlet, w.tick, alpha ? { archetype: 'infected.alpha' } : { look: { role: 'cashier' } });
    if (id) { this.state.arrivals.push({ id, outlet: index, tick: w.tick, alpha }); if (alpha) this.state.alphas++; }
  }
  update(): void {
    const w = this.w, s = this.state, ai = w.infected!, t = w.tick;
    ai.director.pendingTurns = [...w.entities.iterate()].filter(e => e.infection && !e.infected).length;
    if (!s.breachedAt && t - s.startedAt >= 3600) {
      s.breachedAt = t; s.nextWave = t + 600;
      s.outlets.forEach((outlet, i) => { for (let n = 0; n < (ai.director.tier === 'low' ? 3 : 6); n++) this.release(outlet, i); });
      this.mission.setState('breached', true); this.mission.checkpoint('breach');
      w.events.emit({ type: 'story.say', tick: t, id: 1, text: 'They are coming from the tunnels! Get to the armored vehicle!', position: w.entities.get(1)!.transform });
    }
    if (!s.breachedAt) return;
    if (t >= s.nextWave) {
      s.nextWave = t + 240;
      s.outlets.forEach((outlet, i) => { this.release(outlet, i, s.alphas < 4); for (let n = 0; n < 3; n++) this.release(outlet, i); });
    }
    for (const outlet of s.outlets) walkResidents(w, outlet, t);
    const player = w.entities.get(1)!;
    Object.assign(this.mission.def.anchors.exit,this.boardingRing());
    this.mission.setState('player-boarded',w.vehicles!.active===s.carId);
    if(this.mission.state.steps.depart.status==='active')this.mission.state.marker=w.vehicles!.active===s.carId?null:'exit';
    if (!s.escapeCheckpoint && distance(player.transform, this.door()) < 12) { s.escapeCheckpoint = true; this.mission.checkpoint('escape-route'); }
    if (w.vehicles!.groupBoarded(s.carId, [...this.roster(), ...[...w.entities.iterate()].filter(e => e.companion).map(e => e.id)])) this.mission.setState('aboard', true);
  }
  /** Cheat/test path (`completeObjective` before the breach): call the tunnel breach now so the escape objective becomes active. */
  advance(): boolean {
    if (this.mission.state.states.breached) return false;
    this.state.startedAt = this.w.tick - 3600; this.update();
    return !!this.mission.state.states.breached;
  }
  /** Shared follow AI yields to the transport approach only during the escape. */
  companion(e: EntitySnapshot): boolean {
    if (!this.state.breachedAt) return false;
    const w = this.w, door = this.door();
    if (w.vehicles!.active !== this.state.carId && distance(w.entities.get(1)!.transform, door) >= 12) return false;
    if (distance(e.transform, door) < .7) w.vehicles!.boardPassenger(this.state.carId, e.id);
    else w.npcs!.move(e, door, 8, e.companion!, .2);
    return true;
  }
  /** Newly rescued zoo residents also belong to the complete living group. */
  roster(): number[] {
    const ids = [...new Set([...this.state.roster, ...[...this.w.entities.iterate()].filter(e => e.civilian?.survivor?.mode === 'follow' && !e.civilian.zooAnimal).map(e => e.id)])];
    return ids.filter(id => { const e = this.w.entities.get(id); return e && e.health.current > 0 && !e.infected && e.civilian?.state !== 'finished'; });
  }
  follower(e: EntitySnapshot): boolean {
    const w = this.w, s = this.state, c = e.civilian!, p = w.entities.get(1)!;
    if (!s.breachedAt) return s.roster.includes(e.id);
    c.state = 'calm'; c.story = null; c.survivor!.cover = false;
    const door = this.door(), boarding = w.vehicles!.active === s.carId || distance(p.transform, door) < 12;
    const slot = c.survivor!.slot, velocity = p.survivor!.velocity, speed = Math.hypot(velocity.x, velocity.z);
    const hx = speed > .8 ? velocity.x / speed : Math.cos(p.transform.yaw), hz = speed > .8 ? velocity.z / speed : -Math.sin(p.transform.yaw);
    const back = 2.3 + Math.floor(slot / 3) * 1.2, side = (slot % 3 - 1) * 1.2;
    const goal = { x: p.transform.x - hx * back - hz * side, z: p.transform.z - hz * back + hx * side };
    const target = boarding ? door : w.infected!.nav.clear(goal.x, goal.z, .35) ? goal : p.transform;
    if (boarding && distance(e.transform, door) < .7) w.vehicles!.boardPassenger(s.carId, e.id);
    else if (distance(e.transform, target) > (boarding ? .3 : 1)) w.npcs!.move(e, target, (c.l1?.walkSpeed ?? 2.2) <= 1.4 ? 1.4 : 3.8, c, boarding ? .2 : .8, 2400);
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
    this.state.startedAt += delta; if (this.state.breachedAt) this.state.breachedAt += delta; if (this.state.nextWave) this.state.nextWave += delta;
    for (const outlet of this.state.outlets) { outlet.next += delta; for (const walk of outlet.walking ?? []) walk.until += delta; }
    this.w.infected!.director.levelCap = 200; this.w.infected!.director.strict = true;
  }
}
