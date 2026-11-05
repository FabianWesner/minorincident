/** Read-only eligibility before the radio; does not remove or move actors. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadL2, runL2 } from '../sim-runner/l2Bots';
import { provenance } from './accept/probe';
const rows = [];
for (const profile of ['no-axe', 'complete'] as const) {
  const { world, mission } = await loadL2(1, 'low');
  const firstEligible = new Map<number, unknown>(), snapshots: unknown[] = [];
  const seen = new Set<number>();
  const off = world.events.on('sim.tick', () => {
    const s = mission.state.l2!; if (!s.doorsOpenAt || s.radioAt) return;
    const p = world.entities.get(1)!.transform, door = mission.def.anchors['l2-door-front'];
    const away = Math.hypot(p.x - door.x, p.z - door.z);
    const actors = world.infected!.active.filter(e => e.health.current > 0).map(e => ({ id: e.id,
      offscreen: world.infected!.director.offscreen(e.transform, e.transform.y - .7), mode: e.infected?.l1?.mode, target: e.infected?.l1?.targetId,
      ambush: s.ambushIds.includes(e.id), at: { ...e.transform } }));
    if (away >= 18) for (const e of actors) if (e.offscreen && e.mode !== 'bite' && e.target !== 1 && !firstEligible.has(e.id)) firstEligible.set(e.id, { tick: world.tick, away, ...e });
    for (const threshold of [12, 15, 18, 20, 22, 24]) if (away >= threshold && !seen.has(threshold)) {
      seen.add(threshold); snapshots.push({ threshold, tick: world.tick, away, player: { ...p }, actors });
    }
  });
  try {
    runL2(world, mission, profile, { maxSeconds: 100, stopWhen: () => !!mission.state.l2!.radioAt });
    rows.push({ profile, snapshots, firstEligible: [...firstEligible.values()] });
    console.log(JSON.stringify({ profile, eligible: [...firstEligible.keys()] }));
  } finally { off(); world.dispose(); }
}
mkdirSync('test-results/fix55-a', { recursive: true });
writeFileSync('test-results/fix55-a/L2-11-preload-eligibility.json', JSON.stringify({ ...provenance(), rows }, null, 2) + '\n');
