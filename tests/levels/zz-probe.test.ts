import { test } from 'vitest';
import { loadL1, runL1 } from '../../tools/sim-runner/l1Bots';
test('probe', async () => {
  const { world: w, mission } = await loadL1(1);
  let last = -1;
  const r = runL1(w, mission, 'complete', { seed: 1, onTick: (w, m) => {
    const s = Math.floor(w.tick / 600);
    if (s !== last) {
      last = s; const p = w.entities.get(1)!;
      const near = w.infected!.active.filter(e => e.health.current > 0 && Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 10).length;
      console.log('PROBE', (w.tick / 60).toFixed(0), m.state.checkpoint, [...m.def.steps].find(x => m.state.steps[x.id].status === 'active')?.id, p.transform.x.toFixed(1), p.transform.z.toFixed(1), 'hp', p.health.current.toFixed(0), 'near10', near, 'deaths', m.state.stats.deaths);
    }
  } });
  console.log('PROBE result', JSON.stringify({ t: r.simSeconds, deaths: r.deaths, timeline: r.timeline }));
}, 600000);
