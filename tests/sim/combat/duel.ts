import { SimWorld } from '../../../src/sim/world/SimWorld';
import { emptyInput } from '../../../src/input/InputFrame';

/** E19 §5.6 duel harness: real InfectedSystem brains against a scripted player.
 * `newbie` walks to the closest infected and holds the attack button aimed at it,
 * re-reading the situation only every 0.2 s (no kiting, no retreat). `stand` never
 * moves and swings at whatever is closest. `evade` (PO 2026-10-07: fight a few, never all at once) runs from the
 * pack whenever 3+ are close, and turns to strike the followers that reach it one or two at a time. Spawn ring
 * positions come from the seed. */
export type DuelPolicy = 'newbie' | 'stand' | 'evade';
export interface DuelResult { seed: number; won: boolean; died: boolean; seconds: number; hp: number; hits: number; kills: number }

function rng(seed: number): () => number {
  let s = (seed * 0x9e3779b1) >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export async function duel(seed: number, count: number, policy: DuelPolicy, weapon = 'weapon.fists', archetype = 'infected.runner', limitSeconds = 60, l1 = true): Promise<DuelResult> {
  const w = new SimWorld();
  try {
    await w.init(); w.loadScenario('horde-arena', seed); w.combat!.setLoadout([weapon], [weapon]);
    if (l1) w.infected!.configureL1v2();
    const random = rng(seed), base = random() * Math.PI * 2, ids: number[] = [], tiers = ['frail', 'average', 'athletic'] as const;
    for (let i = 0; i < count; i++) {
      const angle = base + (i / count) * Math.PI * 2 + (random() - .5) * .6, distance = 5 + random() * 3;
      const id = w.infected!.spawn(archetype, { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance }, { state: 'chase', ...(l1 ? { tier: tiers[(seed + i) % 3] } : {}) });
      // Spawned facing the player: the L1 brain is vision-only (E19 §5.2); the duel starts at first sight.
      const e = w.entities.get(id)!; e.transform.yaw = Math.atan2(e.transform.z, -e.transform.x); ids.push(id);
    }
    const frame = emptyInput(); frame.aimSource = 'keyboard';
    let target = 0, hits = 0, kills = 0;
    w.events.on('combat.hit', (event) => { if (event.type === 'combat.hit' && event.sourceId === 1 && event.amount > 0) hits++; });
    w.events.on('combat.kill', (event) => { if (event.type === 'combat.kill' && event.sourceId === 1) kills++; });
    for (let tick = 0; tick < limitSeconds * 60; tick++) {
      const player = w.entities.get(1)!;
      const alive = ids.map(id => w.entities.get(id)!).filter(e => e && e.health.current > 0);
      if (!alive.length || player.health.current <= 0) break;
      if (tick % 12 === 0 || !alive.some(e => e.id === target)) {
        let best = Infinity;
        for (const e of alive) { const d = Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z); if (d < best) { best = d; target = e.id; } }
      }
      const t = w.entities.get(target)!, dx = t.transform.x - player.transform.x, dz = t.transform.z - player.transform.z, d = Math.hypot(dx, dz) || 1;
      frame.aim = { x: dx / d, z: dz / d }; frame.aimPoint = { x: t.transform.x, z: t.transform.z };
      const reach = 1.15;
      frame.move = policy === 'newbie' && d > reach ? { x: dx / d, z: dz / d } : { x: 0, z: 0 };
      frame.left = { down: false, held: d <= reach + .35, up: false };
      if (policy === 'evade') {
        // Away from the pack's centre (infected within 6 m), bending toward the arena centre near its edge.
        let cx = 0, cz = 0, close = 0, pack = 0;
        for (const e of alive) {
          const ex = e.transform.x - player.transform.x, ez = e.transform.z - player.transform.z, ed = Math.hypot(ex, ez);
          if (ed < 2.5) close++;
          if (ed < 6) { cx += ex / (ed || 1); cz += ez / (ed || 1); pack++; }
        }
        const fight = close < 3 && d <= reach + .35;
        if (fight) frame.move = { x: 0, z: 0 };
        else {
          let mx = pack ? -cx : -dx, mz = pack ? -cz : -dz;
          const m = Math.hypot(mx, mz) || 1, edge = Math.max(0, Math.hypot(player.transform.x, player.transform.z) - 35) / 15;
          mx = mx / m - player.transform.x / 50 * edge * 3; mz = mz / m - player.transform.z / 50 * edge * 3;
          const n = Math.hypot(mx, mz) || 1; frame.move = { x: mx / n, z: mz / n };
        }
        frame.left = { down: false, held: fight, up: false };
      }
      w.applyInput(frame, 'keyboard'); w.update();
    }
    const player = w.entities.get(1)!, alive = ids.filter(id => (w.entities.get(id)?.health.current ?? 0) > 0).length;
    return { seed, won: alive === 0 && player.health.current > 0, died: player.health.current <= 0 || player.survivor!.diedAt !== null, seconds: w.tick / 60, hp: player.health.current, hits, kills };
  } finally { w.dispose(); }
}
