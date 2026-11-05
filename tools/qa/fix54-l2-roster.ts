/** Read-only per-tick roster evidence on the production no-axe route. */
import { writeFileSync } from 'node:fs';
import { loadL2, runL2 } from '../sim-runner/l2Bots';
import { provenance } from './accept/probe';
const rows = [];
for (const tier of ['low', 'high'] as const) {
  const { world, mission } = await loadL2(1, tier);
  try {
    let rideTicks = 0, unseatedTicks = 0, allOutAt: number | null = null, controlAt: number | null = null;
    world.events.on('sim.tick', () => {
      const s = mission.state.l2!, ids = [1, ...s.crewIds];
      if (s.phase === 'ride') {
        rideTicks++;
        if (!s.seated || ids.some(id => !world.entities.get(id)?.hidden)) unseatedTicks++;
      }
      if (!s.arrivedAt) return;
      if (allOutAt === null && ids.every(id => world.entities.get(id)?.hidden === false)) allOutAt = world.tick;
      if (controlAt === null && !s.seated) controlAt = world.tick;
    });
    const report = runL2(world, mission, 'no-axe', { god: true, maxSeconds: 75,
      stopWhen: m => !!m.state.l2!.doorsOpenAt });
    const s = mission.state.l2!;
    rows.push({ tier, protected: true, method: 'Production no-axe InputFrame bot; no skips; read-only sim.tick observation',
      ids: [1, ...s.crewIds], rideTicks, unseatedTicks, ride: report.ride,
      allOutSeconds: allOutAt === null ? null : (allOutAt - s.arrivedAt) / 60,
      controlSeconds: controlAt === null ? null : (controlAt - s.arrivedAt) / 60,
      arrivedAt: s.arrivedAt, allOutAt, controlAt });
  } finally { world.dispose(); }
}
writeFileSync('docs/reports/fix54-a/L2-03-roster.json', JSON.stringify({ ...provenance(), rows }, null, 2) + '\n');
