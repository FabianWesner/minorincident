import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { compositions } from '../../../src/levels/compositions';
import { resolveCampaignMission } from '../../../src/levels/missions';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { installPerformanceLevel, performanceLevels } from '../../fixtures/scenarios/performance';

for (const name of ['perf-l5-aftermath', 'perf-l6-mainstreet']) for (const tier of ['high', 'low'] as const) for (const prepared of [false, true]) {
  test(`@E18-AC01 ${name} ${tier} prepared=${prepared} retains campaign cast and measures the exact stress population`, async () => {
    const world = new SimWorld();
    try {
      await world.init();
      const fixture = performanceLevels[name], composition = compositions[fixture.level];
      world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1);
      world.infected!.director.setTier(tier); world.npcs!.setQuality(tier);
      const mission = world.loadMission(resolveCampaignMission(fixture.level as 'L5' | 'L6', world.districts!));
      const ai = world.infected;
      if (prepared) mission.begin();
      const campaignPlayer = { ...world.entities.get(1)!.transform };
      installPerformanceLevel(world, tier, name);
      expect(world.infected).toBe(ai);
      expect(mission.state.phase).toBe('playing');
      expect(ai!.director.cap).toBe(tier === 'high' ? 200 : 100);
      expect(ai!.director.count).toBe(ai!.director.cap);
      // Every living infected belongs to the updating system, including campaign wanderers.
      expect(world.entities.values().filter(e => e.infected && e.health.current > 0).map(e => e.id).sort()).toEqual(ai!.active.filter(e => e.health.current > 0).map(e => e.id).sort());
      if (fixture.level === 'L5') {
        if (prepared) expect(world.entities.get(1)!.transform).toEqual(campaignPlayer);
        expect(world.entities.values().filter(e => e.civilian?.state === 'finished').length).toBeGreaterThanOrEqual(30);
      }
      else {
        expect(mission.state.l6!.survivors.length).toBeGreaterThanOrEqual(tier === 'high' ? 24 : 15);
        const district = world.districts!.districts[0], start = district.layout.anchors['player-start'].position;
        expect(world.entities.get(1)!.transform).toMatchObject({ x: district.origin[0] + start[0], z: district.origin[1] + start[2] });
      }
      expect(fixture.spot.startsWith(`${world.districts!.districts[0].id}/`)).toBe(true);
    } finally { world.dispose(); }
  });
}
