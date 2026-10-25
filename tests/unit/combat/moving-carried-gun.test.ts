import { expect, test } from 'vitest';
import { emptyInput } from '../../../src/input/InputFrame';
import { preset } from '../../../src/sim/progression/Campaign';
import { applyCampaign } from '../../../src/sim/progression/apply';
import { completeCampaignLevel } from '../../../src/sim/progression/carryover';
import { arena, dummy } from '../../sim/combat/helpers';

for (const moveFrom of [0, 8]) test(`@E03 @E13 Q-161 L4→L5 carried MG keeps firing a held target when WASD starts at tick ${moveFrom}`, async () => {
  const w = await arena(), save = preset('L4-default');
  save.ownedActions.push('weapon.army-mg'); save.racks.RIGHT = ['weapon.army-mg', 'weapon.handgun']; save.selectedAction = 'weapon.army-mg';
  applyCampaign(w, save);
  completeCampaignLevel(save, 4, { time: 1, kills: 0, knockdowns: 0, damage: 0, deaths: 0, rescued: 0, optionalObjectives: [] }, w);
  w.loadScenario('combat-arena'); w.scenario = 'L5'; applyCampaign(w, save);
  const id = dummy(w, 10, 0, 10000), p = w.entities.get(1)!;
  for (let tick = 0; tick < 90; tick++) {
    const frame = emptyInput(), dx = 10 - p.transform.x, dz = -p.transform.z, d = Math.hypot(dx, dz);
    frame.mouseAttack = frame.pointerTarget = true; frame.aimSource = 'pointer';
    frame.aim = { x: dx / d, z: dz / d }; frame.left = { down: tick === 0, held: true, up: false };
    if (tick === 0) { frame.attackTarget = { id, side: 'LEFT' }; frame.cancelMove = true; }
    if (tick === moveFrom) frame.cancelMove = true; // InputSystem's real WASD key edge
    if (tick >= moveFrom && tick < 60) frame.move = { x: 0, z: 1 };
    w.applyInput(frame, 'mouse-keyboard'); w.update();
  }
  const shots = w.events.events().filter(e => e.type === 'combat.attack' && e.sourceId === 1);
  expect(shots.length).toBeGreaterThanOrEqual(13);
  expect(w.entities.get(id)!.health.current).toBeLessThan(9900);
  expect(p.transform.z).toBeGreaterThan(1);
  expect(w.combat!.runner.loadout.current('RIGHT')).toMatchObject({ id: 'weapon.army-mg', magazine: 0, charges: 0, reloadUntil: 0 });
  // Release ends the target command; a dead target must not turn held fire into ground shots.
  w.entities.get(id)!.health.current = 0;
  for (let tick = 0; tick < 15; tick++) { const frame = emptyInput(); frame.mouseAttack = frame.pointerTarget = true; frame.left.held = true; w.applyInput(frame, 'mouse-keyboard'); w.update(); }
  expect(w.controls.targetId).toBeNull();
});
