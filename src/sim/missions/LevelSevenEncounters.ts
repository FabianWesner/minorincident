import { readyCarriedAlly } from '../outbreak/Allies';
import { Outbreak } from '../outbreak/Outbreak';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { Point } from '../npc/types';
import { l7Encounters, l7Rocket } from '../../data/l7';
import { corpseDetour, formationBack, formationSlot, leaderHeading, requireClearPoint, snapToClear } from './missionHelpers';
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
/** Eighteen metres covers the three-column formation (corridor group check and straggler warnings). */
const l7FollowerRangeM = 18;
/** L7-E1 owns population and physical group passage. Boarding/departure is owned by L7-E2. */
export class LevelSevenEncounters {
  state: L7EncounterState = { started: false, roster: [], arrivals: [], finalReady: false, passageReady: false, waitAt: 0 };
  private launcherId = 0;
  private prepared = false;
  private readonly seen = new Set<number>();
  private readonly waypoint = { x: 0, z: 0 };
  private readonly approaches = new Map<number, { x: number; z: number; at: number; around?: Point[] }>();
  private readonly pocketRoutes = new Map<number, { revision: number; points: Point[] }>();
  private corpseRoutes?: { source: NavGrid; revision: number; bodies: string; nav: NavGrid };
  private routeTick = -1;
  private routeNav?: NavGrid;
  private readonly trail: Point[] = [];
  constructor(private readonly world: SimWorld, private readonly carried?: readonly EntitySnapshot[]) {
    world.events.on('infected.attack', event => {
      if (event.type !== 'infected.attack') return;
      const follower = world.entities.get(event.targetId);
      if (follower && this.state.roster.some(r => r.id === follower.id && r.status === 'following') && this.behind(follower)) this.warn(follower, 'attack');
    });
  }
  private launcher(): EntitySnapshot | undefined {
    if (!this.launcherId) {
      const pickup = [...this.world.entities.iterate()].find(item => item.pickup && 'actionId' in item.pickup && item.pickup.actionId === l7Rocket.action);
      this.launcherId = pickup?.id ?? 0;
    }
    return this.launcherId ? this.world.entities.get(this.launcherId) : undefined;
  }
  /** r5-l7 (vqa58): "behind you" only for an evacuee who really is away from the courier's group (the 18 m corridor
   * group range) and off screen. A loss inside the column next to her is not a straggler, even off a close-zoom frame. */
  private behind(e: EntitySnapshot): boolean {
    const p = this.world.entities.get(1)!.transform;
    return distance(e.transform, p) > l7FollowerRangeM && !this.world.infected!.director.inFrame(e.transform);
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
    // The initial column already occupies the road behind the exit. Seed that
    // line so an aiming turn during pickup cannot sweep its tail into a kerb.
    for (let back = Math.max(20, formationBack(count - 1) + 3.5); back > 0; back -= .4) this.trail.push({ x: leader.x - heading.x * back, z: leader.z - heading.z * back });
    this.trail.push({ x: leader.x, z: leader.z });
    // The launcher is three metres behind the courier along this heading.
    // Stage the column beyond its two-metre objective ring, with room for a body.
    const formation = { x: leader.x - heading.x * 3.5, z: leader.z - heading.z * 3.5 };
    for (let slot = 0; slot < count; slot++) {
      const source = roster?.[slot];
      if (source && (source.health.current <= 0 || source.infected || source.infection)) continue;
      // Preserve the authored entry clearance; loosen slots only after following starts.
      const at = this.clearPoint(formationSlot(formation, heading, slot, false), .4);
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
      // Recovery also expires effects whose timestamps belong to L6's clock.
      if (e.combat) { e.combat.staggerUntil = 0; e.combat.attacking = false; e.combat.statuses.length = 0; delete e.combat.reaction; }
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
    // Asset loading must see the residents' final pedestrian models. Waiting
    // for the first AI tick discovers new living/corpse graphs during pickup.
    outbreak.dressInfected();
  }
  private clearPoint(at: Point, radius: number): Point {
    return requireClearPoint(this.world, at, radius, 4, 'L7 encounter');
  }
  private group(group: number, centre: Point, count: number, alphas: number, resident = false): void {
    const ai = this.world.infected!;
    const admit = resident ? ai.spawn.bind(ai) : ai.director.request.bind(ai.director);
    // These authored groups occupy the street, including Northgate's raised
    // terraces. Supply their layer explicitly; the generic spawn defaults to
    // ground level so actors beneath an overhead deck remain beneath it.
    const streetPoint = (at: Point, radius: number) => {
      const p = this.clearPoint(at, radius);
      return { ...p, y: .7 + this.world.districts!.pavingHeight(p.x, p.z) };
    };
    for (let i = 0; i < alphas; i++) {
      const at = group === l7Encounters.finalGroup
        ? i ? { x: -43, z: 41.7 } : { x: -64, z: 50 }
        : { x: centre.x, z: centre.z + (i ? 3 : -3) };
      admit('infected.alpha', streetPoint(at, .55), { pack: group, state: 'idle', yaw: Math.PI });
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
        p = j < 0 ? { x: centre.x + 14 - (i >> 1) * 1.4, z: centre.z + (i % 2 ? 1 : -1) * 5.5 }
          : { x: centre.x - Math.floor(j / 10) * 1.6, z: centre.z + (j % 2 ? 1 : -1) * (5 + (j % 10 >> 1) * 1.8) };
      } else {
        const row = Math.floor(i / 10);
        // High and low tiers both enter through the road and its two verges.
        // Separate rows laterally and stagger their fronts so one rocket hit
        // cannot clear a single packed arrival stream.
        const flank = [-1, 0, 1, 0][row % 4];
        const spacing = group === l7Encounters.finalGroup ? 10 : 6.5;
        p.z = centre.z + flank * spacing;
        p.x += (row % 2 ? 1 : -1) * (group === l7Encounters.finalGroup ? 3.5 : 1.5);
      }
      // A ruined frontage may hide a cell; search locally rather than putting a figure in its mesh.
      admit('infected.runner', streetPoint(p, .35), { pack: group, state: 'idle', yaw: Math.PI });
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
    const firstStreet = this.world.infected!.active.filter(e => e.infected!.pack === l7Encounters.firstStreetGroup && e.health.current > 0);
    for (const e of firstStreet) if (e.transform.x <= l7Encounters.streets[0].x + 2) this.world.infected!.press(e.id, 1, this.world.tick + 20 * 60);
    if (this.world.infected!.director.tier === 'high') {
    // One high-tier kerb runner needs the same focus as the opening verge ranks;
    // otherwise nearby survivor targets delay first courier contact.
      const player = this.world.entities.get(1)!;
      const close = firstStreet.filter(e => e.archetype === 'infected.runner' && e.transform.x > l7Encounters.streets[0].x + 2)
        .sort((a, b) => distance(a.transform, player.transform) - distance(b.transform, player.transform));
      // r5-l7: evacuees now survive their first bites, so a kerb runner that reaches the party first stays busy
      // with it; two pressed runners keep the courier's first contact inside L7-05's 10 s.
      for (const e of close.slice(0, 2)) this.world.infected!.press(e.id, 1, this.world.tick + 20 * 60);
    }
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
        if (e && this.behind(e)) this.warn(e, 'lost');
        w.events.emit({ type: 'mission.signal', tick: w.tick, name: `l7.survivor-${r.status}`, actorId: r.id });
      }
    }
    const p = w.entities.get(1)!.transform;
    // The crowd already builds this field above twenty infected. Keep it
    // available for out-of-range followers after the fighting has thinned out too.
    if (ai.active.length <= 20 && s.roster.some(r => r.status === 'following' && distance(w.entities.get(r.id)!.transform, p) > l7FollowerRangeM)) ai.nav.flow(p.x, p.z, 1500);
    s.passageReady = s.finalReady && p.x <= l7Encounters.passage.x && Math.abs(p.z - l7Encounters.passage.z) < 7 && s.roster.every(r => r.status !== 'following' || r.passed);
    const m=w.missions;
    if(m?.state.steps.corridor?.status==='active'){
      const entrances=['l7-corridor-east','l7-corridor-west'];
      m.state.marker='l7-corridor-east';
      const arrived=entrances.some(name=>{const a=m.def.anchors[name];return distance(p,a)<=a.radius;});
      m.setState('corridor-group',arrived&&this.corridorGroup().missing.length===0);
    }
  }
  /** A completed bite on a following evacuee costs `followerBite.damage` of its health and staggers the biter while
   * the evacuee tears free. True when it survives; the bite that would empty its health kills/turns as usual. */
  woundFollower(target: EntitySnapshot, biter: EntitySnapshot): boolean {
    if (!this.state.roster.some(r => r.id === target.id && r.status === 'following')) return false;
    const { damage, shoveTicks, shoveM } = l7Encounters.followerBite, w = this.world;
    if (target.health.current <= damage) return false;
    target.health.current -= damage;
    // Reeling in place leaves the attacker's full body sealing the column's
    // escape lane. Break all ordinary holds on this person together, so a
    // second completed grab cannot immediately consume another third of HP.
    for (const attacker of w.infected!.active) {
      if (attacker.id !== biter.id && attacker.infected!.l1?.biteTargetId !== target.id) continue;
      if (attacker.combat) attacker.combat.staggerUntil = Math.max(attacker.combat.staggerUntil, w.tick + shoveTicks);
      const dx = attacker.transform.x - target.transform.x, dz = attacker.transform.z - target.transform.z, length = Math.hypot(dx, dz);
      if (length > 0 && attacker.archetype !== 'infected.alpha') w.knockback(attacker, { x: dx / length, z: dz / length }, shoveM, 12);
    }
    w.events.emit({ type: 'infected.attack', tick: w.tick, sourceId: biter.id, attackId: 0, targetId: target.id, special: 'bite', amount: damage });
    return true;
  }
  /** Eighteen metres covers the three-column formation while requiring every living member to accompany the courier. */
  corridorGroup(){
    const p=this.world.entities.get(1)!.transform,live=this.state.roster.filter(r=>r.status==='following');
    const missing=live.filter(r=>distance(this.world.entities.get(r.id)!.transform,p)>l7FollowerRangeM);
    return {total:live.length,near:live.length-missing.length,missing};
  }
  follower(e: EntitySnapshot): boolean {
    const r = this.state.roster.find(r => r.id === e.id);
    if (!r || r.status !== 'following') return false;
    if (this.world.l7Departure?.claims(e)) return true;
    if (e.passengerOf === undefined && this.yieldToCourier(e)) return true;
    const w = this.world, p = w.entities.get(1)!, c = e.civilian!, s = c.survivor!;
    this.recordTrail(p.transform);
    s.briskAt = w.tick;
    c.state = 'calm'; c.story = null; s.cover = false;
    const launcher = this.launcher();
    if (launcher && distance(p.transform, launcher.transform) < 8) {
      // Before arming, a facing change must not swing the column through the
      // pickup. Keep each survivor in the same separate slot used at arrival.
      const exit = { x: launcher.transform.x - l7Rocket.exitOffset[0], z: launcher.transform.z - l7Rocket.exitOffset[1] };
      const road = l7Encounters.streets[0], heading = leaderHeading(-Math.atan2(road.z - exit.z, road.x - exit.x));
      const origin = { x: exit.x - heading.x * 3.5, z: exit.z - heading.z * 3.5 };
      w.npcs!.move(e, formationSlot(origin, heading, s.slot, false), 5.2, c, .3);
      w.spatial.set(e.id, e.transform.x, e.transform.z);
      return true;
    }
    if (this.walkPocketRoute(e)) return true;
    const d = distance(e.transform, p.transform), slot = s.slot, v = p.survivor!.velocity;
    // Departure slots follow the walked corridor around the parked bus.
    const goal = this.formationGoal(p.transform, v, slot);
    const nav = this.followerNavigation();
    // Keep followers on their individual slots when the leader turns. Falling
    // back to the leader position sends the whole formation to one crowded point.
    const ahead = w.missions!.state.steps.departure?.status !== 'active' || Math.hypot(v.x, v.z) <= .8 || (goal.x - e.transform.x) * v.x + (goal.z - e.transform.z) * v.z >= 0;
    const target = w.infected!.director.tier === 'high' || w.missions!.state.steps.departure?.status === 'active'
      ? nav.clear(goal.x, goal.z, .35) ? goal : snapToClear(w, goal, .35)
      : ahead && nav.clear(goal.x, goal.z, .35) && nav.visible(e.transform, goal, .35) && nav.visible(goal, p.transform, .35) ? goal : p.transform;
    if (d > formationBack(slot) + 10 && w.tick >= this.state.waitAt) {
      this.state.waitAt = w.tick + 300;
      this.warn(e, 'wait');
    }
    if (distance(e.transform, target) > .6) {
      // Reuse the crowd's connected route across the city. Until that field
      // reaches a follower, short searches fit the shared A* scratch budget.
      let destination = target;
      // Straight-line proximity can hide a long street detour. Start the
      // connected route at the same range that makes the group wait; nearby
      // followers otherwise keep replacing an unfinished shared A* search.
      if (d > l7FollowerRangeM) {
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
      const budget = d > l7FollowerRangeM ? w.infected!.director.tier === 'low' ? 200 : 400 : 1600;
      w.npcs!.move(e, destination, 5.2, c, 0, budget, nav);
    }
    w.spatial.set(e.id, e.transform.x, e.transform.z);
    return true;
  }
  /** A dead Alpha can close an entire alley. Route the human column around
   * that closure before it packs against the corpse; infected routing stays
   * independent. Physical movement still checks every full-size body. */
  private followerNavigation(): NavGrid {
    const w = this.world, source = w.infected!.nav;
    if (this.routeTick === w.tick && this.routeNav) return this.routeNav;
    this.routeTick = w.tick;
    const bodies = [...w.entities.iterate()].filter(body => !body.hidden && solidLargeCorpse(body));
    if (!bodies.length) return this.routeNav = source;
    const key = bodies.map(body => `${body.id}:${body.transform.x}:${body.transform.z}:${actorRadius(body)}`).join('|');
    if (!this.corpseRoutes || this.corpseRoutes.source !== source || this.corpseRoutes.revision !== source.revision || this.corpseRoutes.bodies !== key) {
      const nav = source.withClearance(source.clearance);
      for (const body of bodies) {
        const radius = actorRadius(body);
        nav.setBlocker(body.id, { x: body.transform.x, z: body.transform.z, y: body.transform.y, halfX: radius, halfZ: radius, halfY: radius, navBlocker: true }, true);
      }
      this.corpseRoutes = { source, revision: source.revision, bodies: key, nav };
    }
    const nav = this.corpseRoutes.nav, p = w.entities.get(1)!.transform;
    nav.flow(p.x, p.z, 1500);
    return this.routeNav = nav;
  }
  /** The courier can reverse through her column before boarding owns it. A
   * formation target behind her otherwise asks the front rank to walk into her.
   * Step sideways using ordinary swept walking; stationary players stay put. */
  private yieldToCourier(e: EntitySnapshot): boolean {
    const w = this.world, move = w.inputFrame.move, speed = Math.hypot(move.x, move.z);
    if (speed < .1 || !w.solids.blockingBody(1)?.civilian?.survivor) return false;
    const p = w.entities.get(1)!.transform, dx = e.transform.x - p.x, dz = e.transform.z - p.z;
    if (Math.abs(e.transform.y - p.y) >= 1.2) return false;
    const hx = move.x / speed, hz = move.z / speed, along = dx * hx + dz * hz, lateral = dz * hx - dx * hz;
    if (along < -.3 || along > 2.2 || Math.abs(lateral) > 1) return false;
    const side = lateral ? Math.sign(lateral) : e.civilian!.survivor!.slot % 2 ? 1 : -1;
    const nav = w.infected!.nav, radius = actorRadius(e);
    for (const sign of [side, -side]) {
      const shift = sign * 1.3 - lateral;
      const target = { x: e.transform.x - hz * shift, z: e.transform.z + hx * shift };
      if (!nav.clear(target.x, target.z, radius) || !nav.visible(e.transform, target, radius)) continue;
      const c = e.civilian!;
      c.vehicleYield = { target, until: w.tick + 15 };
      c.state = 'calm'; c.story = null; c.survivor!.cover = false; c.survivor!.briskAt = w.tick;
      w.npcs!.move(e, target, 5.2, c, .1);
      w.spatial.set(e.id, e.transform.x, e.transform.z);
      return true;
    }
    return false;
  }
  private recordTrail(player: Point): void {
    const last = this.trail.at(-1);
    if (last && distance(last, player) > 6) this.trail.length = 0;
    if (!last || distance(last, player) >= .4) {
      this.trail.push({ x: player.x, z: player.z });
      if (this.trail.length > 128) this.trail.shift();
    }
  }
  /** Follow the walked street line even while the courier aims or is stunned.
   * Three close rows stay in her cover; the boarding corner remains two abreast. */
  private formationGoal(player: EntitySnapshot['transform'], velocity: Point, slot: number): Point {
    const departure = this.world.missions!.state.steps.departure?.status === 'active';
    {
      const columns = departure ? 2 : 3;
      let remaining = 2.3 + Math.floor(slot / columns) * (departure ? 1 : .8), newer: Point = player;
      for (let i = this.trail.length - 1; i >= 0; i--) {
        const older = this.trail[i], length = distance(older, newer);
        if (length >= remaining && length > 0) {
          const hx = (newer.x - older.x) / length, hz = (newer.z - older.z) / length;
          const side = departure ? slot % 2 - .5 : (slot % 3 - 1) * 1.2;
          const centre = { x: newer.x - hx * remaining, z: newer.z - hz * remaining };
          const goal = { x: centre.x - hz * side, z: centre.z + hx * side };
          const nav = this.followerNavigation();
          // A lateral slot beside the walked trail can cross a wreck's edge.
          // Use the walked centreline instead of snapping across that blocker.
          return nav.clear(goal.x, goal.z, .35) && nav.visible(centre, goal, .35) ? goal : centre;
        }
        remaining -= length; newer = older;
      }
    }
    return formationSlot(player, leaderHeading(player.yaw, velocity), slot, false);
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
    // Contact can invalidate a fine-grid escape leg after it was planned.
    // Release a blocked route so ordinary navigation can replan.
    if (step <= 1e-6) { this.pocketRoutes.delete(e.id); return false; }
    // This is continuous, swept locomotion, including the tight rounded
    // corners that the square-margin route grid cannot represent.
    w.solids.wrote(e, 'l7.pocket-walk'); delete e.locomotion;
    e.transform.x += direction.x * step; e.transform.z += direction.z * step;
    e.transform.yaw = -Math.atan2(dz, dx); w.spatial.set(e.id, e.transform.x, e.transform.z);
    return true;
  }
  snapshot() {
    return { state: structuredClone(this.state), prepared: this.prepared, queue: structuredClone(this.world.infected!.director.queue), seen: [...this.seen], trail: structuredClone(this.trail), tick: this.world.tick };
  }
  restore(saved: unknown): void {
    const record = saved as ReturnType<LevelSevenEncounters['snapshot']>;
    this.state = structuredClone(record.state); this.prepared = record.prepared;
    this.approaches.clear();
    this.pocketRoutes.clear();
    this.corpseRoutes = undefined; this.routeNav = undefined; this.routeTick = -1;
    this.trail.splice(0, this.trail.length, ...(record.trail ?? []));
    this.state.waitAt += this.world.tick - record.tick;
    if (this.state.alarm) this.state.alarm.until += this.world.tick - record.tick;
    this.seen.clear(); for (const id of record.seen) this.seen.add(id);
    const director = this.world.infected!.director;
    director.queue.splice(0, director.queue.length, ...structuredClone(record.queue));
    director.levelCap = 200; director.strict = true; director.ambientTarget = 0;
    this.reserveSlots();
  }
}
