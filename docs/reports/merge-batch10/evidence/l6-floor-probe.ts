import { mkdirSync, writeFileSync } from 'node:fs';
import { loadL6 } from '../../../../tools/sim-runner/l6Bots';
const { world: w, mission } = await loadL6(1);
try {
  const nav = w.infected!.nav;
  const sample = () => mission.state.l6!.survivors.map(r => {
    const e = w.entities.get(r.id)!;
    return { key: r.key, injured: r.injured, at: { ...e.transform }, mask: nav.mask?.(e.transform.x,e.transform.z), clear: nav.clear(e.transform.x,e.transform.z,.3), status: r.status };
  });
  const before = sample(); mission.completeObjective('shelter'); mission.completeObjective('stop');
  for (let i=0; i<120; i++) w.update();
  const result = { before, after: sample(), player: w.entities.get(1)!.transform };
  mkdirSync('test-results', {recursive:true}); writeFileSync('test-results/batch10-l6-floor-probe.json', JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} finally { w.dispose(); }
