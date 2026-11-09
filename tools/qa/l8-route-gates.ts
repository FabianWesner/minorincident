/** Independent keeper locks: a runner attempts the APC while each boss alone is unbeaten. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { LevelEightBot } from '../../src/debug/bot/LevelEightBot';
import { l8BossArenas } from '../../src/data/l8Bosses';
import { loadLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
const w = await loadLevel('L8', 1), rows: unknown[] = [];
try {
  const zoo = w.missions!.l8!, m = w.missions!, p = w.entities.get(1)!;
  m.state.states.breached = true; zoo.state.breachedAt = -1801; zoo.state.nextWave = Number.MAX_SAFE_INTEGER;
  m.state.steps.sanctuary.status = 'completed'; m.state.steps.escape.status = 'active';
  w.combat!.damage.god = true; // Route capability control; no mortal combat claim.
  for (const def of l8BossArenas.filter(a => a.id !== 'elephant')) {
    for (const a of zoo.state.arenas) a.phase = a.id === def.id || a.id === 'elephant' ? 0 : 3;
    zoo.update();
    assert(w.solids.relocate(p, { x: 78, z: 60, y: .7 }, 'qa.runner-entry', 1));
    const bot = new LevelEightBot(w, 'runner'); let enteredYard = false, closest = Infinity;
    for (let i = 0; i < 720; i++) {
      w.applyInput(bot.sample(), 'keyboard'); w.update();
      enteredYard ||= p.transform.x > 85 && p.transform.z > 46;
      const door = zoo.door(); closest = Math.min(closest, Math.hypot(p.transform.x - door.x, p.transform.z - door.z));
    }
    const row = { unbeaten: def.id, enteredYard, closest, position: { ...p.transform }, boarded: w.vehicles!.active === zoo.state.carId };
    rows.push(row); assert(!enteredYard && !row.boarded, `runner bypassed ${def.id}: ${JSON.stringify(row)}`);
  }
  for (const a of zoo.state.arenas) a.phase = a.id === 'elephant' ? 0 : 3;
  zoo.update(); assert(w.solids.relocate(p, { x: 78, z: 60, y: .7 }, 'qa.runner-open-entry', 1));
  const bot = new LevelEightBot(w, 'runner');
  for (let i = 0; i < 720 && p.transform.x <= 85; i++) { w.applyInput(bot.sample(), 'keyboard'); w.update(); }
  assert(p.transform.x > 85, `cleared keeper gates did not release the route: ${JSON.stringify(p.transform)}`);
  rows.push({ allEnclosuresClear: true, enteredYard: true, position: { ...p.transform }, elephantStillBlocksDriver: !zoo.canBoardDriver() });
  assert(!zoo.canBoardDriver());
  const out = process.env.L8_GATE_OUT ?? 'docs/reports/p1-l8rework/route-gates.json'; mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
  writeFileSync(out, JSON.stringify({ ...provenance(), method: 'Controlled setup outside the yard; real runner policy movement, player protection only; each enclosure lock independently tested. No combat completion claim.', pass: true, rows }, null, 2));
  console.log(JSON.stringify({ out, pass: true, rows }));
} finally { w.dispose(); }
