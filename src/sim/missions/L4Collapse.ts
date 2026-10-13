import { l4, l4Edges } from '../../data/l4';
import { l4BreakableLine } from '../../levels/L4/layout';
import type { Mission } from './Mission';
import type { L4Director, L4Line, L4State } from './types';
import type { EntitySnapshot } from '../world/types';
import type { Point } from '../npc/types';
import type { Outbreak } from '../outbreak/Outbreak';
import { allyState } from '../outbreak/Allies';

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
  mission: Mission; s: () => L4State; low: () => boolean; outbreak: () => Outbreak;
  snap: (p: Point, r?: number) => Point; emerge: (at: Point, push?: boolean) => number; human: (e: EntitySnapshot | undefined) => boolean;
  insideRing: (p: Point) => boolean; doors: () => { name: string; x: number; z: number }[]; fallBack: () => void; room: () => boolean;
}

/**
 * L4 collapse director (PO 2026-10-12 design, approved "ok let's try that!"): the outbreak starts behind the lines and the army loses
 * three lines at fixed beats. It watches time and line health; while a line holds too well it adds pressure inside or at the flank of that
 * line (people there turn, infected come at the flank out of view); at the beat it forces the fall back. Line 1 (the sandbag runs) is overrun
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
    if (d.lines[2].brokeAt && !d.fallBackAt && tick >= d.lines[2].brokeAt + ticks(l4.lineBreak.fallBackS)) { d.fallBackAt = tick; this.h.mission.radio('L4.fallback'); this.h.fallBack(); return; }
    if (tick % 10) return;
    this.refugeesTurn();
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
    for (const e of edges) s.pend[e] = Math.min(l4.war.pendMax, s.pend[e] + Math.ceil(n / edges.length));
    this.world.events.emit({ type: 'l4.wave', tick: this.world.tick, wave: -1, count: n, edges });
  }
  /** The line holds too well: people inside it turn (the visible 3 s transformation), the rest come at its flank out of view. */
  private push(i: number): void {
    const { world } = this, o = this.h.outbreak(), n = this.tier(D.push), player = world.entities.get(1)!.transform, line = this.d.lines[i];
    const zone = (p: Point) => i === 2 ? p.x > -21 && p.x < -3 && p.z > -22 && p.z < 24 : this.h.insideRing(p);
    const soldiers = new Set(this.s.soldierIds);
    const people = [...world.entities.iterate()].filter(e => this.h.human(e) && !soldiers.has(e.id) && e.civilian!.state !== 'grabbed' && zone(e.transform))
      .sort((a, b) => dist(a.transform, player) - dist(b.transform, player));
    const targets = this.standing(line), centre = targets[0]?.transform ?? l4.map.centre;
    // Inside: the people nearest the line's soldiers turn (behind their backs; l4-collapse-2: the player-near pick turned people far from the line).
    const near = (p: Point) => targets.length ? Math.min(...targets.map(t => dist(t.transform, p))) : dist(p, player);
    let left = n;
    const inside = i === 0 ? people.sort((a, b) => near(a.transform) - near(b.transform)).slice(0, Math.ceil(n / 3)) : people.slice(0, Math.ceil(n / 2));
    for (const e of inside) { o.infect(e, 0); this.d.turnedInside++; left--; }
    // Flank: the rest come as one burst at the out-of-view flank point nearest a standing soldier (a trickle is shot down on the way;
    // a burst reaches the sandbags). When the camera covers them all, the nearest street mouths (always beyond the view).
    let flanks = D.flanks[i].map(pt).filter(p => world.infected!.director.offscreen(p) && dist(p, player) >= 12);
    if (!flanks.length) flanks = l4Edges.slice(0, 6).map(e => pt(e.at)).filter(p => world.infected!.director.offscreen(p) && dist(p, player) >= 20).sort((p, q) => dist(p, centre) - dist(q, centre)).slice(0, 2);
    if (!flanks.length || !targets.length) return;
    // Line 1 burst: everything at the one flank point nearest a soldier, plus the bitten refugees; the later lines keep their spread flanks.
    // The refugees come from the nearest point, the burst from the next one (refugees chased by their own burst stop to fight it).
    if (i === 0) {
      flanks.sort((p, q) => near(p) - near(q)); const from = flanks[0];
      this.refugees(from, targets.slice().sort((a, b) => dist(a.transform, from) - dist(b.transform, from)).slice(0, 3)); flanks = [flanks[1] ?? from];
    }
    for (let k = 0; k < left; k++) {
      const at = flanks[k % flanks.length], id = this.h.emerge({ x: at.x + (k % 3 - 1) * .9, z: at.z + Math.floor(k / 3) * .9 }, true); if (!id) break;
      this.d.spawned++;
      const to = targets.slice().sort((a, b) => dist(a.transform, at) - dist(b.transform, at))[k % Math.min(3, targets.length)].transform;
      world.infected!.rush(id, { x: to.x, z: to.z }, world.tick + ticks(20));
    }
  }
  /**
   * From the inside (l4-collapse-2, line 1 read as forced, not overrun): bitten refugees come out of the flank and run in through the
   * line to the soldiers (who never shoot people), then turn right behind them (the 3 s transformation). Plain pedestrians as allies
   * with a run point; they fight what blocks them like any armed civilian.
   */
  private refugees(at: Point, victims: EntitySnapshot[]): void {
    const o = this.h.outbreak(), c = l4.civilians, tick = this.world.tick, list = this.d.refugees ??= [];
    for (let k = 0; k < this.tier(D.refugees) && this.h.room(); k++) {
      const v = victims[k % victims.length].transform, dx = l4.map.centre.x - v.x, dz = l4.map.centre.z - v.z, len = Math.hypot(dx, dz) || 1;
      const to = this.h.snap({ x: v.x + dx / len * 1.1 + (k % 3 - 1) * .5, z: v.z + dz / len * 1.1 }, .35);
      const id = o.spawnPedestrian(this.h.snap({ x: at.x + (k % 2 ? .8 : -.8), z: at.z + k * .5 }, .35), { tier: 'average' }), e = this.world.entities.get(id)!;
      e.civilian!.ally = { ...allyState('civilian', null, false), run: { ...to }, runSpeed: 3.8, melee: { ...c.melee }, range: 8 };
      list.push({ id, turnAt: tick + ticks(D.refugeeTurnS) });
    }
  }
  /** A refugee turns on arrival behind the soldier, at the latest `refugeeTurnS` after it set off (wherever the fight held it up). */
  private refugeesTurn(): void {
    const list = this.d.refugees; if (!list?.length) return;
    const o = this.h.outbreak(), tick = this.world.tick;
    this.d.refugees = list.filter(r => {
      const e = this.world.entities.get(r.id); if (!this.h.human(e)) return false;
      if (e!.civilian!.ally?.run && tick < r.turnAt) return true;
      o.infect(e!, 0); this.d.turnedInside++; return false;
    });
  }
  /** The armour beat: every infected near the tank goes for it, and a swarm comes up from the lake garden; `swarmedAt` once it is buried. */
  private swarmTank(): void {
    const { world } = this, s = this.s, tank = world.entities.get(s.tankId), ai = world.infected!;
    if (!tank || s.tankPhase === 'silent' || s.tankPhase === 'gone') { if (!this.d.swarmedAt && this.t >= D.lines[2].earliestS) this.d.swarmedAt = world.tick; return; }
    const at = { x: tank.transform.x, z: tank.transform.z };
    for (const e of ai.active) if (e.health.current > 0 && !e.hidden && e.infected?.l1 && dist(e.transform, at) < 30) ai.rush(e.id, at, world.tick + ticks(15));
    if (world.tick % 60 === 0) for (const edge of [5, 4]) s.pend[edge] = Math.min(l4.war.pendMax, s.pend[edge] + this.tier({ high: 6, low: 3 }));
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
      const v = victims[k % victims.length].transform; ai.rush(id, { x: v.x, z: v.z }, world.tick + ticks(20));
    }
    this.d.cutOff = [...groups[g.i]];
  }
  /** Short camera beat on the collapse (mission cinematic: <= 2 s, the sim pauses, skippable after 0.5 s). Skipped while another one runs. */
  private camera(id: string): void { if (this.h.mission.def.cinematics[id]) this.h.mission.cinematic(id); }

  // ------------------------------------------------------------------------------------------------ the Alphas
  /**
   * Gun-nest beat: the first two Alphas walk to their stage outside the line (north-west corner, south slot) and charge the nearest
   * standing soldier inside (the south charge runs through the authored E26 slot and breaks it), then ground-slam the crew. The third
   * (high tier) charges the convoy line at the armour beat. Plain sim moves: telegraphs, cooldowns and soldier fire apply.
   */
  private alphaJobs(): void {
    const { world } = this, s = this.s, d = this.d, ai = world.infected!, tick = world.tick;
    for (const [n, id] of s.alphaIds.entries()) if (!d.alphaJobs.some(j => j.alphaId === id)) {
      const anchor = s.alphaAnchors[n];
      d.alphaJobs.push({ alphaId: id, job: anchor === 'l4-alpha-north' ? 'north' : anchor === 'l4-alpha-south' ? 'south' : 'armor', stage: 'walk', startedAt: tick });
    }
    for (const job of d.alphaJobs) {
      const e = world.entities.get(job.alphaId), b = e?.infected;
      if (!e || !b || e.health.current <= 0 || job.stage === 'done' || b.specialAttack) continue;
      const armor = job.job === 'armor', line = armor ? d.lines[2] : d.lines[1];
      const crews = [...(armor ? [] : s.hmgIds), ...line.soldierIds].map(sid => this.soldier(sid)).filter((x): x is EntitySnapshot => !!x);
      if (!crews.length || (armor ? line.brokeAt : d.lines[1].brokeAt)) { job.stage = 'done'; delete b.scripted; continue; }
      const nearest = crews.sort((p, q) => dist(p.transform, e.transform) - dist(q.transform, e.transform))[0];
      const ready = this.t >= D.lines[armor ? 2 : 1].pushS && d.lines[armor ? 1 : 0].brokeAt > 0;
      if (job.stage === 'walk') {
        // Held at its stage outside the line (ignores targets beyond it) until the beat; the armour Alpha just waits for its beat.
        if (!armor && !ready) { b.scripted = this.h.snap(pt(D.alphaHold[job.job as 'north' | 'south']), .55); continue; }
        if (!ready) continue;
        delete b.scripted; job.stage = 'charge';
      }
      if (job.stage === 'charge') {
        // The nest Alphas charge through their authored E26 slot (breaking it) while it stands; otherwise at the nearest crew member.
        const slot = armor ? null : this.slotInside(job.job as 'north' | 'south'), to = slot ?? nearest.transform;
        const dx = to.x - e.transform.x, dz = to.z - e.transform.z, length = Math.hypot(dx, dz) || 1;
        // Through the slot the sandbags block the sight line by design; the stage is straight outside it.
        const stage = slot ? this.h.snap(pt(D.alphaStage[job.job as 'north' | 'south']), .55) : null;
        if (stage ? dist(e.transform, stage) > 1.2 : length > 11 || !world.combat!.query.visible(e.transform, to)) { b.scripted = stage ?? this.h.snap(to, .55); continue; }
        delete b.scripted;
        if (ai.startSpecial(e.id, 'alpha.charge', { id: nearest.id, x: to.x, z: to.z }, { x: e.transform.x, z: e.transform.z, radius: 1, dx: dx / length, dz: dz / length })) job.stage = 'slam';
        continue;
      }
      // Slam: close on the nearest crew member, then ground-slam within 3.5 m (knocks everyone in 4 m down).
      const cx = nearest.transform.x - e.transform.x, cz = nearest.transform.z - e.transform.z, cl = Math.hypot(cx, cz) || 1;
      if (cl > 3.5) { b.scripted = { x: nearest.transform.x, z: nearest.transform.z }; continue; }
      delete b.scripted;
      if (ai.startSpecial(e.id, 'alpha.ground-slam', { id: nearest.id, x: nearest.transform.x, z: nearest.transform.z }, { x: e.transform.x, z: e.transform.z, radius: 4, dx: cx / cl, dz: cz / cl })) job.stage = armor ? 'charge' : 'done';
    }
  }
  private slotInside(side: 'north' | 'south' | 'south'): Point | null {
    const slot = l4BreakableLine.find(l => l.id === `l4-line-${side}`)!;
    if (!this.world.barricades?.barricadeIntact(slot.id)) return null;
    const a = this.h.mission.def.anchors[slot.anchors.inside]; return a ? { x: a.x, z: a.z } : null;
  }
}
