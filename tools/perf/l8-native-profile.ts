/** Full seeded L8 native route with per-minute simulation cost and growth counters. */
import { mkdir, writeFile } from 'node:fs/promises';
import { Session } from 'node:inspector/promises';
import { LevelEightBot } from '../../src/debug/bot/LevelEightBot';
import { loadLevel, runLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { cloneData } from '../../src/core/clone';

const out = process.argv[2] ?? 'docs/reports/r12-l8perf/native';
await mkdir(out, { recursive: true });
const results = [];
const campaign = preset('L8-default');
const handover = await runLevel('L7', 'complete', 1, 1200, undefined, campaign, (_world, result) => {
  campaign.results ??= {};
  campaign.results.L7 = structuredClone(result);
});
if (!handover.completed || !campaign.results?.L7?.escapedSurvivors?.length) throw new Error(`Could not produce L7 handover: ${JSON.stringify({ completed: handover.completed, blocker: handover.blocker })}`);
const survivors = campaign.results.L7.escapedSurvivors;
const nativeSurvivorCount = survivors.length;
for (let i = survivors.length; i < 50; i++) {
  const carried = cloneData(survivors[i % survivors.length]);
  carried.id = 10000 + i;
  if (carried.civilian?.survivor) carried.civilian.survivor.slot = i;
  survivors.push(carried);
}
console.log(JSON.stringify({ l7Handover: handover.completed, nativeEscapedSurvivors: nativeSurvivorCount, seededSurvivors: survivors.length }));
for (const tier of ['low', 'high'] as const) {
  campaign.settings.quality = tier;
  const world = await loadLevel('L8', 1, campaign, 0, { quality: tier });
  try {
    const bot = new LevelEightBot(world, 'complete');
    const costs = new Map<string, number[]>();
    const wrap = (owner: object, method: string, label: string) => {
      const target = owner as Record<string, (...args: never[]) => unknown>, original = target[method];
      if (typeof original !== 'function') return;
      target[method] = function (...args: never[]) {
        const start = performance.now();
        try { return original.apply(this, args); }
        finally { const values = costs.get(label) ?? []; values.push(performance.now() - start); costs.set(label, values); }
      };
    };
    wrap(world.infected!, 'update', 'ai');
    wrap(world.npcs!, 'update', 'npcs');
    wrap(world.physics, 'update', 'physics');
    wrap(world.combat!, 'update', 'combat');
    wrap(world.player!, 'update', 'player');
    const tickMs: number[] = [], windows: object[] = [];
    let windowStarted = performance.now(), windowTick = world.tick;
    const inspector = new Session(); inspector.connect();
    await inspector.post('Profiler.enable'); await inspector.post('Profiler.setSamplingInterval', { interval: 100 });
    let profile: unknown;
    const maxTicks = 1200 * 60;
    for (let i = 0; i < maxTicks && !bot.finished; i++) {
      world.applyInput(bot.sample(), 'keyboard');
      if (world.tick === 7000) await inspector.post('Profiler.start');
      const start = performance.now(); world.update(); tickMs.push(performance.now() - start);
      if (world.tick === 7200) profile = (await inspector.post('Profiler.stop')).profile;
      if (world.tick % 3600 === 0 || world.tick === 7200 || bot.finished) {
        const take = (name: string) => {
          const a = costs.get(name) ?? []; costs.set(name, []); a.sort((x, y) => x - y);
          return { p50: a[Math.floor(a.length * .5)] ?? 0, p95: a[Math.ceil(a.length * .95) - 1] ?? 0, max: a.at(-1) ?? 0 };
        };
        tickMs.sort((a, b) => a - b);
        const entities = [...world.entities.iterate()];
        const now = performance.now(), windowTicks = world.tick - windowTick;
        windows.push({ tick: world.tick, simSeconds: world.tick / 60, complete: bot.finished,
          wallSeconds: (now - windowStarted) / 1000, simSecondsPerWallSecond: windowTicks / 60 / ((now - windowStarted) / 1000),
          tickMs: { p50: tickMs[Math.floor(tickMs.length * .5)] ?? 0, p95: tickMs[Math.ceil(tickMs.length * .95) - 1] ?? 0, max: tickMs.at(-1) ?? 0 },
          systems: Object.fromEntries(['ai', 'npcs', 'physics', 'combat', 'player'].map(n => [n, take(n)])),
          entities: entities.length, infected: world.infected!.active.length, livingInfected: world.infected!.director.count,
          corpses: entities.filter(e => !!e.corpse).length, livingCivilians: entities.filter(e => !!e.civilian && e.health.current > 0).length,
          downed: entities.filter(e => e.civilian?.state === 'down' || e.civilian?.state === 'rising' || (e.infected && e.health.current <= 0 && !e.corpse)).length,
          followers: world.missions!.l8!.roster().length,
          player: { x: world.entities.get(1)!.transform.x, z: world.entities.get(1)!.transform.z },
          l8: { checkpoint: world.missions!.state.checkpoint, step: world.missions!.state.steps.depart?.status, phase: world.missions!.state.phase },
          heapBytes: process.memoryUsage().heapUsed, aiRoutes: (world.infected as unknown as { routes: number }).routes,
          aiBudget: (world.infected as unknown as { budget: number }).budget,
          mission: world.missions!.state.phase, objective: world.missions!.def.steps.filter(s => world.missions!.state.steps[s.id]?.status === 'active').map(s => s.id) });
        tickMs.length = 0;
        windowStarted = now; windowTick = world.tick;
      }
    }
    inspector.disconnect();
    if (profile) await writeFile(`${out}/L8-${tier}-7200.cpuprofile`, JSON.stringify(profile));
    const result = { tier, seed: 1, complete: bot.finished, tick: world.tick, windows };
    results.push(result);
    await writeFile(`${out}/L8-${tier}.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ tier, complete: bot.finished, tick: world.tick, windows }));
  } finally { world.dispose(); }
}
await writeFile(`${out}/summary.json`, JSON.stringify(results, null, 2));
