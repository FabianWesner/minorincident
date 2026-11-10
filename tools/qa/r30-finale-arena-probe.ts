// r30-finale-qa: native probe. Load l10-dispersal-console and list the finale arena devices (gate switch, fuel tanks)
// and the Mega special moves seen while a god courier walks to the gate switch and presses E, then holds the console.
//   node --import tsx/esm tools/qa/r30-finale-arena-probe.ts [seconds=120]
import { decodeSave } from '../../src/sim/progression/Save';
import { loadLevel } from '../sim-runner/levels';
import { emptyInput } from '../../src/input/InputFrame';
import { readFixture } from './fixture-io';

const maxS = Number(process.argv[2] ?? 120);
const f = readFixture('tests/fixtures/saves/qa/l10-dispersal-console.json.gz');
const decoded = decodeSave(JSON.stringify(f.campaign));
if (decoded.status !== 'ok') throw new Error('decode');
const world = await loadLevel('L10', 1, decoded.save);
const m = world.missions!;
if (decoded.save.cureResume) m.loadResume(decoded.save.cureResume);
const player = world.entities.get(1)!, c = m.def.anchors['cure-console'];
const actor = (k: string) => { const id = m.state.actors[k]; const e = id != null ? world.entities.get(id) : undefined; return { id, exists: !!e, at: e ? [+e.transform.x.toFixed(1), +e.transform.z.toFixed(1)] : null, interactable: e?.interactable ? { kind: e.interactable.kind, label: e.interactable.label, radius: e.interactable.radius, enabled: e.interactable.enabled, completed: e.interactable.completed } : null, hazard: (e as unknown as { hazard?: unknown })?.hazard ?? null }; };
console.log('console', c, 'arena-equipped', m.state.states['arena-equipped']);
for (const k of ['arena-gate-switch', 'arena-fuel-0', 'arena-fuel-1']) console.log(k, JSON.stringify(actor(k)));
const sw = { x: c.x + 10, z: c.z + 28 };
const specials = new Map<string, number>(); let pressedAt = -1, activeAtSwitch: number | null = null;
for (let t = 0; t < maxS * 60; t++) {
  player.health.current = player.health.max;
  const fr = emptyInput();
  const target = pressedAt < 0 ? sw : c, d = Math.hypot(target.x - player.transform.x, target.z - player.transform.z);
  if (d > 1) fr.move = { x: (target.x - player.transform.x) / d, z: (target.z - player.transform.z) / d };
  if (pressedAt < 0 && d <= 1.2) { activeAtSwitch = world.interactables?.activeId ?? null; fr.interact = t % 20 < 10; if (fr.interact && t % 20 === 0) pressedAt = t; }
  else if (pressedAt >= 0) fr.interact = t % 60 < 45 && d <= c.radius;
  world.applyInput(fr, 'keyboard'); world.update();
  const e = world.megaPursuit?.entity(), mv = e?.infected?.specialAttack?.move; if (mv) specials.set(mv, (specials.get(mv) ?? 0) + 1);
}
console.log(JSON.stringify({ pressedAtS: pressedAt / 60, activeIdAtSwitch: activeAtSwitch, switchAfter: actor('arena-gate-switch'), charge: m.state.counters['charge-ticks'], gateSpent: m.state.states['gate-spent'], specialTicks: Object.fromEntries(specials) }));
world.dispose();
process.exit(0);
