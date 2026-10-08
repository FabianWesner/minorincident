import { SimWorld } from '../../../src/sim/world/SimWorld';
import { emptyInput } from '../../../src/input/InputFrame';

/** PO 10-08 balance harness ("I killed a single zombie efficiently but already down to 84. That's too tough."): an
 * efficient mouse player against `count` L1 runners. It stands where it is and fast-clicks (7.5 Hz) the nearest
 * infected as soon as one is inside the weapon's reach plus a short step-in, exactly the click command a real click on
 * its body produces (attackTarget + released LMB). The encounter ends when every infected is down (0 HP), the courier
 * dies, or after `limitSeconds`. Hits on the courier are logged with their cause for the diagnosis. */
export interface EncounterHit { tick: number; sourceId: number; amount: number; special: string; distance: number; sinceSwing: number; attackerStaggered: boolean }
export interface EncounterResult { policy: string; seed: number; count: number; weapon: string; lost: number; died: boolean; seconds: number; downed: number; hits: EncounterHit[]; clicks: number; swings: number }

function rng(seed: number): () => number {
  let s = (seed * 0x9e3779b1) >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** `hold`: stand and click whatever comes into reach. `engage`: click the nearest infected as soon as it is within 12 m
 * (the click approaches it, Diablo-style), which is how the PO plays a lone infected. */
/** `misses`: `engage`, but every click on the head or chest (half of them, seeded) resolves as the old PROD pick did
 * (measured by tests/e2e/click-attack.spec.ts: 41 of 44 missed): a move to the ground point the cursor ray hits behind the
 * body (camera elevation 36 deg, azimuth 45 deg: h / tan 36 deg further from the camera). */
export type EncounterPolicy = 'hold' | 'engage' | 'misses';
export async function encounter(seed: number, count: number, weapon: string, policy: EncounterPolicy = 'hold', limitSeconds = 30): Promise<EncounterResult> {
  const w = new SimWorld();
  try {
    await w.init(); w.loadScenario('horde-arena', seed); w.combat!.setLoadout([weapon], [weapon]); w.infected!.configureL1v2();
    const random = rng(seed), base = random() * Math.PI * 2, ids: number[] = [], tiers = ['frail', 'average', 'athletic'] as const;
    for (let i = 0; i < count; i++) {
      const angle = base + (i / count) * Math.PI * 2 * (count > 1 ? .5 : 1) + (random() - .5) * .6, distance = 7 + random() * 4;
      const id = w.infected!.spawn('infected.runner', { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance }, { state: 'chase', tier: tiers[(seed + i) % 3] });
      const e = w.entities.get(id)!; e.transform.yaw = Math.atan2(e.transform.z, -e.transform.x); ids.push(id);
    }
    const hits: EncounterHit[] = []; let lastSwing = -999, clicks = 0, swings = 0;
    w.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1) { lastSwing = e.tick; swings++; } });
    w.events.on('infected.attack', e => {
      if (e.type !== 'infected.attack' || e.targetId !== 1 || !e.amount) return;
      const p = w.entities.get(1)!.transform, s = w.entities.get(e.sourceId)!;
      hits.push({ tick: e.tick, sourceId: e.sourceId, amount: e.amount, special: e.special, distance: Math.hypot(s.transform.x - p.x, s.transform.z - p.z), sinceSwing: e.tick - lastSwing, attackerStaggered: (s.combat?.staggerUntil ?? 0) > e.tick });
    });
    const reach = w.combat!.runner.loadout.definition(weapon).range;
    let tick = 0;
    for (; tick < limitSeconds * 60; tick++) {
      const player = w.entities.get(1)!;
      const alive = ids.map(id => w.entities.get(id)!).filter(e => e.health.current > 0);
      // Six or more: the courier stands its ground for the whole limit while downed ones get up again (10-20 s).
      if ((!alive.length && count < 6) || player.health.current <= 0) break;
      if (!alive.length) { const idle = emptyInput(); w.applyInput(idle, 'mouse-only'); w.update(); continue; }
      const frame = emptyInput(); frame.aimSource = 'pointer'; frame.pointerTarget = true;
      let target = alive[0], best = Infinity;
      for (const e of alive) { const d = Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z); if (d < best) { best = d; target = e; } }
      if (tick % 8 === 0 && best <= (policy === 'hold' ? reach + .6 : 12)) {
        clicks++;
        if (policy === 'misses' && random() < .5) {
          const behind = (random() < .5 ? 1.65 : 1.25) / Math.tan(36 * Math.PI / 180) / Math.SQRT2;
          frame.mouseAttack = true; frame.cancelMove = true; frame.pointerGround = true; frame.pointerTarget = false; frame.left = { down: true, held: false, up: true };
          frame.moveTarget = { x: target.transform.x - behind, z: target.transform.z - behind };
          w.applyInput(frame, 'mouse-only'); w.update(); continue;
        } frame.mouseAttack = true; frame.cancelMove = true; frame.left = { down: true, held: false, up: true }; frame.attackTarget = { id: target.id, side: 'LEFT' };
      }
      w.applyInput(frame, 'mouse-only'); w.update();
    }
    const player = w.entities.get(1)!;
    return { policy, seed, count, weapon, lost: 100 - player.health.current, died: player.health.current <= 0 || player.survivor!.diedAt !== null, seconds: tick / 60, downed: ids.filter(id => w.entities.get(id)!.health.current <= 0).length, hits, clicks, swings };
  } finally { w.dispose(); }
}
