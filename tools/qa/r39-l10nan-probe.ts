// r39-l10nan: native probe. Load l10-dispersal-console (courier holding the console, firing at the Mega) and report the
// first tick where any number on the courier (transform, knockback, locomotion, survivor, combat) goes non-finite, every
// courier HP drop with the events of that tick, and the Mega's special moves.
//   node --import tsx/esm tools/qa/r39-l10nan-probe.ts [seconds=30] [god=1] [kite=1] [force=0]
// force=1: from 2 s on, put the Mega 1.2 m from the courier and start its grab-throw on her (the r38-vqa P1 move).
import { decodeSave } from '../../src/sim/progression/Save';
import { loadLevel } from '../sim-runner/levels';
import { emptyInput } from '../../src/input/InputFrame';
import { readFixture } from './fixture-io';

const maxS = Number(process.argv[2] ?? 30), god = (process.argv[3] ?? '1') === '1', kite = (process.argv[4] ?? '1') === '1', force = (process.argv[5] ?? '0') === '1';
const f = readFixture('tests/fixtures/saves/qa/l10-dispersal-console.json.gz');
const decoded = decodeSave(JSON.stringify(f.campaign));
if (decoded.status !== 'ok') throw new Error('decode');
const world = await loadLevel('L10', 1, decoded.save);
const m = world.missions!;
if (decoded.save.cureResume) m.loadResume(decoded.save.cureResume);
if (god) world.combat!.damage.god = true;
const player = world.entities.get(1)!, c = m.def.anchors['cure-console'];
const bad = (o: unknown, path: string, out: string[], depth = 0): void => {
  if (depth > 5 || o === null || o === undefined) return;
  if (typeof o === 'number') { if (Number.isNaN(o)) out.push(path); return; }
  if (typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) bad(v, `${path}.${k}`, out, depth + 1);
};
let lastHp = player.health.current, reported = 0, firstBad = -1, forced = false;
const start = world.tick;
for (let t = 0; t < maxS * 60; t++) {
  const fr = emptyInput();
  const mega = world.megaPursuit?.entity();
  // Like r28-vqa-fixture-play: aim at the nearest live infected; back away from it inside 6 m (kite), else hold the console.
  let foe: typeof player | undefined, fd = Infinity;
  for (const e of world.infected?.active ?? []) { if (e.health.current <= 0 || e.hidden) continue; const dd = Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z); if (dd < fd) { fd = dd; foe = e; } }
  if (kite && foe && fd < 6) { const dx = player.transform.x - foe.transform.x, dz = player.transform.z - foe.transform.z, l = Math.hypot(dx, dz) || 1; fr.move = { x: dx / l, z: dz / l }; }
  else if (!kite || !foe || fd > 12) {
    const d = Math.hypot(c.x + 1 - player.transform.x, c.z - player.transform.z);
    if (d > 1) fr.move = { x: (c.x + 1 - player.transform.x) / d, z: (c.z - player.transform.z) / d };
  }
  fr.interact = t % 60 < 45 && Math.hypot(player.transform.x - c.x, player.transform.z - c.z) <= c.radius;
  if (foe && fd < 30 && t % 20 < 10) { const dx = foe.transform.x - player.transform.x, dz = foe.transform.z - player.transform.z, l = Math.hypot(dx, dz) || 1; fr.aim = { x: dx / l, z: dz / l }; fr.aimSource = 'pointer'; fr.left = { down: t % 20 === 0, held: true, up: false }; }
  if (force && mega && t >= 120 && !forced && !mega.infected!.specialAttack) {
    mega.transform.x = player.transform.x + 1.2; mega.transform.z = player.transform.z; world.spatial.set(mega.id, mega.transform.x, mega.transform.z);
    mega.combat!.staggerUntil = 0; mega.infected!.cooldown = 0; mega.infected!.specialRecoveryUntil = 0; mega.infected!.specialCooldowns = {};
    forced = world.infected!.startSpecial(mega.id, 'alpha.grab-throw', { id: 1, x: player.transform.x, z: player.transform.z }, { x: mega.transform.x, z: mega.transform.z, radius: 1.5, dx: -1, dz: 0 });
    if (forced) console.log(JSON.stringify({ forcedGrab: world.tick - start }));
  }
  if (force && (!forced || mega?.infected?.specialAttack?.move === 'alpha.grab-throw')) { fr.move = { x: 0, z: 0 }; fr.left = { down: false, held: false, up: false }; fr.aim = null; }
  world.applyInput(fr, 'keyboard');
  const before = world.tick;
  world.update();
  const tickEvents = world.events.events(before).map(e => e.type);
  const issues: string[] = [];
  bad(player.transform, 'transform', issues); bad((player as { knockbackSlide?: unknown }).knockbackSlide, 'knockbackSlide', issues);
  bad(player.survivor, 'survivor', issues); bad(mega?.transform, 'mega.transform', issues); bad(mega?.infected?.specialAttack, 'mega.special', issues); bad(player.combat, 'combat', issues); bad({ ...world.player?.locomotion, slipMiss: undefined }, 'locomotion', issues);
  const sp = mega?.infected?.specialAttack;
  if (sp && (t % 15 === 0 || (force && sp.move === "alpha.grab-throw"))) console.log(JSON.stringify({ tick: world.tick - start, mega: sp.move, stage: sp.stage, grabbed: sp.grabbedId, release: sp.grabReleaseTick, d: +Math.hypot(mega!.transform.x - player.transform.x, mega!.transform.z - player.transform.z).toFixed(2), kd: player.survivor?.knockdown, p: { x: +player.transform.x.toFixed(2), y: +player.transform.y.toFixed(2), z: +player.transform.z.toFixed(2) }, hp: player.health.current }));
  if (issues.length && firstBad < 0) { firstBad = world.tick - start; console.log(JSON.stringify({ FIRST_NONFINITE: firstBad, issues: issues.slice(0, 20), events: tickEvents, p: player.transform, ks: (player as { knockbackSlide?: unknown }).knockbackSlide })); }
  if (player.health.current < lastHp && reported++ < 20) console.log(JSON.stringify({ hpDrop: { from: lastHp, to: player.health.current, tick: world.tick - start }, events: tickEvents, mega: sp?.move }));
  lastHp = player.health.current;
}
console.log(JSON.stringify({ done: true, firstBad, hp: player.health.current, p: player.transform }));
world.dispose();
process.exit(0);
