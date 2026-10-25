/** Production skin acceptance receipts. One headless browser at a time; no runtime query flag. */
import { resolve } from 'node:path';
import { SceneSession, stopServer, writeJson, type Backend } from './session';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';

const out = resolve('docs/reports/skinned-prod'), receipts = [];
const backends = (process.env.BACKENDS ?? 'webgl2,webgpu').split(',') as Backend[];
const cases = new Set((process.env.CASES ?? 'humans,gore').split(','));
const spec: SceneSpec = {
  name: 'skinned-prod-humans', ground: 'asphalt', time: 'golden', size: 30, trace: true,
  actors: [
    { id: 'courier', kind: 'courier', at: [0, 7] },
    { id: 'woman', kind: 'pedestrian', at: [-2.5, 0], yaw: -30, look: { model: 'npc.civilian-woman-a', accessories: ['acc.hat-baseball-cap'] } },
    { id: 'man', kind: 'pedestrian', at: [-.8, 0], yaw: -30, look: { model: 'npc.civilian-man-b' } },
    { id: 'worker', kind: 'infected', archetype: 'infected.sprinter', at: [.8, 0], yaw: -30, state: 'idle', look: { model: 'inf.common-worker' } },
    { id: 'nurse', kind: 'infected', archetype: 'infected.sprinter', at: [2.5, 0], yaw: -30, state: 'idle', look: { model: 'inf.nurse' } },
  ],
  camera: { mode: 'pose', position: [7, 4.5, 10], target: [0, 1, 0] }, frames: 30,
};
try {
  for (const backend of backends) {
    const session = new SceneSession({ backend, tier: 'low', query: { crowdProbe: 'full' } });
    try {
      await session.open(); await session.load(spec); await session.step(30);
      if (cases.has('humans')) {
        await session.screenshot(resolve(out, `humans-${backend}.png`));
        const metrics = await session.metrics(), state = await session.page.evaluate(() => window.__SS__!.getState().render);
        receipts.push({ case: 'humans', backend, metrics, state, errors: [...session.errors] });
      }
      if (cases.has('gore')) {
        const gore: SceneSpec = { ...spec, name: 'skinned-prod-gore', barArchetypes: ['infected.sprinter'],
          actors: [{ id: 'courier', kind: 'courier', at: [0, 7], loadout: ['weapon.bat', 'weapon.fists'] },
            ...['arm', 'leg', 'head', 'flash'].map((id, i) => ({ id, kind: 'infected' as const, archetype: 'infected.sprinter', at: [i * 1.7 - 2.5, 0] as [number, number], yaw: -30, state: 'idle' as const, look: { model: 'inf.common-worker', accessories: [] } }))] };
        await session.load(gore); await session.step(1);
        const actors = (await session.metrics()).actors;
        const ids = Object.fromEntries(['arm', 'leg', 'head', 'flash'].map(id => [id, actors[id].entity]));
        await session.page.evaluate(ids => {
          const game = (window.__SCENE__ as unknown as { game: Game }).game;
          const crowd = (game.view as unknown as { crowd: { detach(id: number, limb: number): void; flash(id: number, strength: number): void } }).crowd;
          for (const id of [ids.arm, ids.leg, ids.head]) { const e = game.world.entities.get(id)!; e.health.current = 0; e.infected!.state = 'dead'; e.infected!.deadAt = game.world.tick; e.infected!.recoverAt = -1; }
          crowd.detach(ids.arm, 0); crowd.detach(ids.leg, 2); crowd.detach(ids.head, 4); crowd.flash(ids.flash, .45);
        }, ids);
        await session.screenshot(resolve(out, `severance-flash-${backend}.png`));
        const severed = await session.page.evaluate(() => window.__SS__!.getState().render);
        await session.page.evaluate(() => window.__SCENE__!.command('courier', { click: 'flash', part: 'chest' }));
        await session.step(1); const clicks = (await session.metrics()).clicks;
        await session.page.evaluate(() => { for (const id of ['arm', 'leg', 'head']) window.__SCENE__!.command(id, { corpse: true }); });
        await session.step(180); await session.screenshot(resolve(out, `severed-corpses-${backend}.png`));
        const corpses = await session.page.evaluate(() => window.__SS__!.getState().render);
        receipts.push({ case: 'gore', backend, ids, severed, clicks, corpses, errors: [...session.errors] });
      }
      writeJson(resolve(out, 'visual-verification.json'), receipts);
      console.log(JSON.stringify({ backend, cases: [...cases], errors: session.errors }));
    } finally { await session.close(); stopServer(); }
  }
} finally { stopServer(); }
