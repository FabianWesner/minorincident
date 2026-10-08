import { loadL3 } from '../sim-runner/l3Bots';
import { LevelThreeBot } from '../../src/debug/bot/LevelThreeBot';
const seed = Number(process.argv[2] ?? 3), from = Number(process.argv[3] ?? 0), to = Number(process.argv[4] ?? 600), every = Number(process.argv[5] ?? 300);
const { world, mission } = await loadL3(seed);
const bot = new LevelThreeBot(world, (process.argv[6] ?? 'complete') as 'complete');
world.events.on('player.died', e => console.log((e.tick / 60).toFixed(1), 'DIED'));
world.events.on('checkpoint.restored', e => console.log((e.tick / 60).toFixed(1), 'RESTORED', JSON.stringify(e)));
world.events.on('checkpoint.set', e => console.log((e.tick / 60).toFixed(1), 'CHECKPOINT', JSON.stringify(e)));
for (let t = 0; t < 600 * 60 && !bot.finished; t++) {
  const f = bot.sample(); world.applyInput(f, 'keyboard'); world.update();
  const sec = world.tick / 60;
  if (sec >= from && sec <= to && world.tick % every === 0) {
    const p = world.entities.get(1)!.transform, s = mission.state.l3!, inf = world.infected!.active.filter(e => e.health.current > 0);
    const near = (r: number) => inf.filter(e => Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < r).length;
    console.log(`${sec.toFixed(1)} ${s.phase} p=${p.x.toFixed(1)},${p.z.toFixed(1)} hp=${world.entities.get(1)!.health.current.toFixed(0)} n4=${near(4)} n10=${near(10)} squad=${s.squad.length} cnt=${world.infected!.director.count} move=${f.move.x.toFixed(2)},${f.move.z.toFixed(2)} att=${f.attackTarget ? f.attackTarget.side : '-'}`);
  }
}
