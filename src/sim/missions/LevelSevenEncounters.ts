import { Outbreak } from '../outbreak/Outbreak';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { Point } from '../npc/types';
import { l7Exit } from '../../levels/L7/layout';
import { l7Encounters } from '../../data/l7';

export interface L7EncounterState {
  started: boolean;
  roster: { id: number; key: string; injured: boolean; status: 'following' | 'dead' | 'turned'; passed: boolean }[];
  arrivals: { id: number; group: number; alpha: boolean; tick: number; x: number; z: number; offscreen: boolean; safe: boolean }[];
  finalReady: boolean;
  passageReady: boolean;
  waitAt: number;
}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
/** L7-E1 owns population and physical group passage. Boarding/departure is owned by L7-E2. */
export class LevelSevenEncounters {
  state: L7EncounterState = { started: false, roster: [], arrivals: [], finalReady: false, passageReady: false, waitAt: 0 };
  private prepared = false;
  private readonly seen = new Set<number>();
  private readonly waypoint = { x: 0, z: 0 };
  constructor(private readonly world: SimWorld, private readonly carried?: readonly EntitySnapshot[]) {}
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
    const count = roster?.length ?? (director.tier === 'low' ? 15 : 24);
    for (let slot = 0; slot < count; slot++) {
      const source = roster?.[slot];
      if (source && (source.health.current <= 0 || source.infected || source.infection)) continue;
      const at = this.clearPoint({ x: l7Exit.position[0] + Math.floor(slot / 3) * 1.2, z: l7Exit.position[2] + (slot % 3 - 1) * 1.2 }, .4);
      const e = source ? structuredClone(source) : w.entities.get(outbreak.spawnPedestrian(at, { model: slot % 2 ? 'npc.civilian-man-b.aftermath' : 'npc.civilian-woman-b.aftermath', role: 'cashier' }))!;
      if (source) {
        if (w.entities.get(e.id)) throw new Error(`L7 incoming survivor id collision: ${e.id}`);
        w.entities.replace(e);
      }
      Object.assign(e.transform, { ...at, y: w.districts!.groundHeight(at.x, at.z) + .7 });
      e.hidden = false;
      const c = e.civilian!;
      delete c.floorY; c.story = null; c.path.length = 0; c.goal = -1; c.pauseUntil = 0; c.state = 'calm';
      if (c.l1) c.l1.target = null;
      // Armed shelter residents travel with the group rather than holding their old underground post.
      const key = c.survivor?.key ?? `shelter-${slot}`;
      c.survivor = { key, mode: 'follow', slot, leader: 1, cover: false, waitAt: 0, foundAt: w.tick };
      this.state.roster.push({ id: e.id, key, injured: (c.l1?.walkSpeed ?? 2.2) <= 1.4, status: 'following', passed: false });
      w.solids.admit(e, 'l7.roster.arrival');
    }
  }
  private clearPoint(at: Point, radius: number): Point {
    const nav = this.world.infected!.nav;
    for (let d = 0; d <= 4; d += .5) for (let i = 0; i < (d ? 16 : 1); i++) {
      const p = { x: at.x + Math.cos(i * Math.PI / 8) * d, z: at.z + Math.sin(i * Math.PI / 8) * d };
      if (nav.clear(p.x, p.z, radius)) return p;
    }
    throw new Error(`No clear L7 encounter point at ${at.x},${at.z}`);
  }
  private group(group: number, centre: Point, count: number, alphas: number): void {
    const ai = this.world.infected!;
    for (let i = 0; i < alphas; i++) ai.director.request('infected.alpha', this.clearPoint({ x: centre.x, z: centre.z + (i ? 3 : -3) }, .55), { pack: group, state: 'idle', yaw: Math.PI });
    for (let i = 0; i < count; i++) {
      const p = { x: centre.x + (i % 10 - 4.5) * 1.3, z: centre.z + (Math.floor(i / 10) - (Math.ceil(count / 10) - 1) / 2) * 1.3 };
      // A ruined frontage may hide a cell; search locally rather than putting a figure in its mesh.
      ai.director.request('infected.runner', this.clearPoint(p, .35), { pack: group, state: 'idle', yaw: Math.PI });
    }
  }
  start(): void {
    this.prepare();
    if (this.state.started) return;
    this.state.started = true;
    const low = this.world.infected!.director.tier === 'low';
    // Final horde is present before approach. Its Alphas get slots before ordinary queued arrivals.
    this.group(l7Encounters.finalGroup, l7Encounters.horde, low ? 60 : 120, 2);
    const streetCount = low ? 140 : 280;
    l7Encounters.streets.forEach((p, i) => this.group(l7Encounters.firstStreetGroup + i, p, streetCount / 4, i < 3 ? 1 : 0));
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
    this.reserveSlots();
    if (!s.started && w.combat!.runner.loadout.activeEntries().some(e => e.id === 'weapon.rocket-launcher')) this.start();
    for (const e of ai.active) if (e.infected!.pack >= l7Encounters.finalGroup && e.infected!.pack <= l7Encounters.firstStreetGroup + 3 && !this.seen.has(e.id)) {
      this.seen.add(e.id);
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
      if (r.status !== 'following') w.events.emit({ type: 'mission.signal', tick: w.tick, name: `l7.survivor-${r.status}`, actorId: r.id });
    }
    const p = w.entities.get(1)!.transform;
    s.passageReady = s.finalReady && p.x <= l7Encounters.passage.x && Math.abs(p.z - l7Encounters.passage.z) < 7 && s.roster.every(r => r.status !== 'following' || r.passed);
  }
  follower(e: EntitySnapshot): boolean {
    const r = this.state.roster.find(r => r.id === e.id);
    if (!r || r.status !== 'following') return false;
    if (this.world.l7Departure?.claims(e)) return true;
    const w = this.world, p = w.entities.get(1)!, c = e.civilian!, s = c.survivor!;
    c.state = 'calm'; c.story = null; s.cover = false;
    const d = distance(e.transform, p.transform), slot = s.slot, v = p.survivor!.velocity, speed = Math.hypot(v.x, v.z);
    // Three columns keep a 35-person group inside the street. Nav collapses it through the actual opening.
    const hx = speed > .8 ? v.x / speed : Math.cos(p.transform.yaw), hz = speed > .8 ? v.z / speed : -Math.sin(p.transform.yaw);
    const back = 2.3 + Math.floor(slot / 3) * 1.2, side = (slot % 3 - 1) * 1.2;
    const goal = { x: p.transform.x - hx * back - hz * side, z: p.transform.z - hz * back + hx * side };
    const target = w.infected!.nav.clear(goal.x, goal.z, .35) ? goal : p.transform;
    if (d > back + 10 && w.tick >= this.state.waitAt) {
      this.state.waitAt = w.tick + 300;
      w.events.emit({ type: 'story.say', tick: w.tick, id: e.id, text: 'Wait for us!', position: e.transform });
    }
    if (distance(e.transform, target) > .9) {
      // Cross-city searches share the grid's scratch state. Use short routes
      // that finish within one search budget, then keep walking that route.
      let destination = target;
      if (d > 30) {
        const nav = w.infected!.nav;
        if (!c.l1!.target || distance(e.transform, c.l1!.target) <= .6) {
          if ((w.tick + e.id) % 30 !== 0) return true;
          const length = distance(e.transform, target);
          const local = { x: e.transform.x + (target.x - e.transform.x) * 8 / length, z: e.transform.z + (target.z - e.transform.z) * 8 / length };
          const budget = w.infected!.director.tier === 'low' ? 200 : 400;
          if (!nav.steer(e.transform, local, c, .35, this.waypoint, budget)) return true;
          const cell = nav.nearestCell(local.x, local.z, .35);
          c.l1!.target = { x: nav.x(cell), z: nav.z(cell) };
        }
        destination = c.l1!.target;
      } else c.l1!.target = null;
      w.npcs!.move(e, destination, r.injured ? 1.4 : 3.8, c, .5, d > 30 ? w.infected!.director.tier === 'low' ? 200 : 400 : 1600);
    }
    w.spatial.set(e.id, e.transform.x, e.transform.z);
    return true;
  }
  snapshot() {
    return { state: structuredClone(this.state), prepared: this.prepared, queue: structuredClone(this.world.infected!.director.queue), seen: [...this.seen], tick: this.world.tick };
  }
  restore(saved: unknown): void {
    const record = saved as ReturnType<LevelSevenEncounters['snapshot']>;
    this.state = structuredClone(record.state); this.prepared = record.prepared;
    this.state.waitAt += this.world.tick - record.tick;
    this.seen.clear(); for (const id of record.seen) this.seen.add(id);
    const director = this.world.infected!.director;
    director.queue.splice(0, director.queue.length, ...structuredClone(record.queue));
    director.levelCap = 200; director.strict = true; director.ambientTarget = 0;
    this.reserveSlots();
  }
}
