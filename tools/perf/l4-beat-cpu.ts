/** CPU-only L4 beat attribution. Run on the remote runner before native quiet measurements.
 * The ordinary seeded bot drives the same mission; these inclusive method costs are diagnostic, not frame budgets. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadL4, runL4 } from '../sim-runner/l4Bots';
import { warmL4Alarm } from '../../src/sim/missions/l4AlarmWarmup';

const out = process.env.L4_CPU_OUT ?? 'test-results/perf-l4-l6/l4-cpu';
mkdirSync(out, { recursive: true });
for (const tier of ['high', 'low'] as const) {
  const { world, mission } = await loadL4(2, tier);
  const warmed = process.env.L4_CPU_WARM === '1';
  if (warmed) { const district = world.districts!; await warmL4Alarm(district.composition, district.districts.map(d => d.layout), 2, tier); }
  const costs = new Map<string, { calls: number; totalMs: number; maxMs: number }>();
  const beatCosts = new Map<string, { tick: number; method: string; calls: number; totalMs: number; maxMs: number }>();
  const slow: { tick: number; phase: string; method: string; ms: number }[] = [], beats: { tick: number; type: string }[] = [];
  const restore: (() => void)[] = [];
  const watch = (owner: object | null | undefined, names: string[]) => {
    if (!owner) return;
    const target = owner as Record<string, unknown>;
    for (const name of names) {
      const original = target[name]; if (typeof original !== 'function') continue;
      const method = `${owner.constructor.name}.${name}`;
      target[name] = function (...args: unknown[]) {
        const start = performance.now();
        try { return original.apply(this, args); }
        finally {
          const ms = performance.now() - start, stats = costs.get(method) ?? { calls: 0, totalMs: 0, maxMs: 0 };
          stats.calls++; stats.totalMs += ms; stats.maxMs = Math.max(stats.maxMs, ms); costs.set(method, stats);
          const state = mission.state.l4!;
          if (state.turnAt && world.tick <= state.turnAt + 2 || state.lineBreakAt && world.tick <= state.lineBreakAt + 2) {
            const key = `${world.tick}:${method}`, beat = beatCosts.get(key) ?? { tick: world.tick, method, calls: 0, totalMs: 0, maxMs: 0 };
            beat.calls++; beat.totalMs += ms; beat.maxMs = Math.max(beat.maxMs, ms); beatCosts.set(key, beat);
          }
          if (ms >= 2) slow.push({ tick: world.tick, phase: mission.state.l4!.phase, method, ms });
        }
      };
      restore.push(() => { target[name] = original; });
    }
  };
  try {
    watch(mission.l4, ['turn', 'perimeter', 'emerge', 'panic', 'campCheckpoint', 'lineBreak', 'populateCollapse', 'clearGap', 'toPosts']);
    watch(mission, ['capture', 'flushCheckpoint', 'checkpoint', 'update']);
    watch(world.npcs, ['update', 'move', 'moveStep']); watch(world.npcs?.civilians.outbreak, ['update', 'flee', 'refugeSpot', 'perceive', 'sees']);
    watch(world.infected?.nav, ['steer', 'path', 'reachPath', 'visible']);
    watch(world.combat?.query, ['visible', 'shotVisible', 'clearDistance', 'alliedShotClear']);
    watch(world.infected, ['update']); watch(world, ['update']);
    for (const type of ['l4.firstTurn', 'l4.lineBreaks', 'checkpoint.set'] as const) restore.push(world.events.on(type, event => beats.push({ tick: event.tick, type: event.type })));
    const result = runL4(world, mission, 'complete', { seed: 2, god: true, maxSeconds: 400, stopWhen: m => m.state.l4!.lineBreakAt > 0 && world.tick > m.state.l4!.lineBreakAt + 120 });
    const methods = [...costs].map(([method, stats]) => ({ method, ...stats })).sort((a, b) => b.maxMs - a.maxMs);
    const beatMethods = [...beatCosts.values()].sort((a, b) => a.tick - b.tick || b.totalMs - a.totalMs);
    writeFileSync(`${out}/${tier}.json`, JSON.stringify({ diagnostic: true, warmed, tier, beats, methods, beatMethods, slow, result }, null, 2));
    console.log(JSON.stringify({ tier, beats, methods, beatMethods }));
  } finally { restore.reverse().forEach(run => run()); world.dispose(); }
}
