import { Rng } from '../../core/Rng';
import { l4, l4Anchors, l4Cars, l4CollapseGroups, l4Crowd, l4Edges, l4Pockets, l4Posts, l4Route, l4RoutePose, l4ConvoyStations, type L4Weapon } from '../../data/l4';
import { l4AlphaEmergence, l4BreakableLine } from '../../levels/L4/layout';
import { infectedDef } from '../../data/infected';
import { Outbreak } from '../outbreak/Outbreak';
import { populateGrove } from '../outbreak/Population';
import { allyState } from '../outbreak/Allies';
import { L4Spectacle, spawnSetPiece } from './L4Spectacle';
import type { Mission } from './Mission';
import type { L4State } from './types';
import type { EntitySnapshot } from '../world/types';
import type { CivilianActivity, Point } from '../npc/types';
import type { CoverWall } from '../combat/HitQuery';

const ticks = (s: number) => Math.round(s * 60);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const NAV_CONVOY = 900_500;
const WEAPONS: readonly L4Weapon[] = ['pistol', 'hunting-rifle', 'pistol', 'pipe', 'hunting-rifle', 'bat', 'pistol', 'crowbar', 'hunting-rifle', 'pipe'];
const fresh = (): L4State => ({
  phase: 'convoy', rideAt: 0, arrivedAt: 0, gunAt: 0, turnDueAt: 0, turnAt: 0, warAt: 0, lineBreakAt: 0, lineCause: '', descendAt: 0, barredAt: 0, doneAt: 0, markerAt: 0,
  convoyIds: [], convoyS: [], convoyV: 0, seated: false, evacueeIds: [], turnerIds: [], soldierIds: [], qmId: 0, hmgIds: [], residentIds: [], medkitIds: [], armed: [],
  soldiersAtTurn: 0, civiliansAtTurn: 0, infectedAtT30: -1, killsAtBreak: 0, infectedAtBreak: 0, soldiersAtBreak: 0, soldiersAtCellar: 0,
  alphaIds: [], alphaAnchors: [], wave: 0, waveAt: 0, pend: [0, 0, 0, 0, 0, 0, 0], carIds: [], emergedIds: [], collapseWaveAt: 0, collapseIds: [], collapseWaves: 0, pendingDoor: [], pockets: [],
  tankId: 0, tankS: 0, tankFireAt: 0, tankShots: 0, tankPhase: 'off', heliId: 0, heliAngle: 0, heliPhase: 'off', heliAt: 0, heliBurstAt: 0, heliBurst: 0, heliShots: 0, heliTarget: null,
  hmgBursts: 0, hmgLastAt: {}, fuelId: 0, craterId: 0, burning: [], fires: 0, glass: [], scorch: 0, lastShot: {},
  kills: { player: 0, soldiers: 0, armedCivilians: 0, unarmedCivilians: 0, heli: 0, tank: 0, other: 0 },
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
  constructor(private readonly mission: Mission) { this.spectacle = new L4Spectacle(mission.world, () => this.s, () => this.allyEntities()); }
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
    const outbreak = world.npcs.civilians.outbreak ?? new Outbreak(world, { refuges: edges, tier });
    world.npcs.civilians.outbreak = outbreak;
    world.infected.director.levelCap = l4.war.caps.infected.high; world.infected.director.strict = true; world.infected.director.reserved = l4.alphas.count[this.low ? 'low' : 'high'];
    world.npcs.setAmbient(0);
    // L4-default progression (bat, axe, handgun) unless a campaign load already applied its racks.
    if (!world.progression || !world.entities.get(1)!.weapons) world.combat?.setLoadout(['weapon.fire-axe', 'weapon.bat'], ['weapon.handgun', 'weapon.kick']);
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
    const slots = [...l4Crowd.queue.line1, ...l4Crowd.queue.line2];
    const rng = new Rng(this.world.seed, 'l4-evacuees'), turners = new Set<number>();
    while (turners.size < Math.min(l4.calm.turners, n)) turners.add(Math.floor(rng.next() * n));
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
    if (this.low) posts = posts.filter((p, i) => p.role === 'qm' || p.role === 'hmg' || i % 2 === 0);
    for (const post of posts.slice(0, limit)) {
      const p = this.snap({ x: post.at[0], z: post.at[1] }, .35), face = { x: post.face[0], z: post.face[1] };
      const id = o.spawnPedestrian(p, { role: 'soldier', model: 'npc.national-guard', tint: '#4b5a3a', tier: 'average', yaw: -Math.atan2(face.z - p.z, face.x - p.x), schedule: [{ activity: 'look', anchor: 'l4/post', target: p, facing: face, ticks: 60 * 60 * 6 }] });
      const e = this.world.entities.get(id)!, hmg = post.role === 'hmg';
      e.civilian!.ally = { ...allyState('soldier', p, true), gun: { ...(hmg ? l4.soldiers.hmg : l4.soldiers.rifle) }, weapon: hmg ? 'hmg' : 'rifle', range: hmg ? l4.soldiers.hmgRangeM : l4.soldiers.postRangeM, runSpeed: l4.soldiers.moveMs };
      e.health = { current: l4.soldiers.hp, max: l4.soldiers.hp }; e.appearance!.handProp = 'rifle'; e.transform.yaw = -Math.atan2(face.z - p.z, face.x - p.x);
      s.soldierIds.push(id); if (post.role === 'qm') s.qmId = id; if (hmg) s.hmgIds.push(id);
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
      const p = this.snap({ x, z }, .3), id = this.world.pickups!.spawn('medkit', p);
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
    target = Math.min(target, Math.sqrt(2 * c.brakeMs2 * Math.max(0, remaining)));
    // Slow for the corner any vehicle is on or about to enter (all five share one speed, so the column keeps its shape).
    for (const at of s.convoyS) for (let d = 0; d <= 14; d += 1) {
      const limit = l4RoutePose(this.route, at + d).limit;
      if (limit < Infinity && s.convoyV * s.convoyV - limit * limit <= 2 * c.brakeMs2 * Math.max(0, d - 1)) continue;
      target = Math.min(target, limit);
    }
    if (remaining > .02) target = Math.max(target, .4);
    s.convoyV += Math.max(-c.brakeMs2 / 60, Math.min(c.accelMs2 / 60, target - s.convoyV));
    const step = Math.min(remaining, s.convoyV / 60);
    for (let i = 0; i < s.convoyS.length; i++) {
      s.convoyS[i] += step;
      const p = l4RoutePose(this.route, s.convoyS[i]), e = world.entities.get(s.convoyIds[i]);
      if (e) Object.assign(e.transform, { x: p.x, z: p.z, yaw: p.yaw });
    }
    const bus = world.entities.get(s.convoyIds[this.playerBus()])!;
    this.carry(bus.transform.x, bus.transform.z);
    if (remaining - step < .02 && s.convoyV < .15) this.arrive();
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
    const bus = world.entities.get(s.convoyIds[this.playerBus()])!, player = world.entities.get(1)!;
    const out = this.snap({ x: bus.transform.x - Math.cos(-bus.transform.yaw) * (5.9), z: bus.transform.z + 0 }, .45);
    Object.assign(player.transform, { x: out.x, z: out.z }); player.hidden = false; s.seated = false;
    world.physics.playerBody!.setTranslation(player.transform, true); world.physics.playerBody!.setNextKinematicTranslation(player.transform); world.physics.playerCollider!.setEnabled(true);
    world.player!.locomotion.reset(); Object.assign(world.previousPlayer!, player.transform); world.spatial.set(1, out.x, out.z); world.player!.setCheckpoint(player.transform);
    world.storyLock = null; world.clearInput();
    world.events.emit({ type: 'vehicle.exited', tick, sourceId: s.convoyIds[this.playerBus()], targetId: 1, role: 'passenger' });
    for (const e of world.entities.iterate()) if (e.companion) { e.hidden = false; const p = this.snap({ x: out.x - 1.4, z: out.z + 1.1 }, .4); Object.assign(e.transform, p); world.spatial.set(e.id, p.x, p.z); }
    // Evacuees step off both buses and walk to the registration queue.
    const buses = [2, 4].map(i => world.entities.get(s.convoyIds[i])!.transform);
    for (const [k, id] of s.evacueeIds.entries()) {
      const e = world.entities.get(id); if (!e) continue;
      const b = buses[k % 2], p = this.snap({ x: b.x - 5.2 * Math.cos(-b.yaw) + (k % 3 - 1) * .8, z: b.z + (k % 2 ? 2.6 : -2.6) }, .4);
      e.hidden = false; Object.assign(e.transform, p); world.spatial.set(id, p.x, p.z); e.civilian!.pauseUntil = 0;
    }
    if (!this.mission.state.states.arrived) this.mission.setState('arrived', true);
    world.events.emit({ type: 'l4.convoyArrived', tick });
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
    // The first turn fires 40-50 s after the issue (seeded), at the latest 100 s after the arrival.
    const [a, b] = l4.turn.afterGunS, rng = new Rng(this.world.seed, 'l4-turn');
    s.turnDueAt = Math.min(s.turnDueAt || Infinity, s.gunAt + ticks(a + rng.next() * (b - a)));
  }
  private turn(): void {
    const { world } = this.mission, s = this.s, tick = world.tick, o = this.outbreak();
    // The evacuees from the L3 buses collapse in the queue and turn (the visible 3 s transformation, same entity, same look).
    let ids = s.turnerIds.filter(id => this.human(world.entities.get(id)));
    if (!ids.length) {
      const queue = [...s.evacueeIds, ...s.residentIds].filter(id => this.human(world.entities.get(id)));
      ids = queue.sort((a, b) => dist(world.entities.get(a)!.transform, { x: -25, z: -9 }) - dist(world.entities.get(b)!.transform, { x: -25, z: -9 })).slice(0, l4.calm.turners);
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
  private spawnRoom(): boolean {
    const cap = l4.war.caps.characters[this.low ? 'low' : 'high'];
    return [...this.world.entities.iterate()].filter(e => !e.hidden && e.health.current > 0 && (e.infected || e.civilian)).length < cap;
  }
  private emerge(at: Point): number {
    const { world } = this.mission, ai = world.infected!, o = this.outbreak();
    if (!this.spawnRoom() || ai.director.count >= ai.director.cap - ai.director.reserved || !ai.pool.length) return 0;
    const out = this.snap(at, .45), id = o.spawnPedestrian(out), e = world.entities.get(id)!;
    o.turnNow(e);
    if (!e.infected) return 0;
    if (e.combat) e.combat.staggerUntil = world.tick + 30;
    return id;
  }
  /** Reserve cap space for the first Alphas before releasing ordinary street waves. */
  private alphas(): void {
    const { world } = this.mission, s = this.s, ai = world.infected!;
    for (const [i, entry] of l4AlphaEmergence.entries()) {
      if (s.alphaAnchors.includes(entry.anchor)) continue;
      if (s.alphaIds.length >= l4.alphas.count[this.low ? 'low' : 'high']) return;
      if (world.tick < s.turnAt + ticks(l4.alphas.afterTurnS[i]) || ai.director.count >= ai.director.cap || !ai.pool.length || !this.spawnRoom()) return;
      const anchor = this.anchor(entry.anchor);
      if (!ai.director.offscreen(anchor)) continue;
      const at = this.snap(anchor, infectedDef('infected.alpha').radius);
      if (!ai.nav.clear(at.x, at.z, infectedDef('infected.alpha').radius)) return;
      const target = this.anchor(l4BreakableLine[i].anchors.inside);
      const id = ai.spawn('infected.alpha', at, { state: 'idle', yaw: -Math.atan2(target.z - at.z, target.x - at.x) });
      s.alphaIds.push(id); s.alphaAnchors.push(entry.anchor); ai.director.reserved = l4.alphas.count[this.low ? 'low' : 'high'] - s.alphaIds.length;
    }
  }
  /** Waves from the street edges: pending counts per edge, released out of view (never in the camera, never close to the courier). */
  private waves(): void {
    const { world } = this.mission, s = this.s, tick = world.tick;
    const collapse = s.phase === 'collapse', every = collapse ? l4.war.collapseWaveEveryS : l4.war.waveEveryS;
    if (tick >= (collapse ? s.collapseWaveAt : s.waveAt) && !(collapse && world.infected!.director.count >= l4.war.collapseCapInfected)) {
      const w = collapse ? s.collapseWaves : s.wave, scale = this.low ? .5 : 1, base = collapse ? l4.war.collapseWaveSize : l4.war.waveSize[Math.min(w, l4.war.waveSize.length - 1)];
      const n = Math.max(1, Math.ceil(base * scale)), ring = collapse ? l4Edges.length : l4Edges.length - 1, edges: number[] = [];
      for (let k = 0; k < l4.war.edgesPerWave; k++) { const i = (w + k) % ring; edges.push(i); s.pend[i] = Math.min(40, (s.pend[i] ?? 0) + n); }
      world.events.emit({ type: 'l4.wave', tick, wave: w, count: n * edges.length, edges });
      if (collapse) { s.collapseWaves++; s.collapseWaveAt = tick + ticks(every); } else { s.wave++; s.waveAt = tick + ticks(every); }
    }
    if (tick % 10 === 0) this.flushEdges();
  }
  private flushEdges(): void {
    const { world } = this.mission, s = this.s, ai = world.infected!, p = world.entities.get(1)!.transform, centre = l4.map.centre;
    for (let i = 0; i < s.pend.length; i++) {
      if (s.pend[i] <= 0) continue;
      const at = this.spectacle.edgePoint(i);
      if (!ai.director.offscreen(at) || dist(at, p) < 30) continue;
      for (let k = 0; k < 3 && s.pend[i] > 0; k++) {
        const id = this.emerge({ x: at.x + (k - .5) * 1.2, z: at.z + (i % 2 ? 1 : -1) * k * .8 }); if (!id) return;
        s.pend[i]--; (s.phase === 'collapse' ? s.collapseIds : s.emergedIds).push(id);
        ai.rush(id, { x: centre.x + (k - .5) * 6, z: centre.z + ((id % 5) - 2) * 3 }, world.tick + ticks(l4.war.emergeLeashM));
      }
    }
  }
  private insideRing(p: Point): boolean { const r = l4.map.ring; return p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1; }
  private checkLineBreak(): void {
    const { world } = this.mission, s = this.s, tick = world.tick;
    if (world.tick % 10 !== 0) return;
    const inside = world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && this.insideRing(e.transform)).length;
    const alive = this.liveSoldiers().length, cause = tick - s.warAt >= ticks(l4.lineBreak.defenseS) ? 'time' : s.soldiersAtTurn && alive <= s.soldiersAtTurn * l4.lineBreak.soldiersLeft ? 'soldiers' : inside >= l4.lineBreak.inside ? 'inside' : '';
    if (cause) this.lineBreak(cause);
  }
  private lineBreak(cause: 'time' | 'soldiers' | 'inside' | 'forced'): void {
    const { world } = this.mission, s = this.s, tick = world.tick;
    if (s.phase !== 'war') return;
    s.phase = 'collapse'; s.lineBreakAt = tick; s.lineCause = cause; s.markerAt = tick + ticks(l4.collapse.markerAfterS); s.collapseWaveAt = tick + ticks(4);
    s.killsAtBreak = s.kills.player + s.kills.soldiers + s.kills.armedCivilians + s.kills.unarmedCivilians + s.kills.heli + s.kills.tank + s.kills.other;
    s.infectedAtBreak = world.infected!.active.filter(e => e.health.current > 0).length; s.soldiersAtBreak = this.liveSoldiers().length;
    world.events.emit({ type: 'l4.lineBreaks', tick, cause });
    this.mission.radio('L4.air'); this.spectacle.withdrawHeli(); this.spectacle.detonateFuelTruck(); this.spectacle.fires();
    this.burnCars(); this.populateCollapse(); s.pockets = l4Pockets.map((_, i) => i);
    if (!this.mission.state.states['line-broken']) this.mission.setState('line-broken', true);
    this.mission.requestCheckpoint('line-break');
    this.breakRadioAt = tick + ticks(3);
  }
  private breakRadioAt = 0;
  /** Cars along the streets catch fire from the shockwave and the burning wreckage (E09 car explosions: fires persist). */
  private burnCars(): void {
    const s = this.s, v = this.world.vehicles; if (!v) return;
    const near = s.carIds.filter(id => v.cars.has(id)).sort((a, b) => dist(v.cars.get(a)!.entity.transform, l4.map.centre) - dist(v.cars.get(b)!.entity.transform, l4.map.centre));
    for (const id of near.slice(0, l4.collapse.burningCars)) { v.damage(id, 99999); s.burning.push(id); }
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
      if (!ai.director.offscreen(c) || dist(c, p) < 24) continue;
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
    if (s.phase === 'plaza') {
      if (tick === s.arrivedAt + ticks(l4.calm.welcomeAtS)) this.mission.radio('L4.welcome');
      if (tick >= s.turnDueAt) this.turn();
    }
    if (s.phase === 'war' || s.phase === 'collapse' || s.phase === 'cellar' || s.phase === 'done') {
      this.alphas(); this.waves();
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
    for (const a of s.armed) if (a.armedAt) a.armedAt += delta;
    for (const k of Object.keys(s.lastShot)) s.lastShot[Number(k)] += delta;
    for (const k of Object.keys(s.hmgLastAt)) s.hmgLastAt[Number(k)] += delta;
    if (this.breakRadioAt) this.breakRadioAt += delta;
    // The parked convoy is a nav blocker; the live ones come from the entities restored with the snapshot.
    if (s.phase !== 'convoy') this.parkNav(true);
    this.world.infected!.director.reserved = l4.alphas.count[this.low ? 'low' : 'high'] - s.alphaIds.length;
    const fuel = this.world.entities.get(s.fuelId);
    this.world.events.emit({ type: 'world.blocker.changed', tick: this.world.tick, id: 900_450, blocked: !!fuel && !fuel.hidden, wall: { x: l4.fuelTruck.x, y: 1, z: l4.fuelTruck.z, halfX: 1.6, halfY: 1, halfZ: 5.6 } });
  }
}
void l4Anchors;
