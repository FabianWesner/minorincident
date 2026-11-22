import { performance } from 'node:perf_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { LevelNineBot } from '../../src/debug/bot/LevelNineBot';
import { loadLevel } from './levels';

const world = await loadLevel('L9', 1, undefined, 0, { quality: 'high', l9Route: 'dry-shortcut', l9Detour: true });
try {
  const bot = new LevelNineBot(world, 'dry-shortcut', true, .7, 'complete');
  world.missions!.begin();
  const bus = world.events as unknown as { callbacks: Map<string, Map<number, Set<(event: { tick: number }) => void>>> };
  const rows: Record<number, { order: number; index: number; ms: number }[]> = {};
  const systemNames: Record<string, string> = {};
  const targets = new Set([4082, 4410, 4569]);
  const phases = [...bus.callbacks.get('sim.tick')!.entries()];
  for (const [order, callbacks] of phases) {
    const original = [...callbacks];
    callbacks.clear();
    for (const [current, callback] of original.entries()) {
      const source = callback.toString().replace(/\s+/g, ' ').slice(0, 180);
      systemNames[`${order}:${current}`] = source;
      callbacks.add((event) => {
        if (event.tick < 3500 || event.tick > 4700) { callback(event); return; }
        const start = performance.now(); callback(event); const ms = performance.now() - start;
        (rows[event.tick] ??= []).push({ order, index: current, ms });
      });
    }
  }
  const samples: Record<number, { x: number; z: number; dtMs: number; resident: number; alive: number; corpses: number }> = {};
  const allTicks: number[] = [];
  while (world.tick < 4700) {
    const frame = bot.sample(); world.applyInput(frame, 'keyboard');
    const tick = world.tick + 1, start = performance.now(); world.update();
    const elapsed = performance.now() - start;
    if (tick >= 3500 && tick <= 4700) allTicks.push(elapsed);
    if (targets.has(tick)) {
      const car = world.missions?.l9 && world.entities.get(world.missions.l9.state.carId);
      const infected = world.infected?.active ?? [];
      let corpses = 0; for (const entity of world.entities.iterate()) if (entity.corpse) corpses++;
      samples[tick] = { x: car?.transform.x ?? 0, z: car?.transform.z ?? 0, dtMs: elapsed, resident: infected.length,
        alive: infected.filter(entity => entity.health.current > 0 && !entity.hidden).length, corpses };
    }
  }
  const sorted = [...allTicks].sort((a,b) => a-b), pct = (p: number) => sorted[Math.ceil(sorted.length * p) - 1] ?? 0;
  const label = process.argv[2] ?? 'after', report = { label, seed: 1, route: 'dry-shortcut', detour: true, quality: 'high', fromTick: 3500, toTick: 4700,
    tickCount: allTicks.length, p50: pct(.5), p95: pct(.95), p99: pct(.99), max: sorted.at(-1) ?? 0, samples,
    systemNames, systems: Object.fromEntries(Object.entries(rows).map(([tick, systems]) => [tick, systems.sort((a,b) => b.ms-a.ms)])), allTicks };
  mkdirSync('test-results/s228-l9perf', { recursive: true }); writeFileSync(`test-results/s228-l9perf/node-${label}.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ label, tickCount: report.tickCount, p50: report.p50, p95: report.p95, p99: report.p99, max: report.max, samples,
    leadingSystems: Object.fromEntries([...targets].map(tick => [tick, rows[tick]?.sort((a,b) => b.ms-a.ms).slice(0,5).map(r => ({ system: systemNames[`${r.order}:${r.index}`], ms: r.ms }))])) }, null, 2));
} finally { world.dispose(); }
