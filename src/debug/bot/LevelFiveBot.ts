import { Rng } from '../../core/Rng';
import { l5, l5Survivors } from '../../data/l5';
import { emptyInput, type InputFrame } from '../../input/InputFrame';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { EntitySnapshot } from '../../sim/world/types';
import { Walker } from './Walker';

/**
 * E23 section 8 bot profiles. `complete` walks the cheapest tour of the five hiding places, escorts (waits for the group, defends it with
 * the machine gun and the axe) and leads whoever is left to the Metro; `newbie` reacts 250 ms late, skips attacks and tours greedily;
 * `evade-only` escorts but never attacks (it only walks away from infected); `idle` unbars the door and stays where it stands.
 */
export type L5Profile = 'complete' | 'newbie' | 'evade-only' | 'idle';
type P = { x: number; z: number };
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z);

/** The tour of the five rings (and the Metro at the end) of minimum length: 120 permutations. */
export function cheapestTour(from: P, rings: Record<string, P>, keys: string[], end: P): string[] {
  let best: string[] = [...keys], bestLength = Infinity;
  const walk = (order: string[], rest: string[], at: P, length: number) => {
    if (length >= bestLength) return;
    if (!rest.length) { const total = length + dist(at, end); if (total < bestLength) { bestLength = total; best = order; } return; }
    for (const key of rest) walk([...order, key], rest.filter(k => k !== key), rings[key], length + dist(at, rings[key]));
  };
  walk([], keys, from, 0);
  return best;
}

export class LevelFiveBot {
  finished = false;
  private readonly walker = new Walker();
  private readonly rng: Rng;
  private frame: InputFrame = emptyInput();
  private order: string[] | null = null;
  private detour: (P & { until: number }) | null = null;
  private stuck = { at: null as P | null, n: 0, next: 0 };
  private medkit = 0;
  private lag = 0;
  constructor(private readonly world: SimWorld, readonly profile: L5Profile = 'complete') { this.rng = new Rng(world.seed, `l5-bot-${profile}`); }
  debug() { return { order: this.order, detour: this.detour, medkit: this.medkit, stuck: this.stuck.n }; }
  private threats(p: P, radius: number): EntitySnapshot[] {
    const w = this.world;
    return (w.infected?.active ?? []).filter(e => e.health.current > 0 && !e.hidden && !e.infected?.hidden && !e.infectionRise && dist(e.transform, p) <= radius && w.infected!.nav.visible(p, e.transform, 0))
      .sort((a, b) => dist(a.transform, p) - dist(b.transform, p));
  }
  private chasing(e: EntitySnapshot): boolean { const b = e.infected?.l1; return !!b && (b.mode === 'chase' || b.mode === 'bite') && (b.targetId === 1 || !!this.world.entities.get(b.targetId)?.civilian?.survivor); }
  /** Followers alive right now, as entities. */
  private group(): EntitySnapshot[] {
    const s = this.world.missions!.state.l5!;
    return s.survivors.filter(r => r.status === 'following').map(r => this.world.entities.get(r.id)).filter((e): e is EntitySnapshot => !!e);
  }
  sample(): InputFrame {
    const w = this.world, m = w.missions!, s = m.state.l5;
    this.finished = m.state.phase === 'result' || m.state.phase === 'progression';
    if (this.finished || !s) return emptyInput();
    if (m.state.phase === 'retry') { m.restore(); this.walker.reset(); this.detour = null; }
    if (m.state.phase === 'briefing') m.begin();
    if (m.state.phase === 'cinematic') return { ...emptyInput(), interact: true };
    const newbie = this.profile === 'newbie';
    if (newbie && w.tick % 15 !== 0) { this.frame.interact = false; return this.frame; }
    const frame = this.frame = emptyInput(), player = w.entities.get(1)!, p = player.transform, a = m.def.anchors;
    if (player.health.current <= 0) return frame;
    const go = (target: P, stop: number, key: string) => { const dir = this.walker.step(w, target, stop, key); if (dir) frame.move = dir; return !dir; };
    const strike = (target: EntitySnapshot, side: 'LEFT' | 'RIGHT') => {
      frame.attackTarget = { id: target.id, side }; frame.move = { x: 0, z: 0 };
      if (side === 'LEFT') frame.left.held = true; else frame.right.held = true;
    };
    // ---------------------------------------------------------------- the cellar: unbar the door
    if (s.phase === 'cellar') { if (go(a['l5-brace'], .4, 'brace')) frame.interact = !newbie || this.rng.next() < .6; return frame; }
    if (this.profile === 'idle') return frame;
    const fights = this.profile !== 'evade-only', skip = newbie && this.rng.next() < .15;
    const gun = w.combat?.runner.loadout.state.RIGHT.rack.some(r => r.id === 'weapon.army-mg') ?? false;
    const near = this.threats(p, 2.4), friends = this.group();
    // Fight: the axe for what is at arm's length; the machine gun for what chases the courier or any of the group (before contact).
    const fight = (range: number): boolean => {
      if (!fights || skip) return false;
      if (near[0]) { strike(near[0], 'LEFT'); return true; }
      if (!gun) return false;
      const shot = this.threats(p, range).find(e => this.chasing(e) || dist(e.transform, p) < 9 || friends.some(f => dist(e.transform, f.transform) < 7));
      if (shot) { strike(shot, 'RIGHT'); return true; }
      return false;
    };
    // ---------------------------------------------------------------- the first seconds of silence: look around, walk nowhere
    if (s.phase === 'emerged') return frame;
    if (fight(newbie ? 12 : 18)) return frame;
    const hp = player.health.current / player.health.max;
    if (!this.medkit && hp <= (newbie ? .8 : .55)) {
      const kit = s.medkitIds.map(id => w.entities.get(id)).filter((e): e is EntitySnapshot => !!e?.pickup && 'kind' in e.pickup && !e.pickup.collected)
        .filter(e => dist(e.transform, p) < (newbie ? 30 : 20)).sort((x, y) => dist(x.transform, p) - dist(y.transform, p))[0];
      if (kit) this.medkit = kit.id;
    }
    if (this.medkit) {
      const kit = w.entities.get(this.medkit);
      if (!kit?.pickup || !('kind' in kit.pickup) || kit.pickup.collected || hp > (newbie ? .99 : .95)) this.medkit = 0;
      else { go(kit.transform, .2, `kit-${this.medkit}`); return frame; }
    }
    // A follower crouching in cover has an infected close by: go back to the group and deal with it (the complete bot never walks off on them).
    const covered = friends.filter(f => f.civilian?.survivor?.cover);
    if (fights && covered.length) {
      const f = covered[0], hot = (w.infected?.active ?? []).filter(e => e.health.current > 0 && !e.hidden && !e.infectionRise && dist(e.transform, f.transform) < 10).sort((x, y) => dist(x.transform, f.transform) - dist(y.transform, f.transform))[0];
      if (hot && dist(p, hot.transform) > 8) { go(hot.transform, 7, `help-${f.id}`); return frame; }
      // A grabber hides behind its victim from the machine gun: walk up and hit it with the axe (a hit during the grab frees the survivor).
      if (hot && hot.infected?.l1?.mode === 'bite' && dist(p, hot.transform) > 2) { go(hot.transform, 1.6, `rescue-${hot.id}`); if (dist(p, hot.transform) <= 2.4) strike(hot, 'LEFT'); return frame; }
      if (hot) { strike(hot, dist(p, hot.transform) <= 2.4 ? 'LEFT' : 'RIGHT'); return frame; }
    }
    // A jammed walker steps aside along a connected route.
    if (w.tick >= this.stuck.next) {
      this.stuck.next = w.tick + 60;
      if (this.stuck.at && dist(this.stuck.at, p) < .6 && !near.length && !frame.attackTarget) this.stuck.n++; else this.stuck.n = 0;
      this.stuck.at = { x: p.x, z: p.z };
      if (this.stuck.n >= 3) { const at = this.walker.detour(w, { x: p.x + 8, z: p.z }); this.detour = at ? { ...at, until: w.tick + 150 } : null; this.stuck.n = 0; }
    }
    if (this.detour && (w.tick > this.detour.until || dist(p, this.detour) < 1)) { this.detour = null; this.walker.reset(); }
    // Evade-only walks away from what is close instead of fighting it.
    const crowd = this.threats(p, 4.5);
    if (!fights && !this.detour && crowd.length) { const at = this.walker.detour(w, a['l5-metro-foot'], crowd[0].transform); if (at) this.detour = { ...at, until: w.tick + 90 }; }
    if (this.detour) { go(this.detour, .8, `detour-${this.detour.until}`); return frame; }
    // The group lags: wait for it (the complete bot) rather than walking off.
    const far = friends.filter(f => dist(f.transform, p) > 6);
    if (fights && far.length && this.lag < (newbie ? 240 : 300) && s.phase !== 'metro') { this.lag++; return frame; }
    if (!far.length) this.lag = 0; else if (++this.lag > 700) this.lag = 0;
    // ---------------------------------------------------------------- the search: the cheapest tour of the five rings
    if (s.phase === 'search') {
      if (!this.order) {
        const rings = Object.fromEntries(l5Survivors.map(d => [d.key, { x: a[`l5-ring-${d.key}`].x, z: a[`l5-ring-${d.key}`].z }]));
        const keys = l5Survivors.map(d => d.key);
        this.order = newbie ? [...keys].sort((x, y) => dist(p, rings[x]) - dist(p, rings[y])) : cheapestTour(p, rings, keys, a['l5-metro-foot']);
      }
      const next = this.order.find(k => s.survivors.find(r => r.key === k)?.status === 'hidden');
      if (next) {
        const ring = a[`l5-ring-${next}`];
        if (go(ring, .45, `ring-${next}`)) frame.interact = true;
        return frame;
      }
    }
    // ---------------------------------------------------------------- the Metro: stand at the foot until the shutter closes
    const foot = a['l5-metro-foot'];
    go(foot, Math.max(.6, foot.radius * .35), 'metro');
    return frame;
  }
}
void l5;
