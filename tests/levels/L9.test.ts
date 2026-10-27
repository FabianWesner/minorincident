import { expect, test } from 'vitest';
import { debugCampaign } from '../../src/sim/progression/Campaign';
import { completeCampaignLevel } from '../../src/sim/progression/carryover';
import { validateSave } from '../../src/sim/progression/Save';
import { runLevel } from '../../tools/sim-runner/levels';

test('T-E31-complete @E31-AC01 @E31-AC05 @E31-AC10 @E31-AC15 seed 1 drives the crossing and completes its forced crash with ordinary inputs', async () => {
  const save = debugCampaign(9, null);
  const report = await runLevel('L9', 'complete', 1, 1200, 'auto', save, (world, result) => {
    expect(world.combat!.damage.god).toBe(false);
    expect(world.missions!.l9!.state.finished).toBe(true);
    expect(world.entities.get(world.missions!.l9!.state.carId)!.vehicle!.damage).toBe('exploded');
    expect(world.events.events().filter(e => e.type === 'level.completed' && e.id === 'L9')).toHaveLength(1);
    completeCampaignLevel(save, 9, result, world);
  });
  expect(report.completed, JSON.stringify(report)).toBe(true);
  expect(save.completedLevels).toBe(9);
  expect(save.unlockedLevel).toBe(10);
  expect(save.racks).toEqual({ LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.fire-axe'] });
  expect(save.selectedAction).toBe('weapon.fire-axe');
  expect(validateSave(save)).toBe(true);
}, 120_000);
