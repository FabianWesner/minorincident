import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { compositions } from '../../../src/levels/compositions';
import { missionIds, resolveCampaignMission } from '../../../src/levels/missions';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { stateHash } from '../../../src/sim/world/stateHash';

for (const id of missionIds) test(`${id}: loading preparation is idempotent and Begin preserves the initial simulation`, async () => {
  const run = async (early: boolean) => {
    const world = new SimWorld(); await world.init();
    try {
      const c = compositions[id];
      world.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1);
      const mission = world.loadMission(resolveCampaignMission(id, world.districts!));
      if (early) {
        mission.prepare(); const entities = world.query({}); const state = structuredClone(mission.state);
        mission.prepare();
        expect(world.query({})).toEqual(entities); expect(mission.state).toEqual(state);
        expect(mission.state.phase).toBe('briefing');
        expect(Object.values(mission.state.steps).every(s => s.status === 'pending')).toBe(true);
        expect(world.events.events().some(e => e.type === 'level.started')).toBe(false);
      }
      mission.begin(); const hash = stateHash(world.getState());
      mission.loadCheckpoint('start'); expect(mission.state.phase).toBe('playing');
      return hash;
    } finally { world.dispose(); }
  };
  expect(await run(true)).toBe(await run(false));
}, 120_000);
