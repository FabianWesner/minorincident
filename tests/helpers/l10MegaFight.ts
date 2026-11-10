import { decodeSave } from '../../src/sim/progression/Save';
import { loadLevel } from '../../tools/sim-runner/levels';
import { emptyInput } from '../../src/input/InputFrame';
import { readFixture } from '../../tools/qa/fixture-io';
import { cureFinaleText } from '../../src/sim/missions/LevelTenFinale';

// r31-megafight (called from tests/engine/missions.test.ts next to the resume check; the test budget forbids a new case): the fight stays
// in the arena, "Back to the dispersal arena" never shows while the Mega is in melee with her, the gate switch works by interact,
// a fuel tank next to the Mega and the electric gate both hurt it.
export interface MegaFightReport { maxMegaM: number; maxCourierM: number; backInMelee: number; switchDone: boolean; tankDamage: number; gateDamage: number; gateSpent: boolean }
export async function l10MegaFightCheck(): Promise<MegaFightReport> {
  const f = readFixture('tests/fixtures/saves/qa/l10-dispersal-console.json.gz');
  const decoded = decodeSave(JSON.stringify(f.campaign));
  if (decoded.status !== 'ok') throw new Error('decode');
  const out: MegaFightReport = { maxMegaM: 0, maxCourierM: 0, backInMelee: 0, switchDone: false, tankDamage: 0, gateDamage: 0, gateSpent: false };
  // 1. a fight with a courier who holds the console, runs 70 m west (20-50 s) and comes back.
  const world = await loadLevel('L10', 1, decoded.save);
  try {
    const m = world.missions!;
    m.loadResume(decoded.save.cureResume!);
    const player = world.entities.get(1)!, c = m.def.anchors['cure-console'];
    for (let t = 0; t < 110 * 60; t++) {
      player.health.current = player.health.max;
      const away = t >= 20 * 60 && t < 50 * 60, target = away ? { x: c.x - 70, z: c.z } : { x: c.x + 1, z: c.z };
      const fr = emptyInput(), d = Math.hypot(target.x - player.transform.x, target.z - player.transform.z);
      if (d > 1) fr.move = { x: (target.x - player.transform.x) / d, z: (target.z - player.transform.z) / d };
      fr.interact = t % 60 < 45 && Math.hypot(c.x - player.transform.x, c.z - player.transform.z) <= c.radius;
      world.applyInput(fr, 'keyboard'); world.update();
      const e = world.megaPursuit!.entity()!;
      if (e.health.current <= 0) break;
      out.maxMegaM = Math.max(out.maxMegaM, Math.hypot(e.transform.x - c.x, e.transform.z - c.z));
      out.maxCourierM = Math.max(out.maxCourierM, Math.hypot(player.transform.x - c.x, player.transform.z - c.z));
      if (cureFinaleText(m)?.startsWith('Back to the dispersal arena') && Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) < 10) out.backInMelee++;
    }
  } finally { world.dispose(); }
  // 2. switch by interact, a tank next to the Mega, the electric gate.
  const w2 = await loadLevel('L10', 1, decoded.save);
  try {
    const m = w2.missions!;
    m.loadResume(decoded.save.cureResume!);
    const player = w2.entities.get(1)!, c = m.def.anchors['cure-console'];
    for (let t = 0; t < 120; t++) { w2.applyInput(emptyInput(), 'keyboard'); w2.update(); } // the arena devices spawn
    const sw = w2.entities.get(m.state.actors['arena-gate-switch'])!;
    player.transform.x = sw.transform.x - 1; player.transform.z = sw.transform.z;
    for (let t = 0; t < 60; t++) { player.health.current = player.health.max; const fr = emptyInput(); fr.interact = t % 20 < 10; w2.applyInput(fr, 'keyboard'); w2.update(); }
    out.switchDone = !!sw.interactable?.completed;
    const mega = w2.megaPursuit!.entity()!, tank = w2.entities.get(m.state.actors['arena-fuel-0'])!;
    mega.transform.x = tank.transform.x + 2.5; mega.transform.z = tank.transform.z; mega.combat!.staggerUntil = w2.tick + 400; w2.spatial.set(mega.id, mega.transform.x, mega.transform.z);
    player.transform.x = tank.transform.x + 12; player.transform.z = tank.transform.z;
    const hp0 = mega.health.current;
    w2.combat!.damage.apply({ attackId: 0, actionId: 'weapon.army-mg', sourceId: 1, targetId: tank.id, origin: { x: player.transform.x, z: player.transform.z }, direction: { x: -1, z: 0 }, base: 400, multiplier: 1, type: 'bullet', stagger: 0, knockback: 0 });
    for (let t = 0; t < 240; t++) { player.health.current = player.health.max; w2.applyInput(emptyInput(), 'keyboard'); w2.update(); }
    out.tankDamage = hp0 - mega.health.current;
    const hp1 = mega.health.current;
    mega.combat!.staggerUntil = 0; player.transform.x = c.x - 30; player.transform.z = c.z + 28;
    for (let t = 0; t < 20; t++) { player.health.current = player.health.max; mega.transform.x = c.x; mega.transform.z = c.z + 28; w2.spatial.set(mega.id, c.x, c.z + 28); w2.applyInput(emptyInput(), 'keyboard'); w2.update(); }
    out.gateDamage = hp1 - mega.health.current; out.gateSpent = !!m.state.states['gate-spent'];
  } finally { w2.dispose(); }
  return out;
}
