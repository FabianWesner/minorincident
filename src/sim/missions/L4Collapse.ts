import { l4, l4Edges, l4Inside, l4OffscreenMouths } from '../../data/l4';
import { l4BreachSides, l4BreachSite, l4Breaches, l4Wall, type L4BreachSide } from '../../data/l4Perimeter';
import { l4AlphaEmergence, l4BreakableLine } from '../../levels/L4/layout';
import type { Mission } from './Mission';
import type { L4Director, L4Line, L4State } from './types';
import type { EntitySnapshot } from '../world/types';
import type { Point } from '../npc/types';

const ticks = (s: number) => Math.round(s * 60);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const D = l4.director;
const pt = (p: readonly [number, number]): Point => ({ x: p[0], z: p[1] });

export function freshDirector(): L4Director {
  return { lines: D.lines.map(l => ({ id: l.id, soldierIds: [], size: 0, brokeAt: 0, cause: '', pushAt: 0, pushes: 0 })), alphaJobs: [], knockdowns: 0, barricades: 0, turnedInside: 0, spawned: 0, cutOff: [], swarmedAt: 0, fallBackAt: 0, settled: 0, burnAt: 0, gapUntil: 0, refugees: [] };
}
/** Which line a soldier post defends at the turn (the army gate posts stay out of the plaza war). */
export function postLine(role: 'qm' | 'line' | 'hmg' | 'truck' | 'gate'): number { return role === 'line' ? 0 : role === 'hmg' ? 1 : role === 'gate' ? -1 : 2; }

/** What the director needs from the war controller (shared helpers; the controller owns waves, emergence and the final break). */
export interface CollapseHost {
  mission: Mission; s: () => L4State; low: () => boolean;
  snap: (p: Point, r?: number) => Point; emerge: (at: Point, push?: boolean) => number; human: (e: EntitySnapshot | undefined) => boolean;
  insideRing: (p: Point) => boolean; doors: () => { name: string; x: number; z: number }[]; fallBack: () => void;
  /** PO 10-23 military wall: is a breach site open, and announce the Alpha coming for it. */
  breachOpen: (side: L4BreachSide) => boolean; breachSegments: (side: L4BreachSide) => EntitySnapshot[]; announceBreach: (side: L4BreachSide, alphaId: number) => void;
}

/**
 * L4 collapse director (PO 2026-10-12 design, approved "ok let's try that!"): the outbreak starts behind the lines and the army loses
 * three lines at fixed beats. It watches time and line health; while a line holds too well it adds pressure inside or at the flank of that
 * line (new infected come at the flank out of view); at the beat it forces the fall back. Line 1 (the sandbag runs) is overrun
 * from front and flank, the Alphas charge the gun nests (charge and ground slam knock the crews down, an E26 slot breaks), the tank is
 * swarmed and goes silent, the soldiers retreat in small groups and some are cut off; then the radio orders everyone to fall back.
 * Soldier accuracy and damage are never touched. All state lives in `state.l4.director` (checkpoint-safe).
 */
export class L4Collapse {
  constructor(private readonly h: CollapseHost) {}
  private get s() { return this.h.s(); }
  private get d() { return this.s.director; }
  private get world() { return this.h.mission.world; }
  private get t() { return (this.world.tick - this.s.turnAt) / 60; }
  private tier<T>(v: { high: T; low: T }): T { return this.h.low() ? v.low : v.high; }
  private soldier(id: number): EntitySnapshot | undefined { const e = this.world.entities.get(id); return this.h.human(e) ? e : undefined; }
  /** Standing: a live human soldier, not knocked down and not in a bite hold. */
  private standing(line: L4Line): EntitySnapshot[] {
    const tick = this.world.tick;
    return line.soldierIds.map(id => this.soldier(id)).filter((e): e is EntitySnapshot => !!e && tick >= e.civilian!.knockedUntil && e.civilian!.state !== 'grabbed' && e.civilian!.state !== 'bitten');
  }
  health(i: number): number { const l = this.d.lines[i]; return l.size ? this.standing(l).length / l.size : 0; }
  current(): number { return this.d.lines.findIndex(l => !l.brokeAt); }
  /** The wall opening is the physical line-1 fall beat; do not wait for the old casualty deadline. */
  breachLine1(): void {
    if (this.s.phase === 'war' && !this.d.lines[0].brokeAt) this.breakLine(0, 'forced');
  }
  /** Share of the infected cap the war may fill now (grows with the beats; the full cap once the army falls back). */
  aliveShare(): number { const i = this.current(); return this.s.phase === 'war' && i >= 0 ? (this.h.low() ? D.aliveLow : D.alive)[i] : 1; }

  /** At the turn: the line groups are fixed (sizes for the health ratio). */
  start(): void {
    for (const l of this.d.lines) { l.soldierIds = l.soldierIds.filter(id => this.soldier(id)); l.size = l.soldierIds.length; }
  }
  /** Once per level (prepare): counters fed by sim events. */
  listen(): void {
    // Knockdowns by Alpha hits on soldiers (charge, ground slam, plain swipes) are the "crews knocked down" count.
    this.world.events.on('infected.attack', e => {
      if (e.type !== 'infected.attack' || !this.h.mission.state.l4 || this.s.phase !== 'war') return;
      if (this.world.entities.get(e.sourceId)?.archetype === 'infected.alpha' && this.world.entities.get(e.targetId)?.civilian?.ally?.role === 'soldier') this.d.knockdowns++;
    });
    this.world.events.on('barricade.broken', e => { if (e.type === 'barricade.broken' && this.h.mission.state.l4 && this.s.phase === 'war' && e.groupId === 'l4-line') this.d.barricades++; });
  }

  update(): void {
    const s = this.s, d = this.d, tick = this.world.tick;
    if (s.phase !== 'war' || !s.turnAt) return;
    this.alphaJobs();
    if (d.lines[2].brokeAt && !d.fallBackAt && tick >= d.lines[2].brokeAt + ticks(l4.lineBreak.fallBackS)) { d.fallBackAt = tick; this.h.fallBack(); return; }
    if (tick % 10) return;
    const i = this.current(); if (i < 0) return;
    const line = d.lines[i], def = D.lines[i], t = this.t;
    if (i === 0 && t >= def.pushS && !line.pushes) this.frontWave();
    if (i === 2 && t >= def.pushS) this.swarmTank();
    if (t >= def.pushS && t < def.dueS && tick >= line.pushAt) {
      line.pushAt = tick + ticks(D.pushEveryS);
      if (this.health(i) > D.standing) { this.push(i); line.pushes++; }
    }
    const overrun = t >= def.earliestS && (i === 2 ? !!d.swarmedAt : this.health(i) <= D.standing);
    if (overrun || t >= def.dueS) this.breakLine(i, overrun ? 'overrun' : 'forced');
  }

  // ------------------------------------------------------------------------------------------------ pressure
  /** Line 1 front: a big push from the streets the sandbag runs face (west, NW alley, north, south-west). */
  private frontWave(): void {
    const s = this.s, n = this.tier(D.frontWave), edges = [0, 1, 2, 5];
    for (const e of edges) s.pend[e] += Math.ceil(n / edges.length);
    this.world.events.emit({ type: 'l4.wave', tick: this.world.tick, wave: -1, count: n, edges });
  }
  /** The line holds too well: new infected arrive at its flank out of view; existing humans can only turn after bites. */
  private push(i: number): void {
    const { world } = this, n = this.tier(D.push) + (i === 0 ? this.tier(D.refugees) : 0), player = world.entities.get(1)!.transform, line = this.d.lines[i];
    const targets = this.standing(line), centre = targets[0]?.transform ?? l4.map.centre;
    const near = (p: Point) => targets.length ? Math.min(...targets.map(t => dist(t.transform, p))) : dist(p, player);
    // Flank: new infected come as one burst at the out-of-view flank point nearest a standing soldier (a trickle is shot down on the way;
    // a burst reaches the sandbags). When the camera covers them all, the nearest street mouths (always beyond the view).
    // The earlier pickup alarm can begin before the camp has settled. Keep the first
    // line pressure behind it using the same concealed camp exits as the alarm.
    const origins = [...D.flanks[i], ...(i === 0 ? l4Inside : []), ...l4OffscreenMouths.map(m => m.at)];
    let flanks = origins.map(pt).map(p => this.h.snap(p, .45)).filter(p => world.infected!.nav.clear(p.x, p.z, .45)
      && (world.infected!.director.offscreen(p) || world.infected!.director.occluded(p)) && dist(p, player) >= 12);
    if (!flanks.length) flanks = l4Edges.slice(0, 6).map(e => pt(e.at)).filter(p => world.infected!.director.offscreen(p) && dist(p, player) >= 20).sort((p, q) => dist(p, centre) - dist(q, centre)).slice(0, 2);
    if (!flanks.length || !targets.length) return;
    if (i === 0) flanks = [flanks.sort((p, q) => near(p) - near(q))[0]];
    for (let k = 0; k < n; k++) {
      const at = flanks[k % flanks.length], desired = { x: at.x + (k % 3 - 1) * .9, z: at.z + Math.floor(k / 3) * .9 };
      const snapped = this.h.snap(desired, .45), spawnAt = world.infected!.nav.clear(snapped.x, snapped.z, .45) ? snapped : at;
      const id = this.h.emerge(spawnAt, true); if (!id) break;
      this.d.spawned++;
      const target = targets.slice().sort((a, b) => dist(a.transform, at) - dist(b.transform, at))[k % Math.min(3, targets.length)];
      // A flank push attacks the line through the camp crowd. Retain its soldier
      // focus as the crews retreat; ordinary sight and bite/rescue rules still apply.
      world.infected!.press(id, target.id, world.tick + ticks(20));
    }
  }
  /** The armour beat: every infected near the tank goes for it, and a swarm comes up from the lake garden; `swarmedAt` once it is buried. */
  private swarmTank(): void {
    const { world } = this, s = this.s, tank = world.entities.get(s.tankId), ai = world.infected!;
    if (!tank || s.tankPhase === 'silent' || s.tankPhase === 'gone') { if (!this.d.swarmedAt && this.t >= D.lines[2].earliestS) this.d.swarmedAt = world.tick; return; }
    const at = { x: tank.transform.x, z: tank.transform.z };
    for (const e of ai.active) if (e.health.current > 0 && !e.hidden && e.infected?.l1 && dist(e.transform, at) < 30) ai.rush(e.id, at, world.tick + ticks(15));
    if (world.tick % 60 === 0) for (const edge of [5, 4]) s.pend[edge] += this.tier({ high: 6, low: 3 });
    const near = ai.active.filter(e => e.health.current > 0 && !e.hidden && dist(e.transform, at) <= D.swarmM).length;
    if (near >= D.swarm && this.t >= D.lines[2].earliestS - 6) this.silenceTank();
  }
  private silenceTank(): void {
    const s = this.s; if (s.tankPhase === 'silent') return;
    if (s.tankPhase !== 'off' && s.tankPhase !== 'gone') s.tankPhase = 'silent';
    if (!this.d.swarmedAt) this.d.swarmedAt = this.world.tick;
  }

  // ------------------------------------------------------------------------------------------------ the beats
  private breakLine(i: number, cause: 'overrun' | 'forced'): void {
    const { world } = this, d = this.d, line = d.lines[i], tick = world.tick;
    line.brokeAt = tick; line.cause = cause;
    this.h.mission.l4!.campCheckpoint(line.id, i + 1);
    const inside = world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && this.h.insideRing(e.transform)).length;
    const survivors = line.soldierIds.filter(id => this.soldier(id));
    world.events.emit({ type: 'l4.beat', tick, beat: line.id, cause, soldiers: survivors.length, inside });
    if (i === 0) { this.h.mission.radio('L4.line1'); this.fallTo(survivors, D.fallback1.map(pt), d.lines[1]); this.camera('l4-line-1'); }
    if (i === 1) { this.h.mission.radio('L4.nests'); this.fallTo(survivors, D.fallback2.map(pt), d.lines[2]); }
    if (i === 2) { this.silenceTank(); this.h.mission.radio('L4.armor'); this.retreat(survivors); this.camera('l4-armor'); }
  }
  /** Survivors run back (shooting on the move) to the next line's posts and hold there; the next line counts them. */
  private fallTo(ids: number[], posts: Point[], next: L4Line): void {
    const free = posts.map(p => this.h.snap(p, .35));
    for (const id of ids) {
      const e = this.soldier(id)!, a = e.civilian!.ally; if (!a || !free.length) { if (!next.soldierIds.includes(id)) next.soldierIds.push(id); continue; }
      free.sort((p, q) => dist(p, e.transform) - dist(q, e.transform));
      const post = free.shift()!; a.post = { ...post }; a.run = { ...post }; a.hold = true; a.engaged = true;
      if (!next.soldierIds.includes(id)) next.soldierIds.push(id);
    }
    next.soldierIds = next.soldierIds.filter(id => this.soldier(id)); next.size = next.soldierIds.length;
  }
  /** After the armour beat: small groups (3) retreat out of the plaza; the first group is cut off by infected from a door ahead of it. */
  private retreat(ids: number[]): void {
    const { world } = this, groups: number[][] = [];
    const sorted = ids.map(id => this.soldier(id)!).sort((a, b) => a.transform.z - b.transform.z);
    for (let k = 0; k < sorted.length; k += 3) groups.push(sorted.slice(k, k + 3).map(e => e.id));
    for (const [g, group] of groups.entries()) {
      const to = this.h.snap(pt(D.retreat[g % D.retreat.length]), .35);
      for (const [k, id] of group.entries()) { const a = this.soldier(id)!.civilian!.ally!; const p = this.h.snap({ x: to.x + (k - 1) * 1.2, z: to.z }, .35); a.post = { ...p }; a.run = { ...p }; a.hold = true; a.engaged = true; }
    }
    // The cut-off group: the one nearest the courier, so it happens on screen; infected come out of the nearest door beyond its goal.
    const player = world.entities.get(1)!.transform;
    const g = groups.map((group, i) => ({ i, d: Math.min(...group.map(id => dist(this.soldier(id)!.transform, player))) })).sort((a, b) => a.d - b.d)[0];
    if (!g) return;
    const goal = this.h.snap(pt(D.retreat[g.i % D.retreat.length]), .35), ai = world.infected!;
    const door = this.h.doors().filter(dd => ai.director.offscreen(dd) && dist(dd, player) >= 12).sort((a, b) => dist(a, goal) - dist(b, goal))[0];
    const from = door ?? pt(l4Edges[g.i === 0 ? 2 : g.i === 1 ? 3 : 4].at);
    const victims = groups[g.i].map(id => this.soldier(id)!);
    for (let k = 0; k < this.tier(D.cutOff); k++) {
      const id = this.h.emerge({ x: from.x + (k % 3 - 1) * .9, z: from.z + Math.floor(k / 3) * .9 }, true); if (!id) break;
      this.d.spawned++;
      const victim = victims[k % victims.length];
      ai.press(id, victim.id, world.tick + ticks(dist(from, victim.transform) / 1.6 + 20), 30);
    }
    this.d.cutOff = [...groups[g.i]];
  }
  /** Short camera beat on the collapse (mission cinematic: <= 2 s, the sim pauses, skippable after 0.5 s). Skipped while another one runs. */
  private camera(id: string): void { if (this.h.mission.def.cinematics[id]) this.h.mission.cinematic(id); }

  // ------------------------------------------------------------------------------------------------ the Alphas
  /**
   * The Alphas' jobs (`l4AlphaEmergence`; PO 10-13 "add more alphas. The current one has zero chance."). `north` / `south`: the gun-nest
   * beat: wait at the stage outside the line (out of the plaza sight lines) until the beat, charge through the authored E26 slot (breaking
   * it) and ground-slam the crew behind. `west`: the same through the west slot at once (line 1). `line`: go for the nearest standing soldier
   * of the line that holds now, charge, slam, again. `armor`: the same at the armour beat, against the convoy line. Plain sim moves:
   * telegraphs, cooldowns and soldier fire apply.
   */
  private alphaJobs(): void {
    const { world } = this, s = this.s, d = this.d, ai = world.infected!, tick = world.tick;
    for (const [n, id] of s.alphaIds.entries()) if (!d.alphaJobs.some(j => j.alphaId === id)) {
      const entry = l4AlphaEmergence.find(e => e.anchor === s.alphaAnchors[n]);
      // PO 10-23: every Alpha comes in through a breach site of the wall: its own side, else the nearest one.
      const e = world.entities.get(id), job = entry?.job ?? 'line';
      const breach = job === 'west' || job === 'north' || job === 'south' ? job : e ? l4BreachSides.slice().sort((p, q) => dist(l4BreachSite(p).stage, e.transform) - dist(l4BreachSite(q).stage, e.transform))[0] : undefined;
      d.alphaJobs.push({ alphaId: id, job, stage: 'walk', startedAt: tick, breach });
    }
    this.batter();
    const live = (ids: number[]) => ids.map(sid => this.soldier(sid)).filter((x): x is EntitySnapshot => !!x);
    // A line whose own crews are all down: the Alpha goes for whichever soldiers still stand (the army's survivors).
    const crewsOf = (k: number) => { const own = live([...(k === 1 ? s.hmgIds : []), ...d.lines[k].soldierIds]); return own.length ? own : live(s.soldierIds); };
    for (const job of d.alphaJobs) {
      const e = world.entities.get(job.alphaId), b = e?.infected;
      if (!e || !b || e.health.current <= 0 || job.stage === 'done' || b.specialAttack) continue;
      // Its line broken (charge and slam landed): the Alpha moves on to bury the armour (l4-po-round: Alphas that kept slamming
      // every soldier wiped the army before the nests beat; the bitten soldiers turned inside the ring and swamped the courier).
      if (job.stage === 'tank') { if (!this.toTank(job.alphaId, b)) { job.stage = 'done'; delete b.scripted; } continue; }
      let nest = job.job === 'north' || job.job === 'south', k = job.job === 'armor' ? 2 : nest ? 1 : this.current();
      // A finished or orphaned job moves on to the line that holds now: while the army stands an Alpha works the lines (l4-po-round:
      // a free Alpha hunts the nearest target, mostly the courier, and its grab-throws killed the courier bot five times).
      if (k < 0 || d.lines[k].brokeAt || !crewsOf(k).length) {
        const c = this.current();
        if (c < 0 || !crewsOf(c).length) {
          // No soldier stands: the Alphas go for the armour (they bury the tank) rather than all hunting the courier at once.
          if (this.toTank(job.alphaId, b)) { job.stage = 'tank'; continue; }
          job.stage = 'done'; delete b.scripted; continue;
        }
        job.job = 'line'; nest = false; k = c; if (job.stage === 'walk' || job.stage === 'slam') job.stage = 'charge';
      }
      const crews = crewsOf(k), nearest = crews.sort((p, q) => dist(p.transform, e.transform) - dist(q.transform, e.transform))[0];
      const ready = nest ? this.t >= D.lines[1].pushS && d.lines[0].brokeAt > 0 : job.job === 'armor' ? this.t >= D.lines[2].pushS && d.lines[1].brokeAt > 0 : true;
      if (job.stage === 'walk') {
        // Held at its stage outside the line (ignores targets beyond it) until the beat; the armour Alpha waits where it came out (out of view).
        // The nest Alphas leave their hold `wallLeadS` before the beat: the wall in front of the guns has to come down first.
        const wallFirst = nest && !!job.breach && this.t >= D.lines[1].pushS - l4Wall.wallLeadS && d.lines[0].brokeAt > 0;
        if (!ready && !wallFirst) { b.scripted = nest ? this.h.snap(pt(D.alphaHold[job.job as 'north' | 'south']), .55) : (job.hold ??= { x: e.transform.x, z: e.transform.z }); continue; }
        // Through early: it waits at the gap it tore open, roaring at the guns, until the beat.
        if (!ready && this.h.breachOpen(job.breach!)) { b.scripted = this.h.snap(l4BreachSite(job.breach!).stage, .55); continue; }
        if (ready) { delete b.scripted; job.stage = 'charge'; }
      }
      // The wall first (PO 10-23 "so Zombies or alphas can tear them down"): announced, it runs up from outside the breach site and
      // charges the wire again and again (300 per contacted charge, E26 HP) until a segment falls; then its job goes on through the gap.
      if (job.breach && !this.h.breachOpen(job.breach) && !this.inside(e.transform)) {
        const site = l4BreachSite(job.breach), out = l4Breaches[job.breach].out, stage = this.h.snap(site.stage, .55);
        this.h.announceBreach(job.breach, e.id);
        // Back off to the run-up point (unless already at the wire), then charge straight at the breach.
        const atWire = Math.abs((e.transform.x - site.centre.x) * out.x + (e.transform.z - site.centre.z) * out.z) < 1.8;
        if (!atWire && dist(e.transform, stage) > 1.2) { b.scripted = stage; continue; }
        delete b.scripted;
        const dx = site.centre.x - e.transform.x, dz = site.centre.z - e.transform.z, length = Math.hypot(dx, dz) || 1;
        if (!ai.startSpecial(e.id, 'alpha.charge', { id: e.id, x: site.centre.x, z: site.centre.z }, { x: e.transform.x, z: e.transform.z, radius: 1, dx: dx / length, dz: dz / length })) b.scripted = stage;
        continue;
      }
      // On a move cooldown it keeps closing in; at arm's length its own brain swipes at the crew in reach.
      const press = (to: Point) => { if (dist(e.transform, nearest.transform) > 2.5) b.scripted = this.h.snap(to, .55); else delete b.scripted; };
      if (job.stage === 'charge') {
        // The slot Alphas charge through their authored E26 slot (breaking it) while it stands; otherwise at the nearest crew member.
        const side = nest || job.job === 'west' ? job.job as 'north' | 'south' | 'west' : null, slot = side ? this.slotInside(side) : null, to = slot ?? nearest.transform;
        const dx = to.x - e.transform.x, dz = to.z - e.transform.z, length = Math.hypot(dx, dz) || 1;
        // Through the slot the sandbags block the sight line by design; the stage is straight outside it.
        const stage = slot && side ? this.h.snap(this.slotStage(side), .55) : null;
        if (stage ? dist(e.transform, stage) > 1.2 : length > 11 || !world.combat!.query.visible(e.transform, to)) { b.scripted = stage ?? this.h.snap(to, .55); continue; }
        delete b.scripted;
        if (ai.startSpecial(e.id, 'alpha.charge', { id: nearest.id, x: to.x, z: to.z }, { x: e.transform.x, z: e.transform.z, radius: 1, dx: dx / length, dz: dz / length })) job.stage = 'slam';
        else if (slot) b.scripted = stage!; else press(to);
        continue;
      }
      // Slam: close on the nearest crew member, then ground-slam within 3.5 m (knocks everyone in 4 m down); then the next charge.
      const cx = nearest.transform.x - e.transform.x, cz = nearest.transform.z - e.transform.z, cl = Math.hypot(cx, cz) || 1;
      if (cl > 3.5) { b.scripted = { x: nearest.transform.x, z: nearest.transform.z }; continue; }
      delete b.scripted;
      if (ai.startSpecial(e.id, 'alpha.ground-slam', { id: nearest.id, x: nearest.transform.x, z: nearest.transform.z }, { x: e.transform.x, z: e.transform.z, radius: 4, dx: cx / cl, dz: cz / cl })) job.stage = job.job === 'armor' ? 'charge' : 'tank';
      else press(nearest.transform);
    }
  }
  /** Stage near the tank until arrival, a perceived human, or the armour beat ends. */
  private toTank(id: number, b: NonNullable<EntitySnapshot['infected']>): boolean {
    const s = this.s, tank = this.world.entities.get(s.tankId);
    if (!tank || s.tankPhase === 'off' || s.tankPhase === 'gone' || s.tankPhase === 'silent') return false;
    const e = this.world.entities.get(id)!;
    // Tank staging ends as soon as a human is perceived or the Alpha arrives.
    // Otherwise the scripted branch suppresses its combat brain forever.
    if (this.world.infected!.hearing.closest(e, b.heardTargetId ?? 0) || (b.scripted && dist(e.transform, b.scripted) <= 1.2)) return false;
    b.scripted = this.h.snap({ x: tank.transform.x + (id % 3 - 1) * 2.5, z: tank.transform.z + 3 }, .55); return true;
  }
  /**
   * An Alpha's charge that reaches the wire hits the breach segments it touches once each (logged E26 damage through the combat path:
   * `barricade.damaged`, then `barricade.broken` at 0 HP). The charge's own blocker probe runs at the 0.7 m shot line, above the
   * wall's low cover box, so the contact is resolved here. Battering Alphas take `batterResist` of the army's fire.
   */
  private batter(): void {
    const world = this.world;
    for (const job of this.d.alphaJobs) {
      const e = world.entities.get(job.alphaId), b = e?.infected; if (!e || !b || !e.combat || e.health.current <= 0 || !job.breach) continue;
      const battering = !this.h.breachOpen(job.breach) && !this.inside(e.transform);
      e.combat.allyResist = battering ? l4Wall.batterResist : l4.alphas.allyResist;
      const a = b.specialAttack; if (!battering || a?.move !== 'alpha.charge' || a.stage !== 'active') continue;
      for (const seg of this.h.breachSegments(job.breach)) {
        if (a.hitIds.includes(seg.id) || !world.barricades!.withinReach(e, seg)) continue;
        a.hitIds.push(seg.id);
        world.combat!.damage.apply({ sourceId: e.id, targetId: seg.id, attackId: a.attackId, actionId: a.move, origin: e.transform, direction: { x: a.area.dx, z: a.area.dz }, base: l4Wall.chargeDamage, multiplier: 1, type: 'melee', knockback: 0, stagger: 0, hitStopMs: 0 });
      }
    }
  }
  /** Inside the military wall (an Alpha that is through needs no breach). */
  private inside(p: Point): boolean { const r = l4.perimeter; return p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1; }
  /** The charge stage outside a slot: authored for the nest slots, else 8 m straight out of the slot. */
  private slotStage(side: 'north' | 'south' | 'west'): Point {
    if (side !== 'west') return pt(D.alphaStage[side]);
    const slot = l4BreakableLine.find(l => l.id === `l4-line-${side}`)!, a = this.h.mission.def.anchors;
    const c = a[slot.anchors.center], o = a[slot.anchors.outside], dx = o.x - c.x, dz = o.z - c.z, n = Math.hypot(dx, dz) || 1;
    return { x: c.x + dx / n * 8, z: c.z + dz / n * 8 };
  }
  private slotInside(side: 'north' | 'south' | 'west'): Point | null {
    const slot = l4BreakableLine.find(l => l.id === `l4-line-${side}`)!;
    if (!this.world.barricades?.barricadeIntact(slot.id)) return null;
    const a = this.h.mission.def.anchors[slot.anchors.inside]; return a ? { x: a.x, z: a.z } : null;
  }
}
