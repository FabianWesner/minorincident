// PO 11-26: "Protect the group!" shows but nothing happens. Time from breach until infected reach the group.
import { loadLevel } from '../../sim-runner/levels';
import { emptyInput } from '../../../src/input/InputFrame';
const w = await loadLevel('L8', 1); const m = w.missions!, zoo = m.l8!;
w.combat!.damage.god = true;
for (let i = 0; i < 150 * 60; i++) {
  w.applyInput(emptyInput(), 'keyboard'); w.update();
  if (!m.state.states.breached || (w.tick - zoo.state.breachedAt) % 120) continue;
  const roster = zoo.roster().map(id => w.entities.get(id)!).filter(Boolean);
  let near = 0, min = Infinity;
  for (const e of w.infected!.active) { if (e.health.current <= 0) continue; for (const r of roster) { const d = Math.hypot(e.transform.x - r.transform.x, e.transform.z - r.transform.z); min = Math.min(min, d); if (d < 15) { near++; break; } } }
  console.log(`t+${((w.tick - zoo.state.breachedAt) / 60).toFixed(0)}s protecting=${zoo.protecting()} infected=${w.infected!.active.filter(e => e.health.current > 0).length} near-group(15m)=${near} closest=${min.toFixed(1)}m`);
  if ([10, 40].includes(Math.round((w.tick - zoo.state.breachedAt) / 60))) {
    const states: Record<string, number> = {};
    for (const e of w.infected!.active) if (e.health.current > 0) { const k = `${e.infected!.state}/target=${e.infected!.targetId ? (w.entities.get(e.infected!.targetId)?.civilian ? 'civ' : e.infected!.targetId === 1 ? 'player' : 'other') : 0}/approach=${e.infected!.breachApproach ?? '-'}/pack=${e.infected!.pack}`; states[k] = (states[k] ?? 0) + 1; }
    console.log(JSON.stringify(states));
  }
  if (w.tick - zoo.state.breachedAt > 42 * 60) break;
}
process.exit(0);
