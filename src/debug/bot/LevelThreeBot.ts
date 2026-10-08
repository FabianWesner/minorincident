import { Rng } from '../../core/Rng';
import { l3, l3Street } from '../../data/l3';
import { emptyInput, type InputFrame } from '../../input/InputFrame';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { EntitySnapshot } from '../../sim/world/types';
import { Walker } from './Walker';

/** E21 section 8 bot profiles. `evade-only` never attacks; `idle` stays where it starts in the station yard. */
export type L3Profile = 'complete' | 'newbie' | 'evade-only' | 'idle';
/** Forced street (AC11): the bot keeps to one avenue up to On-ramp Road; `auto` switches streets by what it sees. */
export type L3StreetChoice = 'auto' | 'blvd' | 'commerce' | 'oak';
type P = { x: number; z: number };
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z);
const STREETS = ['blvd', 'commerce', 'oak'] as const;
/** Cross-links the bot may switch streets at (full cross streets and the mid-block alleys). */
const LINKS = [-120, -90, -55, -15, 40, 85, 128];

/**
 * L3 policy shared by the Node battery and the browser (ordinary controls only: movement, attack, interact; no cheats).
 * Complete: takes the handgun, holds the yard with the police until the fallback, then moves up the avenues with the squad
 * (waiting for it in the first two segments), shoots what comes at it before contact and axes what gets close, switches
 * streets around the densest groups and picks up medkits when hurt. Newbie: 250 ms reaction, 15 % skipped attacks, shorter
 * shooting range, never waits for the squad, occasional wrong turns. Evade-only: never attacks; runs, sidesteps, switches.
 */
export class LevelThreeBot {
  finished = false;
  private readonly walker = new Walker();
  private readonly rng: Rng;
  private frame: InputFrame = emptyInput();
  private street: 'blvd' | 'commerce' | 'oak';
  private detour: (P & { until: number }) | null = null;
  private stuck = { at: null as P | null, n: 0, next: 0 };
  private last: P | null = null;
  private medkit = 0;
  private decidedAt: number | null = null;
  private waiting = false;
  private waitedSince = 0;
  constructor(private readonly world: SimWorld, readonly profile: L3Profile = 'complete', readonly forced: L3StreetChoice = 'auto') {
    this.rng = new Rng(world.seed, `l3-bot-${profile}-${forced}`);
    this.street = forced === 'auto' ? 'commerce' : forced;
  }
  /** Infected the player can see (line of sight on the walk grid), nearest first. */
  private threats(p: P, radius: number): EntitySnapshot[] {
    const w = this.world;
    return (w.infected?.active ?? []).filter(e => e.health.current > 0 && !e.hidden && !e.infected?.hidden && !e.infectionRise && dist(e.transform, p) <= radius && w.infected!.nav.visible(p, e.transform, 0))
      .sort((a, b) => dist(a.transform, p) - dist(b.transform, p));
  }
  private chasing(e: EntitySnapshot): boolean { const b = e.infected?.l1; return !!b && (b.mode === 'chase' || b.mode === 'bite') && b.targetId === 1; }
  sample(): InputFrame {
    const w = this.world, m = w.missions!, s = m.state.l3;
    this.finished = m.state.phase === 'result' || m.state.phase === 'progression';
    if (this.finished || !s) return emptyInput();
    if (m.state.phase === 'retry') { m.restore(); this.walker.reset(); this.detour = null; }
    if (m.state.phase === 'briefing') m.begin();
    if (m.state.phase === 'cinematic') return { ...emptyInput(), interact: true };
    const newbie = this.profile === 'newbie';
    if (newbie && w.tick % 15 !== 0) { this.frame.interact = false; return this.frame; }
    const frame = this.frame = emptyInput(), player = w.entities.get(1)!, p = player.transform, a = m.def.anchors;
    if (player.health.current <= 0 || this.profile === 'idle') return frame;
    const go = (target: P, stop: number, key: string) => { const dir = this.walker.step(w, target, stop, key); if (dir) frame.move = dir; return !dir; };
    const strike = (target: EntitySnapshot, side: 'LEFT' | 'RIGHT') => {
      frame.attackTarget = { id: target.id, side }; frame.move = { x: 0, z: 0 };
      if (side === 'LEFT') frame.left.held = true; else frame.right.held = true;
    };
    const fights = this.profile !== 'evade-only', skip = newbie && this.rng.next() < .15;
    const gun = w.combat?.runner.loadout.state.RIGHT.rack.some(r => r.id === 'weapon.pistol') ?? false;
    const near = this.threats(p, 2.4);
    // Fight: the axe for what is at arm's length, the handgun for what comes at the courier from range (before contact).
    const fight = (range: number): boolean => {
      if (!fights || skip) return false;
      if (near[0]) { strike(near[0], 'LEFT'); return true; }
      if (!gun) return false;
      const shot = this.threats(p, range).find(e => this.chasing(e) || dist(e.transform, p) < 9);
      if (shot) { strike(shot, 'RIGHT'); return true; }
      return false;
    };
    // ---------------------------------------------------------------- the yard: handgun, then hold with the police
    if (s.phase === 'yard' || s.phase === 'attack') {
      if (m.state.steps.armory.status === 'active') { if (go(a['l3-armory'], .5, 'armory')) frame.interact = !newbie || this.rng.next() < .6; if (!frame.interact) fight(14); return frame; }
      if (fight(newbie ? 12 : 16)) return frame;
      go({ x: -134.5, z: 1.5 }, 1.2, 'hold');
      return frame;
    }
    // ---------------------------------------------------------------- the avenues
    if (this.last && dist(this.last, p) > 6) { this.walker.reset(); this.detour = null; }
    this.last = { x: p.x, z: p.z };
    const hp = player.health.current / player.health.max;
    // Medkits when hurt: the nearest one ahead or close by that is still there.
    if (!this.medkit && hp <= (newbie ? .5 : .65)) {
      const kit = s.medkitIds.map(id => w.entities.get(id)).filter((e): e is EntitySnapshot => !!e?.pickup && 'kind' in e.pickup && !e.pickup.collected)
        .filter(e => dist(e.transform, p) < 24 && e.transform.x > p.x - 10).sort((x, y) => dist(x.transform, p) - dist(y.transform, p))[0];
      if (kit) this.medkit = kit.id;
    }
    if (this.medkit) {
      const kit = w.entities.get(this.medkit);
      if (!kit?.pickup || !('kind' in kit.pickup) || kit.pickup.collected || hp > .95) this.medkit = 0;
      else { if (fight(8)) return frame; go(kit.transform, .2, `kit-${this.medkit}`); return frame; }
    }
    // Street choice at the cross-links: keep away from the densest group the courier can see ahead.
    if (this.forced === 'auto' && p.x < 122) {
      const link = LINKS.find(x => Math.abs(p.x - x) < 3.2);
      // One decision per cross-link (no dithering between two streets at the same corner).
      if (link !== undefined && link !== this.decidedAt) {
        this.decidedAt = link;
        const ahead = (st: typeof STREETS[number]) => this.threats(p, 32).filter(e => l3Street(e.transform.z) === st && e.transform.x > p.x - 2).length + (st === this.street ? -1.5 : 0) + Math.abs(STREETS.indexOf(st) - STREETS.indexOf(this.street)) * .8;
        const best = [...STREETS].sort((x, y) => ahead(x) - ahead(y))[0];
        if (best !== this.street) { this.street = best; this.walker.reset(); }
      }
    }
    // A jammed walker (crowd, wreck or corner) steps aside along a connected route.
    if (w.tick >= this.stuck.next) {
      this.stuck.next = w.tick + 60;
      if (this.stuck.at && dist(this.stuck.at, p) < .6 && !near.length && !frame.attackTarget) this.stuck.n++; else this.stuck.n = 0;
      this.stuck.at = { x: p.x, z: p.z };
      if (this.stuck.n >= 3) { const at = this.walker.detour(w, { x: p.x + 10, z: p.z }); this.detour = at ? { ...at, until: w.tick + 150 } : null; this.stuck.n = 0; }
    }
    if (this.detour && (w.tick > this.detour.until || dist(p, this.detour) < 1)) { this.detour = null; this.walker.reset(); }
    const crowd = this.threats(p, 4.5), many = this.threats(p, 9).filter(e => this.chasing(e)).length;
    // Fight a few, flee from many: a crowd closing in (or a losing fight) means breaking away forward, not standing.
    if (!this.detour && (crowd.length >= (fights ? 4 : 2) || many >= 6) && (hp < .5 || !fights || many >= 6)) { const at = this.walker.detour(w, { x: p.x + 12, z: l3.map.streets[this.street] }, crowd[0]?.transform ?? this.threats(p, 9)[0]?.transform); if (at) this.detour = { ...at, until: w.tick + 90 }; }
    if (newbie && !this.detour && this.rng.next() < .0015) this.detour = { x: p.x - 6 + this.rng.next() * 8, z: p.z + (this.rng.next() - .5) * 12, until: w.tick + 180 };
    if (this.detour) { if (crowd.length < 2 && fight(5)) return frame; go(this.detour, .8, `detour-${this.detour.until}`); return frame; }
    // With a strong squad in the first segment a careful courier lets the officers shoot (only close threats are its own).
    // Segment 3 is the run-away part: fight only what is about to grab the courier, keep moving otherwise.
    const range = newbie ? 11 : this.profile === 'complete' && s.squad.length >= 2 && p.x < l3.map.segments[0][1] ? 7 : p.x >= l3.map.segments[2][0] ? 6 : 15;
    if (fight(range)) return frame;
    // The first two segments with a squad: a careful courier lets the officers keep up (no waiting in segment 3).
    if (this.profile === 'complete' && s.squad.length && p.x < 50 && p.x > -100) {
      const lag = Math.max(...s.squad.map(q => { const e = w.entities.get(q.id); return e ? dist(e.transform, p) : 0; }));
      // A careful courier waits a few seconds for a straggler, not forever (an officer stuck on a wreck is left behind).
      if (lag <= 7) this.waiting = false;
      else if (!this.threats(p, 20).some(e => this.chasing(e))) {
        if (!this.waiting) { this.waiting = true; this.waitedSince = w.tick; }
        if (w.tick - this.waitedSince < 300) return frame;
      }
    }
    // Forward: along the street, then up On-ramp Road to the checkpoint lane and through the zone line.
    const zone = a['l3-zone'];
    if (p.x > 118) { if (Math.abs(p.z) > 2.2 && p.x < 131) go({ x: 129, z: 0 }, .8, 'onramp'); else go({ x: zone.x + 3, z: 0 }, .3, 'zone'); return frame; }
    // A point 24 m ahead on the chosen street (on clear ground); the grid route takes the cross-links by itself.
    const nav = w.infected!.nav, z = l3.map.streets[this.street], ahead = Math.min(124, Math.floor(p.x / 12) * 12 + 24);
    let target = { x: ahead, z };
    for (const dz of [0, 1.5, -1.5, 3, -3, 4.5, -4.5]) if (nav.clear(ahead, z + dz, .45)) { target = { x: ahead, z: z + dz }; break; }
    if (go(target, .8, `route-${this.street}-${target.x}`) && dist(p, target) > 1.6) {
      // No route to that point (a closed pocket): take the next street over, or step aside when the street is forced.
      if (this.forced === 'auto') { this.street = STREETS[(STREETS.indexOf(this.street) + 1) % 3]; this.walker.reset(); }
      else { const at = this.walker.detour(w, { x: p.x + 10, z }); if (at) this.detour = { ...at, until: w.tick + 120 }; }
    }
    return frame;
  }
}
