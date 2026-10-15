import { mkdirSync, writeFileSync } from 'node:fs';
import { loadL6, runL6 } from '../sim-runner/l6Bots';
const label = process.env.L6_PRESSURE_STAGE ?? 'after';
const rows = [];
for (const tier of ['high', 'low'] as const) {
  const { world, mission } = await loadL6(1, tier);
  const engagements = new Map<number, number>(); const perMinute: Record<number, number> = {};
  let routeTicks = 0;
  world.events.on('sim.tick', () => {
    const p = world.entities.get(1)!.transform;
    if (p.x < 30 || p.x > 246 || !mission.state.l6!.abandonAt) return;
    routeTicks++;
    for (const e of world.infected!.active) if (e.health.current > 0 && !e.hidden && Math.hypot(p.x - e.transform.x, p.z - e.transform.z) < 12 && !engagements.has(e.id)) {
      engagements.set(e.id, world.tick); const minute = Math.floor((world.tick - mission.state.l6!.abandonAt) / 3600); perMinute[minute] = (perMinute[minute] ?? 0) + 1;
    }
  });
  try { const result = runL6(world); rows.push({ tier, ...result, routeSeconds: routeTicks / 60, engagements: engagements.size, engagingPerMinute: engagements.size / (routeTicks / 3600), perMinute }); }
  finally { world.dispose(); }
}
mkdirSync('test-results/l6-po', { recursive: true });
writeFileSync(`test-results/l6-po/pressure-${label}.json`, JSON.stringify(rows, null, 2));
console.log(rows.map(({ tier, engagements, engagingPerMinute, deaths, rescued, total, simSeconds }) => ({ tier, engagements, engagingPerMinute, deaths, rescued, total, simSeconds })));
