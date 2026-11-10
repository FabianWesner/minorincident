// r31-megafight: native probe. Load l10-dispersal-console, run the console charge and the Mega fight with a god courier that
// (a) holds the console, then (b) kites away from it (west) and comes back, and report how far the Mega strays from the console,
// whether the HUD text says "Back to the dispersal arena" while the Mega is in melee range, and what the Mega does.
//   node --import tsx/esm tools/qa/r31-megafight-probe.ts [kite=1|0] [seconds=180] [hurt=1] [god=1]
import { decodeSave } from '../../src/sim/progression/Save';
import { loadLevel } from '../sim-runner/levels';
import { emptyInput } from '../../src/input/InputFrame';
import { readFixture } from './fixture-io';
import { cureFinaleText } from '../../src/sim/missions/LevelTenFinale';

const kite = (process.argv[2] ?? '1') === '1', maxS = Number(process.argv[3] ?? 180), hurt = (process.argv[4] ?? '1') === '1', god = (process.argv[5] ?? '1') === '1';
let damageTaken = 0, lastHp = 0, deadAtS = -1;
const f = readFixture('tests/fixtures/saves/qa/l10-dispersal-console.json.gz');
const decoded = decodeSave(JSON.stringify(f.campaign));
if (decoded.status !== 'ok') throw new Error('decode');
const world = await loadLevel('L10', 1, decoded.save);
const m = world.missions!;
if (decoded.save.cureResume) m.loadResume(decoded.save.cureResume);
const player = world.entities.get(1)!, c = m.def.anchors['cure-console'];
const d2 = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
let maxMega = 0, maxPlayer = 0, backWhileMelee = 0, attacking = 0, samples = 0, standTicks = 0;
const modes = new Map<string, number>(), specials = new Map<string, number>();
for (let t = 0; t < maxS * 60; t++) {
  if (god) player.health.current = player.health.max;
  if (!lastHp) lastHp = player.health.current;
  if (player.health.current < lastHp) damageTaken += lastHp - player.health.current;
  lastHp = player.health.current;
  if (player.health.current <= 0) { deadAtS = t / 60; break; }
  const fr = emptyInput(), sec = t / 60;
  // 0-65 s: hold the console. 65-95 s (kite): run west 70 m away. afterwards: back at the console.
  const away = kite && sec >= 65 && sec < 95;
  const target = away ? { x: c.x - 70, z: c.z } : { x: c.x + 1, z: c.z };
  const d = d2(target, player.transform);
  if (d > 1) fr.move = { x: (target.x - player.transform.x) / d, z: (target.z - player.transform.z) / d };
  fr.interact = t % 60 < 45 && d2(player.transform, c) <= c.radius;
  world.applyInput(fr, 'keyboard');
  if (hurt && m.state.states['charge-ready'] && t % 6 === 0) { const e = world.megaPursuit?.entity(); if (e && e.health.current > 0) e.health.current = Math.max(1, e.health.current - 10); }
  world.update();
  const e = world.megaPursuit?.entity();
  if (!e || e.health.current <= 0) continue;
  const dm = d2(e.transform, c), dp = d2(player.transform, c), gap = d2(e.transform, player.transform);
  maxMega = Math.max(maxMega, dm); maxPlayer = Math.max(maxPlayer, dp);
  const txt = cureFinaleText(m) ?? '';
  if (txt.startsWith('Back to the dispersal arena') && gap < 6) backWhileMelee++;
  const mv = e.infected?.specialAttack?.move; if (mv) specials.set(mv, (specials.get(mv) ?? 0) + 1);
  if (e.infected!.state === 'attack' || e.combat!.attacking) attacking++;
  const mode = `${world.megaPursuit!.state.mode}/${e.infected!.state}`; modes.set(mode, (modes.get(mode) ?? 0) + 1);
  if (!mv && e.infected!.state !== 'attack' && gap < 6 && !e.combat!.attacking) standTicks++;
  samples++;
}
console.log(JSON.stringify({ god, damageTaken: Math.round(damageTaken), courierDeadAtS: deadAtS, kite, maxMegaFromConsoleM: +maxMega.toFixed(1), maxCourierFromConsoleM: +maxPlayer.toFixed(1), backTextWhileMeleeTicks: backWhileMelee, megaNearNotAttackingTicks: standTicks, attackTicks: attacking, samples, charge: m.state.counters['charge-ticks'], megaDead: m.state.states['mega-dead'], gateSpent: m.state.states['gate-spent'], specials: Object.fromEntries(specials), modes: Object.fromEntries(modes) }));
world.dispose();
process.exit(0);
