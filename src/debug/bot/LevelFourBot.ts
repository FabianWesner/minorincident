import { Rng } from '../../core/Rng';
import { l4 } from '../../data/l4';
import { emptyInput, type InputFrame } from '../../input/InputFrame';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { EntitySnapshot } from '../../sim/world/types';
import { Walker } from './Walker';

/** E22 section 8 bot profiles. `evade-only` never attacks; `idle` goes to the quartermaster and stays there. */
export type L4Profile = 'complete' | 'newbie' | 'evade-only' | 'idle';
/** Route to Kessler Lane (AC01): Harbor Street in the north, Lakeshore Avenue in the south; `auto` picks the emptier one at the line break. */
export type L4RouteChoice = 'auto' | 'harbor' | 'lakeshore';
type P = { x: number; z: number };
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z);
const ROUTES: Record<'harbor' | 'lakeshore', P[]> = {
  harbor: [{ x: -39.2, z: -36.4 }, { x: 24, z: -36.4 }, { x: 48.6, z: -30 }],
  lakeshore: [{ x: -19, z: 43.4 }, { x: 24, z: 43.4 }, { x: 48.6, z: 40 }],
};

/**
 * L4 policy shared by the Node battery and the browser (ordinary controls only: movement, attack, interact; no cheats).
 * Complete: reports to the quartermaster (machine gun), holds the plaza behind the line shooting what comes within range, axes what
 * gets close, backs off a crowd, and when the line breaks runs for Kessler's cellar along the emptier route, picking up medkits when
 * hurt, then bars the door. Newbie: 250 ms reaction, 15 % skipped attacks, shorter range, occasional wrong turns. Evade-only: never
 * attacks. Idle: stays at the quartermaster.
 */
export class LevelFourBot {
  finished = false;
  private readonly walker = new Walker();
  private readonly rng: Rng;
  private frame: InputFrame = emptyInput();
  private route: 'harbor' | 'lakeshore';
  private leg = 0;
  private detour: (P & { until: number }) | null = null;
  private stuck = { at: null as P | null, n: 0, next: 0 };
  private medkit = 0;
  constructor(private readonly world: SimWorld, readonly profile: L4Profile = 'complete', readonly forced: L4RouteChoice = 'auto') {
    this.rng = new Rng(world.seed, `l4-bot-${profile}-${forced}`);
    this.route = forced === 'auto' ? 'lakeshore' : forced;
  }
  debug() { return { route: this.route, leg: this.leg, detour: this.detour, medkit: this.medkit, stuck: this.stuck.n }; }
  private threats(p: P, radius: number): EntitySnapshot[] {
    const w = this.world;
    return (w.infected?.active ?? []).filter(e => e.health.current > 0 && !e.hidden && !e.infected?.hidden && !e.infectionRise && dist(e.transform, p) <= radius && w.infected!.nav.visible(p, e.transform, 0))
      .sort((a, b) => dist(a.transform, p) - dist(b.transform, p));
  }
  private chasing(e: EntitySnapshot): boolean { const b = e.infected?.l1; return !!b && (b.mode === 'chase' || b.mode === 'bite') && b.targetId === 1; }
  sample(): InputFrame {
    const w = this.world, m = w.missions!, s = m.state.l4;
    this.finished = m.state.phase === 'result' || m.state.phase === 'progression';
    if (this.finished || !s) return emptyInput();
    if (m.state.phase === 'retry') { m.restore(); this.walker.reset(); this.detour = null; this.leg = 0; }
    if (m.state.phase === 'briefing') m.begin();
    if (m.state.phase === 'cinematic') return { ...emptyInput(), interact: true };
    const newbie = this.profile === 'newbie';
    if (newbie && w.tick % 15 !== 0) { this.frame.interact = false; return this.frame; }
    const frame = this.frame = emptyInput(), player = w.entities.get(1)!, p = player.transform, a = m.def.anchors;
    if (player.health.current <= 0 || s.phase === 'convoy') return frame;
    const go = (target: P, stop: number, key: string) => { const dir = this.walker.step(w, target, stop, key); if (dir) frame.move = dir; return !dir; };
    const strike = (target: EntitySnapshot, side: 'LEFT' | 'RIGHT') => {
      frame.attackTarget = { id: target.id, side }; frame.move = { x: 0, z: 0 };
      if (side === 'LEFT') frame.left.held = true; else frame.right.held = true;
    };
    const fights = this.profile !== 'evade-only', skip = newbie && this.rng.next() < .15;
    const gun = w.combat?.runner.loadout.state.RIGHT.rack.some(r => r.id === l4.machineGun.id) ?? false;
    const near = this.threats(p, 2.4);
    // Fight: the axe for what is at arm's length, the machine gun for what comes at the courier from range (before contact).
    const fight = (range: number): boolean => {
      if (!fights || skip) return false;
      if (near[0]) { strike(near[0], 'LEFT'); return true; }
      if (!gun) return false;
      const shot = this.threats(p, range).find(e => this.chasing(e) || dist(e.transform, p) < 11);
      if (shot) { strike(shot, 'RIGHT'); return true; }
      return false;
    };
    // ---------------------------------------------------------------- the plaza: the quartermaster, then hold the line
    if (s.phase === 'plaza') { const q = a['l4-quartermaster']; if (go(q, .4, 'qm')) frame.interact = !newbie || this.rng.next() < .6; return frame; }
    if (this.profile === 'idle') { go(a['l4-quartermaster'], .6, 'idle'); if (!s.gunAt) frame.interact = true; return frame; }
    if (s.phase === 'war') {
      if (fight(newbie ? 13 : 20)) return frame;
      // Back off from a crowd that is closing in (fight a few, flee from many): toward the middle of the ring, away from the nearest.
      const crowd = this.threats(p, 5), many = this.threats(p, 10).filter(e => this.chasing(e)).length;
      if ((crowd.length >= 4 || many >= 6) && fights) { const at = this.walker.detour(w, { x: -20, z: 3 }, crowd[0]?.transform); if (at) this.detour = { ...at, until: w.tick + 70 }; }
      if (this.detour && w.tick < this.detour.until && dist(p, this.detour) > .8) { go(this.detour, .8, `det-${this.detour.until}`); return frame; }
      go({ x: -21.5, z: 3 }, 1.4, 'hold');
      return frame;
    }
    // ---------------------------------------------------------------- the collapse: run for the cellar, then bar the door
    if (s.phase === 'cellar' || s.phase === 'done') {
      const brace = a['l4-brace']; if (go(brace, .35, 'brace')) frame.interact = !newbie || this.rng.next() < .6;
      return frame;
    }
    const hp = player.health.current / player.health.max;
    if (!this.medkit && hp <= (newbie ? .9 : .65)) {
      const kit = s.medkitIds.map(id => w.entities.get(id)).filter((e): e is EntitySnapshot => !!e?.pickup && 'kind' in e.pickup && !e.pickup.collected)
        .filter(e => dist(e.transform, p) < (newbie ? 34 : 22)).sort((x, y) => dist(x.transform, p) - dist(y.transform, p))[0];
      if (kit) this.medkit = kit.id;
    }
    if (this.medkit) {
      const kit = w.entities.get(this.medkit);
      if (!kit?.pickup || !('kind' in kit.pickup) || kit.pickup.collected || hp > (newbie ? .99 : .95)) this.medkit = 0;
      else { if (fight(8)) return frame; go(kit.transform, .2, `kit-${this.medkit}`); return frame; }
    }
    // Pick the emptier route once, at the break (forced runs keep theirs).
    if (this.leg === 0 && this.forced === 'auto' && !this.detour) {
      const density = (r: 'harbor' | 'lakeshore') => this.threats({ x: p.x, z: p.z }, 40).filter(e => (r === 'harbor') === (e.transform.z < 0)).length;
      this.route = density('harbor') < density('lakeshore') ? 'harbor' : 'lakeshore';
    }
    // A jammed walker steps aside along a connected route.
    if (w.tick >= this.stuck.next) {
      this.stuck.next = w.tick + 60;
      if (this.stuck.at && dist(this.stuck.at, p) < .6 && !near.length && !frame.attackTarget) this.stuck.n++; else this.stuck.n = 0;
      this.stuck.at = { x: p.x, z: p.z };
      if (this.stuck.n >= 3) { const at = this.walker.detour(w, { x: p.x + 8, z: p.z }); this.detour = at ? { ...at, until: w.tick + 150 } : null; this.stuck.n = 0; }
    }
    if (this.detour && (w.tick > this.detour.until || dist(p, this.detour) < 1)) { this.detour = null; this.walker.reset(); }
    const crowd = this.threats(p, 4.5), many = this.threats(p, 9).filter(e => this.chasing(e)).length;
    const door = a['l4-cellar-door'];
    if (!this.detour && (crowd.length >= (fights ? 4 : 2) || many >= 6) && (hp < .5 || !fights || many >= 6)) { const at = this.walker.detour(w, door, crowd[0]?.transform ?? this.threats(p, 9)[0]?.transform); if (at) this.detour = { ...at, until: w.tick + 90 }; }
    if (newbie && !this.detour && this.rng.next() < .0015) this.detour = { x: p.x - 4 + this.rng.next() * 8, z: p.z + (this.rng.next() - .5) * 10, until: w.tick + 180 };
    if (this.detour) { if (crowd.length < 2 && fight(5)) return frame; go(this.detour, .8, `detour-${this.detour.until}`); return frame; }
    if (fight(newbie ? 11 : 10)) return frame;
    // Waypoints of the route (the grid path takes the cross streets by itself), then the cellar door: stand in its ring to descend.
    const legs = ROUTES[this.route];
    while (this.leg < legs.length && dist(p, legs[this.leg]) < 3) this.leg++;
    if (this.leg < legs.length) {
      if (go(legs[this.leg], 1.5, `route-${this.route}-${this.leg}`) && dist(p, legs[this.leg]) > 3) { this.route = this.route === 'harbor' ? 'lakeshore' : 'harbor'; this.leg = 0; this.walker.reset(); }
      return frame;
    }
    if (go(door, .45, 'door')) frame.interact = !newbie || this.rng.next() < .6;
    return frame;
  }
}
