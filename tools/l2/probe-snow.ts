import { loadL2, runL2 } from '../sim-runner/l2Bots';
import type { L2Profile } from '../../src/debug/bot/LevelTwoBot';
/** Dev aid: outbreak counters every 10 s after the doors open. */
const seed = Number(process.argv[2] ?? 1), profile = ({ i: 'idle', a: 'aggressive', c: 'complete' } as Record<string, L2Profile>)[process.argv[3] ?? 'i'];
const { world, mission } = await loadL2(seed);
world.combat!.damage.god = process.argv[4] === 'god';
let kills = 0, ffKills = 0;
world.events.on('combat.kill', e => { if (e.type === 'combat.kill') { kills++; if (mission.state.l2!.crewIds.includes(e.sourceId)) ffKills++; } });
world.events.on('sim.tick', () => {
  const s = mission.state.l2!, o = world.npcs!.civilians.outbreak!;
  if (s.doorsOpenAt && (world.tick - s.doorsOpenAt) % 600 === 0 && world.tick - s.doorsOpenAt <= 7200) {
    const live = world.infected!.active.filter(e => e.health.current > 0).length;
    console.log(`+${(world.tick - s.doorsOpenAt) / 60}s infected ${live} civ ${o.liveCivilians()} ${JSON.stringify(o.stats)} kills ${kills} ffKills ${ffKills} deaths ${mission.state.stats.deaths}`);
  }
});
runL2(world, mission, profile, { seed, maxSeconds: 200 });
world.dispose();
