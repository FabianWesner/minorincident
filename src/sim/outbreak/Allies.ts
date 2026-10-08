import { l2 } from '../../data/l2';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { AllyState } from '../npc/types';

const half = Math.cos(l2.allies.coneDeg / 2 * Math.PI / 180);
const ticks = (s: number) => Math.round(s * 60);
/** Fresh allied-fighter component (E20 §5.2): no immunity, no survival flag; it is an ordinary live human otherwise. */
export function allyState(role: AllyState['role'], post: { x: number; z: number } | null = null, hold = false): AllyState {
  return { role, engaged: false, run: null, runSpeed: l2.allies.firefighter.moveMs, post: post ? { ...post } : null, hold, targetId: 0, nextAttack: 0, hits: 0, forceUntil: 0 };
}

/**
 * One tick of an allied fighter (firefighter or officer), called by the outbreak layer for live civilians with `ally`.
 * Sight model of civilians (140 degree cone, 16 m, line of sight) to acquire infected; an infected that is biting a human is
 * preferred (the rescue window is the 1.0 s grab, as for the player). Firefighters close to melee reach, officers hold their
 * post and shoot infected within 15 m of it. Returns false when the ordinary calm routine should run instead.
 */
export function updateAlly(world: SimWorld, e: EntitySnapshot, sees: (a: { x: number; z: number }, b: { x: number; z: number }, id: number) => boolean): boolean {
  const c = e.civilian!, a = c.ally!, tick = world.tick, ai = world.infected!, npcs = world.npcs!;
  // A rescued or startled ally does not run for a refuge: it is a fighter (state stays a live human state).
  if (c.state !== 'calm') { c.state = 'calm'; c.entered = tick; c.until = tick; world.events.emit({ type: 'civilian.state', tick, id: e.id, state: 'calm', until: tick }); }
  if (c.story && c.story.clip === 'swing' && tick - c.story.start > 30 && tick >= a.forceUntil) c.story = null;
  // Forcing the doors: a looping halligan heave (or the directing gesture), seeded per person so the crew never moves in sync.
  const forcing = a.forceClip ?? 'ff-pry';
  if (c.story && c.story.clip === forcing && tick >= a.forceUntil) c.story = null;
  if (a.forceUntil > tick) { if (c.story?.clip !== forcing) c.story = { clip: forcing, start: tick - (e.id * 17) % 40 }; return true; }
  if (a.engaged) {
    const officer = a.role === 'officer', post = a.post ?? e.transform;
    let target = a.targetId ? world.entities.get(a.targetId) : undefined;
    if (!target || target.health.current <= 0 || !target.infected || target.hidden || (tick + e.id) % 6 === 0) {
      // Re-acquire: biting infected first (rescue), then the nearest visible one.
      let best: EntitySnapshot | undefined, score = Infinity;
      const fx = Math.cos(e.transform.yaw), fz = -Math.sin(e.transform.yaw);
      for (const o of ai.active) {
        if (o.health.current <= 0 || o.hidden || o.infected?.hidden || o.infectionRise) continue;
        const dx = o.transform.x - e.transform.x, dz = o.transform.z - e.transform.z, d = Math.hypot(dx, dz);
        if (d > (officer ? l2.allies.officer.rangeM + 4 : l2.allies.firefighter.engageM)) continue;
        if (officer && Math.hypot(o.transform.x - post.x, o.transform.z - post.z) > (a.range ?? l2.allies.officer.rangeM)) continue;
        const current = o.id === a.targetId;
        if (!current && d > 1.2 && (dx * fx + dz * fz) / d < half && !officer) continue;
        if (!sees(e.transform, o.transform, o.id)) continue;
        const s = d - (o.infected?.l1?.mode === 'bite' ? 8 : 0) - (current ? 1.5 : 0);
        if (s < score) { score = s; best = o; }
      }
      target = best; a.targetId = best?.id ?? 0;
    }
    // A swing in progress lands after its windup on whatever is still in reach (no tracking, it can whiff).
    if (a.strikeAt && tick >= a.strikeAt) {
      const victim = world.entities.get(a.strikeTarget ?? 0); a.strikeAt = 0;
      if (victim?.infected && victim.health.current > 0 && world.combat) {
        const dx = victim.transform.x - e.transform.x, dz = victim.transform.z - e.transform.z, d = Math.hypot(dx, dz);
        const def = officer ? l2.allies.officer : l2.allies.firefighter, reach = officer ? (a.range ?? l2.allies.officer.rangeM) + 4 : l2.allies.firefighter.reachM * 1.1;
        if (d <= reach) world.combat.damage.apply({ attackId: 0, actionId: officer ? 'weapon.pistol' : 'weapon.fire-axe', sourceId: e.id, targetId: victim.id, origin: { x: e.transform.x, z: e.transform.z }, direction: { x: dx / (d || 1), z: dz / (d || 1) }, base: def.damage, multiplier: 1, type: officer ? 'bullet' : 'melee', knockback: officer ? 0 : .3, stagger: officer ? .25 : .1 });
      }
    }
    if (a.strikeAt) return true;
    if (target) {
      const dx = target.transform.x - e.transform.x, dz = target.transform.z - e.transform.z, d = Math.hypot(dx, dz);
      const reach = officer ? l2.allies.officer.rangeM + 4 : l2.allies.firefighter.reachM;
      if (d > reach * .9 && !a.hold) { npcs.move(e, target.transform, a.runSpeed, c, reach * .8); return true; }
      e.transform.yaw = -Math.atan2(dz, dx);
      if (d <= reach && tick >= a.nextAttack && world.combat) {
        a.nextAttack = tick + ticks(officer ? l2.allies.officer.shotS : l2.allies.firefighter.swingS); a.hits++;
        a.strikeAt = tick + Math.max(1, ticks(officer ? 0 : l2.allies.firefighter.windupS)); a.strikeTarget = target.id;
        c.story = officer ? { clip: 'npc-gesture', start: tick } : { clip: 'swing', start: tick };
        world.events.emit({ type: 'ally.attack', tick, sourceId: e.id, targetId: target.id, role: a.role });
      }
      return true;
    }
  }
  if (a.run) {
    if (Math.hypot(a.run.x - e.transform.x, a.run.z - e.transform.z) <= .35) { a.run = null; return true; }
    npcs.move(e, a.run, a.runSpeed, c, .25); return true;
  }
  // Disengaged fighters follow their routine; a held post (officers) is kept regardless.
  if (!a.engaged && !a.hold) return false;
  const post = a.post;
  if (post && Math.hypot(post.x - e.transform.x, post.z - e.transform.z) > (a.hold ? .4 : l2.allies.regroupM)) npcs.move(e, post, a.hold ? 2 : a.runSpeed * .8, c, a.hold ? .3 : l2.allies.regroupM * .5);
  return true;
}
