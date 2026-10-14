import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { newCampaign, type Level } from '../../src/sim/progression/Campaign';
import { completeCampaignLevel } from '../../src/sim/progression/carryover';
import { validateSave } from '../../src/sim/progression/Save';
import { runLevel, type LevelReport, type RunnerLevel } from '../../tools/sim-runner/levels';

test('T-E31-20 @E31-AC20 continuous seed 1 L1 through L9 commits real campaign handovers and the axe reset', async () => {
  const save = newCampaign('female', 1);
  const reports: (LevelReport & { racks: typeof save.racks; survivors: string[] })[] = [];
  const out = 'test-results/epics/E31/campaign-seed-1.json';
  try {
    for (let n = 1; n <= 9; n++) {
      const level = `L${n}` as RunnerLevel;
      const transport = structuredClone(save.transport);
      const abilities = save.ownedActions.filter(id => id.startsWith('ability.'));
      const report = await runLevel(level, 'complete', save.seed, 1200, 'auto', save, (world, result) => {
        // Match Game's completion callback, including the exact zoo APC payload.
        if (n === 7) expect(world.l7Encounters!.state.roster.map(r => r.id)).toEqual(save.results!.L6.escapedSurvivors!.map(e => e.id));
        if (n === 8) {
          expect(world.missions!.l8!.state.roster).toEqual(save.results!.L7.escapedSurvivors!.map(e => e.id));
          save.transport = world.missions!.l8!.transferOrNull() ?? undefined;
        }
        if (n === 9) {
          expect(world.missions!.l9!.state.carId).toBe(transport!.vehicle.id);
          expect(world.missions!.l9!.state.preCrashDurability).toBeLessThanOrEqual(transport!.vehicle.health.current);
        }
        completeCampaignLevel(save, n as Level, result, world);
      });
      reports.push({ ...report, racks: structuredClone(save.racks), survivors: [...save.survivors ?? []] });
      console.log(JSON.stringify({ level, completed: report.completed, time: report.time, deaths: report.deaths, blocker: report.blocker }));
      expect(report.completed, JSON.stringify(report)).toBe(true);
      expect(save.completedLevels).toBe(n); expect(save.unlockedLevel).toBe(n + 1);
      expect(save.pending).toBeUndefined(); expect(validateSave(save)).toBe(true);
      if (n === 1) expect(save.world?.L1).toBeDefined();
      if (n === 5) expect(save.stationOccupants).toBeDefined();
      if (n === 7) expect(save.racks.RIGHT).toContain('weapon.rocket-launcher');
      if (n === 9) {
        expect(save.ownedActions.filter(id => id.startsWith('ability.'))).toEqual(abilities);
        expect(save.crossingHandover!.shelteredPassengers.map(e => e.id)).toEqual(transport!.occupants.filter(e => e.id !== 1 && !e.companion).map(e => e.id));
      }
      if (n === 8) {
        expect(save.transport?.vehicle.archetype).toBe('vehicle.military-apc');
        expect(save.transport?.occupants.find(e => e.id === 1)?.weapons?.RIGHT.rack.map(s => s.id)).toEqual(save.racks.RIGHT);
      }
    }
    expect(reports).toHaveLength(9);
    expect(save.crossingHandover?.applied).toBe(true);
    expect(save.crossingHandover?.lostWeapons).toContain('weapon.rocket-launcher');
    expect(save.transport).toBeUndefined();
    expect(save.ownedActions.filter(id => id.startsWith('weapon.'))).toEqual(['weapon.fire-axe']);
    expect(save.racks).toEqual({ LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.fire-axe'] });
  } finally {
    mkdirSync('test-results/epics/E31', { recursive: true });
    writeFileSync(out, JSON.stringify({ seed: 1, reports, save }, null, 2) + '\n');
  }
}, 1_800_000);
