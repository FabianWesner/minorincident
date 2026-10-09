import { ArmyCheckpointBoom } from './ArmyCheckpointBoom';
import { Rng } from '../../core/Rng';
import { l4 } from '../../data/l4';
import { l3, l3Street, l3Segment } from '../../data/l3';
import { l3Dressing } from '../../levels/L3/layout';
import { Outbreak } from '../outbreak/Outbreak';
import { allyState } from '../outbreak/Allies';
import type { Mission } from './Mission';
import type { L3State } from './types';
import type { EntitySnapshot } from '../world/types';
import type { CivilianActivity, Point } from '../npc/types';
import type { CoverWall } from '../combat/HitQuery';

const TICKS = 60, ticks = (s: number) => Math.round(s * TICKS);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
type Dir = 'river' | 'blvd' | 'oak';
const DIRS: readonly Dir[] = ['river', 'blvd', 'oak'];
/** Where each attack direction runs at: outside the river-path gate, the north-east and the south-east gate. */
const RUSH: Record<Dir, Point> = { river: { x: -157, z: -25.5 }, blvd: { x: -132, z: -25.5 }, oak: { x: -132, z: 25.5 } };
/** The yard gates the remaining officers pull shut behind the squad (east = Commerce, the side gates and the river gate). */
export const L3_GATES: Record<string, CoverWall> = {
  'yard-east': { x: -126, y: .9, z: 0, halfX: .25, halfY: .9, halfZ: 5.2 },
  'yard-ne': { x: -132, y: .9, z: -22, halfX: 2.2, halfY: .9, halfZ: .25 },
  'yard-se': { x: -132, y: .9, z: 22, halfX: 2.2, halfY: .9, halfZ: .25 },
  'yard-river': { x: -157, y: .9, z: -22, halfX: 2, halfY: .9, halfZ: .25 },
};
const fresh = (): L3State => ({
  phase: 'yard', handgunAt: 0, attackAt: 0, fallbackAt: 0, fallbackCause: '', crossedAt: 0, doneAt: 0, gatesClosedAt: 0,
  officerIds: [], squadIds: [], soldierIds: [], medkitIds: [], squad: [], lost: [], turnedOfficers: [],
  waves: [], waveIds: [], wavesSpawned: 0, populated: [false, false, false], pending: [], segmentIds: [[], [], []],
  furthest: -Infinity, furthestAt: 0, pressureAt: 0, pressureIds: [], segment: -1, segmentSquad: [], lastShot: {}, retired: 0, spills: {}, spillIds: [],
});
type Pending = L3State['pending'][number];

/**
 * L3 "The Police Collapse" controller (specs/epic-21 sections 4 and 5). Scripted only up to the fallback: the calm yard with
 * the armory table, the handgun pickup, the station attack (waves from the river path and both avenues) and the first-of
 * fallback rule (60 s / 3 officers turned / 8 inside the fence). From there everything is systemic: the squad follows the
 * player (allied fighters v2), the corridor population emerges out of view ahead of the player, gunfire is a loud event
 * for non-chasing infected within 20 m, bites turn officers like anyone else, and forward pressure lets infected emerge
 * behind a lingering player. The army zone line ends the level. All state lives in `mission.state.l3` (checkpoints).
 */
export class LevelThreeCollapse {
  private readonly walls = new Map<string, number>();
  constructor(private readonly mission: Mission) {}
  /** Static collider + navigation blocker; recreated from state on checkpoint restore. */
  private wall(id: string, blocked: boolean): void {
    const handle = this.walls.get(id), w = L3_GATES[id], key = 900_400 + Object.keys(L3_GATES).indexOf(id);
    if (blocked && handle === undefined) { this.walls.set(id, this.world.physics.addBlocker(w)); this.world.events.emit({ type: 'world.blocker.changed', tick: this.world.tick, id: key, blocked: true, wall: w }); }
    if (!blocked && handle !== undefined) { this.world.physics.removeBlocker(handle); this.walls.delete(id); this.world.events.emit({ type: 'world.blocker.changed', tick: this.world.tick, id: key, blocked: false, wall: w }); }
  }
  /**
   * Section 5.5: the station cannot be held, but the officers who stay buy the squad its head start. Once the courier and
   * the squad are through the east gate (or 15 s after the call), the officers left inside pull every yard gate shut.
   */
  private sealYard(): void {
    const { world } = this.mission, s = this.s, tick = world.tick;
    if (s.gatesClosedAt || !s.fallbackAt) return;
    const out = (p: Point) => p.x > l3.map.yard.x1 + 1.5, player = world.entities.get(1)!;
    const squadOut = s.squad.every(m => { const e = world.entities.get(m.id); return !e || out(e.transform); });
    if (!(out(player.transform) && (squadOut || tick - s.fallbackAt >= ticks(15)))) return;
    // Never shut a gate onto somebody standing in it.
    for (const w of Object.values(L3_GATES)) for (const e of world.entities.iterate()) if (e.health.current > 0 && (e.infected || e.civilian || e.id === 1) && Math.abs(e.transform.x - w.x) < w.halfX + .5 && Math.abs(e.transform.z - w.z) < w.halfZ + .5) return;
    s.gatesClosedAt = tick;
    for (const id of Object.keys(L3_GATES)) { this.wall(id, true); world.events.emit({ type: 'gate.changed', tick, id: `l3-${id}`, open: false }); }
  }
  private get s(): L3State { return this.mission.state.l3!; }
  private get world() { return this.mission.world; }
  private anchor(name: string) { return this.mission.def.anchors[name]; }
  private outbreak(): Outbreak { return this.world.npcs!.civilians.outbreak!; }
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

  prepare(): void {
    const { world, state } = this.mission;
    state.l3 = fresh();
    if (!world.infected || !world.npcs) return;
    const tier = world.infected.director.tier;
    // Fleeing stragglers run for the map edges (river path, the far ends of the avenues); houses stay locked.
    const edges = Object.keys(this.mission.def.anchors).filter(n => n.startsWith('edge-in-')).map(id => ({ id, ...this.anchor(id) }));
    const outbreak = world.npcs.civilians.outbreak ?? new Outbreak(world, { refuges: edges, tier });
    world.npcs.civilians.outbreak = outbreak;
    world.infected.director.levelCap = l3.density.caps.high; world.infected.director.strict = true;
    world.npcs.setAmbient(0);
    // L3-default progression (bat + axe from L1/L2) unless a campaign load already applied its racks.
    if (!world.progression || !world.entities.get(1)!.weapons) world.combat?.setLoadout(['weapon.fire-axe', 'weapon.bat'], ['weapon.kick']);
    this.spawnOfficers();
    this.spawnSoldiers();
    this.spawnCorpses();
    this.spawnFires();
    this.spawnMedkits();
    this.mission.radio('L3.briefing');
    // Gunfire is a loud event (section 5.3): the player's handgun and every ally shot.
    world.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === 'weapon.handgun') this.gunshot(1, e.position); });
    world.events.on('ally.attack', e => { if (e.type === 'ally.attack' && e.role !== 'firefighter' && e.from) this.gunshot(e.sourceId, e.from); });
    world.events.on('outbreak.bite', e => { if (e.type === 'outbreak.bite') this.bitten(e.targetId); });
    world.events.on('civilian.turned', e => { if (e.type === 'civilian.turned') this.turned(e.id); });
    world.events.on('outbreak.infection', e => { if (e.type === 'outbreak.infection' && e.phase === 'infected') this.turned(e.entityId); });
  }

  // ---------------------------------------------------------------------------------------------------------- setup
  private schedule(at: Point, facing: Point, kind: CivilianActivity['activity'] = 'look'): CivilianActivity[] {
    return [{ activity: kind, anchor: 'l3/yard', target: at, facing, ticks: 60 * 60 }];
  }
  private officer(at: Point, facing: Point, post: boolean): number {
    const o = this.outbreak(), p = this.snap(at, .35);
    const id = o.spawnPedestrian(p, { role: 'officer', model: 'npc.police-officer', tint: '#2f4858', tier: 'average', schedule: this.schedule(p, facing, post ? 'look' : 'chat') });
    const e = this.world.entities.get(id)!;
    e.civilian!.ally = { ...allyState('officer', p, true), gun: { ...l3.officers.gun }, runSpeed: l3.officers.moveMs };
    e.health = { current: l3.officers.hp, max: l3.officers.hp };
    e.transform.yaw = -Math.atan2(facing.z - p.z, facing.x - p.x);
    return id;
  }
  private spawnOfficers(): void {
    const s = this.s;
    // Six at the posts behind sandbags at the gates; the squad (with the sergeant) by the armory, briefing.
    const posts: [string, Point][] = [['l3-post-1', { x: -128.6, z: -30 }], ['l3-post-2', { x: -118, z: -3 }], ['l3-post-3', { x: -118, z: 3 }], ['l3-post-4', { x: -128.6, z: 30 }], ['l3-post-5', { x: -157.6, z: -30 }], ['l3-post-6', { x: -144, z: 30 }]];
    for (const [name, facing] of posts) s.officerIds.push(this.officer(this.anchor(name), facing, true));
    const yard = this.anchor('l3-yard');
    for (let i = 1; i <= l3.officers.squad.size; i++) {
      const id = this.officer(this.anchor(i === 1 ? 'l3-sergeant' : `l3-squad-${i}`), i === 1 ? this.anchor('l3-armory') : yard, false);
      s.officerIds.push(id); s.squadIds.push(id);
    }
  }
  private spawnSoldiers(): void {
    const o = this.outbreak(), zone = this.anchor('l3-zone');
    for (let i = 1; i <= l3.soldiers.count; i++) {
      const p = this.snap(this.anchor(`l3-soldier-${i}`), .35);
      const id = o.spawnPedestrian(p, { role: 'soldier', model: 'npc.national-guard', tint: '#4b5a3a', tier: 'average', schedule: this.schedule(p, { x: 110, z: 0 }) });
      const e = this.world.entities.get(id)!;
      e.civilian!.ally = { ...allyState('soldier', p, true), gun: { ...l4.soldiers.hmg }, weapon: 'hmg', cover: { x: zone.x - 12, z: zone.z }, range: 45, engaged: true };
      e.health = { current: l3.soldiers.hp, max: l3.soldiers.hp }; e.transform.yaw = Math.PI;
      this.s.soldierIds.push(id);
    }
  }
  /** W2/W3 dead bystanders (and a fallen officer on the Boulevard): pedestrians already finished, never targets. */
  private spawnCorpses(): void {
    const o = this.outbreak();
    for (const d of l3Dressing) if (d.entity && d.kind === 'corpse') {
      const p = this.snap({ x: d.x, z: d.z }, .35), id = o.spawnPedestrian(p, { model: d.assetId, yaw: d.yaw, ...(d.assetId === 'npc.police-officer' ? { role: 'officer', tint: '#2f4858' } : {}), schedule: this.schedule(p, p) }), e = this.world.entities.get(id)!;
      e.civilian!.state = 'finished'; e.civilian!.entered = this.world.tick - 600; e.appearance!.handProp = null;
    }
  }
  /** Fires (E27 hazards: flame cards, light pool, smoke column) on the wrecks and deep inside the blocks. They burn all level. */
  private spawnFires(): void {
    for (const d of l3Dressing) if (d.entity && (d.kind === 'fire' || d.kind === 'smoke')) this.world.hazards?.spawn('fire', { x: d.x, z: d.z }, { radius: 1.1 * (d.scale ?? 1), duration: 3600 });
  }
  private spawnMedkits(): void {
    for (const [x, z] of l3.medkits.positions) {
      const p = this.snap({ x, z }, .3), id = this.world.pickups!.spawn('medkit', p);
      const e = this.world.entities.get(id)!; if (e.pickup && 'kind' in e.pickup) e.pickup.amount = l3.medkits.heal;
      this.s.medkitIds.push(id);
    }
  }

  // ---------------------------------------------------------------------------------------------------------- beats
  completed(id: string): void {
    if (!this.mission.state.l3) return;
    if (id === 'armory') this.takeHandgun();
    // Cheat/test completion of the defense (E12-AC07 walk): the fallback is what ends it.
    if (id === 'defend' && !this.s.fallbackAt) { if (!this.s.attackAt) this.startAttack(); this.fallback('time'); }
  }
  /** The handgun joins the carried weapons (RIGHT rack) and is selected: no magazine, no reload, the fire rate is the limit. */
  private takeHandgun(): void {
    const combat = this.world.combat, s = this.s; if (!combat || s.handgunAt) return;
    s.handgunAt = Math.max(1, this.world.tick);
    const left = combat.runner.loadout.state.LEFT.rack.map(r => r.id), right = combat.runner.loadout.state.RIGHT.rack.map(r => r.id).filter(id => id !== 'weapon.handgun');
    combat.setLoadout(left, ['weapon.handgun', ...right].slice(0, Math.max(2, combat.rackCapacity)));
    combat.runner.loadout.state.selectedSide = 'RIGHT';
    this.world.events.emit({ type: 'pickup.collected', tick: this.world.tick, sourceId: 1, pickupId: 0, side: 'RIGHT', actionId: 'weapon.handgun', replaced: null });
    this.world.events.emit({ type: 'l3.handgun', tick: this.world.tick });
    this.mission.radio('L3.handgun');
  }
  private startAttack(): void {
    const { world } = this.mission, s = this.s, tick = world.tick;
    s.phase = 'attack'; s.attackAt = tick;
    world.events.emit({ type: 'l3.attack', tick }); this.mission.radio('L3.attack');
    if (!this.mission.state.states.attack) this.mission.setState('attack', true);
    for (const id of s.officerIds) { const a = world.entities.get(id)?.civilian?.ally; if (a) { a.engaged = true; } }
    const scale = world.infected!.director.tier === 'low' ? l3.attack.lowScale : 1;
    for (const [w, wave] of l3.attack.waves.entries()) {
      const n = Math.ceil(wave.count * scale);
      for (let i = 0; i < n; i++) s.waves.push({ id: 0, dir: DIRS[i % 3], at: tick + ticks(wave.atS + Math.floor(i / 3) * l3.attack.staggerS + (i % 3) * .15), wave: w });
    }
    // The S1 wanderers are already out there (out of view, east of the yard).
    this.populate(0);
  }
  /** Emergence points of one attack direction: the river-path end, or building doors on the avenue east of the yard. */
  private sources(dir: Dir): Point[] {
    if (dir === 'river') return [{ x: -163, z: -44 }, { x: -161.5, z: -41.5 }, { x: -164.4, z: -39.5 }, { x: -159.5, z: -43.8 }];
    const z = l3.map.streets[dir];
    return this.doors().filter(d => Math.abs(d.z - z) < 7 && d.x > -116 && d.x < -88);
  }
  private emergeWaves(): void {
    const { world } = this.mission, s = this.s, tick = world.tick, ai = world.infected!;
    for (const q of s.waves) if (!q.id && tick >= q.at) {
      const pts = this.sources(q.dir).filter(p => ai.director.offscreen(p));
      if (!pts.length) continue;
      const p = pts[(q.at + q.wave) % pts.length], id = this.emerge(p);
      if (!id) { if (ai.director.count >= ai.director.cap) break; continue; }
      q.id = id; s.waveIds.push(id); s.wavesSpawned = Math.max(s.wavesSpawned, q.wave + 1);
      ai.rush(id, RUSH[q.dir], tick + ticks(14));
      if (s.waves.filter(w => w.wave === q.wave && w.id).length === 1) world.events.emit({ type: 'l3.wave', tick, wave: q.wave, count: s.waves.filter(w => w.wave === q.wave).length });
    }
  }
  /** An infected comes out of a door: a pedestrian turned in place (same pipeline as L1/L2). Returns the id or 0 at the cap. */
  private emerge(at: Point, home?: Point): number {
    const { world } = this.mission, ai = world.infected!, o = this.outbreak();
    if (ai.director.count >= ai.director.cap || !ai.pool.length) return 0;
    const out = this.snap(at, .45);
    const id = o.spawnPedestrian(out), e = world.entities.get(id)!;
    o.turnNow(e);
    if (!e.infected) return 0;
    if (e.combat) e.combat.staggerUntil = world.tick + 30;
    const brain = e.infected.l1;
    if (brain && home) { brain.homeX = home.x; brain.homeZ = home.z; brain.leashM = l3.density.leashM; }
    return id;
  }
  private insideYard(p: Point): boolean { const y = l3.map.yard; return p.x > y.x0 && p.x < y.x1 && p.z > y.z0 && p.z < y.z1; }
  private checkFallback(): void {
    const { world } = this.mission, s = this.s, tick = world.tick;
    const inside = world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && this.insideYard(e.transform)).length;
    const cause = s.turnedOfficers.length >= l3.attack.fallback.turned ? 'turned' : inside >= l3.attack.fallback.inside ? 'inside' : tick - s.attackAt >= ticks(l3.attack.fallback.defenseS) ? 'time' : '';
    if (cause) this.fallback(cause);
  }
  private fallback(cause: 'time' | 'turned' | 'inside'): void {
    const { world } = this.mission, s = this.s, tick = world.tick, player = world.entities.get(1)!;
    s.phase = 'fallback'; s.fallbackAt = tick; s.fallbackCause = cause;
    // The squad: the living officers designated at the armory (3-4 normally), topped up by the nearest living officers.
    const human = (id: number) => { const e = world.entities.get(id); return !!e?.civilian?.ally && e.health.current > 0 && !e.infection && e.civilian.state !== 'finished'; };
    const squad = s.squadIds.filter(human);
    const others = s.officerIds.filter(id => !squad.includes(id) && human(id)).sort((a, b) => dist(world.entities.get(a)!.transform, player.transform) - dist(world.entities.get(b)!.transform, player.transform));
    while (squad.length < l3.officers.squad.size && others.length) squad.push(others.shift()!);
    const f = l3.officers.squad;
    for (const [slot, id] of squad.entries()) {
      const a = world.entities.get(id)!.civilian!.ally!;
      a.hold = false; a.post = null; a.engaged = true; a.targetId = 0; a.runSpeed = f.moveMs; a.gun = { ...f.gun };
      // Shared allied follower/navigation: all surviving officers can keep pace with the courier.
      a.follow = { targetId: 1, slot, minM: f.minFollowM, maxM: f.maxFollowM, engageM: f.engageM, leashM: f.leashM, moveMs: f.moveMs - slot * f.slowerMs, breakoutUntil: tick + ticks(f.breakoutS) };
      world.entities.get(id)!.civilian!.story = null;
    }
    s.squad = squad.map(id => ({ id, farSince: 0 }));
    world.events.emit({ type: 'l3.fallback', tick, cause, squad: [...squad] });
    this.mission.radio('L3.fallback');
    if (this.mission.state.steps.armory.status === 'active') this.mission.state.steps.armory.status = 'cancelled';
    if (!this.mission.state.states.fallback) this.mission.setState('fallback', true);
    s.furthest = player.transform.x; s.furthestAt = tick;
    this.mission.requestCheckpoint('fallback');
  }
  /** Bites on squad members are losses (they turn or die); a turned station officer counts for the fallback rule. */
  private bitten(id: number): void {
    const s = this.mission.state.l3; if (!s) return;
    if (s.squad.some(m => m.id === id)) this.lose(id, 'bite');
  }
  private turned(id: number): void {
    const s = this.mission.state.l3; if (!s || !s.officerIds.includes(id) || s.turnedOfficers.includes(id)) return;
    s.turnedOfficers.push(id);
  }
  private lose(id: number, cause: 'bite' | 'kill' | 'separated'): void {
    const s = this.s; if (!s.squad.some(m => m.id === id)) return;
    s.squad = s.squad.filter(m => m.id !== id); s.lost.push({ id, cause, tick: this.world.tick });
    const a = this.world.entities.get(id)?.civilian?.ally;
    // A separated officer holds where he is and keeps fighting (no scripted removal, no teleport).
    if (a && cause === 'separated') { delete a.follow; a.hold = true; a.post = { x: this.world.entities.get(id)!.transform.x, z: this.world.entities.get(id)!.transform.z }; }
    this.world.events.emit({ type: 'l3.squad-lost', tick: this.world.tick, id, cause });
    if (!s.squad.length) this.mission.radio('L3.alone');
  }
  private squadUpdate(): void {
    const { world } = this.mission, s = this.s, player = world.entities.get(1)!;
    for (const m of [...s.squad]) {
      const e = world.entities.get(m.id);
      if (!e || e.health.current <= 0 || !e.civilian || e.civilian.state === 'finished') { this.lose(m.id, 'kill'); continue; }
      if (e.infection) continue;
      const a = e.civilian.ally;
      if (!a?.follow) continue;
      // The courier moving on is a regroup order. Do not strand a living officer at his last fight.
      if (player.transform.x > l3.finale.passX && e.transform.x <= l3.finale.passX) {
        a.engaged = false; a.targetId = 0; a.strikeAt = 0;
        a.run = { x: l3.finale.passX + 3, z: (a.follow.slot % 2 ? 1 : -1) * .8 };
        continue;
      }
      const far = dist(e.transform, player.transform) > a.follow.maxM;
      a.engaged = !far;
      if (far) { a.targetId = 0; a.strikeAt = 0; e.civilian.story = null; }
      m.farSince = 0;
    }
  }
  /** Section 5.3: a shot pulls every non-chasing infected within 20 m to the shot position (never to the shooter's live position). */
  private gunshot(sourceId: number, at: Point): void {
    const s = this.mission.state.l3, world = this.world; if (!s || !world.infected) return;
    const last = s.lastShot[sourceId] ?? -Infinity; if (world.tick - last < ticks(l3.gunfire.minGapS)) return;
    s.lastShot[sourceId] = world.tick;
    world.events.emit({ type: 'outbreak.distraction', tick: world.tick, id: 300_000 + world.tick * 64 + (sourceId % 64), kind: 'gunfire', position: { x: at.x, z: at.z }, radius: l3.gunfire.radiusM, until: world.tick + ticks(l3.gunfire.holdS) });
    world.events.emit({ type: 'l3.gunfire', tick: world.tick, sourceId, position: { x: at.x, z: at.z } });
    this.spill(at);
  }
  /**
   * Section 4 beat 6: "side streets spill infected". A shot near a cross-link mouth in segments 2-3 brings a group out of the
   * buildings along that link (out of view, never closer than 18 m) that runs at the shot position (an event position).
   */
  private spill(at: Point): void {
    const { world } = this.mission, s = this.s, ai = world.infected!, seg = l3Segment(at.x), sp = l3.density.spill;
    if (s.phase !== 'corridor' || seg < 1 || seg > 2) return;
    const link = sp.links.find(x => Math.abs(x - at.x) <= sp.nearM); if (link === undefined) return;
    const key = String(link), last = s.spills[key];
    if (last && (last.n >= sp.maxPerLink || world.tick - last.at < ticks(sp.cooldownS))) return;
    s.spills[key] = { n: (last?.n ?? 0) + 1, at: world.tick };
    const player = world.entities.get(1)!.transform;
    const doors = this.doors().filter(d => Math.abs(d.x - link) <= sp.doorM && ai.director.offscreen(d) && dist(d, player) >= 18)
      .sort((a, b) => dist(a, at) - dist(b, at));
    for (let i = 0; i < sp.size[seg - 1] && doors.length; i++) {
      const id = this.emerge(doors[i % doors.length]); if (!id) break;
      s.spillIds.push(id); ai.rush(id, at, world.tick + ticks(14));
    }
  }
  /** Pre-populated wanderers of one segment, planned in groups and emerging at doors near their home once out of view. */
  private populate(segment: number): void {
    const s = this.s; if (s.populated[segment]) return;
    s.populated[segment] = true;
    const doors = this.doors(), scale = this.world.infected!.director.tier === 'low' ? .5 : 1;
    for (const [x, street, size] of l3.density.groups[segment]) {
      const home = this.snap({ x, z: l3.map.streets[street] + (street === 'blvd' ? 0 : 0) }, .5);
      const clusterSize = Math.ceil(size * scale), offsets = [0, -24, -12, 12, 24];
      for (let i = 0; i < Math.ceil(size * scale * l3.density.streetMultiplier); i++) {
        // Five small clusters across the neighbourhood, with breathing room along the walking line.
        const cluster = Math.floor(i / clusterSize);
        const spread = cluster === 0 ? home : this.snap({ x: home.x + offsets[cluster], z: home.z + (i % clusterSize - (clusterSize - 1) / 2) * 1.3 }, .5);
        const near = doors.filter(d => l3Street(d.z) === street).sort((a, b) => dist(a, spread) - dist(b, spread)).slice(0, 2);
        s.pending.push({ id: 0, door: near[i % near.length].name, home: spread, segment, at: 0, streetExtra: cluster > 0 });
      }
    }
    if (segment === 2) this.planHorde();
  }
  /**
   * The segment-3 horde: two packs out of view on different avenues (seeded: never chosen by where the
   * courier is), pursuing east into the army line once she passes the finale entrance. Two of the three avenues carry one, so a street choice is a gamble, not a safe line.
   */
  private planHorde(): void {
    const s = this.s; if (s.hordeStreet) return;
    const streets = ['blvd', 'commerce', 'oak'] as const, skip = Math.floor(new Rng(this.world.seed, 'l3-horde').next() * 3);
    s.hordeStreet = streets[skip];
    const h = l3.density.horde, scale = this.world.infected!.director.tier === 'low' ? .5 : 1, doors = this.doors();
    for (const street of streets.filter((_, i) => i !== skip)) {
      const home = this.snap({ x: h.toX, z: l3.map.streets[street] }, .5), near = doors.filter(d => l3Street(d.z) === street).sort((a, b) => Math.abs(a.x - h.fromX) - Math.abs(b.x - h.fromX)).slice(0, 3);
      for (let i = 0; i < Math.ceil(h.packSize * scale); i++) s.pending.push({ id: 0, door: near[i % near.length].name, home, segment: 2, at: 0, horde: true });
    }
  }
  private emergePending(all = false): void {
    const { world } = this.mission, s = this.s, ai = world.infected!, p = world.entities.get(1)!.transform;
    if (!all && world.tick % 10 !== 0) return;
    // Preserve the original yard hold/cap headroom. The additional street residents emerge after the fallback.
    if (s.phase === 'attack' && s.segmentIds[0].length >= (ai.director.tier === 'low' ? 5 : 10)) return;
    const allowance = s.phase === 'attack' ? Math.min(3, (ai.director.tier === 'low' ? 5 : 10) - s.segmentIds[0].length) : all ? Infinity : 3;
    let spawned = 0;
    for (const q of s.pending as Pending[]) {
      if (q.id !== 0 || spawned >= allowance || (s.phase === 'attack' && q.streetExtra) || (q.horde && p.x < l3.finale.startX + 10)) continue;
      const a = this.anchor(q.door);
      if (!ai.director.offscreen(a) || Math.hypot(a.x - p.x, a.z - p.z) < 25) continue;
      const id = this.emerge(a, q.home);
      if (!id) { if (ai.director.count >= ai.director.cap) break; continue; }
      const e = world.entities.get(id)!; q.id = id; q.at = world.tick; q.x = e.transform.x; q.z = e.transform.z; q.seen = !ai.director.offscreen(e.transform); spawned++;
      if (q.horde) ai.rush(id, q.home, world.tick + ticks(16));
      s.segmentIds[q.segment].push(id);
    }
  }
  /** Section 5.6 forward pressure: a player lingering 20 s behind the furthest progress line gets company from behind. */
  private pressure(): void {
    const { world } = this.mission, s = this.s, tick = world.tick, p = world.entities.get(1)!.transform, ai = world.infected!;
    if (p.x > s.furthest + .5) { s.furthest = p.x; s.furthestAt = tick; s.pressureAt = 0; }
    if (tick - s.furthestAt < ticks(l3.density.pressure.idleS)) return;
    if (s.pressureAt && tick - s.pressureAt < ticks(l3.density.pressure.everyS)) return;
    s.pressureAt = tick;
    const [b0, b1] = l3.density.pressure.behindM, rng = new Rng(world.seed, `l3-pressure:${tick}`);
    const doors = this.doors().filter(d => d.x <= s.furthest - b0 && d.x >= s.furthest - b1 && ai.director.offscreen(d));
    const [n0, n1] = l3.density.pressure.count, n = n0 + Math.floor(rng.next() * (n1 - n0 + 1));
    for (let i = 0; i < n && doors.length; i++) {
      const door = doors[Math.floor(rng.next() * doors.length)], id = this.emerge(door, { x: door.x, z: door.z });
      if (!id) break;
      s.pressureIds.push(id);
      ai.rush(id, { x: s.furthest, z: l3.map.streets[l3Street(door.z)] }, tick + ticks(12));
    }
  }
  /** Infected far behind the furthest line and out of view leave the books when the cap is tight (never a visible removal). */
  private retire(): void {
    const { world } = this.mission, s = this.s, ai = world.infected!;
    // Only while the planned population ahead still waits for slots, or the cap is nearly reached.
    if (world.tick % 30 !== 0 || (ai.director.count < ai.director.cap - 6 && !s.pending.some(q => q.id === 0))) return;
    for (const e of [...ai.active]) {
      if (e.transform.x > s.furthest - l3.density.retireBehindM || !ai.director.offscreen(e.transform) || e.infected?.l1?.mode === 'bite') continue;
      ai.release(e); s.retired++;
    }
  }

  // ---------------------------------------------------------------------------------------------------------- tick
  update(): void {
    const { world, state } = this.mission, s = state.l3; if (!s) return;
    if (this.mercyDue) this.mercy();
    const tick = world.tick, player = world.entities.get(1)!;
    if (s.phase === 'yard') {
      if (tick === ticks(l3.armory.briefingAtS)) this.mission.radio('L3.sergeant');
      if ((s.handgunAt && tick - s.handgunAt >= ticks(l3.armory.attackAfterS)) || tick >= ticks(l3.armory.attackLatestS)) this.startAttack();
    }
    if (s.phase === 'attack') { this.emergeWaves(); this.checkFallback(); }
    if (s.phase !== 'yard') this.emergePending();
    if (s.phase === 'fallback' || s.phase === 'corridor') {
      this.emergeWaves(); this.squadUpdate(); this.pressure(); this.retire(); this.sealYard(); this.finale();
      if (s.phase === 'fallback' && player.transform.x > l3.map.corridor[0]) s.phase = 'corridor';
      // Populate a segment while the player is still well short of it (out of view, ahead of the squad).
      for (let k = 1; k < 3; k++) if (!s.populated[k] && player.transform.x >= l3.map.segments[k][0] - l3.density.populateAheadM) this.populate(k);
      const seg = l3Segment(player.transform.x);
      if (seg > s.segment && seg >= 0) {
        for (let k = Math.max(0, s.segment); k < seg; k++) s.segmentSquad[k] = s.squad.length;
        s.segment = seg; world.events.emit({ type: 'l3.segment', tick, segment: seg, squad: s.squad.length });
        if (seg === 1) this.mission.radio('L3.dispatch');
      }
      // Segment checkpoints (PO 10-09: plus one mid-way in segments 2 and 3, so a death costs a stretch, not the whole segment).
      for (const [id, x] of Object.entries(l3.checkpointAt)) if (player.transform.x >= x && !s.cpSeen?.includes(id)) { (s.cpSeen ??= []).push(id); (s.cpWait ??= []).push(id); }
      this.calmCheckpoint(player);
      this.zone(tick, player);
    }
    // L3 infected (turned adults in the open) hit as hard as L2's (section 5.1 tuning).
    if (tick % 15 === 0) for (const e of world.infected!.active) if (e.combat && e.health.current > 0 && e.combat.damageMultiplier === 1) e.combat.damageMultiplier = l3.infectedDamage;
  }
  /**
   * PO 10-09: a checkpoint taken with a crowd on the courier's heels or at low health respawns the courier into the same fight
   * (death loops of 15+ on one spot). The segment checkpoints wait for a calm moment: nothing alive within 10 m and health >= 70 %.
   */
  private calmCheckpoint(player: EntitySnapshot): void {
    const s = this.s, w = this.world; if (!s.cpWait?.length || w.tick % 10 !== 0) return;
    const p = player.transform;
    if (player.health.current < player.health.max * .7 || w.infected!.active.some(e => e.health.current > 0 && dist(e.transform, p) < 10)) return;
    for (const id of s.cpWait) this.mission.requestCheckpoint(id);
    s.cpWait = [];
  }
  private boom?: ArmyCheckpointBoom;
  private barrier(closed: boolean): void {
    this.boom ??= new ArmyCheckpointBoom(this.world, l3.finale.barrierX);
    this.boom.set(closed);
  }
  private finale(): void {
    const s = this.s, w = this.world, p = w.entities.get(1)!.transform, f = l3.finale;
    if (p.x < f.startX) return;
    s.finalePacks ??= []; s.finaleIds ??= [];
    // Trigger on each avenue. Pursuers appear behind/alongside, leaving the army line as the escape.
    for (const [index, [x, authored]] of f.packs.entries()) {
      const count = Math.ceil(authored * (1 - this.mercyFraction()));
      if (p.x < x || (s.finalePacks[index] ?? 0) >= count) continue;
      const doors = this.doors().filter(d => Math.abs(d.x - (x - 15)) < 20 && w.infected!.director.offscreen(d) && dist(d, p) > 12)
        .sort((a, b) => dist(a, p) - dist(b, p));
      if (!doors.length) continue;
      let n = 0;
      for (let i = 0; i < Math.min(3, count - (s.finalePacks[index] ?? 0)) && doors.length; i++) {
        const id = this.emerge(doors[i % doors.length]); if (!id) break;
        s.finaleIds.push(id); n++;
        w.infected!.rush(id, { x: Math.min(136, p.x + 22), z: p.z }, w.tick + ticks(f.chaseS));
      }
      s.finalePacks[index] = (s.finalePacks[index] ?? 0) + n;
    }
    this.boom ??= new ArmyCheckpointBoom(w, f.barrierX);
    if (!s.barrierClosedAt && this.boom.ready([1, ...s.squad.map(m => m.id)])) {
      s.barrierClosedAt = w.tick; this.barrier(true);
      w.events.emit({ type: 'gate.changed', tick: w.tick, id: 'l3-army-boom', open: false });
    }
  }
  private inZone(p: Point): boolean { return p.x >= l3.map.zoneX && p.z >= l3.map.zoneZ[0] && p.z <= l3.map.zoneZ[1]; }
  private zone(tick: number, player: EntitySnapshot): void {
    const s = this.s;
    if (!s.crossedAt && player.health.current > 0 && this.inZone(player.transform)) {
      s.crossedAt = tick; s.segmentSquad[2] ??= s.squad.length;
      this.world.events.emit({ type: 'l3.crossed', tick }); this.mission.radio('L3.army');
    }
    if (s.crossedAt && s.barrierClosedAt && !s.doneAt && tick - s.barrierClosedAt >= ticks(l3.finale.closeS)) { s.doneAt = tick; s.phase = 'done'; if (!this.mission.state.states.crossed) this.mission.setState('crossed', true); }
  }

  /** Cheat/test path (`completeObjective` in a gap without an active objective): start the attack, or call the fallback. */
  advance(): boolean {
    const s = this.mission.state.l3; if (!s) return false;
    if (s.phase === 'yard') { this.startAttack(); return true; }
    if (s.phase === 'attack') { this.fallback('time'); return true; }
    return false;
  }
  /** Checkpoint restore: shift the timeline. Entities (officers, squad, infected, pickups) come back from the snapshot. */
  /** Death-loop relief (data: `l3.mercy`), applied on the first tick after a respawn. */
  private mercyDue = false;
  /** Respawns per checkpoint (a death loop is several deaths at the same checkpoint, not the level's death total). */
  private readonly respawns: Record<string, number> = {};
  private mercyFraction(): number {
    const m = l3.mercy;
    return Math.max(0, Math.min(m.maxFrac, m.stepFrac * ((this.respawns[this.mission.state.checkpoint ?? 'start'] ?? 0) - m.fromDeaths + 1)));
  }
  private mercy(): void {
    this.mercyDue = false;
    const { world } = this.mission, s = this.s, m = l3.mercy, ai = world.infected;
    const frac = this.mercyFraction(); if (frac <= 0 || !ai || (s.phase !== 'corridor' && s.phase !== 'fallback')) return;
    const p = world.entities.get(1)!.transform, [a, b] = m.aheadM, ahead = (x: number) => x > p.x + a && x < p.x + b;
    const thin = <T>(items: T[], remove: (item: T) => void) => items.forEach((item, i) => { if (Math.floor((i + 1) * frac) > Math.floor(i * frac)) remove(item); });
    thin([...ai.active].filter(e => e.health.current > 0 && ahead(e.transform.x)).sort((x, y) => x.id - y.id), e => ai.release(e));
    const waiting = (s.pending as Pending[]).filter(q => q.id === 0 && ahead(q.home.x));
    thin(waiting, q => { s.pending.splice(s.pending.indexOf(q), 1); });
  }
  restore(delta: number): void {
    const s = this.mission.state.l3; if (!s) return;
    this.mercyDue = true; { const id = this.mission.state.checkpoint ?? 'start'; this.respawns[id] = (this.respawns[id] ?? 0) + 1; }
    for (const key of ['handgunAt', 'attackAt', 'fallbackAt', 'crossedAt', 'doneAt', 'furthestAt', 'pressureAt'] as const) if (s[key]) s[key] += delta;
    for (const w of s.waves) if (w.at) w.at += delta;
    for (const q of s.pending) if (q.at) q.at += delta;
    for (const m of s.squad) if (m.farSince) m.farSince += delta;
    for (const k of Object.keys(s.lastShot)) s.lastShot[Number(k)] += delta;
    for (const v of Object.values(s.spills)) v.at += delta;
    if (s.gatesClosedAt) s.gatesClosedAt += delta;
    if (s.barrierClosedAt) s.barrierClosedAt += delta;
    this.barrier(!!s.barrierClosedAt);
    for (const id of Object.keys(L3_GATES)) {
      const handle = this.walls.get(id); if (handle !== undefined) { this.world.physics.removeBlocker(handle); this.walls.delete(id); }
      if (s.gatesClosedAt) this.wall(id, true); else this.world.events.emit({ type: 'world.blocker.changed', tick: this.world.tick, id: 900_400 + Object.keys(L3_GATES).indexOf(id), blocked: false, wall: L3_GATES[id] });
    }
  }
}
