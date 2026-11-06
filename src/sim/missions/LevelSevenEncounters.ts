import { readyCarriedAlly } from '../outbreak/Allies';
import { Outbreak } from '../outbreak/Outbreak';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { Point } from '../npc/types';
import { l7Encounters } from '../../data/l7';
import { corpseDetour, formationBack, formationSlot, leaderHeading, requireClearPoint } from './missionHelpers';
import { NavGrid } from '../ai/NavGrid';
import { actorRadius, solidLargeCorpse } from '../world/SolidRegistry';

export interface L7EncounterState {
  started: boolean;
  roster: { id: number; key: string; injured: boolean; status: 'following' | 'dead' | 'turned'; passed: boolean }[];
  arrivals: { id: number; group: number; alpha: boolean; tick: number; x: number; z: number; offscreen: boolean; safe: boolean }[];
  finalReady: boolean;
  passageReady: boolean;
  waitAt: number;
  alarm?: { key: string; id: number; x: number; z: number; text: string; until: number; kind: 'wait' | 'attack' | 'lost' };
}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
/** L7-E1 owns population and physical group passage. Boarding/departure is owned by L7-E2. */
export class LevelSevenEncounters {
  state: L7EncounterState = { started: false, roster: [], arrivals: [], finalReady: false, passageReady: false, waitAt: 0 };
  private prepared = false;
  private readonly seen = new Set<number>();
  private readonly waypoint = { x: 0, z: 0 };
  private readonly approaches = new Map<number, { x: number; z: number; at: number; around?: Point[] }>();
  private readonly pocketRoutes = new Map<number, { revision: number; points: Point[] }>();
  constructor(private readonly world: SimWorld, private readonly carried?: readonly EntitySnapshot[]) {
    world.events.on('infected.attack', event => {
      if (event.type !== 'infected.attack') return;
      const follower = world.entities.get(event.targetId);
      if (follower && this.state.roster.some(r => r.id === follower.id && r.status === 'following') && !world.infected!.director.inFrame(follower.transform)) this.warn(follower, 'attack');
    });
  }
  private warn(e: EntitySnapshot, kind: 'wait' | 'attack' | 'lost'): void {
    const w = this.world, current = this.state.alarm;
    // A repeated windup keeps its warning visible without producing a bark
    // every tick. Loss always replaces an earlier wait/attack warning.
    if (current && w.tick < current.until && (current.kind === 'lost' || current.kind === kind)) return;
    if (kind === 'wait' && current && w.tick < current.until) return;
    this.state.alarm = { key: `l7-${e.id}-${w.tick}`, id: e.id, x: e.transform.x, z: e.transform.z, kind,
      text: kind === 'lost' ? 'Survivor lost behind you!' : kind === 'attack' ? 'Survivor under attack! Turn back!' : 'Wait for us! Stay with the group.', until: w.tick + 300 };
    w.events.emit({ type: 'l7.follower-alarm', tick: w.tick, id: e.id, kind, position: { x: e.transform.x, z: e.transform.z } });
  }
  /** Called after campaign application; an explicit empty roster remains empty. */
  prepare(carried?: readonly EntitySnapshot[]): void {
    if (this.prepared) return;
    this.prepared = true;
    const w = this.world, ai = w.infected!, director = ai.director;
    director.levelCap = 200; director.strict = true; director.ambientTarget = 0; director.reserved = 0; director.pendingTurns = 0;
    w.npcs!.setAmbient(0);
    const outbreak = w.npcs!.civilians.outbreak ?? new Outbreak(w, { refuges: [], tier: director.tier });
    w.npcs!.civilians.outbreak = outbreak;
    // Outbreak initialization can configure the shared director; the level owns its cap.
    director.levelCap = 200; director.strict = true;
    const roster = carried ?? this.carried ?? w.progression?.campaign?.results?.L6?.escapedSurvivors;
    // Quality thins infected, never the community that escaped L6. Standalone
    // entries have the same 24-person shelter group on every quality/path.
    const count = roster?.length ?? 24;
    const leader = w.entities.get(1)!.transform;
    // Form behind the escape direction, not the courier's briefing pose
    // facing the launcher. Otherwise the whole party crosses itself on departure.
    const road = l7Encounters.streets[0], heading = leaderHeading(-Math.atan2(road.z - leader.z, road.x - leader.x));
    for (let slot = 0; slot < count; slot++) {
      const source = roster?.[slot];
      if (source && (source.health.current <= 0 || source.infected || source.infection)) continue;
      // Leave the three-metre approach to the launcher clear of the party.
      const at = this.clearPoint(formationSlot({ x: leader.x + 4, z: leader.z }, heading, slot), .4);
      const e = source ? structuredClone(source) : w.entities.get(outbreak.spawnPedestrian(at, { model: slot % 2 ? 'npc.civilian-man-b.aftermath' : 'npc.civilian-woman-b.aftermath', role: 'cashier' }))!;
      if (source) {
        if (w.entities.get(e.id)) throw new Error(`L7 incoming survivor id collision: ${e.id}`);
        w.entities.replace(e);
      }
      Object.assign(e.transform, { ...at, y: w.districts!.groundHeight(at.x, at.z) + .7 });
      e.hidden = false;
      e.health.current = e.health.max;
      const c = e.civilian!;
      readyCarriedAlly(e, w.tick);
      delete c.floorY; c.story = null; c.path.length = 0; c.goal = -1; c.pauseUntil = 0; c.state = 'calm';
      c.entered = w.tick; c.until = 0; c.knockedUntil = 0;
      if (e.combat) { e.combat.staggerUntil = 0; e.combat.attacking = false; delete e.combat.reaction; }
      if (c.l1) c.l1.target = null;
      // Armed shelter residents travel with the group rather than holding their old underground post.
      const key = c.survivor?.key ?? `shelter-${slot}`;
      // Ordinary pedestrians also stroll below 1.4 m/s. Their routine pace is
      // not an injury; preserve L6's story flag through the campaign handover.
      // Older L6 saves predate that flag but retain the authored shelter slot.
      const shelter = source?.civilian?.survivor;
      const injured = shelter?.injured ?? (shelter?.leader === 0
        ? shelter.slot > 0 && shelter.slot % 5 === 0 && key !== 'rosa'
        : source?.civilian?.l1?.walkSpeed === 1.4);
      c.survivor = { key, mode: 'follow', slot, leader: 1, cover: false, ...(source ? { injured } : {}), waitAt: 0, foundAt: w.tick };
      this.state.roster.push({ id: e.id, key, injured, status: 'following', passed: false });
      w.solids.admit(e, 'l7.roster.arrival');
    }
    // Residents are already standing in the city when the level becomes
    // playable. Deferring the nearest group through the offscreen spawn gate
    // admitted it one victim at a time at rocket range and removed all contact.
    const low = director.tier === 'low';
    this.group(l7Encounters.finalGroup, l7Encounters.horde, low ? 60 : 120, 2, true);
    this.group(l7Encounters.firstStreetGroup, l7Encounters.streets[0], low ? 35 : 70, 1, true);
  }
  private clearPoint(at: Point, radius: number): Point {
    return requireClearPoint(this.world, at, radius, 4, 'L7 encounter');
  }
  private group(group: number, centre: Point, count: number, alphas: number, resident = false): void {
    const ai = this.world.infected!;
    const admit = resident ? ai.spawn.bind(ai) : ai.director.request.bind(ai.director);
    for (let i = 0; i < alphas; i++) {
      const at = group === l7Encounters.finalGroup
        ? i ? { x: -43, z: 41.7 } : { x: -64, z: 50 }
        : { x: centre.x, z: centre.z + (i ? 3 : -3) };
      admit('infected.alpha', this.clearPoint(at, .55), { pack: group, state: 'idle', yaw: Math.PI });
    }
    // Only the final horde spans the wide corridor. Street packs stay on the
    // road; the wide rows put Lakeshore residents behind frontage obstacles.
    const rows = Math.ceil(count / 10), rowGap = group === l7Encounters.finalGroup ? Math.min(4, 20 / Math.max(1, rows - 1)) : 1.3;
    for (let i = 0; i < count; i++) {
      // Spread along the road so one rocket cannot erase a whole compact row
      // before its unhit neighbours have time to approach from the flanks.
      let p = { x: centre.x + (i % 10 - 4.5) * 2.8, z: centre.z + (Math.floor(i / 10) - (rows - 1) / 2) * rowGap };
      if (group === l7Encounters.firstStreetGroup) {
        // fix69-r (L7-05/G-13): a 25 m column along the road reached from the launcher into the forming party, so a group
        // following a courier who walks on was dragged through the whole pack. A close cluster (4 low / 5 high) waits on
        // both kerbs just west of the pickup, clear of the party's middle lane, for the first contact; the rest stands on
        // both verges ahead of the courier, ranks stepping back west. Arming sends only the verge ranks at her.
        const close = ai.director.tier === 'low' ? 4 : 5, j = i - close;
        p = j < 0 ? { x: centre.x + 4 - (i >> 1) * 1.4, z: centre.z + (i % 2 ? 1 : -1) * 5.5 }
          : { x: centre.x - Math.floor(j / 10) * 1.6, z: centre.z + (j % 2 ? 1 : -1) * (5 + (j % 10 >> 1) * 1.8) };
      } else if (ai.director.tier === 'low' && group !== l7Encounters.finalGroup && centre.x > 90) {
        const row = Math.floor(i / 10);
        // The broad Northgate road has two clear verges. Keep the existing
        // low roster on three approaches rather than one rocket-sized lane.
        p.z = centre.z + [-.8, -6.5, 6.5, .8][row];
      }
      // A ruined frontage may hide a cell; search locally rather than putting a figure in its mesh.
      admit('infected.runner', this.clearPoint(p, .35), { pack: group, state: 'idle', yaw: Math.PI });
    }
  }
  start(): void {
    this.prepare();
    if (this.state.started) return;
    this.state.started = true;
    this.world.events.emit({ type: 'mission.signal', tick: this.world.tick, name: 'l7.armed' });
    // fix69-r (L7-05): arming (the launcher pickup) sets the opening verge ranks on the courier, so they close in within
    // seconds instead of waiting for their idle leash. The close cluster east of the anchor keeps its own native notice;
    // pressing it too drove it through the following party.
    for (const e of this.world.infected!.active) if (e.infected!.pack === l7Encounters.firstStreetGroup && e.transform.x <= l7Encounters.streets[0].x + 2) this.world.infected!.press(e.id, 1, this.world.tick + 20 * 60);
    const low = this.world.infected!.director.tier === 'low';
    // Final horde is present before approach. Its Alphas get slots before ordinary queued arrivals.
    const streetCount = low ? 140 : 280;
    l7Encounters.streets.slice(1).forEach((p, i) => this.group(l7Encounters.firstStreetGroup + i + 1, p, streetCount / 4, i !== 1 ? 1 : 0));
  }
  /** Run before AI so external explosion fixtures and combat ticks share the same active-pool cap. */
  reserveSlots(): void {
    const ai = this.world.infected!;
    const turning = this.state.roster.reduce((n, r) => n + (this.world.entities.get(r.id)?.infection ? 1 : 0), 0);
    ai.director.reserved = Math.max(0, ai.active.length - ai.director.count);
    ai.director.pendingTurns = turning;
  }
  update(): void {
    this.prepare();
    const w = this.world, s = this.state, ai = w.infected!;
    const speaker = s.alarm && w.entities.get(s.alarm.id);
    if (speaker && s.alarm && s.alarm.kind !== 'lost') { s.alarm.x = speaker.transform.x; s.alarm.z = speaker.transform.z; }
    this.reserveSlots();
    if (!s.started && w.combat!.runner.loadout.activeEntries().some(e => e.id === 'weapon.rocket-launcher')) this.start();
    for (const e of ai.active) if (e.infected!.pack >= l7Encounters.finalGroup && e.infected!.pack <= l7Encounters.firstStreetGroup + 3 && !this.seen.has(e.id)) {
      this.seen.add(e.id);
      // Idle residents stay on their authored block until a human or noise
      // starts a pursuit. The shared unrestricted wander can cross half the
      // district during the approach and leave the final corridor empty.
      const brain = e.infected!.l1;
      if (brain) brain.leashM = 5;
      s.arrivals.push({ id: e.id, group: e.infected!.pack, alpha: e.archetype === 'infected.alpha', tick: w.tick, x: e.transform.x, z: e.transform.z, offscreen: ai.director.offscreen(e.transform), safe: ai.director.safe(e.archetype, e.transform) });
    }
    const finals = s.finalReady ? [] : s.arrivals.filter(a => a.group === l7Encounters.finalGroup);
    s.finalReady ||= finals.filter(a => !a.alpha).length >= (ai.director.tier === 'low' ? 60 : 120) && finals.filter(a => a.alpha).length >= 2;
    for (const r of s.roster) {
      const e = w.entities.get(r.id);
      if (r.status !== 'following') continue;
      if (!e || e.health.current <= 0 || e.civilian?.state === 'finished') r.status = 'dead';
      else if (e.infected || e.infection) r.status = 'turned';
      else if (e.transform.x <= l7Encounters.passage.x && Math.abs(e.transform.z - l7Encounters.passage.z) < 7) r.passed = true;
      if (r.status !== 'following') {
        if (e && !ai.director.inFrame(e.transform)) this.warn(e, 'lost');
        w.events.emit({ type: 'mission.signal', tick: w.tick, name: `l7.survivor-${r.status}`, actorId: r.id });
      }
    }
    const p = w.entities.get(1)!.transform;
    // The crowd already builds this field above twenty infected. Keep it
    // available for distant followers after the fighting has thinned out too.
    if (ai.active.length <= 20 && s.roster.some(r => r.status === 'following' && distance(w.entities.get(r.id)!.transform, p) > 30)) ai.nav.flow(p.x, p.z, 1500);
    s.passageReady = s.finalReady && p.x <= l7Encounters.passage.x && Math.abs(p.z - l7Encounters.passage.z) < 7 && s.roster.every(r => r.status !== 'following' || r.passed);
    const m=w.missions;
    if(m?.state.steps.corridor?.status==='active'){
      const entrances=['l7-corridor-east','l7-corridor-west'];
      m.state.marker='l7-corridor-east';
      const arrived=entrances.some(name=>{const a=m.def.anchors[name];return distance(p,a)<=a.radius;});
      m.setState('corridor-group',arrived&&this.corridorGroup().missing.length===0);
    }
  }
  /** Eighteen metres covers the three-column formation while requiring every living member to accompany the courier. */
  corridorGroup(){
    const p=this.world.entities.get(1)!.transform,live=this.state.roster.filter(r=>r.status==='following');
    const missing=live.filter(r=>distance(this.world.entities.get(r.id)!.transform,p)>18);
    return {total:live.length,near:live.length-missing.length,missing};
  }
  follower(e: EntitySnapshot): boolean {
    const r = this.state.roster.find(r => r.id === e.id);
    if (!r || r.status !== 'following') return false;
    if (this.world.l7Departure?.claims(e)) return true;
    const w = this.world, p = w.entities.get(1)!, c = e.civilian!, s = c.survivor!;
    s.briskAt = w.tick;
    c.state = 'calm'; c.story = null; s.cover = false;
    if (this.walkPocketRoute(e)) return true;
    const d = distance(e.transform, p.transform), slot = s.slot, v = p.survivor!.velocity;
    // Three columns keep a 35-person group inside the street. Nav collapses it through the actual opening.
    const goal = this.state.started ? formationSlot(p.transform, leaderHeading(p.transform.yaw, v), slot)
      : formationSlot({ x: p.transform.x + 4, z: p.transform.z }, { x: -1, z: 0 }, slot);
    // Reuse the L5 formation rule around cover: a clear slot across a wreck
    // can still send one follower around its far side at every corner.
    const nav = w.infected!.nav;
    // In the final approach the large formation must not double back into the
    // narrow opening as the courier turns toward the bus.
    const ahead = w.missions!.state.steps.departure?.status !== 'active' || Math.hypot(v.x, v.z) <= .8 || (goal.x - e.transform.x) * v.x + (goal.z - e.transform.z) * v.z >= 0;
    const target = ahead && nav.clear(goal.x, goal.z, .35) && nav.visible(e.transform, goal, .35) && nav.visible(goal, p.transform, .35) ? goal : p.transform;
    if (d > formationBack(slot) + 10 && w.tick >= this.state.waitAt) {
      this.state.waitAt = w.tick + 300;
      this.warn(e, 'wait');
    }
    if (distance(e.transform, target) > .6) {
      // Reuse the crowd's connected route across the city. Until that field
      // reaches a follower, short searches fit the shared A* scratch budget.
      let destination = target;
      if (d > 30) {
        const nav = w.infected!.nav;
        const cell = nav.nearestCell(e.transform.x, e.transform.z, .35);
        let next = nav.flowNext(cell);
        if (next >= 0 && next !== cell) {
          // A straight eight-metre goal can land inside a building and snap
          // back to this same wall forever. Follow the connected crowd route.
          for (let i = 0; i < 7; i++) next = nav.flowNext(next);
          this.waypoint.x = nav.x(next); this.waypoint.z = nav.z(next);
          c.l1!.target = null; destination = this.waypoint;
        } else {
          if (!c.l1!.target || distance(e.transform, c.l1!.target) <= .6) {
            if ((w.tick + e.id) % 30 !== 0) return true;
            const length = distance(e.transform, target);
            const local = { x: e.transform.x + (target.x - e.transform.x) * 8 / length, z: e.transform.z + (target.z - e.transform.z) * 8 / length };
            const budget = w.infected!.director.tier === 'low' ? 200 : 400;
            if (!nav.steer(e.transform, local, c, .35, this.waypoint, budget)) { this.escapePocket(e); return true; }
            const cell = nav.nearestCell(local.x, local.z, .35);
            c.l1!.target = { x: nav.x(cell), z: nav.z(cell) };
          }
          destination = c.l1!.target;
        }
      } else c.l1!.target = null;
      let approach = this.approaches.get(e.id);
      if (!approach) { approach = { x: e.transform.x, z: e.transform.z, at: w.tick }; this.approaches.set(e.id, approach); }
      if (distance(e.transform, approach) > .05) { approach.x = e.transform.x; approach.z = e.transform.z; approach.at = w.tick; }
      if (approach.around && distance(e.transform, approach.around[0]) < .15) approach.around.shift();
      if (!approach.around?.length) delete approach.around;
      // The pre-boarding corridor wait has no recovery timer. Use the bus
      // approach's swept corpse detour here too, so a dead Alpha cannot hold
      // the whole group at the corridor objective indefinitely.
      if (!approach.around && w.tick - approach.at >= 30 && (w.tick + e.id) % 15 === 0) approach.around = corpseDetour(w, e, destination);
      if (approach.around) destination = approach.around[0];
      // Injury remains visible in the carried story state; it must not turn
      // one evacuee into a straggler the player has to babysit.
      // Every slot has the same catch-up speed through street corners.
      const budget = d > 30 ? w.infected!.director.tier === 'low' ? 200 : 400 : 1600;
      w.npcs!.move(e, destination, 5.2, c, 0, budget);
    }
    w.spatial.set(e.id, e.transform.x, e.transform.z);
    return true;
  }
  /** Rounded physical bodies can be separated into a gap the conservative
   * crowd bake closes. Find a short real walk back to the connected flow,
   * retaining every collider and the follower's complete capsule footprint. */
  private escapePocket(e: EntitySnapshot): void {
    const w = this.world, nav = w.infected!.nav, radius = actorRadius(e) + .01, origin = e.transform;
    const grid = new NavGrid({ width: 12, depth: 12 }, [], 0, { x: origin.x, z: origin.z }, null, .1);
    const bodies = [...w.entities.iterate()].filter(body => !body.hidden && solidLargeCorpse(body) && Math.abs(body.transform.y - origin.y) < 1.2);
    for (let cell = 0; cell < grid.blocked.length; cell++) {
      const x = grid.x(cell), z = grid.z(cell), y = w.districts!.groundHeight(x, z) + .7;
      grid.blocked[cell] = Number(!nav.contains(x, z, radius) || Math.abs(y - origin.y) > .45 || !w.solids.clear({ x, y, z }, radius, e.id, false) || bodies.some(body => Math.hypot(x - body.transform.x, z - body.transform.z) < radius + actorRadius(body)));
    }
    const from = grid.nearestCell(origin.x, origin.z), reached = grid.reachableFrom(from);
    let best = -1, score = Infinity;
    for (let cell = 0; cell < reached.length; cell++) {
      if (!reached[cell]) continue;
      const x = grid.x(cell), z = grid.z(cell), global = nav.cell(x, z);
      if (global < 0 || nav.blocked[global] || nav.distance[global] < 0) continue;
      const rank = Math.hypot(x - origin.x, z - origin.z) + nav.distance[global] * .001;
      if (rank < score) { score = rank; best = cell; }
    }
    const path: number[] = [];
    if (best < 0 || !grid.path(from, best, path, Infinity)) return;
    path.unshift(from);
    this.pocketRoutes.set(e.id, { revision: nav.revision, points: path.map(cell => ({ x: grid.x(cell), z: grid.z(cell) })) });
    e.civilian!.path.length = 0; e.civilian!.goal = -1; e.civilian!.l1!.target = null;
    this.walkPocketRoute(e);
  }
  private walkPocketRoute(e: EntitySnapshot): boolean {
    const route = this.pocketRoutes.get(e.id); if (!route) return false;
    const w = this.world;
    if (route.revision !== w.infected!.nav.revision) { this.pocketRoutes.delete(e.id); return false; }
    while (route.points.length && distance(e.transform, route.points[0]) < .00001) route.points.shift();
    if (!route.points.length) { this.pocketRoutes.delete(e.id); this.approaches.delete(e.id); return false; }
    const target = route.points[0], dx = target.x - e.transform.x, dz = target.z - e.transform.z, length = Math.hypot(dx, dz);
    const direction = { x: dx / length, z: dz / length };
    const wanted = Math.min(length, 5.2 / 60), radius = actorRadius(e);
    // Static sweeps use square-expanded boxes. Sample the rounded physical
    // footprint with 1 cm extra clearance at <=1 cm intervals: every point
    // between samples is therefore clear for the complete original radius.
    let step = 0;
    const samples = Math.ceil(wanted / .01);
    for (let i = 1; i <= samples; i++) {
      const next = wanted * i / samples;
      const point = { x: e.transform.x + direction.x * next, z: e.transform.z + direction.z * next, y: e.transform.y };
      if (!w.solids.clear(point, radius + .01, e.id)) {
        // An actor already touching a flat face can first leave that face
        // through the ordinary conservative sweep before gaining the margin.
        step = Math.max(step, w.solids.sweep(e, direction, wanted));
        break;
      }
      step = next;
    }
    // This is continuous, swept locomotion, including the tight rounded
    // corners that the square-margin route grid cannot represent.
    w.solids.wrote(e, 'l7.pocket-walk'); delete e.locomotion;
    e.transform.x += direction.x * step; e.transform.z += direction.z * step;
    e.transform.yaw = -Math.atan2(dz, dx); w.spatial.set(e.id, e.transform.x, e.transform.z);
    return true;
  }
  snapshot() {
    return { state: structuredClone(this.state), prepared: this.prepared, queue: structuredClone(this.world.infected!.director.queue), seen: [...this.seen], tick: this.world.tick };
  }
  restore(saved: unknown): void {
    const record = saved as ReturnType<LevelSevenEncounters['snapshot']>;
    this.state = structuredClone(record.state); this.prepared = record.prepared;
    this.approaches.clear();
    this.pocketRoutes.clear();
    this.state.waitAt += this.world.tick - record.tick;
    if (this.state.alarm) this.state.alarm.until += this.world.tick - record.tick;
    this.seen.clear(); for (const id of record.seen) this.seen.add(id);
    const director = this.world.infected!.director;
    director.queue.splice(0, director.queue.length, ...structuredClone(record.queue));
    director.levelCap = 200; director.strict = true; director.ambientTarget = 0;
    this.reserveSlots();
  }
}
