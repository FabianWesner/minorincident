/** Controlled actual-L8 gate admission check; no combat completion claim. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { l8Route, l8PlazaGates, l8ConnectorGates, l8YardGates, l8EncounterGates } from '../../src/data/l8Bosses';
import { loadLevel } from '../sim-runner/levels';
const w = await loadLevel('L8', 1);
const rows: unknown[] = [];
try {
  const zoo = w.missions!.l8!, player = w.entities.get(1)!;
  zoo.state.sealedAt = 1;
  for (const arena of zoo.state.arenas) { arena.phase = 1; arena.armed = true; }
  zoo.bosses.updateGates();
  const gates = [
    ...l8Route.flatMap(stage => [['entry', stage.entry], ['exit', stage.exit]].flatMap(([side, box]) => typeof box === 'object' && box ? [{ name: `${stage.id}.${side}`, box }] : [])),
    ...Object.entries(l8PlazaGates).map(([name, box]) => ({ name: `plaza.${name}`, box })),
    ...l8ConnectorGates.map((box, i) => ({ name: `connector.${i}`, box })),
    ...l8YardGates.map((box, i) => ({ name: `yard.${i}`, box })),
    { name: 'elephant.entry', box: l8EncounterGates.elephantEntry },
    { name: 'elephant.exit', box: l8EncounterGates.elephantExit },
  ];
  for (const { name, box } of gates) for (const side of [-1, 1]) {
    const horizontal = box.halfX > box.halfZ;
    const axis = horizontal ? 'z' : 'x';
    const at = { x: box.x, z: box.z, y: .84 };
    at[axis] += side * .95;
    assert(w.solids.relocate(player, at, 'qa.gate-shove', 1, false), `${name}: setup admission`);
    const before = { x: player.transform.x, z: player.transform.z };
    assert((before[axis] - box[axis]) * side > 0, `${name}: setup on expected side`);
    w.knockback(player, horizontal ? { x: 0, z: -side } : { x: -side, z: 0 }, 6);
    const after = { x: player.transform.x, z: player.transform.z };
    assert((after[axis] - box[axis]) * side > 0, `${name}: six-metre shove crossed closed gate`);
    rows.push({ name, side, before, after });
  }
  const out = process.env.L8_SHOVE_OUT ?? 'test-results/s75-l8part2/gate-shoves.json';
  writeFileSync(out, JSON.stringify({ pass: true, method: 'Actual L8 closed gates, controlled admission on both sides, immediate six-metre knockback; no normal travel or combat claim.', rows }, null, 2));
  console.log(JSON.stringify({ pass: true, cases: rows.length, out }));
} finally { w.dispose(); }
