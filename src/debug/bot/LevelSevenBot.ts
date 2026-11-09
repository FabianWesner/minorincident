import { strikeAt } from './helpers';
import { emptyInput, type InputFrame } from '../../input/InputFrame';
import { l7Rocket } from '../../data/l7';
import { l7CorridorAnchors } from '../../levels/L7/corridor';
import type { SimWorld } from '../../sim/world/SimWorld';
import { Walker } from './Walker';
import { solidLargeCorpse } from '../../sim/world/SolidRegistry';

const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** Shared L7 completion policy: pickup, road route, visible threats, group and bus. */
export class LevelSevenBot {
  private readonly walker = new Walker();
  // Walk around the inherited parked school bus south of the crater, with room for the full party.
  private readonly route = [{ x: 88, z: 15 }, { x: 88, z: 46 }, { x: -30, z: 47 }, { x: -36, z: 47 }, { x: -36, z: 41.7 }, { x: -50, z: 41.7 }, { x: -50, z: 47 }, { x: l7CorridorAnchors['l7-bus-boarding'].position[0], z: l7CorridorAnchors['l7-bus-boarding'].position[2] }];
  private waypoint = 0;
  private avoidCorpses = false;
  finished = false;
  constructor(private readonly w: SimWorld, readonly profile = 'complete') {}
  sample(): InputFrame {
    const w = this.w, p = w.entities.get(1)!, f = emptyInput();
    this.finished = w.l7Departure?.state.phase === 'done' || w.missions?.state.phase === 'result' || w.missions?.state.phase === 'progression';
    if (this.finished || w.storyLock || this.profile === 'idle' || p.health.current <= 0) return f;
    const blocker = w.solids.blockingBody(1);
    if (blocker && solidLargeCorpse(blocker)) this.avoidCorpses = true;
    const pickup = w.l7Encounters!.state.started ? undefined : [...w.entities.iterate()].find(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === l7Rocket.action);
    if (!pickup && this.waypoint < this.route.length - 1 && distance(p.transform, this.route[this.waypoint]) < (this.waypoint >= 3 ? .3 : 2)) this.waypoint++;
    const goal = pickup?.transform ?? this.route[this.waypoint];
    if (!this.avoidCorpses && !pickup && this.waypoint >= 3 && w.infected!.nav.visible(p.transform, goal, .35)) {
      const dx = goal.x - p.transform.x, dz = goal.z - p.transform.z, d = Math.hypot(dx, dz);
      if (d > .2) f.move = { x: dx / d, z: dz / d };
    } else f.move = this.walker.step(w, goal, pickup ? .5 : this.waypoint >= 3 ? .2 : 1, `${pickup ? 'pickup' : 'bus'}-${this.waypoint}`, this.avoidCorpses) ?? f.move;
    if (pickup && distance(p.transform, goal) < 1.45) { f.move = { x: 0, z: 0 }; f.interact = true; }
    const rocket = p.weapons!.RIGHT.rack.findIndex(s => s.id === l7Rocket.action);
    if (rocket >= 0) f.selectedSlot = { side: 'RIGHT', index: rocket };
    const followers = w.l7Encounters!.state.roster.filter(r => r.status === 'following' && !w.l7Departure!.state.boarded.includes(r.id));
    const enemies = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.emerging && !e.infectionRise && distance(e.transform, p.transform) < 24 && w.infected!.nav.visible(p.transform, e.transform, 0)).sort((a, b) => distance(a.transform, p.transform) - distance(b.transform, p.transform));
    // Cover visible grabs in the column before another close-range courier
    // shot. The launcher can rescue the group at range without civilian splash,
    // but the same close-enemy firing-cone safety still applies.
    const rescue = rocket < 0 ? undefined : enemies.find(e => {
      const brain = e.infected!, victim = brain.l1?.biteTargetId || brain.l1?.targetId || brain.specialAttack?.target.id || brain.heardTargetId;
      if (!followers.some(r => r.id === victim) || distance(e.transform, p.transform) < 6) return false;
      const dx = e.transform.x - p.transform.x, dz = e.transform.z - p.transform.z, length = Math.hypot(dx, dz);
      return !w.combat!.query.melee(1, p.transform, { x: dx / length, z: dz / length }, 5, 30, 1000).some(target => target.faction === 'infected' && !target.hidden && !target.infected?.hidden && distance(target.transform, p.transform) < 5);
    });
    const target = rescue ?? enemies[0];
    if (target && this.profile !== 'evade-only') {
      const close = distance(target.transform, p.transform) < 6;
      const backup = p.weapons!.RIGHT.rack.findIndex(s => s.id === 'weapon.shotgun');
      if (close && backup >= 0) f.selectedSlot = { side: 'RIGHT', index: backup };
      strikeAt(f, target, 'RIGHT', p.transform, false);
    }
    // Deaths leave holes in the original slots; the surviving tail keeps its row.
    const lastSlot = followers.reduce((slot, r) => Math.max(slot, w.entities.get(r.id)!.civilian!.survivor!.slot), -1);
    const limit = Math.max(12, (Math.floor(lastSlot / 3) + 1) * 1.2 + 5);
    // Reach the bus door before waiting for the last stragglers; the shipped boarding queue owns their recovery there.
    if (!pickup && this.waypoint < this.route.length - 1 && distance(p.transform, goal) > 10 && followers.some(r => { const e = w.entities.get(r.id); return e && distance(e.transform, p.transform) > limit; })) f.move = { x: 0, z: 0 };
    return f;
  }
}
