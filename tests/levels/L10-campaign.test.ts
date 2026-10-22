import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { newCampaign, nextLevelAfter, type Level } from '../../src/sim/progression/Campaign';
import { completeCampaignLevel } from '../../src/sim/progression/carryover';
import { validateSave } from '../../src/sim/progression/Save';
import { runLevel, type LevelReport, type RunnerLevel } from '../../tools/sim-runner/levels';

test('T-E32-32 @E32-AC32 continuous seed 1 L1 through L10 reaches credits with real campaign handovers', async () => {
  const save = newCampaign('female', 1);
  const reports: (LevelReport & { racks: typeof save.racks; survivors: string[] })[] = [];
  const out = 'test-results/epics/E32/Q4/campaign-seed-1.json';
  try {
    for (let n = 1; n <= 10; n++) {
      const level = `L${n}` as RunnerLevel;
      const transport = structuredClone(save.transport);
      const abilities = save.ownedActions.filter(id => id.startsWith('ability.'));
      const report = await runLevel(level, 'complete', save.seed, n === 10 ? 3600 : 1200, 'auto', save, (world, result) => {
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
        expect(world.combat!.damage.god).toBe(false);
        if (n === 10) {
          const m = world.missions!;
          expect(m.state.epilogue!.phase).toBe('done');
          expect(m.state.states['cure-released']).toBe(true);
          expect(world.megaPursuit!.state.mode).toBe('dead');
          expect(world.progression!.campaign!.world?.infectionCleared?.level).toBe(10);
          expect(world.events.events().filter(e => e.type === 'level.completed' && e.id === 'L10')).toHaveLength(1);
        }
        completeCampaignLevel(save, n as Level, result, world);
        if (n === 10) {
          // Game.saveCampaign materializes the live L10 arsenal/world after completion.
          const live = world.progression!.campaign!;
          save.ownedActions = [...live.ownedActions]; save.racks = structuredClone(live.racks);
          save.world = structuredClone(live.world); save.cureResume = world.missions!.saveResume();
        }
      });
      reports.push({ ...report, racks: structuredClone(save.racks), survivors: [...save.survivors ?? []] });
      console.log(JSON.stringify({ level, completed: report.completed, time: report.time, deaths: report.deaths, blocker: report.blocker }));
      expect(report.completed, JSON.stringify(report)).toBe(true);
      if (n === 10) expect(report.cureReleases).toBe(1);
      expect(save.completedLevels).toBe(n); expect(save.unlockedLevel).toBe(Math.min(10, n + 1));
      expect(save.pending).toBeUndefined(); expect(validateSave(save)).toBe(true);
      if (n === 1) expect(save.world?.L1).toBeDefined();
      if (n === 5) expect(save.stationOccupants).toBeDefined();
      if (n === 7) expect(save.racks.RIGHT).toContain('weapon.rocket-launcher');
      if (n === 9) {
        expect(save.racks).toEqual({ LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.fire-axe'] });
        expect(save.ownedActions.filter(id => id.startsWith('weapon.'))).toEqual(['weapon.fire-axe']);
        expect(save.ownedActions.filter(id => id.startsWith('ability.'))).toEqual(abilities);
        expect(save.crossingHandover!.shelteredPassengers.map(e => e.id)).toEqual(transport!.occupants.filter(e => e.id !== 1 && !e.companion).map(e => e.id));
      }
      if (n === 8) {
        expect(save.transport?.vehicle.archetype).toBe('vehicle.military-apc');
        expect(save.transport?.occupants.find(e => e.id === 1)?.weapons?.RIGHT.rack.map(s => s.id)).toEqual(save.racks.RIGHT);
      }
    }
    expect(reports).toHaveLength(10);
    expect(save.crossingHandover?.applied).toBe(true);
    expect(save.crossingHandover?.lostWeapons).toContain('weapon.rocket-launcher');
    expect(save.transport).toBeUndefined();
    expect(save.completedLevels).toBe(10); expect(nextLevelAfter(10)).toBeNull();
    expect(save.results!.L10.time).toBe(reports[9].time);
    expect(reports[9].regions).toHaveLength(7);
    expect(reports[9].objectiveTimeline.map(e => e.id)).toEqual(['crash', 'residential-fringe', 'industrial-area', 'military-zone', 'research-campus', 'research', 'cure', 'research-exit', 'destroyed-corridor', 'dispersal-complex', 'install', 'hold', 'mega', 'release', 'epilogue', 'credits']);
  } finally {
    mkdirSync('test-results/epics/E32/Q4', { recursive: true });
    writeFileSync(out, JSON.stringify({ seed: 1, reports, save }, null, 2) + '\n');
  }
}, 1_800_000);
