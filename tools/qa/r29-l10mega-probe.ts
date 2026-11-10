// r29-l10mega: native probe. Load l10-dispersal-console, hold E at the console, track the Mega.
//   node --import tsx/esm tools/qa/r29-l10mega-probe.ts [seed=1] [maxSeconds=240]
import { decodeSave } from '../../src/sim/progression/Save';
import { loadLevel } from '../sim-runner/levels';
import { emptyInput } from '../../src/input/InputFrame';
import { markerAnchor } from '../../src/sim/missions/markerAnchor';
import { readFixture } from './fixture-io';

const seed = Number(process.argv[2] ?? 1), maxS = Number(process.argv[3] ?? 240);
const f = readFixture('tests/fixtures/saves/qa/l10-dispersal-console.json.gz');
const decoded = decodeSave(JSON.stringify(f.campaign));
if (decoded.status !== 'ok') throw new Error('decode');
const world = await loadLevel('L10', seed, decoded.save);
const m = world.missions!;
if (decoded.save.cureResume) m.loadResume(decoded.save.cureResume);
const player = world.entities.get(1)!, console_ = m.def.anchors['cure-console'];
console.log('start', world.tick, m.state.phase, m.def.steps.filter(x => m.state.steps[x.id].status === 'active').map(x => x.id), Object.entries(m.state.states).filter(([, v]) => v).map(([k]) => k).join(','), 'storyLock', !!world.storyLock);
console.log('console', console_, 'playerToConsole', Math.hypot(player.transform.x - console_.x, player.transform.z - console_.z), 'mega', world.megaPursuit?.entity()?.transform);
if (process.env.UNSTUN) world.megaPursuit!.entity()!.combat!.staggerUntil = 0;
let chargeDone = -1, within15 = -1, distAtCharge = -1, firstNear = -1, guide: unknown = null;
for (let t = 0; t < maxS * 60; t++) {
  player.health.current = player.health.max; // god
  const fr = emptyInput(), pc = Math.hypot(console_.x - player.transform.x, console_.z - player.transform.z);
  if (pc > 1.2) { fr.move = { x: (console_.x - player.transform.x) / pc, z: (console_.z - player.transform.z) / pc }; }
  fr.interact = t % 60 < 45 && pc <= console_.radius;
   world.applyInput(fr, 'keyboard');
  world.update();
  const mp = world.megaPursuit, e = mp?.entity();
  const d = e ? Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) : Infinity;
  if (chargeDone < 0 && m.state.states['charge-ready']) { chargeDone = t; distAtCharge = d; }
  if (firstNear < 0 && d <= 15) firstNear = t;
  if (chargeDone >= 0 && !guide && m.state.steps.mega.status === 'active') guide = markerAnchor(m);
  if (chargeDone >= 0 && within15 < 0 && d <= 15) within15 = t;
  if (t % 1800 === 0) console.log(`t=${(t / 60) | 0}s charge=${m.state.counters['charge-ticks']} mode=${mp?.state.mode} phase=${e?.infected?.megaPhase} hp=${e ? Math.round(e.health.current) : '-'} megaD=${Math.round(d)} megaToConsole=${e ? Math.round(Math.hypot(e.transform.x - console_.x, e.transform.z - console_.z)) : '-'} stuck=${mp?.state.stuck.level} player=(${player.transform.x.toFixed(0)},${player.transform.z.toFixed(0)}) hidden=${e?.infected?.hidden} bstate=${e?.infected?.state} special=${e?.infected?.specialAttack?.move} pos=(${e?.transform.x.toFixed(1)},${e?.transform.z.toFixed(1)})  noPath=${mp?.state.stuck.noPath} atk=${e?.combat?.attacking} grab=${e?.infected?.grabUntil} recov=${e?.infected?.specialRecoveryUntil} tick=${world.tick} stagger=${e?.combat?.staggerUntil} cd=${JSON.stringify(e?.infected?.specialCooldowns)}`);
  if (within15 >= 0 && t > within15 + 300) break;
}
console.log(JSON.stringify({ seed, chargeDoneS: chargeDone / 60, within15S: within15 / 60, firstNearFromLoadS: firstNear / 60, distAtCharge: Math.round(distAtCharge), guide, arrivalS: within15 < 0 ? null : (within15 - chargeDone) / 60 }));
world.dispose();
process.exit(0);
