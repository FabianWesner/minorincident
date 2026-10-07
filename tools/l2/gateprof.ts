import { loadL2, runL2 } from '../sim-runner/l2Bots';
/** Dev aid: per-tick sim cost around the checkpoint gate close (complete bot, god mode). */
const { world, mission } = await loadL2(Number(process.argv[2] ?? 2), (process.argv[3] ?? 'low') as 'high' | 'low');
world.combat!.damage.god = true;
const times: { tick: number; ms: number }[] = [];
const update = world.update.bind(world);
world.update = () => { const t = performance.now(); update(); const s = mission.state.l2!; if (s.radioAt) times.push({ tick: world.tick, ms: performance.now() - t }); };
runL2(world, mission, 'complete', { seed: 2 });
const s = mission.state.l2!, around = times.filter(t => Math.abs(t.tick - s.gateClosedAt) <= 240).sort((a, b) => b.ms - a.ms).slice(0, 8);
console.log(JSON.stringify({ crossedAt: s.crossedAt, gateClosedAt: s.gateClosedAt, worst: around.map(t => `${t.tick - s.gateClosedAt}:${t.ms.toFixed(1)}`), overallMax: Math.max(...times.map(t => t.ms)).toFixed(1) }));
world.dispose();
