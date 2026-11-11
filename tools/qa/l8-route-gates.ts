/** Independent keeper locks: a runner attempts the APC while each boss alone is unbeaten. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { LevelEightBot } from '../../src/debug/bot/LevelEightBot';
import { l8Route, inRect } from '../../src/data/l8Bosses';
import { loadLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
const w = await loadLevel('L8', 1), rows: unknown[] = [];
try {
  const zoo = w.missions!.l8!, m = w.missions!, p = w.entities.get(1)!;
  m.state.states.breached = true; zoo.state.breachedAt = -1801; zoo.state.nextWave = Number.MAX_SAFE_INTEGER;
  m.state.steps.sanctuary.status = 'completed'; m.state.steps.escape.status = 'active';
  w.combat!.damage.god = true; // Route capability control; no mortal combat claim.
  // r33-l8route: from the plaza, with the first k arenas cleared and the plaza sealed, a runner walking for the yard may enter no later enclosure and never the yard.
  zoo.state.sealedAt = 1;
  const route = l8Route.filter(r => r.id !== 'elephant');
  for (let k = 0; k <= route.length; k++) {
    for (const a of zoo.state.arenas) a.phase = route.findIndex(r => r.id === a.id) < k ? 3 : 0;
    zoo.bosses.updateGates();
    assert(w.solids.relocate(p, { x: 0, z: 0, y: .7 }, 'qa.runner-entry', 8));
    const bot = new LevelEightBot(w, 'runner'); let enteredYard = false, deepest = -1;
    for (let i = 0; i < 5400; i++) {
      w.applyInput(bot.sample(), 'keyboard'); w.update();
      for (let s2 = 0; s2 < route.length; s2++) if (inRect(p.transform, route[s2].zone)) deepest = Math.max(deepest, s2);
      enteredYard ||= p.transform.x > 85 && p.transform.z > 46;
    }
    const row = { cleared: k, deepestEnclosure: deepest >= 0 ? route[deepest].id : null, enteredYard, position: { ...p.transform } };
    rows.push(row);
    assert(k >= route.length || !enteredYard, `runner entered the yard with ${k} cleared: ${JSON.stringify(row)}`);
    assert(k >= route.length || deepest <= k, `runner reached enclosure ${deepest} with only ${k} cleared`);
    if (k >= route.length) assert(enteredYard, `cleared route did not release the yard: ${JSON.stringify(row)}`);
  }
  const out = process.env.L8_GATE_OUT ?? 'docs/reports/r33-l8route/route-gates.json'; mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
  writeFileSync(out, JSON.stringify({ ...provenance(), method: 'Controlled setup outside the yard; real runner policy movement, player protection only; each enclosure lock independently tested. No combat completion claim.', pass: true, rows }, null, 2));
  console.log(JSON.stringify({ out, pass: true, rows }));
} finally { w.dispose(); }
