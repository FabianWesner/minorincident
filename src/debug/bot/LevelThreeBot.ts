import { emptyInput, type InputFrame } from '../../input/InputFrame';
import type { SimWorld } from '../../sim/world/SimWorld';
import { Walker } from './Walker';
export type LevelThreeRoute = 'market' | 'park';
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
/** L3 policy shared by the browser and Node battery. Ordinary controls and menu actions only. */
export class LevelThreeBot {
  finished = false;
  private walker = new Walker();
  private frame: InputFrame = emptyInput();
  private key = '';
  private waypoint = 0;
  private enterWaypoint = 0;
  constructor(private readonly world: SimWorld, readonly policy: 'complete' | 'newbie' = 'complete', readonly route: LevelThreeRoute = 'market') {}
  sample(): InputFrame {
    const w = this.world, m = w.missions!;
    this.finished = m.state.phase === 'result' || m.state.phase === 'progression';
    if (this.finished) return emptyInput();
    if (m.state.phase === 'retry') { m.restore(); this.walker.reset(); this.key = ''; }
    if (m.state.phase === 'briefing') m.begin();
    if (m.state.phase === 'cinematic') return { ...emptyInput(), interact: true };
    if (this.policy === 'newbie' && w.tick % 15 !== 0) { this.frame.interact = false; return this.frame; }
    const preferred = `${this.route}-route`;
    const step = m.def.steps.find(s => s.id === preferred && m.state.steps[s.id].status === 'active') ?? m.def.steps.find(s => m.state.steps[s.id].status === 'active');
    const frame = this.frame = emptyInput();
    if (!step || w.entities.get(1)!.health.current <= 0) return frame;
    const p = w.entities.get(1)!.transform, at = m.def.anchors[step.anchor], state = m.state.steps[step.id];
    const key = `${step.id}:${state.started}`;
    if (this.key !== key) { this.key = key; this.waypoint = 0; this.enterWaypoint = 0; this.walker.reset(); }
    const drive = step.complete.kind === 'drive' ? step.complete : null;
    const car = w.vehicles!.cars.get(m.state.actors.sedan);
    if (w.vehicles!.active !== null && car) {
      if (!drive || state.driveArrived && drive.exit) { frame.brake = true; frame.interact = car.physics.speed < .5; return frame; }
      const c = car.entity.transform, a = m.def.anchors;
      const x = a.sedan.x, z = a.market.z, west = a.park.x, south = a.approach.z;
      // Sedan steering (.27 rad, 2.7 m wheelbase) needs ~10 m corner radii.
      // Quarter-circle road waypoints begin before the junction, not at its centre.
      const mainTurn = [{ x, z: z+10 }, { x: x-.76, z: z+6.17 }, { x: x-2.93, z: z+2.93 }, { x: x-6.17, z: z+.76 }, { x: x-10, z }];
      const shopTurn = [{ x: west+10, z }, { x: west+6.17, z: z+.76 }, { x: west+2.93, z: z+2.93 }, { x: west+.76, z: z+6.17 }, { x: west, z: z+10 }];
      const parkTurn = [{ x: west, z: south-10 }, { x: west+.76, z: south-6.17 }, { x: west+2.93, z: south-2.93 }, { x: west+6.17, z: south-.76 }, { x: west+10, z: south }];
      const road = step.id === 'approach'
        ? [...(this.route === 'market' ? shopTurn : []), ...parkTurn, at]
        : [...mainTurn, ...(step.id === 'park-route' ? [...shopTurn, at] : [at])];
      while (this.waypoint < road.length-1 && dist(c, road[this.waypoint]) < 3) this.waypoint++;
      const target = road[this.waypoint], dx = target.x - c.x, dz = target.z - c.z;
      const delta = Math.atan2(Math.sin(Math.atan2(-dz, dx) - c.yaw), Math.cos(Math.atan2(-dz, dx) - c.yaw));
      const reverse = Math.abs(delta) > 2.1;
      const angle = reverse ? Math.atan2(Math.sin(delta + Math.PI), Math.cos(delta + Math.PI)) : delta;
      frame.left.held = step.id !== 'approach' && this.waypoint < 2;
      frame.drive = { throttle: reverse ? -.65 : 1, steer: Math.max(-1, Math.min(1, Math.atan(2 * car.physics.def.wheelbase * Math.sin(angle) / Math.max(3, Math.min(7, dist(c, target)))) / car.physics.def.steering * (reverse ? -1 : 1))) };
      frame.brake = car.physics.speed > (Math.abs(angle) > .5 ? 4 : 9);
      return frame;
    }
    if (drive && car && !(drive.exit && state.driveArrived)) {
      const c = car.entity.transform, z = car.physics.def.width / 2 + .55;
      const local = (x: number, side: number) => ({ x: c.x + Math.cos(c.yaw)*x + Math.sin(c.yaw)*side, z: c.z-Math.sin(c.yaw)*x+Math.cos(c.yaw)*side });
      const door = local(.2, z);
      // The stand-to-interact driver door is +Z. Walk behind the parked chassis
      // when coming from its other side, rather than pushing through a dynamic car.
      const side = (p.x-c.x)*Math.sin(c.yaw)+(p.z-c.z)*Math.cos(c.yaw);
      if (this.enterWaypoint === 0 && side >= 0) this.enterWaypoint = 2;
      const around = [local(-4, -z-1), local(-4, z+1), door];
      while (this.enterWaypoint < 2 && dist(p, around[this.enterWaypoint]) < .65) this.enterWaypoint++;
      frame.move = this.walker.step(w, around[this.enterWaypoint], .35, `enter-${car.entity.id}-${this.enterWaypoint}`) ?? frame.move;
      frame.interact = dist(p, door) < .65;
      return frame;
    }
    const waveIds = step.type === 'defend' ? new Set(Object.entries(m.state.actors).filter(([key]) => key.startsWith(`${step.id}-wave-`)).map(([, id]) => id)) : null;
    const enemies = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && (waveIds?.has(e.id) || dist(e.transform, p) < (step.id === 'checkpoint' ? 18 : 3)));
    enemies.sort((a, b) => dist(a.transform, p) - dist(b.transform, p));
    const enemy = enemies[0];
    if (enemy) {
      frame.move = this.walker.step(w, enemy.transform, .8, `fight-${enemy.id}`) ?? frame.move;
      if (dist(p, enemy.transform) < 2.5 && w.combat!.query.visible(p, enemy.transform)) { frame.attackTarget = { id: enemy.id, side: 'LEFT' }; frame.left.held = true; frame.move = { x: 0, z: 0 }; }
    } else frame.move = this.walker.step(w, at, Math.min(1, at.radius / 2), step.id) ?? frame.move;
    if (step.complete.kind === 'interact' && dist(p, at) <= at.radius) frame.interact = true;
    // Escort followers stop behind a stationary player. Keep walking inside
    // the gate area until the patient crosses it, regardless of arrival direction.
    if (step.complete.kind === 'escort' && !enemy) {
      const inside = [{ x: at.x, z: at.z }, { x: at.x+1, z: at.z-1 }, { x: at.x+1, z: at.z+1 }, { x: at.x-1, z: at.z+1 }, { x: at.x-1, z: at.z-1 }];
      if (dist(p, inside[this.waypoint]) < .6) this.waypoint = this.waypoint === inside.length-1 ? 1 : this.waypoint+1;
      frame.move = this.walker.step(w, inside[this.waypoint], .25, `patient-gate-${this.waypoint}`) ?? frame.move;
    }
    return frame;
  }
}
