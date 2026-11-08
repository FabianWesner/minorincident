import { strikeAt } from './helpers';
import { emptyInput, type InputFrame } from '../../input/InputFrame';
import type { SimWorld } from '../../sim/world/SimWorld';
import { Walker } from './Walker';
/** Shared seeded policy: explore, hold the group together, fight only threats on the route, board the APC. */
export class LevelEightBot {
  finished = false;
  private readonly walker = new Walker();
  private breachHoldStarted = 0;
  constructor(private readonly w: SimWorld, readonly profile = 'complete') {}
  sample(): InputFrame {
    const w = this.w, m = w.missions!, zoo = m.l8!, f = emptyInput(), player = w.entities.get(1)!;
    this.finished = m.state.phase === 'result' || m.state.phase === 'progression';
    if (this.finished || this.profile === 'idle' || player.health.current <= 0) return f;
    const p = player.transform;
    if (w.vehicles!.active !== null) { f.brake = true; return f; }
    const calm = !zoo.state.breachedAt;
    if (!calm && this.profile === 'threat-passive') {
      this.breachHoldStarted ||= w.tick;
      if (w.tick - this.breachHoldStarted < 60 * 60) return f;
    }
    const door = zoo.door(), car = w.vehicles!.cars.get(zoo.state.carId)!.entity.vehicle!;
    const boarded = zoo.passengers().every(id => car.passengers?.some(p => p.id === id && p.phase === 'seated'));
    // Cover the queue on foot; the APC has no gun. Stand clear of its door so
    // the courier's body does not obstruct passengers, then board last.
    const target = m.state.steps.sanctuary.status === 'active' ? m.def.anchors['zoo-gate'] : boarded ? door : { x: door.x - 4, z: door.z + 2 };
    if (!calm) {
      const enemies = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.emerging && !e.infectionRise && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 16 && w.infected!.director.inPlayerView(e.transform, 16, 1, 5) && w.infected!.nav.visible(p, e.transform, 0)).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z));
      const enemy = enemies[0];
      if (enemy && this.profile !== 'evade-only') { strikeAt(f, enemy, 'RIGHT', p, false); }
      const live = zoo.roster().map(id => w.entities.get(id)).filter(e => e && e.health.current > 0 && !e.infected && e.passengerOf === undefined);
      if (Math.hypot(p.x - target.x, p.z - target.z) > 10 && live.some(e => Math.hypot(e!.transform.x - p.x, e!.transform.z - p.z) > Math.max(12, Math.ceil(live.length / 3) * 1.2 + 5))) return f;
    }
    f.move = this.walker.step(w, target, calm ? 1 : .35, calm ? 'explore' : 'apc') ?? f.move;
    if (!calm && boarded && Math.hypot(p.x - door.x, p.z - door.z) < .6) { f.move = { x: 0, z: 0 }; f.interact = true; }
    return f;
  }
}
