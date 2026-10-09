import { l5 } from '../../data/l5';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { Point } from '../npc/types';

const ticks = (s: number) => Math.round(s * 60);
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * One tick of a found E23 survivor (called by the outbreak layer for live civilians with `survivor` in follow mode). They are unarmed,
 * biteable humans like anyone else; the escort rules of section 5.4: follow in single file 2-5 m behind (each behind the one found
 * before it), run at 3.8 m/s (slower than the courier and every infected), call "Wait!" when more than 10 m behind, and crouch in
 * cover while an infected is within 8 m. No fail state: a survivor that is lost is simply gone. Returns true (the follower owns the tick).
 */
export function updateSurvivor(world: SimWorld, e: EntitySnapshot): boolean {
  const c = e.civilian!, s = c.survivor!, tick = world.tick, f = l5.follow;
  if (s.mode !== 'follow') return false;
  // A found survivor stays a calm, upright human: no startle, no flight (the infected decide what happens to them).
  if (c.state !== 'calm') { c.state = 'calm'; c.entered = tick; c.until = tick; world.events.emit({ type: 'civilian.state', tick, id: e.id, state: 'calm', until: tick }); }
  const player = world.entities.get(1)!, ahead = s.leader ? world.entities.get(s.leader) : undefined;
  const leader = ahead && ahead.health.current > 0 && !ahead.hidden && ahead.civilian && !ahead.infection ? ahead : player;
  const me = e.transform;
  // Cover: crouch while an infected is close (the courier fights it; the group does not scatter).
  let threatened = false;
  if ((tick + e.id) % 6 === 0 || s.cover) {
    s.cover = false;
    for (const o of world.infected!.active) if (o.health.current > 0 && !o.hidden && !o.infected?.hidden && !o.infectionRise && dist(o.transform, me) <= f.coverM) { s.cover = true; break; }
  }
  threatened = s.cover;
  if (threatened) {
    if (c.story?.clip !== 'npc-cower') c.story = { clip: 'npc-cower', start: tick - (e.id * 11) % 30 };
    world.spatial.set(e.id, me.x, me.z);
    return true;
  }
  if (c.story?.clip === 'npc-cower') c.story = null;
  const d = dist(me, leader.transform), toPlayer = dist(me, player.transform);
  if (toPlayer > f.waitCallM && tick >= s.waitAt) { s.waitAt = tick + ticks(f.waitEveryS); world.events.emit({ type: 'l5.wait', tick, id: e.id }); }
  // Face the leader; walk when a little behind, run when far behind. Single file: the leader is the follower found before this one.
  const stop = Math.max(1.6, f.minM - .2);
  if (d > stop + .7) {
    const speed = d > f.maxM ? f.runMs : f.walkMs;
    world.npcs!.move(e, leader.transform, speed, c, stop);
  } else {
    const yaw = -Math.atan2(leader.transform.z - me.z, leader.transform.x - me.x), delta = Math.atan2(Math.sin(yaw - me.yaw), Math.cos(yaw - me.yaw));
    me.yaw += Math.max(-.1, Math.min(.1, delta));
  }
  world.spatial.set(e.id, me.x, me.z);
  return true;
}
