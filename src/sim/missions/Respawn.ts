import type { SimWorld } from '../world/SimWorld';

/**
 * The one respawn path of every level (PO 2026-10-13: "After dying at the house where I got the baseball stick, I re-spawn at a totally
 * different place. Let's respawn at the last checkpoint as a general rule for all levels. Checkpoints for re-spawn.").
 * Death puts the courier exactly on the last reached checkpoint (the level start counts); we never search for another spot. Only the
 * threat around the anchor is made safe: infected inside `clearM` are pushed out to that radius, pursuers lose her for `delayS`,
 * and she is invulnerable for `graceS`.
 */
export const respawnRule = { snapM: 1.5, clearM: 9, pursueM: 30, delayS: 4, graceS: 2 } as const;
const TICKS = 60, ticks = (s: number) => Math.round(s * TICKS);
type Spot = { x: number; z: number };
const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.z - b.z);

/** The anchor itself when the player fits there, else the nearest clear spot within `snapM` (never farther). */
function snap(world: SimWorld, anchor: Spot): Spot {
  const nav = world.infected?.nav;
  if (!nav || nav.clear(anchor.x, anchor.z, .35)) return { x: anchor.x, z: anchor.z };
  let best: Spot | null = null;
  for (let r = .25; r <= respawnRule.snapM && !best; r += .25) for (let k = 0; k < 16 && !best; k++) {
    const at = { x: anchor.x + Math.cos(k * Math.PI / 8) * r, z: anchor.z + Math.sin(k * Math.PI / 8) * r };
    if (nav.clear(at.x, at.z, .35)) best = at;
  }
  return best ?? { x: anchor.x, z: anchor.z };
}

/** Companion and escorts come back beside the courier (the companion has its own settle logic; escorts stand up and follow). */
function gatherAllies(world: SimWorld, at: Spot, escorts: boolean): void {
  world.npcs?.companion.respawnNear();
  if (!escorts) return;
  const nav = world.infected?.nav;
  let n = 0;
  for (const e of world.entities.iterate()) {
    const c = e.escort; if (!c || e.passengerOf !== undefined || c.state === 'dead' || e.corpse) continue;
    const a = 2.4 * n++ + 1;
    const spot = [1.6, 2.2, 1.0, 0].map(r => ({ x: at.x + Math.cos(a) * r, z: at.z + Math.sin(a) * r })).find(s => !nav || nav.clear(s.x, s.z, .35)) ?? at;
    e.transform.x = spot.x; e.transform.z = spot.z; world.spatial.set(e.id, spot.x, spot.z);
    c.path.length = 0; c.goal = -1; c.pathIndex = 0;
    if (e.motion) { e.motion.velocity.x = e.motion.velocity.z = 0; e.motion.speed = 0; e.motion.moving = false; }
  }
}

/** Clear the area around the anchor of infected and make pursuers lose the courier for a few seconds. */
function clearThreat(world: SimWorld, at: Spot): void {
  const ai = world.infected, r = respawnRule, tick = world.tick;
  if (!ai) return;
  for (const e of ai.active) {
    const d = dist(e.transform, at);
    // E32 Mega Alpha: never pushed or blinded here; its pursuit seam already restored it ≥ respawnGapM away.
    if (!e.infected || (e.health.current <= 0 && e.infected.recoverAt < 0) || e.corpse || e.infected.pursuit || d > r.pursueM) continue;
    // Downed infected that will recover are threats too: leaving their bodies inside the ring revived them beside the courier.
    const pushed = d < r.clearM;
    if (pushed) {
      const k = d > .1 ? 1 / d : 0, dx = k ? (e.transform.x - at.x) * k : Math.cos(e.id), dz = k ? (e.transform.z - at.z) * k : Math.sin(e.id);
      // Keep the outward direction when possible; beside walls or parked vehicles that entire ray can be blocked.
      // Try neighboring bearings too so cover never leaves a live or recovering body inside the clear ring.
      let moved = false;
      for (let n = 0; n < 16 && !moved; n++) {
        const angle = (n % 2 ? 1 : -1) * Math.ceil(n / 2) * Math.PI / 8, c = Math.cos(angle), s = Math.sin(angle);
        for (let m = r.clearM; m <= r.clearM + 6; m += 1) {
          const to = { x: at.x + (dx * c - dz * s) * m, z: at.z + (dx * s + dz * c) * m };
          if (!ai.nav.clear(to.x, to.z, e.combat?.radius ?? .45)) continue;
          Object.assign(e.transform, to); world.spatial.set(e.id, to.x, to.z);
          if (e.locomotion) e.locomotion.vx = e.locomotion.vz = 0;
          moved = true; break;
        }
      }
    }
    if (e.combat) e.combat.attacking = false;
    const brain = e.infected.l1;
    if (brain) {
      if (brain.mode === 'chase' && brain.targetId === 1) { brain.mode = 'wander'; brain.targetId = 0; if (e.health.current > 0) e.infected.state = 'wander'; }
      brain.ignoreId = 1; brain.ignoreUntil = tick + ticks(r.delayS);
      // A pushed body (or one whose goal is the respawn spot) forgets its walk goal: it kept walking to the old goal straight back across
      // the anchor (gate 10-13: four infected within 2-7 m of the bat pickup 3 s after the respawn). Free wanderers take the anchor as
      // home, so their next goals lead away from it; leashed street groups keep their block.
      if (pushed || (brain.hasGoal && Math.hypot(brain.goalX - at.x, brain.goalZ - at.z) < r.clearM)) {
        brain.hasGoal = false;
        if (brain.mode === 'attracted' || brain.mode === 'search') { brain.mode = 'wander'; if (e.health.current > 0) e.infected.state = 'wander'; }
        if (!brain.leashM) { brain.homeX = at.x; brain.homeZ = at.z; }
      }
      // A pushed body stands and looks around while it has lost her: a leashed street-group member otherwise walked straight home through
      // the cleared ring (gate 10-13: 8.8 m from the anchor 3 s after the respawn, on its way back to its block).
      if (pushed) { brain.pauseUntil = Math.max(brain.pauseUntil, tick + ticks(r.delayS)); brain.looking = true; }
    } else {
      // Levels without the L1 brain: drop the target and path, and hold attacks for the same delay.
      if (e.infected.targetId === 1 || e.infected.heardTargetId === 1) { e.infected.targetId = 0; e.infected.heardTargetId = 0; if (e.health.current > 0) e.infected.state = 'idle'; }
      e.infected.path.length = 0; e.infected.goal = -1; e.infected.cooldown = Math.max(e.infected.cooldown, tick + ticks(r.delayS));
    }
  }
}

/** Put the courier on the checkpoint anchor and make it safe. `anchor` is read before any level-specific restore touched the world. */
/** `worldKept`: the level keeps its world on death (L1), so escorts are brought back; elsewhere the checkpoint snapshot restored them in formation. */
export function respawnAtCheckpoint(world: SimWorld, anchor: Spot, worldKept = true): void {
  const player = world.entities.get(1)!, at = snap(world, anchor);
  player.transform.x = at.x; player.transform.z = at.z;
  world.physics.playerBody!.setTranslation(player.transform, true);
  world.previousPlayer = { ...player.transform }; world.spatial.set(1, at.x, at.z);
  if (player.survivor) player.survivor.invulnerableUntil = world.tick + ticks(respawnRule.graceS);
  clearThreat(world, at);
  gatherAllies(world, at, worldKept);
}

/** PO 2026-10-13 run-out after the final objective when action is still going on (see Mission.runOut). */
export const runOutRule = { seconds: 5, engagedM: 25, actionS: 2 } as const;
