import { loadL3 } from '../sim-runner/l3Bots';
import { LevelThreeBot } from '../../src/debug/bot/LevelThreeBot';
const seed = Number(process.argv[2] ?? 1), from = Number(process.argv[3] ?? 0), to = Number(process.argv[4] ?? 30), every = Number(process.argv[5] ?? 60);
const { world, mission } = await loadL3(seed);
const bot = new LevelThreeBot(world, 'complete');
world.events.on('outbreak.bite', e => { if (e.type === 'outbreak.bite') { const v = world.entities.get(e.targetId); console.log((e.tick / 60).toFixed(2), 'BITE', e.targetId, v?.civilian?.ally?.role, v?.transform.x.toFixed(1), v?.transform.z.toFixed(1)); } });
world.events.on('l3.fallback', e => console.log((e.tick / 60).toFixed(2), 'FALLBACK', JSON.stringify(e)));
for (let t = 0; t < 600 * 60 && !bot.finished; t++) {
  world.applyInput(bot.sample(), 'keyboard'); world.update();
  const s = mission.state.l3!, since = s.fallbackAt ? (world.tick - s.fallbackAt) / 60 : -1;
  if (since >= from && since <= to && world.tick % every === 0) {
    const p = world.entities.get(1)!.transform, inf = world.infected!.active.filter(e => e.health.current > 0);
    const near = (q: { x: number; z: number }, r: number) => inf.filter(e => Math.hypot(e.transform.x - q.x, e.transform.z - q.z) < r).length;
    const squad = s.squad.map(m => { const e = world.entities.get(m.id)!; return `${m.id}@${e.transform.x.toFixed(0)},${e.transform.z.toFixed(0)}:${e.civilian?.state}:n${near(e.transform, 5)}:t${e.civilian?.ally?.targetId}`; }).join(' ');
    console.log(`+${since.toFixed(1)} p=${p.x.toFixed(1)},${p.z.toFixed(1)} hp=${world.entities.get(1)!.health.current.toFixed(0)} near6=${near(p, 6)} near15=${near(p, 15)} yard=${inf.filter(e => e.transform.x < -126).length} squad=[${squad}]`);
  }
}
