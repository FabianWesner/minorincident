import { SceneSession, stopServer } from '../scenelab/session';
const cells: {frame:number; jpeg:Buffer}[] = [];
const groups = [
  ['setpiece-quarantine-gate', 3010, 95],
  ['setpiece-burning-convoy', 3260, 95],
  ['setpiece-dark-underpass', 3390, 74],
  ['setpiece-field-hospital', 3502, 95],
] as const;
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ backend: 'webgl2', tier, viewport: { width:1280, height:720 }, query: { zoom:'1' } });
    try {
      await session.open();
      await session.page.evaluate(async () => {
        const api = window.__SS__!;
        await api.loadLevel('L10', { seed:1, checkpoint:'cure-research' });
        if (api.missions.state()?.phase === 'briefing') api.missions.begin();
        api.pause(); api.cheats.god(true); api.camera.follow(); api.camera.zoom(1);
      });
      for (const [group,x,z] of groups) {
        const closed = await session.page.evaluate(async ({group,x,z}) => {
          const api = window.__SS__!;
          const world = (window.__SCENE__ as unknown as {game:{world: import('../../src/sim/world/SimWorld').SimWorld}}).game.world;
          api.teleport(1, {x:x-8,z}); await api.step(120); await api.screenshotReady();
          const id = world.l10Encounters?.state.roadblockGates?.[group];
          if (id === undefined) throw new Error(`${group}: no gate`);
          const gate=world.entities.get(id);
          if (!gate?.interactable || gate.interactable.open || !world.interactables!.walls.some(w => w.entityId===id)) throw new Error(`${group}: gate is not closed`);
          return {id, x:gate.transform.x, z:gate.transform.z, wall:world.interactables!.walls.find(w=>w.entityId===id)};
        },{group,x,z});
        cells.push({frame:cells.length, jpeg:await session.snapshot()});
        await session.page.evaluate(async id => {
          const api=window.__SS__!, world=(window.__SCENE__ as unknown as {game:{world: import('../../src/sim/world/SimWorld').SimWorld}}).game.world;
          const gate=world.entities.get(id)!; gate.interactable!.open=true; gate.interactable!.completed=true; world.interactables!.unblock(id);
          await api.step(1); await api.screenshotReady();
        },closed.id);
        cells.push({frame:cells.length, jpeg:await session.snapshot()});
        console.log(JSON.stringify({tier,group,closed}));
      }
      if (tier === 'low') console.log(await session.makeSheet(cells, 'docs/reports/s243-l10ride/roadblocks.jpg', 480, 500));
    } finally { await session.close(); }
  }
} finally { stopServer(); }
