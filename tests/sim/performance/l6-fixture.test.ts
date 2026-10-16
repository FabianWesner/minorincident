import { expect, test } from 'vitest';
import { loadLevel } from '../../../tools/sim-runner/levels';
import { installPerformanceLevel, performanceLevels } from '../../fixtures/scenarios/performance';

test('E18 mobile L6 probe uses current shelter geometry and retains 100 admitted infected', async () => {
  const w = await loadLevel('L6', 1);
  try {
    expect(performanceLevels['perf-l6-mainstreet'].spot).toBe('D-SUBWAY/W0/l6-shelter-calm');
    installPerformanceLevel(w, 'low', 'perf-l6-mainstreet');
    for (let i=0;i<600;i++) w.update();
    expect(w.infected!.director.count).toBe(100);
    expect(w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.pendingAdmission)).toHaveLength(100);
    expect(w.solids.snapshot(), JSON.stringify(w.solids.offenders)).toMatchObject({ failures: 0, pending: 0 });
  } finally { w.dispose(); }
}, 60_000);
