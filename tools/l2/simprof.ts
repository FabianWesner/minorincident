import { loadL2, runL2 } from '../sim-runner/l2Bots';
/** Dev aid: sim cost per tick through the rescue (doors-open + 0..30 s): p50/p95/max and the outbreak/AI share. */
const { world, mission } = await loadL2(Number(process.argv[2] ?? 2), (process.argv[3] ?? 'high') as 'high' | 'low');
world.combat!.damage.god = true;
runL2(world, mission, 'idle', { stopWhen: m => !!m.state.l2!.atDoorsAt && m.world.tick - m.state.l2!.atDoorsAt >= 200 });
const ai = world.infected!, ob = world.npcs!.civilians.outbreak!;
let aiMs = 0, obMs = 0;
const aiu = ai.update.bind(ai); ai.update = () => { const t = performance.now(); aiu(); aiMs += performance.now() - t; };
const obu = ob.update.bind(ob); ob.update = () => { const t = performance.now(); obu(); obMs += performance.now() - t; };
const times: number[] = [], ais: number[] = [], obs: number[] = [];
for (let i = 0; i < 2100; i++) { aiMs = obMs = 0; const t = performance.now(); world.update(); times.push(performance.now() - t); ais.push(aiMs); obs.push(obMs); }
const pct = (v: number[], f: number) => [...v].sort((a, b) => a - b)[Math.floor(v.length * f)];
console.log(JSON.stringify({ p50: pct(times, .5).toFixed(2), p95: pct(times, .95).toFixed(2), max: Math.max(...times).toFixed(1), aiP95: pct(ais, .95).toFixed(2), outbreakP95: pct(obs, .95).toFixed(2), infected: ai.active.filter(e => e.health.current > 0).length }));
world.dispose();
