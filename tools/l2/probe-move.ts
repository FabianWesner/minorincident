import { loadL2, runL2 } from '../sim-runner/l2Bots';
/** Dev aid: trace one crew member's run order after the crew exits. */
const { world, mission } = await loadL2(1);
runL2(world, mission, 'complete', { stopWhen: m => m.state.l2!.crewExitAt > 0 && m.world.tick - m.state.l2!.crewExitAt === 120 });
const s = mission.state.l2!, id = s.crewIds[3], e = world.entities.get(id)!, nav = world.infected!.nav;
const run = e.civilian!.ally!.run!;
console.log('target', run, 'clear', nav.clear(run.x, run.z, .35), 'cell blocked', nav.blocked[nav.cell(run.x, run.z)]);
for (let i = 0; i < 40; i++) {
  const before = { x: e.transform.x, z: e.transform.z }, wp = { x: 0, z: 0 }, route = { path: [] as number[], goal: -1, pathIndex: 0 };
  const ok = nav.steer(e.transform, run, route, .35, wp);
  world.update();
  if (i % 5 === 0) console.log(i, before.x.toFixed(2), before.z.toFixed(2), '->', e.transform.x.toFixed(2), e.transform.z.toFixed(2), 'steer', ok, wp.x.toFixed(2), wp.z.toFixed(2), 'state', e.civilian!.state, 'motion', JSON.stringify(e.motion ?? null).slice(0, 120));
}
world.dispose();
