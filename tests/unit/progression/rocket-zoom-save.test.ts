import { expect, test } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { applyCampaign } from '../../../src/sim/progression/apply';
import { preset } from '../../../src/sim/progression/Campaign';
import { decodeSave, validateSave } from '../../../src/sim/progression/Save';
import { levelTenMission } from '../../../src/levels/L10/mission';

test('#67 @E32-AC27 rocket zoom survives a valid Cure checkpoint save; out-of-range zoom stays invalid', async () => {
  const world = new SimWorld(); await world.init();
  try {
    world.loadScenario('combat-arena'); applyCampaign(world, preset('L10-default'));
    const mission = world.loadMission(levelTenMission(() => ({ x: 0, z: 0, radius: 2 }))); mission.begin();
    for (let i = 0; mission.state.checkpoint !== 'cure-corridor' && i < 12; i++) mission.completeObjective();
    expect(mission.state.checkpoint).toBe('cure-corridor');
    const save = structuredClone(world.progression!.campaign!);
    for (const cameraZoom of [.5, 1.5, 2]) {
      save.cureResume = { ...mission.saveResume(), cameraZoom };
      expect(validateSave(save), `zoom ${cameraZoom}`).toBe(true);
      const decoded = decodeSave(JSON.stringify(save)); expect(decoded.status).toBe('ok');
      if (decoded.status === 'ok') expect(decoded.save.cureResume!.cameraZoom).toBe(cameraZoom);
    }
    for (const cameraZoom of [.49, 2.01, NaN, Infinity]) {
      save.cureResume = { ...mission.saveResume(), cameraZoom }; expect(validateSave(save)).toBe(false);
    }
  } finally { world.dispose(); }
});
