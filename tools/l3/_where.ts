import { loadL3 } from '../sim-runner/l3Bots';
import { LevelThreeBot } from '../../src/debug/bot/LevelThreeBot';
import { l3Street, l3Segment } from '../../src/data/l3';
const seed = Number(process.argv[2] ?? 3), at = Number(process.argv[3] ?? 40);
const { world, mission } = await loadL3(seed);
const bot = new LevelThreeBot(world, 'complete');
for (let t = 0; t < 600 * 60 && !bot.finished; t++) {
  world.applyInput(bot.sample(), 'keyboard'); world.update();
  const s = mission.state.l3!;
  if (s.fallbackAt && (at > 0 ? world.tick - s.fallbackAt === at * 60 : world.entities.get(1)!.transform.x >= -at)) {
    const p = world.entities.get(1)!.transform;
    console.log('player', p.x.toFixed(0), p.z.toFixed(0), 'count', world.infected!.director.count, 'active', world.infected!.active.length, 'retired', s.retired);
    const groups = new Map<string, number>();
    for (const e of world.infected!.active) {
      const k = `${l3Segment(e.transform.x)}:${l3Street(e.transform.z)}:${e.health.current > 0 ? e.infected?.l1?.mode ?? e.infected?.state : 'down'}`;
      groups.set(k, (groups.get(k) ?? 0) + 1);
    }
    console.log([...groups].sort().map(([k, v]) => `${k}=${v}`).join(' '));
    for (const q of s.pending.slice(0, 80)) { const e = world.entities.get(q.id); if (e && q.segment === 2) console.log('S3', q.id, 'home', q.home.x.toFixed(0), q.home.z.toFixed(0), 'at', e.transform.x.toFixed(1), e.transform.z.toFixed(1), e.infected?.l1?.mode, e.health.current); }
    break;
  }
}
