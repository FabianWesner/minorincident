import { emptyInput, type InputFrame } from '../../input/InputFrame';
import { l7Rocket } from '../../data/l7';
import { l7CorridorAnchors } from '../../levels/L7/corridor';
import type { SimWorld } from '../../sim/world/SimWorld';
import { Walker } from './Walker';

const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** Shared L7 completion policy: pickup, road route, visible threats, group and bus. */
export class LevelSevenBot {
  private readonly walker = new Walker();
  private readonly route = [{ x: 88, z: 15 }, { x: 88, z: 46 }, { x: l7CorridorAnchors['l7-bus-boarding'].position[0], z: l7CorridorAnchors['l7-bus-boarding'].position[2] }];
  private waypoint = 0;
  finished = false;
  constructor(private readonly w: SimWorld, readonly profile = 'complete') {}
  sample(): InputFrame {
    const w = this.w, p = w.entities.get(1)!, f = emptyInput();
    this.finished = w.l7Departure?.state.phase === 'done' || w.missions?.state.phase === 'result' || w.missions?.state.phase === 'progression';
    if (this.finished || w.storyLock || this.profile === 'idle' || p.health.current <= 0) return f;
    const pickup = w.l7Encounters!.state.started ? undefined : [...w.entities.iterate()].find(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === l7Rocket.action);
    if (!pickup && this.waypoint < this.route.length - 1 && distance(p.transform, this.route[this.waypoint]) < 2) this.waypoint++;
    const goal = pickup?.transform ?? this.route[this.waypoint];
    f.move = this.walker.step(w, goal, pickup ? .5 : 1, `${pickup ? 'pickup' : 'bus'}-${this.waypoint}`) ?? f.move;
    if (pickup && distance(p.transform, goal) < 1.45) { f.move = { x: 0, z: 0 }; f.interact = true; }
    const rocket = p.weapons!.RIGHT.rack.findIndex(s => s.id === l7Rocket.action);
    if (rocket >= 0) f.selectedSlot = { side: 'RIGHT', index: rocket };
    const enemies = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.emerging && !e.infectionRise && distance(e.transform, p.transform) < 24 && w.infected!.nav.visible(p.transform, e.transform, 0)).sort((a, b) => distance(a.transform, p.transform) - distance(b.transform, p.transform));
    if (enemies[0] && this.profile !== 'evade-only') { f.attackTarget = { id: enemies[0].id, side: 'RIGHT' }; f.right.held = true; }
    const followers = w.l7Encounters!.state.roster.filter(r => r.status === 'following' && !w.l7Departure!.state.boarded.includes(r.id));
    const limit = Math.max(12, Math.ceil(followers.length / 3) * 1.2 + 5);
    if (!pickup && distance(p.transform, goal) > 10 && followers.some(r => { const e = w.entities.get(r.id); return e && distance(e.transform, p.transform) > limit; })) f.move = { x: 0, z: 0 };
    return f;
  }
}
