/** Controlled route-boundary diagnostic, not a mortal completion run. */
import { writeFileSync } from 'node:fs';
import { loadLevel } from '../sim-runner/levels';
import { Walker } from '../../src/debug/bot/Walker';
import { emptyInput } from '../../src/input/InputFrame';
const w = await loadLevel('L8', 1);
try {
  const zoo = w.missions!.l8!, m = w.missions!, player = w.entities.get(1)!;
  m.state.states.breached = true; zoo.state.breachedAt = -1801; zoo.state.nextWave = Number.MAX_SAFE_INTEGER;
  m.state.steps.sanctuary.status = 'completed'; m.state.steps.escape.status = 'active';
  zoo.state.sealedAt = 1;
  for (const arena of zoo.state.arenas) arena.phase = ['flamingo', 'lion'].includes(arena.id) ? 3 : 0;
  zoo.bosses.updateGates(); w.combat!.damage.god = true;
  if (!w.solids.relocate(player, { x: -60, z: 0, y: .84 }, 'qa.junction-entry', 2, false)) throw new Error('junction setup failed');
  const walker = new Walker(), goal = { x: -96, z: 0 }, samples: unknown[] = [];
  for (let i = 0; i < 1200; i++) {
    const frame = emptyInput(); frame.move = walker.step(w, goal, .5, 'west-exterior') ?? frame.move;
    w.applyInput(frame, 'keyboard'); w.update();
    if (i % 60 === 0) samples.push({ tick: w.tick, x: player.transform.x, z: player.transform.z });
  }
  const receipt = { method: 'Controlled two-cleared-pen setup, god on, normal keyboard InputFrames from Walker; no teleport after junction admission.', goal, reachedExterior: player.transform.x < -80, final: { ...player.transform }, samples };
  writeFileSync(process.env.L8_JUNCTION_OUT ?? 'test-results/s75-l8part2/junction-probe.json', JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} finally { w.dispose(); }
