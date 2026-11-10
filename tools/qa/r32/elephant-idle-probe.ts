// r32-animalmoves: native probe. Load an L8 QA fixture and report the old elephant's state (healthy/turned, arena, specials)
// every 10 s while the courier stands still (god mode).
//   node --import tsx/esm tools/qa/r32/elephant-idle-probe.ts [fixture=l8-before-lion] [seconds=60]
import { decodeSave } from '../../../src/sim/progression/Save';
import { loadLevel } from '../../sim-runner/levels';
import { emptyInput } from '../../../src/input/InputFrame';
import { readFixture } from '../fixture-io';

const name = process.argv[2] ?? 'l8-before-lion', maxS = Number(process.argv[3] ?? 60);
const ext = name.endsWith('before-elephant') ? 'json.br' : 'json.gz';
const f = readFixture(`tests/fixtures/saves/qa/${name}.${ext}`);
const decoded = decodeSave(JSON.stringify(f.campaign));
if (decoded.status !== 'ok') throw new Error('decode');
const world = await loadLevel('L8', 1, decoded.save);
const m = world.missions!;
if (f.kind === 'mission-resume' && f.resume) { m.begin(); m.loadResume(f.resume as never); }
const player = world.entities.get(1)!;
const s = m.l8!.state;
const report = (t: number) => {
  const id = s.animals[2], e = world.entities.get(id);
  const arena = s.arenas.find(a => a.id === 'elephant');
  const all = `cp=${m.state.checkpoint} br=${!!m.state.states.breached} ` + s.arenas.map(a => `${a.id}:${a.phase}`).join(' ');
  console.log(JSON.stringify({ t: +(t / 60).toFixed(1), id, archetype: e?.archetype, zoo: e?.civilian?.zooAnimal, civState: e?.civilian?.state, infection: !!e?.infection, infected: !!e?.infected, state: e?.infected?.state, hp: e?.health.current, at: e ? [+e.transform.x.toFixed(1), +e.transform.z.toFixed(1)] : null, boss: e?.infected?.arenaBoss ? { engaged: e.infected.arenaBoss.engaged } : null, special: e?.infected?.specialAttack?.move, arenaPhase: arena?.phase, arenas: all, player: [+player.transform.x.toFixed(1), +player.transform.z.toFixed(1)] }));
};
for (let t = 0; t <= maxS * 60; t++) {
  player.health.current = player.health.max;
  world.applyInput(emptyInput(), 'keyboard'); world.update();
  if (t % 600 === 0) report(t);
}
world.dispose();
process.exit(0);
