import { loadL2, runL2 } from '../sim-runner/l2Bots';
/** Dev aid: where the crew is when the doors are forced. */
const { world, mission } = await loadL2(Number(process.argv[2] ?? 1));
runL2(world, mission, 'complete', { stopWhen: m => (m.state.l2!.crewExitAt > 0 && m.world.tick - m.state.l2!.crewExitAt === 360) || m.state.l2!.atDoorsAt > 0 });
const s = mission.state.l2!;
console.log({ crewExitAt: s.crewExitAt / 60, atDoorsAt: s.atDoorsAt / 60, tick: world.tick / 60 });
for (const id of s.crewIds) { const e = world.entities.get(id)!; console.log(id, e.transform.x.toFixed(2), e.transform.z.toFixed(2), e.hidden, e.civilian?.state, JSON.stringify(e.civilian?.ally?.run), e.civilian?.path.length); }
const t = world.entities.get(s.truckId)!.transform; console.log('truck', t.x.toFixed(2), t.z.toFixed(2), t.yaw.toFixed(2));
world.dispose();
