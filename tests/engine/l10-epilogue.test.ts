import { expect, test } from 'vitest';
import { decodeSave } from '../../src/sim/progression/Save';
import { loadLevel } from '../../tools/sim-runner/levels';
import { emptyInput } from '../../src/input/InputFrame';
import { readFixture } from '../../tools/qa/fixture-io';
import { l10Closing, l10ClosingPose } from '../../src/render/characters/l10Closing';

// r31-epilogue (r30-finale-qa: "When the fight ended away from the console, she stands alone with the corgi for 8 s.
// Cured people only appear when infected are nearby."): the release beat always has a cured crowd around her, clear of
// bodies; Voss's "Release it. Now." ends with the release; the closing group never stands in the Mega's body.
test('L10 release: a cured crowd kneels around her, clear of bodies; the release order clears', async () => {
  const f = readFixture('tests/fixtures/saves/qa/l10-dispersal-console.json.gz');
  const decoded = decodeSave(JSON.stringify(f.campaign));
  if (decoded.status !== 'ok') throw new Error('decode');
  const world = await loadLevel('L10', 1, decoded.save), m = world.missions!;
  if (decoded.save.cureResume) m.loadResume(decoded.save.cureResume);
  const c = m.def.anchors['cure-console'], player = world.entities.get(1)!;
  // Release-ready at the console with nobody infected near, as when the Mega fell far away.
  m.state.states['charge-active'] = m.state.states['charge-ready'] = m.state.states['mega-dead'] = true;
  m.state.counters['charge-ticks'] = 3600; m.state.steps.hold.status = 'completed'; m.state.steps.release.status = 'active';
  for (const e of [...world.entities.iterate()]) if (e.faction === 'infected' && e.health.current > 0 && Math.hypot(e.transform.x - c.x, e.transform.z - c.z) < 30) e.health.current = 0;
  Object.assign(player.transform, { x: c.x + .5, z: c.z }); world.physics.playerBody!.setTranslation({ x: c.x + .5, y: player.transform.y, z: c.z }, true);
  m.radio('L10.release');
  for (let t = 0; t < 4 && !m.state.states['cure-released']; t++) { const fr = emptyInput(); fr.interact = t % 2 === 0; world.applyInput(fr, 'keyboard'); world.update(); }
  expect(m.state.states['cure-released']).toBe(true);
  expect(m.state.subtitle?.id).not.toBe('L10.release');
  const p = player.transform, cured = m.state.cureFront!.affectedIds.map(id => world.entities.get(id)!).filter(e => e?.civilian && e.health.current > 0 && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 14);
  expect(cured.length).toBeGreaterThanOrEqual(world.infected!.director.tier === 'low' ? 4 : 7);
  const bodies = [...world.entities.iterate()].filter(e => e.corpse || (e.health.current <= 0 && e.id !== 1));
  for (const person of cured) for (const body of bodies) expect(Math.hypot(person.transform.x - body.transform.x, person.transform.z - body.transform.z)).toBeGreaterThan(1.5);
  // Deterministic: a second release is a no-op (no second crowd).
  const count = m.state.cureFront!.affectedIds.length; m.l10!.epilogue.gatherCured(); expect(m.state.cureFront!.affectedIds.length).toBe(count);

  // Closing shot: everyone in the group stands clear of the Mega's body, facing her seat.
  world.applyInput(emptyInput(), 'keyboard'); world.update();
  m.state.counters['epilogue-ticks'] = 46 * 60; expect(m.state.epilogue?.phase).toBe('playable');
  const seat = l10Closing.seat(world)!, mega = l10Closing.megaBody(world);
  for (const person of cured) {
    const pose = l10ClosingPose(world, person);
    if (!pose) continue;
    if (mega) expect(Math.hypot(pose.x - mega.x, pose.z - mega.z)).toBeGreaterThanOrEqual(4.49);
    expect(Math.hypot(pose.x - seat.x, pose.z - seat.z)).toBeGreaterThan(3);
  }
  world.dispose();
}, 120_000);
