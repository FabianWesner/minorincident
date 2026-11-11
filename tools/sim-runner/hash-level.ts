import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { emptyInput } from '../../src/input/InputFrame';
import { stateHash } from '../../src/sim/world/stateHash';
import { loadLevel, runLevel, type RunnerLevel } from './levels';

let traceMath = false;
if (process.env.HASH_MATH_TRACE) {
  const calls: unknown[] = [];
  for (const name of ['sin', 'cos', 'atan2', 'hypot'] as const) {
    const original = Math[name];
    Math[name] = (...args: number[]) => { const result = original(...args as [number, number]); if (traceMath) calls.push([name, args, result]); return result; };
  }
  process.on('exit', () => writeFileSync(process.env.HASH_MATH_TRACE!, JSON.stringify(calls)));
}

// Cross-platform baseline: native campaign setup, fixed empty input, full state hash each tick.
const { values } = parseArgs({ options: {
  level: { type: 'string', short: 'l' }, ticks: { type: 'string', short: 't', default: '1200' },
  quality: { type: 'string', default: 'high' }, policy: { type: 'string', default: 'empty' }, seed: { type: 'string', short: 's', default: '1' }, out: { type: 'string' }, compare: { type: 'string' }, from: { type: 'string', default: '0' },
} });
const comparison = values.compare ? new Map((JSON.parse(readFileSync(values.compare, 'utf8')).hashes as { tick: number; exact: string }[]).map(row => [row.tick, row.exact])) : undefined;
let firstMismatch: number | undefined;
function hashState(world: import('../../src/sim/world/SimWorld').SimWorld): string {
  if (world.tick === Number(process.env.HASH_DUMP_TICK ?? -1)) { const path = process.env.HASH_DUMP_PATH ?? '/tmp/hash-state.json'; mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(world.getState())); }
  const { entities, mission, progression, rng, ai, combat, controls, weather, interactions, destruction, props } = world.getState();
  const hash = createHash('sha256').update(JSON.stringify({ entities, mission, progression, rng, ai, combat, controls, weather, interactions, destruction, props })).digest('hex');
  if (comparison && firstMismatch === undefined && comparison.get(world.tick) !== hash) {
    firstMismatch = world.tick;
    const path = `${values.out ?? 'test-results/sim-hashes/comparison'}.first-mismatch.json`;
    mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(world.getState()));
    console.error(JSON.stringify({ firstMismatch, expected: comparison.get(world.tick), actual: hash, state: path }));
    process.exitCode = 1;
  }
  return hash;
}
const level = values.level as RunnerLevel;
const ticks = Number(values.ticks), seed = Number(values.seed);
if (!level || !Number.isSafeInteger(ticks) || ticks < 0 || !Number.isSafeInteger(seed)) throw new Error('Usage: tsx tools/sim-runner/hash-level.ts --level L8 --ticks 1200 --seed 1 [--out path]');
if (values.policy === 'complete') {
  const rows: { tick: number; hash: string; exact: string }[] = [];
  const report = await runLevel(level, 'complete', seed, ticks / 60, undefined, undefined, undefined, 0, {
    quality: values.quality as 'high' | 'low',
    beforeBegin(world) {
      const update = world.update.bind(world);
      world.update = (...args) => {
        traceMath = world.tick + 1 >= Number(values.from);
        update(...args);
        if (world.tick >= Number(values.from)) rows.push({ tick: world.tick, hash: stateHash(world.getState()), exact: hashState(world) });
      };
    },
  });
  const output = values.out ?? `test-results/sim-hashes/${level}-complete-seed-${seed}.json`;
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ level, seed, input: 'complete', ticks, outcome: report.outcome, hashes: rows }) + '\n');
  console.log(JSON.stringify({ output, outcome: report.outcome, samples: rows.length, last: rows.at(-1) }));
} else {
const world = await loadLevel(level, seed, undefined, 0, { quality: values.quality as 'high' | 'low' });
try {
  const rows: { tick: number; hash: string; exact: string }[] = [{ tick: world.tick, hash: stateHash(world.getState()), exact: hashState(world) }];
  for (let i = 0; i < ticks; i++) {
    world.applyInput(emptyInput(), 'keyboard');
    world.update();
    if (world.tick >= Number(values.from)) rows.push({ tick: world.tick, hash: stateHash(world.getState()), exact: hashState(world) });
  }
  const output = values.out ?? `test-results/sim-hashes/${level}-seed-${seed}.json`;
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ level, seed, input: 'empty', ticks, hashes: rows }, null, 2) + '\n');
  console.log(JSON.stringify({ output, level, seed, ticks, first: rows[0], last: rows.at(-1) }));
} finally { world.dispose(); }

}
