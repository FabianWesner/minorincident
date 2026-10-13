import { Rng } from '../../core/Rng';
import { l4, l4Anchors, l4Cars, l4CollapseGroups, l4Crowd, l4Edges, l4Emergence, l4Inside, l4Pockets, l4Posts, l4Route, l4RoutePose, l4ConvoyStations, type L4Weapon } from '../../data/l4';
import { l4AlphaEmergence } from '../../levels/L4/layout';
import { infectedDef } from '../../data/infected';
import { Outbreak } from '../outbreak/Outbreak';
import { populateGrove } from '../outbreak/Population';
import { allyState } from '../outbreak/Allies';
import { emitEngine, stopEngine } from '../vehicles/ConvoySound';
import { L4Spectacle, spawnSetPiece } from './L4Spectacle';
import { L4Collapse, freshDirector, postLine } from './L4Collapse';
import type { Mission } from './Mission';
import type { L4State } from './types';
import type { EntitySnapshot } from '../world/types';
import type { CivilianActivity, Point } from '../npc/types';
import type { CoverWall } from '../combat/HitQuery';

const ticks = (s: number) => Math.round(s * 60);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const NAV_CONVOY = 900_500, NAV_GATE = 900_520;
const WEAPONS: readonly L4Weapon[] = ['pistol', 'hunting-rifle', 'pistol', 'pipe', 'hunting-rifle', 'bat', 'pistol', 'crowbar', 'hunting-rifle', 'pipe'];
const fresh = (): L4State => ({
  phase: 'convoy', rideAt: 0, arrivedAt: 0, gunAt: 0, turnDueAt: 0, turnAt: 0, warAt: 0, lineBreakAt: 0, lineCause: '', descendAt: 0, barredAt: 0, doneAt: 0, markerAt: 0,
  convoyIds: [], convoyS: [], convoyV: 0, seated: false, evacueeIds: [], turnerIds: [], soldierIds: [], qmId: 0, hmgIds: [], residentIds: [], medkitIds: [], armed: [],
  soldiersAtTurn: 0, civiliansAtTurn: 0, infectedAtT30: -1, killsAtBreak: 0, infectedAtBreak: 0, soldiersAtBreak: 0, soldiersAtCellar: 0,
  alphaIds: [], alphaAnchors: [], wave: 0, waveAt: 0, pend: [0, 0, 0, 0, 0, 0, 0], carIds: [], emergedIds: [], collapseWaveAt: 0, collapseIds: [], collapseWaves: 0, pendingDoor: [], pockets: [],
  edgeNext: [0, 0, 0, 0, 0, 0, 0], edgeCursor: [0, 0, 0, 0, 0, 0, 0], insideAt: 0, insideCursor: 0, origin: {}, gateIds: [], barkAt: 0,
  tankId: 0, tankS: 0, tankFireAt: 0, tankShots: 0, tankPhase: 'off', heliId: 0, heliAngle: 0, heliPhase: 'off', heliAt: 0, heliBurstAt: 0, heliBurst: 0, heliShots: 0, heliTarget: null,
  hmgBursts: 0, hmgLastAt: {}, fuelId: 0, craterId: 0, burning: [], fires: 0, glass: [], scorch: 0, lastShot: {},
  kills: { player: 0, soldiers: 0, armedCivilians: 0, unarmedCivilians: 0, heli: 0, tank: 0, other: 0 }, director: freshDirector(),
});

/**
 * L4 "The Safe City Falls" controller (specs/epic-22 sections 4 and 5). Scripted up to the first turn (the convoy ride, the calm plaza,
 * the quartermaster's machine gun); from there the war is systemic with a few scripted spectacles: the street-edge waves, soldiers and armed
 * civilians fighting (allied fighters v3), the tank, the helicopter and the HMG nests, the first-of line break (75 s / half the soldiers
 * gone / 15 infected inside the line) that detonates the fuel truck, the collapse along both routes, and the cellar of Kessler's Hardware.
 * All state lives in `mission.state.l4`, so checkpoints restore it.
 */
export class LevelFourWar {
  private readonly route = l4Route();
  private readonly stations = l4ConvoyStations(this.route.length);
  private readonly spectacle: L4Spectacle;
  private readonly director: L4Collapse;
  constructor(private readonly mission: Mission) {
    this.spectacle = new L4Spectacle(mission.world, () => this.s, () => this.allyEntities());
    this.director = new L4Collapse({ mission, s: () => this.s, low: () => this.low, outbreak: () => this.outbreak(), snap: (p, r) => this.snap(p, r), emerge: (p, push) => this.emerge(p, push), human: e => this.human(e), insideRing: p => this.insideRing(p), doors: () => this.doors(), fallBack: () => this.lineBreak('beats'), room: () => this.spawnRoom() });
  }
  private get s(): L4State { return this.mission.state.l4!; }
  private get world() { return this.mission.world; }
  private anchor(name: string) { return this.mission.def.anchors[name]; }
  private outbreak(): Outbreak { return this.world.npcs!.civilians.outbreak!; }
  private get low(): boolean { return this.world.infected!.director.tier === 'low'; }
  private snap(p: Point, r = .4): Point {
    const nav = this.world.infected!.nav;
    for (let d = 0; d <= 6; d += .5) for (let k = 0; k < (d ? 16 : 1); k++) {
      const x = p.x + Math.cos(k * Math.PI / 8) * d, z = p.z + Math.sin(k * Math.PI / 8) * d;
      if (nav.clear(x, z, Math.max(r, .36))) return { x, z };
    }
    return { x: p.x, z: p.z };
  }
  private doors(): { name: string; x: number; z: number }[] {
    return Object.keys(this.mission.def.anchors).filter(n => n.startsWith('refuge-door-')).map(name => ({ name, ...this.anchor(name) }));
  }
  private human(e: EntitySnapshot | undefined): boolean { return !!e && e.health.current > 0 && !!e.civilian && !e.infection && e.civilian.state !== 'finished' && !e.hidden; }
  private liveSoldiers(): EntitySnapshot[] { return this.s.soldierIds.map(id => this.world.entities.get(id)).filter((e): e is EntitySnapshot => this.human(e)); }
  private allyEntities(): EntitySnapshot[] {
    const out = this.liveSoldiers();
    for (const a of this.s.armed) { const e = this.world.entities.get(a.id); if (this.human(e) && e!.civilian!.ally) out.push(e!); }
    return out;
  }

  // ---------------------------------------------------------------------------------------------------------- setup
  prepare(): void {
    const { world, state } = this.mission;
    state.l4 = fresh();
    if (!world.infected || !world.npcs) return;
    const tier = world.infected.director.tier;
    const edges = Object.keys(this.mission.def.anchors).filter(n => n.startsWith('edge-in-')).map(id => ({ id, ...this.anchor(id) }));
    // PO 10-13: at the alarm the people "panik and try to hide": the shop and house doors are refuges as well as the street edges.
    const refuges = [...edges, ...this.doors().map(d => ({ id: d.name, x: d.x, z: d.z }))];
    const outbreak = world.npcs.civilians.outbreak ?? new Outbreak(world, { refuges, tier });
    world.npcs.civilians.outbreak = outbreak;
    world.infected.director.levelCap = l4.war.caps.infected.high; world.infected.director.strict = true; world.infected.director.reserved = l4.alphas.count[this.low ? 'low' : 'high'];
    world.npcs.setAmbient(0);
    // L4-default progression (bat, axe, handgun) unless a campaign load already applied its racks.
    if (!world.progression || !world.entities.get(1)!.weapons) world.combat?.setLoadout(['weapon.fire-axe', 'weapon.bat'], ['weapon.handgun', 'weapon.kick']);
    world.combat?.withholdPickups(l4.machineGun.id);
    this.spawnConvoy();
    this.spawnPeople();
    this.spawnSoldiers();
    this.spawnCars();
    this.spawnMedkits();
    this.spectacle.spawnFuelTruck();
    this.mission.radio('L4.briefing');
    // Gunfire is a loud event (E22 section 5): the player's machine gun 30 m, HMG 40 m, every other shot 20 m.
    world.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === l4.machineGun.id) this.gunshot(1, e.position, 30); });
    world.events.on('ally.attack', e => {
      if (e.type !== 'ally.attack' || !e.from || e.role === 'heli') return;
      this.gunshot(e.sourceId, e.from, e.weapon === 'hmg' || e.role === 'tank' ? 40 : 20);
      if (e.weapon === 'hmg') this.hmgShot(e.sourceId);
    });
    // Every knockdown or kill counts as a "kill" for the war balance (the infected recover: PO rule), credited to who dealt it.
    world.events.on('combat.kill', e => { if (e.type === 'combat.kill') this.killed(e.sourceId, e.targetId); });
    this.director.listen();
  }
  private spawnConvoy(): void {
    const { world } = this.mission, s = this.s;
    for (const [i, v] of l4.convoy.vehicles.entries()) {
      const p = l4RoutePose(this.route, this.stations.start[i]);
      s.convoyIds.push(spawnSetPiece(world, v.asset, { x: p.x, z: p.z, yaw: p.yaw }).id); s.convoyS.push(this.stations.start[i]);
    }
    this.board();
    this.spawnEvacuees();
  }
  private playerBus(): number { return l4.convoy.vehicles.findIndex(v => v.player); }
  /** The courier rides as a passenger (hidden, no input) in the last bus, so she passes the army gate first and sees the whole convoy ahead. */
  private board(): void {
    const { world } = this.mission, player = world.entities.get(1)!, s = this.s;
    s.seated = true; player.hidden = true; world.physics.playerCollider!.setEnabled(false); world.player!.locomotion.reset();
    world.storyLock = { scripted: null, skip: false };
    world.events.emit({ type: 'vehicle.entered', tick: world.tick, sourceId: s.convoyIds[this.playerBus()], targetId: 1, role: 'passenger' });
    const t = world.entities.get(s.convoyIds[this.playerBus()])!.transform;
    this.carry(t.x, t.z);
    s.rideAt = world.tick; world.events.emit({ type: 'l4.convoyStarted', tick: world.tick });
  }
  private spawnEvacuees(): void {
    const o = this.outbreak(), s = this.s, n = this.low ? l4.calm.evacuees.low : l4.calm.evacuees.high;
    const slots = [...l4Crowd.queue.line1, ...l4Crowd.queue.line2, ...l4.calm.waiting];
    const rng = new Rng(this.world.seed, 'l4-evacuees'), turners = new Set<number>();
    while (turners.size < Math.min(this.turners(), n)) turners.add(Math.floor(rng.next() * n));
    for (let i = 0; i < n; i++) {
      const at = this.snap({ x: -26, z: -8 }, .35);
      const id = o.spawnPedestrian(at, { tier: 'average', schedule: this.queueSchedule(slots[i % slots.length]) });
      const e = this.world.entities.get(id)!;
      // Inside the buses until they stop (hidden, parked at the bus, no routine).
      e.hidden = true; e.civilian!.pauseUntil = Number.MAX_SAFE_INTEGER; this.world.spatial.delete(id);
      e.appearance!.origin = 'L3-bus';
      s.evacueeIds.push(id); if (turners.has(i)) s.turnerIds.push(id);
    }
  }
  private turners(): number { return this.low ? l4.calm.turners.low : l4.calm.turners.high; }
  private queueSchedule(slot: readonly number[]): CivilianActivity[] {
    const p = this.snap({ x: slot[0], z: slot[1] }, .35), table = { x: l4Crowd.queue.table[0], z: l4Crowd.queue.table[1] };
    return [{ activity: 'walk', anchor: 'l4/queue', target: p, ticks: 1 }, { activity: 'look', anchor: 'l4/queue', target: p, facing: table, ticks: 60 * 60 * 6 }];
  }
  private spawnPeople(): void {
    const o = this.outbreak(), s = this.s, residents = this.low ? l4.calm.residents.low : l4.calm.residents.high;
    // Strollers, sitters and doorstep groups on every pavement (the Population layer), then the plaza's own chatting pairs.
    const pairs = this.low ? 3 : 6;
    s.residentIds.push(...populateGrove(o, Math.max(0, residents - pairs * 2)));
    for (let i = 0; i < pairs; i++) {
      const c = { x: l4Crowd.chats[i][0], z: l4Crowd.chats[i][1] };
      for (let k = 0; k < 2; k++) {
        const at = this.snap({ x: c.x + (k ? .55 : -.55), z: c.z }, .35), facing = { x: c.x + (k ? -3 : 3), z: c.z };
        s.residentIds.push(o.spawnPedestrian(at, { yaw: k ? Math.PI : 0, schedule: [{ activity: 'chat', anchor: 'l4/chat', target: at, facing, ticks: 60 * 60 * 6 }] }));
      }
    }
    // Armed from the start (weapons stowed until the turn): 40 % of the people, pistols, hunting rifles and improvised melee in turn.
    const ids = [...s.residentIds, ...s.evacueeIds], armedN = Math.ceil(ids.length * l4.civilians.armedShare);
    const rng = new Rng(this.world.seed, 'l4-armed'), order = ids.map((id, i) => ({ id, k: rng.next() + i * 0 })).sort((a, b) => a.k - b.k).slice(0, armedN);
    for (const [i, { id }] of order.entries()) s.armed.push({ id, weapon: WEAPONS[i % WEAPONS.length], armedAt: 0 });
  }
  private spawnSoldiers(): void {
    const o = this.outbreak(), s = this.s, limit = this.low ? l4.calm.soldiers.low : l4.calm.soldiers.high;
    let posts = l4Posts.slice();
    const names = new Map<string, number>();
    if (this.low) posts = posts.filter((p, i) => p.role === 'qm' || p.role === 'hmg' || i % 2 === 0);
    for (const post of posts.slice(0, limit)) {
      const p = this.snap({ x: post.at[0], z: post.at[1] }, .35), face = { x: post.face[0], z: post.face[1] };
      const id = o.spawnPedestrian(p, { role: 'soldier', model: 'npc.national-guard', tint: '#4b5a3a', tier: 'average', yaw: -Math.atan2(face.z - p.z, face.x - p.x), schedule: [{ activity: 'look', anchor: 'l4/post', target: p, facing: face, ticks: 60 * 60 * 6 }] });
      const e = this.world.entities.get(id)!, hmg = post.role === 'hmg';
      e.civilian!.ally = { ...allyState('soldier', p, true), gun: { ...(hmg ? l4.soldiers.hmg : l4.soldiers.rifle) }, weapon: hmg ? 'hmg' : 'rifle', range: hmg ? l4.soldiers.hmgRangeM : l4.soldiers.postRangeM, runSpeed: l4.soldiers.moveMs };
      e.health = { current: l4.soldiers.hp, max: l4.soldiers.hp }; e.appearance!.handProp = 'rifle'; e.transform.yaw = -Math.atan2(face.z - p.z, face.x - p.x);
      s.soldierIds.push(id); if (post.role === 'qm') s.qmId = id; if (hmg) s.hmgIds.push(id);
      const line = postLine(post.role); if (line >= 0) s.director.lines[line].soldierIds.push(id);
      names.set(post.name, id);
    }
    this.offDuty(names);
  }
  /**
   * PO 10-13: "before the alarm let solidiers be relaxed": until the turn the soldiers are off duty (no held post, so their routine runs):
   * chatting pairs, coffee, short patrols; everybody else (quartermaster, HMG crews, gate guards) stands at the post. Rifles are lowered
   * while not engaged (CivilianCrowd). At the turn `toPosts` sends everyone to the post.
   */
  private offDuty(names: Map<string, number>): void {
    const { world } = this, o = l4.calm.offDuty, look = 60 * 60 * 6;
    const soldier = (name: string) => { const id = names.get(name); return id === undefined ? undefined : world.entities.get(id); };
    const relax = (e: EntitySnapshot, schedule: CivilianActivity[]) => { const c = e.civilian!; c.ally!.hold = false; c.schedule = schedule; c.scheduleStep = 0; c.activityUntil = 0; };
    for (const [a, b, at] of o.chat) {
      const ea = soldier(a), eb = soldier(b); if (!ea || !eb) continue;
      for (const [k, e] of [ea, eb].entries()) {
        const p = this.snap({ x: at[0] + (k ? .6 : -.6), z: at[1] }, .35), facing = { x: at[0] + (k ? -3 : 3), z: at[1] };
        relax(e, [{ activity: 'chat', anchor: 'l4/off-duty', target: p, facing, ticks: look }]);
      }
    }
    for (const [name, at, face] of o.coffee) {
      const e = soldier(name); if (!e) continue;
      relax(e, [{ activity: 'look', anchor: 'l4/off-duty', target: this.snap({ x: at[0], z: at[1] }, .35), facing: { x: face[0], z: face[1] }, prop: 'coffee', ticks: look }]);
    }
    for (const [name, a, b] of o.patrol) {
      const e = soldier(name); if (!e) continue;
      const pa = this.snap({ x: a[0], z: a[1] }, .35), pb = this.snap({ x: b[0], z: b[1] }, .35), out = (p: Point) => ({ x: p.x + (p.x - l4.map.centre.x) * .5, z: p.z + (p.z - l4.map.centre.z) * .5 });
      relax(e, [{ activity: 'walk', anchor: 'l4/patrol', target: pa, ticks: 1 }, { activity: 'look', anchor: 'l4/patrol', target: pa, facing: out(pa), ticks: ticks(o.patrolLookS) },
        { activity: 'walk', anchor: 'l4/patrol', target: pb, ticks: 1 }, { activity: 'look', anchor: 'l4/patrol', target: pb, facing: out(pb), ticks: ticks(o.patrolLookS) }]);
    }
  }
  /**
   * The alarm (the turn): every soldier runs to the post (at the soldiers' run speed) and takes the war footing; a soldier with a coffee
   * drops the cup. Holding the post again, so the routine no longer runs.
   */
  private toPosts(): void {
    const { world } = this;
    for (const id of this.s.soldierIds) {
      const e = world.entities.get(id), c = e?.civilian, a = c?.ally; if (!e || !this.human(e) || !a || !a.post) continue;
      if (c!.schedule?.[c!.scheduleStep ?? 0]?.prop === 'coffee') world.entities.create({ kind: 'dropped-prop', archetype: 'prop.coffee', faction: 'environment', health: { current: 1, max: 1 }, transform: { ...e.transform, y: e.transform.y - .7 }, droppedProp: 'coffee' });
      const post = l4Posts.find(p => Math.hypot(p.at[0] - a.post!.x, p.at[1] - a.post!.z) < 1.5), face = post ? { x: post.face[0], z: post.face[1] } : l4.map.centre;
      c!.schedule = [{ activity: 'look', anchor: 'l4/post', target: { ...a.post }, facing: face, ticks: 60 * 60 * 6 }]; c!.scheduleStep = 0; c!.activityUntil = 0;
      a.hold = true; if (Math.hypot(a.post.x - e.transform.x, a.post.z - e.transform.z) > .4) { a.run = { ...a.post }; a.runSpeed = l4.soldiers.moveMs; }
    }
  }
  private spawnCars(): void {
    const v = this.world.vehicles; if (!v) return;
    for (const c of l4Cars) {
      const id = v.spawn(c.def, { x: c.at[0], z: c.at[1] }, c.yaw); this.s.carIds.push(id);
      v.cars.get(id)!.noEnterUntil = Number.MAX_SAFE_INTEGER;
    }
  }
  private spawnMedkits(): void {
    for (const [x, z] of l4.medkits.positions) {
      const snapped = this.snap({ x, z }, .3), p = this.world.trapRescue?.nearestReachable(snapped) ?? snapped, id = this.world.pickups!.spawn('medkit', p);
      const e = this.world.entities.get(id)!; if (e.pickup && 'kind' in e.pickup) e.pickup.amount = l4.medkits.heal;
      this.s.medkitIds.push(id);
    }
  }

  // ---------------------------------------------------------------------------------------------------------- the ride
  /** Seated courier and corgi ride with the bus (hidden, no input). */
  private carry(x: number, z: number): void {
    const { world } = this.mission, player = world.entities.get(1)!;
    if (this.s.seated) {
      player.transform.x = x; player.transform.z = z; world.physics.playerBody!.setTranslation(player.transform, true); world.physics.playerBody!.setNextKinematicTranslation(player.transform);
      Object.assign(world.previousPlayer!, player.transform); world.spatial.set(1, x, z);
    }
    for (const e of world.entities.iterate()) if (e.companion) { e.hidden = true; e.transform.x = x; e.transform.z = z; world.spatial.delete(e.id); }
    for (const id of this.s.evacueeIds) { const e = world.entities.get(id); if (e?.hidden) { e.transform.x = x; e.transform.z = z; } }
  }
  private ride(): void {
    const { world } = this.mission, s = this.s, c = l4.convoy, travel = this.stations.travel, done = s.convoyS[0] - this.stations.start[0];
    const remaining = travel - done;
    let target: number = c.speedMs;
    // Stop with margin (80 % of the braking limit): the speed follows the curve down to a crawl, never into a dead stop at the end of the route.
    target = Math.min(target, Math.sqrt(2 * c.brakeMs2 * .8 * Math.max(0, remaining)));
    // Slow for the corner any vehicle is on or about to enter (all five share one speed, so the column keeps its shape).
    for (const at of s.convoyS) for (let d = 0; d <= 14; d += 1) {
      const limit = l4RoutePose(this.route, at + d).limit;
      if (limit < Infinity && s.convoyV * s.convoyV - limit * limit <= 2 * c.brakeMs2 * Math.max(0, d - 1)) continue;
      target = Math.min(target, limit);
    }
    if (remaining > .02) target = Math.max(target, .12);
    s.convoyV += Math.max(-c.brakeMs2 / 60, Math.min(c.accelMs2 / 60, target - s.convoyV));
    const step = Math.min(remaining, s.convoyV / 60);
    for (let i = 0; i < s.convoyS.length; i++) {
      s.convoyS[i] += step;
      const p = l4RoutePose(this.route, s.convoyS[i]), e = world.entities.get(s.convoyIds[i]);
      // The heading eases onto the route tangent (about 5 ticks) so a corner starts as a steering ramp, not a snap of the yaw rate.
      if (e) { const d = Math.atan2(Math.sin(p.yaw - e.transform.yaw), Math.cos(p.yaw - e.transform.yaw)); Object.assign(e.transform, { x: p.x, z: p.z, yaw: e.transform.yaw + d * .2 }); }
    }
    this.clearLane();
    const bus = world.entities.get(s.convoyIds[this.playerBus()])!;
    this.carry(bus.transform.x, bus.transform.z);
    if (remaining - step < .02 && s.convoyV < .15) this.arrive();
  }
  /**
   * PO 2026-10-12 ("move this soldier away, all busses drive through him"): no actor stays inside a convoy hull. A resident, evacuee or soldier
   * in a vehicle's path (hull plus 0.6 m at the sides and 1.5 m ahead) steps out sideways to the nearer edge.
   */
  private clearLane(): void {
    const { world } = this.mission, s = this.s;
    // Every actor, not only the authored crowd: pets, the corgi, dog walkers, strays (PO 10-13 "Bus is going over a dog").
    const ids: number[] = [];
    for (const e of world.entities.iterate()) if (e.id !== 1 && !e.hidden && e.health.current > 0 && !e.corpse && (e.civilian || e.companion || e.infected) && !String(e.archetype).startsWith('veh.')) ids.push(e.id);
    for (const [i, vid] of s.convoyIds.entries()) {
      const v = world.entities.get(vid), spec = l4.convoy.vehicles[i]; if (!v) continue;
      const c = Math.cos(v.transform.yaw), si = Math.sin(v.transform.yaw);
      for (const id of ids) {
        const e = world.entities.get(id); if (!e || e.hidden || e.health.current <= 0) continue;
        const dx = e.transform.x - v.transform.x, dz = e.transform.z - v.transform.z, along = dx * c + dz * si, side = -dx * si + dz * c;
        if (along < -spec.len / 2 - .6 || along > spec.len / 2 + 1.5 || Math.abs(side) > spec.wid / 2 + .6) continue;
        const out = (spec.wid / 2 + .9) * (side >= 0 ? 1 : -1);
        e.transform.x += -si * (out - side); e.transform.z += c * (out - side); world.spatial.set(id, e.transform.x, e.transform.z);
      }
    }
  }
  /** Engines of the convoy: all five drive, the courier's bus is muffled; they idle for a few seconds after the stop, then are switched off. */
  private convoySound(tick: number): void {
    const { world } = this.mission, s = this.s, idleTicks = ticks(6);
    if (tick % 6 !== 0 || !s.convoyIds.length) return;
    if (s.phase === 'convoy') for (const [i, id] of s.convoyIds.entries()) emitEngine(world, id, s.convoyV, i === this.playerBus());
    else if (s.phase === 'plaza' && tick < s.arrivedAt + idleTicks) for (const id of s.convoyIds) emitEngine(world, id, 0);
    else if (s.arrivedAt && tick >= s.arrivedAt + idleTicks && tick < s.arrivedAt + idleTicks + 6) for (const id of s.convoyIds) stopEngine(world, id);
  }
  private parkNav(blocked: boolean): void {
    const { world } = this.mission, s = this.s;
    for (const [i, v] of l4.convoy.vehicles.entries()) {
      const e = world.entities.get(s.convoyIds[i]); if (!e) continue;
      const c = Math.abs(Math.cos(e.transform.yaw)), n = Math.abs(Math.sin(e.transform.yaw));
      const wall: CoverWall = { x: e.transform.x, y: .9, z: e.transform.z, halfX: (c * v.len + n * v.wid) / 2, halfY: .9, halfZ: (n * v.len + c * v.wid) / 2 };
      world.events.emit({ type: 'world.blocker.changed', tick: world.tick, id: NAV_CONVOY + i, blocked, wall });
    }
  }
  /** The bus stops: everybody out (the courier at the plaza end at once, evacuees at the doors), the loudspeaker welcome follows. */
  private arrive(): void {
    const { world } = this.mission, tick = world.tick, s = this.s;
    if (s.phase !== 'convoy') return;
    s.phase = 'plaza'; s.arrivedAt = tick; s.convoyV = 0; s.turnDueAt = tick + ticks(l4.turn.latestAfterArrivalS);
    this.parkNav(true);
    // PO 10-13 ("Let the user exit the 1st bus which is ON the military area"): she steps off the side of the bus that faces the plaza.
    const bus = world.entities.get(s.convoyIds[this.playerBus()])!, player = world.entities.get(1)!, side = this.plazaSide(bus.transform);
    // At its rear corner: the follow camera looks from the south-east, so beside the middle of the bus she would stand behind it, unseen.
    const spec = l4.convoy.vehicles[this.playerBus()], off = spec.wid / 2 + .9, back = spec.len / 2 - .2, f = { x: Math.cos(bus.transform.yaw), z: -Math.sin(bus.transform.yaw) };
    const out = this.snap({ x: bus.transform.x + side.x * off - f.x * back, z: bus.transform.z + side.z * off - f.z * back }, .45);
    Object.assign(player.transform, { x: out.x, z: out.z }); player.hidden = false; s.seated = false;
    world.physics.playerBody!.setTranslation(player.transform, true); world.physics.playerBody!.setNextKinematicTranslation(player.transform); world.physics.playerCollider!.setEnabled(true);
    world.player!.locomotion.reset(); Object.assign(world.previousPlayer!, player.transform); world.spatial.set(1, out.x, out.z); world.player!.setCheckpoint(player.transform);
    world.storyLock = null; world.clearInput();
    world.events.emit({ type: 'vehicle.exited', tick, sourceId: s.convoyIds[this.playerBus()], targetId: 1, role: 'passenger' });
    // The corgi beside her, toward the camera (not behind her in the follow view).
    for (const e of world.entities.iterate()) if (e.companion) { e.hidden = false; const p = this.snap({ x: out.x + side.x * .9 - f.x * 1.2, z: out.z + side.z * .9 - f.z * 1.2 }, .4); Object.assign(e.transform, p); world.spatial.set(e.id, p.x, p.z); }
    // Evacuees step off both buses (on the plaza side, along the doors) and walk to the registration queue.
    const buses = l4.convoy.vehicles.map((v, i) => ({ v, i })).filter(b => b.v.asset === 'veh.evac-bus').map(b => world.entities.get(s.convoyIds[b.i])!.transform);
    for (const [k, id] of s.evacueeIds.entries()) {
      const e = world.entities.get(id); if (!e) continue;
      const b = buses[k % buses.length], n = this.plazaSide(b), f = { x: Math.cos(b.yaw), z: -Math.sin(b.yaw) }, along = (k % 5 - 2) * 1.4, w = 2.6 + (k % 2) * .6;
      const p = this.snap({ x: b.x + n.x * w + f.x * along, z: b.z + n.z * w + f.z * along }, .4);
      e.hidden = false; Object.assign(e.transform, p); world.spatial.set(id, p.x, p.z); e.civilian!.pauseUntil = 0;
    }
    if (!this.mission.state.states.arrived) this.mission.setState('arrived', true);
    this.closeGate();
    world.events.emit({ type: 'l4.convoyArrived', tick });
  }
  /** Unit normal of a parked vehicle toward the plaza centre (the side the courier and the evacuees step off). */
  private plazaSide(t: { x: number; z: number; yaw: number }): Point {
    const n = { x: Math.sin(t.yaw), z: Math.cos(t.yaw) }, c = l4.map.centre, sign = (c.x - t.x) * n.x + (c.z - t.z) * n.z >= 0 ? 1 : -1;
    return { x: n.x * sign, z: n.z * sign };
  }

  // ---------------------------------------------------------------------------------------------------------- the perimeter (PO 10-13)
  private fence: number[] = [];
  /** Courier-only walls around the camp (physics colliders, no navigation blocker: soldiers, people and infected cross freely). */
  private perimeter(on: boolean): void {
    const physics = this.world.physics;
    if (!on) { for (const h of this.fence) physics.removeBlocker(h); this.fence = []; return; }
    if (this.fence.length || !physics.playerBody) return;
    const p = l4.perimeter, cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2, hx = (p.x1 - p.x0) / 2 + .2, hz = (p.z1 - p.z0) / 2 + .2;
    for (const w of [{ x: cx, z: p.z0, halfX: hx, halfZ: .2 }, { x: cx, z: p.z1, halfX: hx, halfZ: .2 }, { x: p.x0, z: cz, halfX: .2, halfZ: hz }, { x: p.x1, z: cz, halfX: .2, halfZ: hz }])
      this.fence.push(physics.addBlocker({ ...w, y: 1, halfY: 1.2 }));
  }
  private gateWalls(): CoverWall[] {
    return this.s.gateIds.map(id => this.world.entities.get(id)).filter((e): e is EntitySnapshot => !!e).map(e => ({ x: e.transform.x, y: .5, z: e.transform.z, halfX: .4, halfY: .5, halfZ: 1.5 }));
  }
  /**
   * "The gate closes behind the convoy": jersey barriers close the gap the column turned in through, from the last bus inside to the south
   * (a navigation blocker for everyone, removed at the line break so the escape street opens), and the courier's perimeter goes up.
   */
  private closeGate(): void {
    const { world } = this, s = this.s, p = l4.perimeter;
    if (!s.gateIds.length) for (const z of [5.65, 8.7, 11.75]) s.gateIds.push(spawnSetPiece(world, p.barrier, { x: p.x1, z, yaw: Math.PI / 2 }).id);
    this.gateNav(true); this.perimeter(true);
  }
  private gateNav(blocked: boolean): void {
    for (const [k, wall] of this.gateWalls().entries()) this.world.events.emit({ type: 'world.blocker.changed', tick: this.world.tick, id: NAV_GATE + k, blocked, wall });
  }
  /** "Fall back!": the soldiers open the gate (the barriers go) and the courier may leave. */
  private openGate(): void {
    this.gateNav(false);
    for (const id of this.s.gateIds) { const e = this.world.entities.get(id); if (e) e.hidden = true; }
    this.perimeter(false);
  }
  /** A soldier calls her back when she leans on the perimeter (at most every `barkEveryS`). */
  private perimeterBark(): void {
    const s = this.s, tick = this.world.tick, p = l4.perimeter, t = this.world.entities.get(1)!.transform;
    if (!this.fence.length || tick < s.barkAt || t.x < p.x0 - 1 || t.x > p.x1 + 1 || t.z < p.z0 - 1 || t.z > p.z1 + 1) return;
    if (Math.min(t.x - p.x0, p.x1 - t.x, t.z - p.z0, p.z1 - t.z) > p.barkM) return;
    s.barkAt = tick + ticks(p.barkEveryS); this.mission.radio('L4.perimeter');
  }

  // ---------------------------------------------------------------------------------------------------------- beats
  completed(id: string): void {
    if (!this.mission.state.l4) return;
    if (id === 'ride' && this.s.phase === 'convoy') this.finishRide();
    if (id === 'quartermaster') this.issueGun();
    if (id === 'hold' && this.s.phase === 'war') this.lineBreak('forced');
    if (id === 'hide') this.descend();
    if (id === 'bar') this.bar();
  }
  /** Cheat/test completion of the ride: park the column at once. */
  private finishRide(): void {
    const { world } = this.mission, s = this.s;
    for (let i = 0; i < s.convoyS.length; i++) { s.convoyS[i] = this.stations.end[i]; const p = l4RoutePose(this.route, s.convoyS[i]), e = world.entities.get(s.convoyIds[i]); if (e) Object.assign(e.transform, { x: p.x, z: p.z, yaw: p.yaw }); }
    s.convoyV = 0; this.arrive();
  }
  /** The machine gun joins the carried weapons (RIGHT rack, selected): no magazine, no reload, no overheat. */
  private issueGun(): void {
    const combat = this.world.combat, s = this.s; if (!combat || s.gunAt) return;
    s.gunAt = Math.max(1, this.world.tick);
    const left = combat.runner.loadout.state.LEFT.rack.map(r => r.id), right = combat.runner.loadout.state.RIGHT.rack.map(r => r.id).filter(id => id !== l4.machineGun.id);
    combat.setLoadout(left, [l4.machineGun.id, ...right].slice(0, Math.max(2, combat.rackCapacity)));
    combat.runner.loadout.state.selectedSide = 'RIGHT';
    this.world.events.emit({ type: 'pickup.collected', tick: this.world.tick, sourceId: 1, pickupId: 0, side: 'RIGHT', actionId: l4.machineGun.id, replaced: null });
    this.world.events.emit({ type: 'l4.gun', tick: this.world.tick });
    this.mission.radio('L4.gun');
    this.armCivilians();
    // The first turn fires 40-50 s after the issue (seeded), at the latest 100 s after the arrival.
    const [a, b] = l4.turn.afterGunS, rng = new Rng(this.world.seed, 'l4-turn');
    s.turnDueAt = Math.min(s.turnDueAt || Infinity, s.gunAt + ticks(a + rng.next() * (b - a)));
  }
  /**
   * PO 2026-10-12 ("the army arms the peds"): when the quartermaster issues the courier's gun, the civilians at the table are armed in view:
   * the four nearest get a handgun if they carry nothing, and every civilian holding a firearm shows it in hand (before, all weapons stayed stowed until the turn).
   */
  private armCivilians(): void {
    const { world } = this.mission, s = this.s, qm = { x: l4Anchors['l4-quartermaster'][0], z: l4Anchors['l4-quartermaster'][1] };
    const near = [...s.residentIds, ...s.evacueeIds].map(id => world.entities.get(id)).filter(e => this.human(e) && !e!.civilian!.ally)
      .sort((a, b) => dist(a!.transform, qm) - dist(b!.transform, qm)).slice(0, 4);
    for (const e of near) {
      const entry = s.armed.find(a => a.id === e!.id);
      if (!entry) s.armed.push({ id: e!.id, weapon: 'pistol', armedAt: 0 }); else if (entry.weapon !== 'pistol' && entry.weapon !== 'hunting-rifle') entry.weapon = 'pistol';
    }
    for (const entry of s.armed) {
      const e = world.entities.get(entry.id);
      if (this.human(e) && !e!.civilian!.ally && (entry.weapon === 'pistol' || entry.weapon === 'hunting-rifle')) e!.appearance!.handProp = entry.weapon;
    }
  }
  private turn(): void {
    const { world } = this.mission, s = this.s, tick = world.tick, o = this.outbreak();
    // The evacuees from the L3 buses collapse in the queue and turn (the visible 3 s transformation, same entity, same look).
    // Collapse design: the evacuees who turn stand inside the perimeter (a seeded one may still be walking in from the bus), topped up from the queue.
    const ring = l4.map.ring, inside = (id: number) => { const t = world.entities.get(id)!.transform; return t.x > ring.x0 && t.x < ring.x1 && t.z > ring.z0 && t.z < ring.z1; };
    const want = this.turners(), centre = { x: -25, z: -9 };
    let ids = s.turnerIds.filter(id => this.human(world.entities.get(id)) && inside(id));
    if (ids.length < want) {
      const rest = s.evacueeIds.filter(id => !ids.includes(id) && this.human(world.entities.get(id)) && inside(id));
      ids = [...ids, ...rest.sort((a, b) => dist(world.entities.get(a)!.transform, centre) - dist(world.entities.get(b)!.transform, centre))].slice(0, want);
    }
    if (!ids.length) {
      const queue = [...s.evacueeIds, ...s.residentIds].filter(id => this.human(world.entities.get(id)));
      ids = queue.sort((a, b) => dist(world.entities.get(a)!.transform, centre) - dist(world.entities.get(b)!.transform, centre)).slice(0, want);
    }
    const first = world.entities.get(ids[0])?.transform ?? { x: -25, z: -9 };
    const near = [...world.entities.iterate()].filter(e => this.human(e) && dist(e.transform, first) <= 10).length;
    for (const id of ids) o.infect(world.entities.get(id)!, 0);
    s.turnAt = s.warAt = tick; s.phase = 'war'; s.waveAt = tick + ticks(l4.war.fromS);
    s.soldiersAtTurn = this.liveSoldiers().length; s.civiliansAtTurn = [...world.entities.iterate()].filter(e => this.human(e)).length;
    world.events.emit({ type: 'l4.firstTurn', tick, ids: [...ids], humansNear: near });
    this.mission.radio('L4.turn');
    if (!this.mission.state.states.turned) this.mission.setState('turned', true);
    this.engageAll();
    this.toPosts();
    this.panic(first);
    this.director.start();
    this.mission.requestCheckpoint('turn');
  }
  /** Soldiers take their posts' war footing; armed civilians draw their weapons and fight where they stand. */
  private engageAll(): void {
    const { world } = this.mission, tick = world.tick;
    for (const id of this.s.soldierIds) { const a = world.entities.get(id)?.civilian?.ally; if (a) a.engaged = true; }
    const c = l4.civilians;
    for (const entry of this.s.armed) {
      const e = world.entities.get(entry.id); if (!this.human(e) || e!.civilian!.ally) continue;
      const gun = entry.weapon === 'pistol' ? c.pistol : entry.weapon === 'hunting-rifle' ? c.rifle : null, p = { x: e!.transform.x, z: e!.transform.z };
      e!.civilian!.ally = { ...allyState('civilian', gun ? p : null, !!gun), engaged: true, runSpeed: 3.4, ...(gun ? { gun: { ...gun }, weapon: entry.weapon as 'pistol' | 'hunting-rifle', range: gun.rangeM } : { melee: { ...c.melee }, range: 8 }) };
      e!.health = { current: Math.max(e!.health.current, c.hp), max: c.hp }; e!.appearance!.handProp = entry.weapon; entry.armedAt = tick;
    }
  }
  /**
   * PO 10-13: "when the alarm is on, they panik and try to hide": every unarmed person who is not a soldier flees at the alarm, to the
   * nearest refuge away from the turn (a shop or house door, or out of the city along a street edge).
   */
  private panic(at: Point): void {
    const { world } = this, o = this.outbreak(), soldiers = new Set(this.s.soldierIds), turners = new Set(this.s.turnerIds);
    for (const e of world.entities.iterate()) {
      const c = e.civilian;
      if (!this.human(e) || !c || c.ally || c.pet || soldiers.has(e.id) || turners.has(e.id) || c.state !== 'calm') continue;
      o.panic(e, { x: at.x, z: at.z });
    }
  }
  private spawnRoom(): boolean {
    const cap = l4.war.caps.characters[this.low ? 'low' : 'high'];
    return [...this.world.entities.iterate()].filter(e => !e.hidden && e.health.current > 0 && (e.infected || e.civilian)).length < cap;
  }
  /** One infected out of view at `at`; `push` (the collapse director's pressure) may use the whole cap, waves only the stage's share. */
  private emerge(at: Point, push = false): number {
    const { world } = this.mission, ai = world.infected!, o = this.outbreak();
    const limit = Math.floor(ai.director.cap * (push ? 1 : this.director.aliveShare())) - ai.director.reserved - l4.war.headroom;
    if (ai.director.count >= limit) this.settleDowned(1);
    if (!this.spawnRoom() || ai.director.count >= limit || !ai.pool.length || this.inGap(at)) return 0;
    const out = this.snap(at, .45), id = o.spawnPedestrian(out), e = world.entities.get(id)!;
    o.turnNow(e);
    if (!e.infected) return 0;
    if (e.combat) e.combat.staggerUntil = world.tick + 30;
    return id;
  }
  /**
   * The Alphas, staggered from their street mouths and doors (`l4AlphaEmergence`, the low tier skips the `high` ones), out of view;
   * cap space stays reserved for the ones still to come. Each takes `allyResist` damage from the army (the courier's is unchanged).
   */
  private alphas(): void {
    const { world } = this.mission, s = this.s, ai = world.infected!, count = l4.alphas.count[this.low ? 'low' : 'high'];
    for (const entry of l4AlphaEmergence) {
      if (s.alphaAnchors.includes(entry.anchor) || (entry.high && this.low)) continue;
      if (s.alphaIds.length >= count) return;
      if (world.tick < s.turnAt + ticks(entry.afterTurnS) || ai.director.count >= ai.director.cap || !ai.pool.length || !this.spawnRoom()) return;
      const anchor = this.anchor(entry.anchor), radius = infectedDef('infected.alpha').radius;
      if (!ai.director.offscreen(anchor)) continue;
      const at = this.snap(anchor, radius);
      if (!ai.nav.clear(at.x, at.z, radius)) continue;
      const id = ai.spawn('infected.alpha', at, { state: 'idle', yaw: -Math.atan2(l4.map.centre.z - at.z, l4.map.centre.x - at.x) });
      const e = world.entities.get(id); if (e?.combat) e.combat.allyResist = l4.alphas.allyResist;
      s.alphaIds.push(id); s.alphaAnchors.push(entry.anchor); ai.director.reserved = count - s.alphaIds.length;
    }
  }
  /** Waves from the street edges: pending counts per edge, released out of view (never in the camera, never close to the courier). */
  private waves(): void {
    const { world } = this.mission, s = this.s, tick = world.tick;
    const collapse = s.phase === 'collapse', every = collapse ? l4.war.collapseWaveEveryS : l4.war.waveEveryS;
    if (tick >= (collapse ? s.collapseWaveAt : s.waveAt) && !(collapse && world.infected!.director.count >= l4.war.collapseCapInfected)) {
      const w = collapse ? s.collapseWaves : s.wave, scale = (this.low ? .5 : 1) * (collapse ? 1 : l4.war.waveScale), base = collapse ? l4.war.collapseWaveSize : l4.war.waveSize[Math.min(w, l4.war.waveSize.length - 1)];
      const n = Math.max(1, Math.ceil(base * scale)), ring = collapse ? l4Edges.length : l4Edges.length - 1, edges: number[] = [];
      if (collapse) for (let k = 0; k < l4.war.edgesPerWave; k++) { const i = (w + k) % ring; edges.push(i); s.pend[i] = Math.min(l4.war.pendMax, (s.pend[i] ?? 0) + n); }
      // PO 10-13 ("from all directios, not in bulk"): a war wave adds to every street edge (the same total), released in small groups.
      else { const each = Math.ceil(n * l4.war.edgesPerWave / ring); for (let i = 0; i < ring; i++) { edges.push(i); s.pend[i] = Math.min(l4.war.pendMax, (s.pend[i] ?? 0) + each); } }
      world.events.emit({ type: 'l4.wave', tick, wave: w, count: collapse ? n * edges.length : Math.ceil(n * l4.war.edgesPerWave / ring) * ring, edges });
      if (collapse) { s.collapseWaves++; s.collapseWaveAt = tick + ticks(every); } else { s.wave++; s.waveAt = tick + ticks(every); }
    }
    if (tick % 10 === 0) { if (s.phase === 'war') { this.flushGroups(); this.emergeInside(); } else this.flushEdges(); }
  }
  /**
   * The war (PO 10-13): each street edge releases one small group (2-5, seeded) at a time from one of its emergence points in turn (street
   * mouths, side streets, doors; out of view, away from the courier), then waits 1.2-2.6 s (seeded): spread and staggered, never a stream
   * from one mouth. The groups head into the plaza and pick their own fights there.
   */
  private flushGroups(): void {
    const { world } = this.mission, s = this.s, ai = world.infected!, p = world.entities.get(1)!.transform, centre = l4.map.centre, tick = world.tick, w = l4.war;
    for (let i = 0; i < l4Edges.length - 1; i++) {
      if (s.pend[i] <= 0 || tick < s.edgeNext[i]) continue;
      const points = l4Emergence.map((e, k) => ({ e, k })).filter(x => x.e.edge === i);
      for (let tries = 0; tries < points.length; tries++) {
        const { e, k } = points[(s.edgeCursor[i] + tries) % points.length], at = this.snap({ x: e.at[0], z: e.at[1] }, .45);
        if (!ai.director.offscreen(at) || dist(at, p) < (e.door ? 12 : 24) || this.inGap(at)) continue;
        const rng = new Rng(world.seed, `l4-group:${i}:${s.edgeCursor[i]}:${s.wave}`), size = Math.min(s.pend[i], w.group[0] + Math.floor(rng.next() * (w.group[1] - w.group[0] + 1)));
        const to = { x: centre.x + (at.x - centre.x) * .25, z: centre.z + (at.z - centre.z) * .25 };
        for (let g = 0; g < size; g++) {
          const id = this.emerge({ x: at.x + (g % 3 - 1) * .9, z: at.z + Math.floor(g / 3) * .9 }); if (!id) break;
          s.pend[i]--; s.emergedIds.push(id); s.origin[id] = k;
          ai.rush(id, { x: to.x + (g - size / 2) * 1.5, z: to.z + ((id % 5) - 2) * 1.5 }, tick + ticks(w.emergeLeashM));
        }
        s.edgeCursor[i] = (s.edgeCursor[i] + tries + 1) % points.length;
        s.edgeNext[i] = tick + ticks(w.groupEveryS[0] + rng.next() * (w.groupEveryS[1] - w.groupEveryS[0]));
        break;
      }
    }
  }
  /**
   * PO 10-13 ("ALso from within buildings inside the army area"): every `inside.everyS` during the war one or two infected come out from
   * behind a tent, the supply crates or the registration kit inside the perimeter (out of view or hidden behind a building, >= `minM` from
   * the courier) and go for the nearest soldier.
   */
  private emergeInside(): void {
    const { world } = this.mission, s = this.s, ai = world.infected!, p = world.entities.get(1)!.transform, tick = world.tick, w = l4.war.inside;
    if (!s.insideAt) s.insideAt = s.warAt + ticks(w.everyS);
    if (tick < s.insideAt) return;
    for (let tries = 0; tries < l4Inside.length; tries++) {
      const k = (s.insideCursor + tries) % l4Inside.length, at = this.snap({ x: l4Inside[k][0], z: l4Inside[k][1] }, .45);
      if (dist(at, p) < w.minM || !(ai.director.offscreen(at) || ai.director.occluded(at))) continue;
      const rng = new Rng(world.seed, `l4-inside:${s.insideCursor}`), size = w.group[0] + Math.floor(rng.next() * (w.group[1] - w.group[0] + 1));
      const soldier = this.liveSoldiers().sort((a, b) => dist(a.transform, at) - dist(b.transform, at))[0]?.transform ?? l4.map.centre;
      for (let g = 0; g < size; g++) {
        const id = this.emerge({ x: at.x + g * .8, z: at.z }); if (!id) break;
        s.emergedIds.push(id); s.origin[id] = l4Emergence.length + k;
        ai.rush(id, { x: soldier.x, z: soldier.z }, tick + ticks(12));
      }
      s.insideCursor = k + 1; s.insideAt = tick + ticks(w.everyS);
      return;
    }
  }
  private flushEdges(): void {
    const { world } = this.mission, s = this.s, ai = world.infected!, p = world.entities.get(1)!.transform, centre = l4.map.centre;
    for (let i = 0; i < s.pend.length; i++) {
      if (s.pend[i] <= 0) continue;
      const at = this.spectacle.edgePoint(i);
      if (!ai.director.offscreen(at) || dist(at, p) < 30 || this.inGap(at)) continue;
      for (let k = 0; k < 3 && s.pend[i] > 0; k++) {
        const id = this.emerge({ x: at.x + (k - .5) * 1.2, z: at.z + (i % 2 ? 1 : -1) * k * .8 }); if (!id) return;
        s.pend[i]--; (s.phase === 'collapse' ? s.collapseIds : s.emergedIds).push(id);
        ai.rush(id, { x: centre.x + (k - .5) * 6, z: centre.z + ((id % 5) - 2) * 3 }, world.tick + ticks(l4.war.emergeLeashM));
      }
    }
  }
  private insideRing(p: Point): boolean { const r = l4.map.ring; return p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1; }
  /**
   * Replenishment (l4-collapse; as l3-horde-5x): downed infected keep their slot until they get up (strict cap), so a fighting army fills
   * the cap with bodies and new infected and bites stall. When the alive count needs room, the longest-downed bodies settle into drawn
   * corpses; `headroom` slots stay free so a bite turns rather than kills.
   */
  private replenish(): void {
    const ai = this.world.infected!, tick = this.world.tick; if (tick % 10) return;
    const over = ai.director.count - (ai.director.cap - ai.director.reserved - l4.war.headroom); if (over <= 0) return;
    this.settleDowned(over);
  }
  /** Settle the `n` longest-downed bodies (not Alphas) into drawn corpses; returns how many. */
  private settleDowned(n: number): number {
    const ai = this.world.infected!, tick = this.world.tick;
    const downed = ai.active.filter(e => e.health.current <= 0 && (e.infected?.recoverAt ?? -1) >= 0 && tick - e.infected!.deadAt >= 120 && e.archetype !== 'infected.alpha').sort((a, b) => a.infected!.deadAt - b.infected!.deadAt);
    let done = 0;
    for (const e of downed) { if (done >= n) break; ai.settle(e); done++; }
    this.s.director.settled += done;
    return done;
  }
  /**
   * Keep at most `corpseMax` drawn bodies (the oldest out of view go first) and at most `heap.max` per `heap.cellM` square (the oldest
   * first, also in view: a courier camping at one spot would otherwise stand on a mound). Removed bodies leave the world: settled bodies
   * have their own ids (the pool assigns new ones) and the corpse renderer drops them one by one, so ~1000 dead records no longer cost
   * every entity scan and checkpoint.
   */
  private clearBodies(): void {
    const { world } = this.mission, tier = this.low ? 'low' : 'high', max = l4.war.corpseMax[tier], heap = l4.war.heap;
    // A body an Alpha is throwing stays until it lands (the throw keeps positioning it).
    const flying = new Set(world.infected!.active.map(a => a.infected?.specialAttack?.projectile?.objectId ?? 0));
    const bodies = [...world.entities.iterate()].filter(e => e.corpse && e.faction === 'infected' && !e.hidden && !flying.has(e.id));
    bodies.sort((a, b) => (b.infected?.deadAt ?? 0) - (a.infected?.deadAt ?? 0)); // newest first
    const cells = new Map<number, number>(), drop = (e: EntitySnapshot) => { world.entities.delete(e.id); world.spatial.delete(e.id); };
    const kept: EntitySnapshot[] = [];
    for (const e of bodies) {
      const cell = Math.floor(e.transform.x / heap.cellM) * 4096 + Math.floor(e.transform.z / heap.cellM), n = cells.get(cell) ?? 0;
      if (n >= heap.max[tier]) { drop(e); continue; }
      cells.set(cell, n + 1); kept.push(e);
    }
    let excess = kept.length - max;
    for (let i = kept.length - 1; i >= 0 && excess > 0; i--) { const e = kept[i]; if (!world.infected!.director.offscreen(e.transform)) continue; drop(e); excess--; }
  }
  /** The line breaks when the collapse director has taken all three lines (`beats`), at the latest `defenseS` after the turn. */
  private checkLineBreak(): void {
    const { world } = this.mission, s = this.s;
    this.director.update();
    if (s.phase === 'war' && world.tick - s.warAt >= ticks(l4.lineBreak.defenseS)) this.lineBreak('time');
  }
  private lineBreak(cause: 'time' | 'beats' | 'forced'): void {
    const { world } = this.mission, s = this.s, tick = world.tick;
    if (s.phase !== 'war') return;
    s.phase = 'collapse'; s.lineBreakAt = tick; s.lineCause = cause; s.markerAt = tick + ticks(l4.collapse.markerAfterS); s.collapseWaveAt = tick + ticks(4);
    s.killsAtBreak = s.kills.player + s.kills.soldiers + s.kills.armedCivilians + s.kills.unarmedCivilians + s.kills.heli + s.kills.tank + s.kills.other;
    s.infectedAtBreak = world.infected!.active.filter(e => e.health.current > 0).length; s.soldiersAtBreak = this.liveSoldiers().length;
    world.events.emit({ type: 'l4.lineBreaks', tick, cause });
    this.openGate();
    this.escapeWindow();
    this.mission.radio('L4.air'); this.spectacle.withdrawHeli(); this.spectacle.detonateFuelTruck(); this.spectacle.fires();
    s.director.burnAt = tick + ticks(1); this.populateCollapse(); s.pockets = l4Pockets.map((_, i) => i);
    if (!this.mission.state.states['line-broken']) this.mission.setState('line-broken', true);
    this.mission.requestCheckpoint('line-break');
    this.breakRadioAt = tick + ticks(3);
  }
  private breakRadioAt = 0;
  private safeRespawn(): void {
    const { world } = this.mission, player = world.entities.get(1)!, live = world.infected!.active.filter(e => e.health.current > 0 && !e.hidden);
    const spots = l4.director.respawn.map(([x, z]) => this.snap({ x, z }, .45)).map(p => ({ p, n: live.filter(e => dist(e.transform, p) < 12).length })).sort((a, b) => a.n - b.n);
    const to = spots[0]?.p; if (!to) return;
    Object.assign(player.transform, { x: to.x, z: to.z });
    world.physics.playerBody!.setTranslation(player.transform, true); world.physics.playerBody!.setNextKinematicTranslation(player.transform);
    Object.assign(world.previousPlayer!, player.transform); world.spatial.set(1, to.x, to.z); world.player!.locomotion.reset();
    for (const e of world.entities.iterate()) if (e.companion) { const c = this.snap({ x: to.x + 1.2, z: to.z + .8 }, .4); Object.assign(e.transform, c); world.spatial.set(e.id, c.x, c.z); }
  }
  /** Alone after "Fall back!": the infected beyond `nearM` are busy with the army for a few seconds, so a way out opens (also after a respawn in the collapse). */
  private escapeWindow(): void {
    const { world } = this.mission, p = world.entities.get(1)!.transform, e = l4.director.escape;
    for (const a of world.infected!.active) { const b = a.infected?.l1; if (!b || a.health.current <= 0 || dist(a.transform, p) <= e.nearM) continue; b.ignoreId = 1; b.ignoreUntil = world.tick + ticks(e.s); if (b.mode === 'chase' && b.targetId === 1) b.targetId = 0; }
    this.s.director.gapUntil = world.tick + ticks(e.gapS); this.clearGap();
  }
  /** Distance to the escape street (the polyline from the ring's east side to Kessler's door). */
  private escapeDistance(p: Point): number {
    const r = l4.director.escape.route; let best = Infinity;
    for (let i = 1; i < r.length; i++) {
      const [ax, az] = r[i - 1], [bx, bz] = r[i], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(p.x - ax - dx * t, p.z - az - dz * t));
    }
    return best;
  }
  private gapOpen(): boolean { const g = this.s.director.gapUntil ?? 0; return g > 0 && this.world.tick < g; }
  /** While the gap is open nothing emerges on the escape street. */
  private inGap(p: Point): boolean { return this.gapOpen() && this.escapeDistance(p) < l4.director.escape.gapM; }
  /**
   * The gap: infected on the escape street farther than `nearM` from the courier run off toward the army (the nearest soldier or armed
   * civilian off the street, else back into the ring), so the street reads as a way out; the ones on her heels keep chasing.
   */
  private clearGap(): void {
    const { world } = this.mission, ai = world.infected!, p = world.entities.get(1)!.transform, e = l4.director.escape;
    const allies = this.allyEntities().filter(a => this.escapeDistance(a.transform) >= e.gapM + 2);
    for (const a of ai.active) {
      if (a.health.current <= 0 || a.hidden || a.archetype === 'infected.alpha' || dist(a.transform, p) <= e.nearM || this.escapeDistance(a.transform) >= e.gapM) continue;
      const to = allies.length ? allies.reduce((q, b) => dist(b.transform, a.transform) < dist(q.transform, a.transform) ? b : q).transform : { x: -26, z: 0 };
      ai.rush(a.id, { x: to.x, z: to.z }, world.tick + ticks(10));
    }
  }
  /** Cars along the streets catch fire from the shockwave and the burning wreckage (E09 car explosions: fires persist). */
  /** One car per call (staggered after the break, l4-collapse perf: the fuel-truck chain and three car blasts used to land in one frame). */
  private burnCars(): void {
    const s = this.s, v = this.world.vehicles; if (!v) { s.director.burnAt = 0; return; }
    const near = s.carIds.filter(id => v.cars.has(id) && !s.burning.includes(id)).sort((a, b) => dist(v.cars.get(a)!.entity.transform, l4.map.centre) - dist(v.cars.get(b)!.entity.transform, l4.map.centre));
    if (near.length && s.burning.length < l4.collapse.burningCars) { v.damage(near[0], 99999); s.burning.push(near[0]); }
    s.director.burnAt = near.length > 1 && s.burning.length < l4.collapse.burningCars ? this.world.tick + ticks(.7) : 0;
  }
  private populateCollapse(): void {
    const s = this.s, doors = this.doors(), scale = this.low ? .5 : 1;
    for (const [x, z, size] of l4CollapseGroups) {
      const near = doors.filter(d => dist(d, { x, z }) < 14).sort((a, b) => dist(a, { x, z }) - dist(b, { x, z })).slice(0, 2);
      if (!near.length) continue;
      for (let i = 0; i < Math.ceil(size * scale); i++) s.pendingDoor.push({ id: 0, door: near[i % near.length].name, home: { x, z } });
    }
  }
  private emergeCollapse(): void {
    const { world } = this.mission, s = this.s, ai = world.infected!, p = world.entities.get(1)!.transform;
    if (world.tick % 10 !== 0) return;
    let spawned = 0;
    for (const q of s.pendingDoor) {
      if (q.id !== 0 || spawned >= l4.collapse.pendingPerTick) continue;
      const a = this.anchor(q.door);
      if (!ai.director.offscreen(a) || dist(a, p) < 24) continue;
      const id = this.emerge(a); if (!id) { if (ai.director.count >= ai.director.cap) break; continue; }
      const e = world.entities.get(id)!, brain = e.infected!.l1; q.id = id; spawned++;
      if (brain) { brain.homeX = q.home.x; brain.homeZ = q.home.z; brain.leashM = 12; }
    }
    // Soldier pockets: three soldiers hold a street corner against a few infected (spawned out of view).
    for (const i of [...s.pockets]) {
      const pocket = l4Pockets[i], c = { x: pocket.at[0][0], z: pocket.at[0][1] };
      if (!ai.director.offscreen(c) || dist(c, p) < 24 || this.inGap({ x: pocket.foes[0], z: pocket.foes[1] })) continue;
      s.pockets = s.pockets.filter(k => k !== i);
      const survivors = this.liveSoldiers().filter(e => !s.hmgIds.includes(e.id)).sort((a, b) => dist(a.transform, c) - dist(b.transform, c)).slice(0, pocket.at.length);
      for (const [k, e] of survivors.entries()) {
        const [x, z] = pocket.at[k], ally = e.civilian!.ally;
        if (ally) { ally.post = { x, z }; ally.hold = true; ally.engaged = true; }
      }
      for (let k = 0; k < (this.low ? 3 : 6); k++) { const id = this.emerge({ x: pocket.foes[0] - k * .9, z: pocket.foes[1] }); if (id) ai.rush(id, c, world.tick + ticks(20)); }
    }
  }
  /** Section 5.9: the player (and the corgi) go down alone; nobody and nothing follows (the yard is walled off, its nav island is unreachable). */
  private descend(): void {
    const { world } = this.mission, s = this.s, tick = world.tick, player = world.entities.get(1)!;
    if (s.phase === 'cellar' || s.phase === 'done') return;
    s.phase = 'cellar'; s.descendAt = tick; s.soldiersAtCellar = this.liveSoldiers().length;
    const inn = this.anchor('l4-cellar-in');
    Object.assign(player.transform, { x: inn.x, z: inn.z });
    world.physics.playerBody!.setTranslation(player.transform, true); world.physics.playerBody!.setNextKinematicTranslation(player.transform);
    Object.assign(world.previousPlayer!, player.transform); world.spatial.set(1, inn.x, inn.z); world.player!.locomotion.reset(); world.player!.setCheckpoint(player.transform); world.clearInput();
    for (const e of world.entities.iterate()) if (e.companion) { const p = { x: inn.x + 1.2, z: inn.z - .6 }; Object.assign(e.transform, p); e.hidden = false; world.spatial.set(e.id, p.x, p.z); }
    // Anything that was chasing her loses her (she is out of reach and out of sight).
    for (const e of world.infected!.active) if (e.infected?.l1 && dist(e.transform, inn) > 6) { const b = e.infected.l1; b.homeX = e.transform.x; b.homeZ = e.transform.z; b.leashM = 8; }
    if (!this.mission.state.states.descended) this.mission.setState('descended', true);
    world.events.emit({ type: 'l4.descended', tick });
  }
  private bar(): void {
    const { world } = this.mission, s = this.s, tick = world.tick;
    if (s.barredAt) return;
    s.barredAt = tick;
    if (!this.mission.state.states.barred) this.mission.setState('barred', true);
    world.events.emit({ type: 'l4.doorBarred', tick });
    this.mission.radio('L4.twist');
  }
  /** Gunfire and blasts go on above for at least `battleAfterBarredS`; muffled by the cellar acoustic zone. */
  private cellarUpdate(): void {
    const { world } = this.mission, s = this.s, tick = world.tick;
    if (!s.barredAt) return;
    if ((tick - s.barredAt) % 75 === 0) world.events.emit({ type: 'l4.battle', tick });
    if (!s.doneAt && tick - s.barredAt >= ticks(l4.cellar.battleAfterBarredS)) { s.doneAt = tick; s.phase = 'done'; if (!this.mission.state.states.done) this.mission.setState('done', true); }
  }

  // ---------------------------------------------------------------------------------------------------------- events
  private gunshot(sourceId: number, at: Point, radius: number): void {
    const s = this.mission.state.l4, world = this.world; if (!s || !world.infected) return;
    const last = s.lastShot[sourceId] ?? -Infinity; if (world.tick - last < ticks(.5)) return;
    s.lastShot[sourceId] = world.tick;
    world.events.emit({ type: 'outbreak.distraction', tick: world.tick, id: 400_000 + world.tick * 64 + (sourceId % 64), kind: 'gunfire', position: { x: at.x, z: at.z }, radius, until: world.tick + ticks(6) });
  }
  private hmgShot(sourceId: number): void {
    const s = this.mission.state.l4; if (!s) return;
    const last = s.hmgLastAt[sourceId] ?? -Infinity;
    if (this.world.tick - last > ticks(1)) { s.hmgBursts++; this.world.events.emit({ type: 'hmg.burst', tick: this.world.tick, sourceId }); }
    s.hmgLastAt[sourceId] = this.world.tick;
  }
  private killed(sourceId: number, targetId: number): void {
    const s = this.mission.state.l4, world = this.world; if (!s || s.phase === 'convoy' || s.phase === 'plaza') return;
    if (world.entities.get(targetId)?.faction !== 'infected') return;
    const k = s.kills;
    if (sourceId === 1) k.player++;
    else if (sourceId === s.heliId) k.heli++;
    else if (sourceId === s.tankId) k.tank++;
    else if (s.soldierIds.includes(sourceId)) k.soldiers++;
    else if (s.armed.some(a => a.id === sourceId)) k.armedCivilians++;
    else k.other++;
  }

  // ---------------------------------------------------------------------------------------------------------- tick
  update(): void {
    const { world, state } = this.mission, s = state.l4; if (!s) return;
    const tick = world.tick;
    if (s.phase === 'convoy') this.ride();
    this.convoySound(tick);
    if ((s.phase === 'plaza' || s.phase === 'war') && tick % 10 === 0) this.perimeterBark();
    if (s.phase === 'plaza') {
      if (tick === s.arrivedAt + ticks(l4.calm.welcomeAtS)) this.mission.radio('L4.welcome');
      if (tick >= s.turnDueAt) this.turn();
    }
    if (s.phase === 'war' || s.phase === 'collapse' || s.phase === 'cellar' || s.phase === 'done') {
      this.alphas(); this.waves(); this.replenish(); if (tick % 30 === 0) this.clearBodies();
      if (s.phase === 'war') {
        if (s.infectedAtT30 < 0 && tick >= s.warAt + ticks(30)) s.infectedAtT30 = world.infected!.active.filter(e => e.health.current > 0).length;
        if (s.tankPhase === 'off' && tick >= s.warAt + ticks(l4.tank.enterAfterS)) this.spectacle.startTank();
        if (s.heliPhase === 'off' && tick >= s.warAt + ticks(8)) { this.spectacle.startHeli(); this.mission.radio('L4.war'); }
        this.checkLineBreak();
      }
      this.spectacle.updateTank(); this.spectacle.updateHeli();
      if (s.phase === 'collapse') {
        this.emergeCollapse();
        if (this.breakRadioAt && tick >= this.breakRadioAt) { this.breakRadioAt = 0; this.mission.radio('L4.break'); }
        if (s.director.burnAt && tick >= s.director.burnAt) this.burnCars();
        if (tick % 20 === 0 && this.gapOpen()) this.clearGap();
        // The hiding place is only a soft marker for the first seconds: the courier finds her own way first.
        if (tick < s.markerAt && this.mission.state.marker === 'l4-cellar-door') this.mission.state.marker = null;
      }
      if (s.phase === 'cellar') this.cellarUpdate();
      // L4 infected hit like L3's (section 5.1 tuning; PO: a sensible player finishes with few deaths).
      if (tick % 15 === 0) for (const e of world.infected!.active) if (e.combat && e.health.current > 0 && e.combat.damageMultiplier === 1) e.combat.damageMultiplier = l4.war.infectedDamage;
    }
  }

  /** Cheat/test path (`completeObjective` in a gap without an active objective): the first turn comes now. */
  advance(): boolean {
    const s = this.mission.state.l4; if (!s) return false;
    if (s.phase === 'plaza') { this.turn(); return true; }
    return false;
  }
  /** Checkpoint restore: shift the timeline. Entities (soldiers, convoy, tank, infected, pickups) come back from the snapshot. */
  restore(delta: number): void {
    const s = this.mission.state.l4; if (!s) return;
    for (const key of ['rideAt', 'arrivedAt', 'gunAt', 'turnDueAt', 'turnAt', 'warAt', 'lineBreakAt', 'descendAt', 'barredAt', 'doneAt', 'markerAt', 'waveAt', 'collapseWaveAt', 'tankFireAt', 'heliAt', 'heliBurstAt'] as const) if (s[key]) s[key] += delta;
    const d = s.director;
    for (const l of d.lines) { if (l.brokeAt) l.brokeAt += delta; if (l.pushAt) l.pushAt += delta; }
    for (const j of d.alphaJobs) j.startedAt += delta;
    if (d.swarmedAt) d.swarmedAt += delta; if (d.fallBackAt) d.fallBackAt += delta; if (d.burnAt) d.burnAt += delta; if (d.gapUntil) d.gapUntil += delta; for (const r of d.refugees ?? []) r.turnAt += delta;
    for (const a of s.armed) if (a.armedAt) a.armedAt += delta;
    for (const k of Object.keys(s.lastShot)) s.lastShot[Number(k)] += delta;
    for (const k of Object.keys(s.hmgLastAt)) s.hmgLastAt[Number(k)] += delta;
    if (this.breakRadioAt) this.breakRadioAt += delta;
    // The parked convoy is a nav blocker; the live ones come from the entities restored with the snapshot.
    if (s.phase !== 'convoy') this.parkNav(true);
    // The perimeter and the convoy gate follow the phase (the barriers themselves come back with the snapshot).
    if (s.barkAt) s.barkAt += delta;
    for (let i = 0; i < s.edgeNext.length; i++) if (s.edgeNext[i]) s.edgeNext[i] += delta;
    if (s.insideAt) s.insideAt += delta;
    const camp = s.phase === 'plaza' || s.phase === 'war';
    this.gateNav(camp); this.perimeter(camp);
    this.world.infected!.director.reserved = l4.alphas.count[this.low ? 'low' : 'high'] - s.alphaIds.length;
    const fuel = this.world.entities.get(s.fuelId);
    this.world.events.emit({ type: 'world.blocker.changed', tick: this.world.tick, id: 900_450, blocked: !!fuel && !fuel.hidden, wall: { x: l4.fuelTruck.x, y: 1, z: l4.fuelTruck.z, halfX: 1.6, halfY: 1, halfZ: 5.6 } });
    // A retry in the collapse: back at the quietest plaza exit, with the escape window (no death loop in the flooded ring).
    if (s.phase === 'collapse') { this.safeRespawn(); this.escapeWindow(); }
  }
}
void l4Anchors;
