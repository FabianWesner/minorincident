import { strikeAt } from './helpers';
import { emptyInput, type InputFrame } from '../../input/InputFrame';
import { l7Rocket } from '../../data/l7';
import { l7CorridorAnchors } from '../../levels/L7/corridor';
import type { SimWorld } from '../../sim/world/SimWorld';
import { Walker } from './Walker';

const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** Shared L7 completion policy: pickup, road route, visible threats, group and bus. */
export class LevelSevenBot {
  private readonly walker = new Walker();
  // Walk around the inherited parked school bus south of the crater, with room for the full party.
  private readonly route = [{ x: 88, z: 15 }, { x: 88, z: 46 }, { x: -30, z: 47 }, { x: -36, z: 47 }, { x: -36, z: 41.7 }, { x: -50, z: 41.7 }, { x: -50, z: 47 }, { x: l7CorridorAnchors['l7-bus-boarding'].position[0], z: l7CorridorAnchors['l7-bus-boarding'].position[2] }];
  private waypoint = 0;
  private detour: { x: number; z: number; until: number } | null = null;
  finished = false;
  constructor(private readonly w: SimWorld, readonly profile = 'complete') {}
  sample(): InputFrame {
    const w = this.w, p = w.entities.get(1)!, f = emptyInput();
    this.finished = w.l7Departure?.state.phase === 'done' || w.missions?.state.phase === 'result' || w.missions?.state.phase === 'progression';
    if (this.finished || w.storyLock || this.profile === 'idle' || p.health.current <= 0) return f;
    const pickup = w.l7Encounters!.state.started ? undefined : [...w.entities.iterate()].find(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === l7Rocket.action);
    // A dodge can already take the courier past a corridor corner. Rejoin a
    // forward clear leg instead of walking back to the missed corner and
    // dragging the column through the same turn twice.
    if (!pickup && this.waypoint >= 3) for (let i = this.route.length - 1; i > this.waypoint; i--) {
      const at = this.route[i], d = distance(p.transform, at);
      if (at.x > p.transform.x || !d || !w.infected!.nav.visible(p.transform, at, .45)) continue;
      if (w.solids.sweep(p, { x: (at.x - p.transform.x) / d, z: (at.z - p.transform.z) / d }, d) < d - .01) continue;
      this.waypoint = i; break;
    }
    if (!pickup && this.waypoint < this.route.length - 1 && distance(p.transform, this.route[this.waypoint]) < (this.waypoint >= 3 ? .3 : 2)) this.waypoint++;
    const goal = pickup?.transform ?? this.route[this.waypoint];
    if (!pickup && this.waypoint >= 3 && w.infected!.nav.visible(p.transform, goal, .35)) {
      const dx = goal.x - p.transform.x, dz = goal.z - p.transform.z, d = Math.hypot(dx, dz);
      if (d > .2) f.move = { x: dx / d, z: dz / d };
    } else f.move = this.walker.step(w, goal, pickup ? .5 : this.waypoint >= 3 ? .2 : 1, `${pickup ? 'pickup' : 'bus'}-${this.waypoint}`) ?? f.move;
    if (pickup && distance(p.transform, goal) < 1.45) { f.move = { x: 0, z: 0 }; f.interact = true; }
    const rocket = p.weapons!.RIGHT.rack.findIndex(s => s.id === l7Rocket.action);
    if (rocket >= 0) f.selectedSlot = { side: 'RIGHT', index: rocket };
    const enemies = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.emerging && !e.infectionRise && distance(e.transform, p.transform) < 24 && w.infected!.nav.visible(p.transform, e.transform, 0)).sort((a, b) => distance(a.transform, p.transform) - distance(b.transform, p.transform));
    if (enemies[0] && this.profile !== 'evade-only') {
      const close = distance(enemies[0].transform, p.transform) < 6;
      const backup = p.weapons!.RIGHT.rack.findIndex(s => s.id === 'weapon.shotgun');
      if (close && backup >= 0) f.selectedSlot = { side: 'RIGHT', index: backup };
      strikeAt(f, enemies[0], 'RIGHT', p.transform, false);
    }
    const followers = w.l7Encounters!.state.roster.filter(r => r.status === 'following' && !w.l7Departure!.state.boarded.includes(r.id));
    // Casualties leave holes, not renumbered slots. Counting only the living
    // shortened this wait band below a surviving tail's assigned row.
    const rows = followers.reduce((n, r) => Math.max(n, Math.floor(w.entities.get(r.id)!.civilian!.survivor!.slot / 3) + 1), 0);
    const tail = followers.reduce((n, r) => Math.max(n, w.entities.get(r.id)!.civilian!.survivor!.slot), 0);
    // The walking corridor is two abreast, longer than the street's three
    // columns. Leave two metres for ordinary tracking lag behind its last row;
    // otherwise stopping the leader can leave a settled tail outside the band.
    const limit = Math.max(12, rows * 1.2 + 5, 2.3 + Math.floor(tail / 2) + 2);
    // Reach the bus door before waiting for the last stragglers; the shipped boarding queue owns their recovery there.
    if (!pickup && this.waypoint < this.route.length - 1 && distance(p.transform, goal) > 10) {
      const gap = followers.reduce((n, r) => Math.max(n, distance(w.entities.get(r.id)!.transform, p.transform)), 0);
      // Ease into the same wait band instead of repeatedly running to its
      // edge, stopping the whole party, and making every rank restart.
      const pace = Math.max(0, Math.min(1, (limit - gap) / 1.5));
      f.move.x *= pace; f.move.z *= pace;
    }
    // Clear a firing lane instead of running into a crowd or waiting inside
    // its bites. Reuse the same connected six-metre dodge as the war bot.
    if (!pickup && followers.length && this.profile !== 'evade-only') {
      if (this.detour && (w.tick >= this.detour.until || distance(p.transform, this.detour) < .8)) this.detour = null;
      const alpha = enemies.find(e => e.archetype === 'infected.alpha' && e.infected?.specialAttack?.stage === 'telegraph' && distance(e.transform, p.transform) < 14);
      if (!this.detour && (alpha || enemies[0] && distance(enemies[0].transform, p.transform) < 6)) {
        const at = this.walker.detour(w, goal, (alpha ?? enemies[0]).transform);
        if (at) this.detour = { ...at, until: w.tick + 45 };
      }
      if (this.detour) f.move = this.walker.step(w, this.detour, .8, `dodge-${this.detour.until}`) ?? f.move;
    }
    return f;
  }
}
