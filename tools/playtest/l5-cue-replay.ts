/** Replays the screen-only search's recorded physical inputs in real time, without navigation/state queries. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const root = 'test-results/l5-visual-cue';
const trace = existsSync(`${root}/real-input/inputs.jsonl`) ? `${root}/real-input/inputs.jsonl` : 'docs/reports/l5-visual-cue/input-trace.jsonl';
const actions = readFileSync(trace, 'utf8').trim().split('\n').map(line => {
  const input = JSON.parse(line) as Record<string, unknown>; delete input.elapsedS;
  return input;
});
for (let i = 0; i < 120; i++) {
  try { if ((await fetch('http://127.0.0.1:4883/look')).ok) break; } catch { /* browser/menu boot */ }
  await new Promise(r => setTimeout(r, 250));
}
const from = Number(process.argv[2] ?? 0);
const file = `${root}/realtime-replay.json`;
const observations: unknown[] = from && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []; let last = '';
const expected = new Map([[16, 1], [39, 2], [43, 3], [53, 4], [64, 5]]);
for (const [index, input] of actions.entries()) {
  if (index < from) continue;
  const response = await fetch('http://127.0.0.1:4883/act', { method: 'POST', body: JSON.stringify(input) });
  if (!response.ok) throw new Error(await response.text());
  const observed = await response.json() as { objective: string; health: string; cue: unknown; survivors: string[] };
  observations.push({ index, input, ...observed });
  if (observed.objective !== last || observed.cue) { last = observed.objective; console.log(JSON.stringify({ index, objective: observed.objective, health: observed.health, cue: observed.cue })); }
  writeFileSync(`${root}/realtime-replay.json`, JSON.stringify(observations, null, 2));
  const found = observed.objective.includes('Lead the survivors') ? 5 : Number(/found (\d)\/5/.exec(observed.objective)?.[1] ?? 0);
  if (expected.has(index) && found < expected.get(index)!) throw new Error(`Stop for screen-only correction at input ${index}; expected ${expected.get(index)} found, saw ${found}. Resume with argument ${index + 1}.`);
  if (expected.has(index) && index < 64) {
    // Let the visibly growing group catch up while normal mouse combat covers it.
    const regroup = await fetch('http://127.0.0.1:4883/act', { method: 'POST', body: JSON.stringify({ ms: 1800 }) });
    if (!regroup.ok) throw new Error(await regroup.text());
  }
}
const final = observations.at(-1) as { objective: string; survivors: string[] };
console.log(JSON.stringify({ final }));
assert(final.objective.includes('Lead the survivors') && final.survivors.length === 5, 'all five found and alive after the physical input replay');
const closed = await fetch('http://127.0.0.1:4883/done');
assert(closed.ok, 'save the final receipt and release the browser immediately');
