import { resolve } from 'node:path';
import { SceneSession, stopServer, writeJson } from '../scenelab/session';

const out = resolve(process.env.S235_OUT ?? '/private/tmp/s235-corn');
const backend = process.env.S235_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2';
for (const tier of ['high', 'low'] as const) for (const zoom of [1, 1.5]) {
  const session = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 }, seed: 32 });
  try {
    await session.open();
    const setup = await session.page.evaluate(async ({ tier, zoom }) => {
      const a = window.__SS__!; a.pause(); await a.loadLevel('L10', { seed: 32 }); a.pause(); a.missions.begin(); a.inspect.enable(false); a.cheats.god(true);
      a.settings.set({ quality: tier, cameraShake: false }); a.camera.follow(); a.camera.zoom(zoom);
      a.teleport('player', { x: 555, z: 42 });
      const dog = a.query({}).find(e => e.companion); if (dog) a.teleport(dog.id, { x: 554.2, z: 42 });
      await a.step(12);
      a.settings.set({ timeOfDay: 'L1', cheapDof: false });
      a.camera.cinematic({ position: [562, 7, 48], target: [556, 1, 42] }, true);
      return { dog: dog?.id, quality: a.getState().render.quality, backend: a.perf().backend, zoom };
    }, { tier, zoom });
    if (setup.backend !== (backend === 'webgpu' ? 'webgpu' : 'webgl')) throw Error(`Requested ${backend}, got ${setup.backend}`);
    await session.screenshot(`${out}/${tier}-zoom-${zoom}-walk-0.png`);
    await session.page.evaluate(() => window.__SS__!.input.set({ move: { x: 1, z: 0 } }));
    for (const frame of [5, 10, 15, 20, 25, 30, 35, 40, 45]) {
      await session.page.evaluate(async () => { const a = window.__SS__!; await a.step(5); a.settings.set({ timeOfDay: 'L1' }); });
      await session.screenshot(`${out}/${tier}-zoom-${zoom}-walk-${frame}.png`);
    }
    const end = await session.page.evaluate(() => { const e = window.__SS__!.getEntity(1)!; return { ...e.transform, velocity: e.survivor?.velocity, motion: e.motion?.velocity, locomotion: e.locomotion }; });
    if (Math.hypot(end.x - 555, end.z - 42) < .2) throw Error('Courier did not move');
    await session.page.evaluate(zoom => { const a = window.__SS__!; a.camera.follow(); a.camera.zoom(zoom); }, zoom);
    await session.screenshot(`${out}/${tier}-zoom-${zoom}.png`);
    await session.page.evaluate(() => {
      const a = window.__SS__!, p = a.getEntity(1)!.transform;
      a.camera.cinematic({ position: [p.x + 6, 7, p.z + 6], target: [p.x, 1, p.z] }, true);
    });
    await session.page.evaluate(() => window.__SS__!.input.clear());
    for (const frame of [10, 20, 30, 40, 50, 60]) {
      await session.page.evaluate(async () => { const a = window.__SS__!; await a.step(10); a.settings.set({ timeOfDay: 'L1' }); });
      await session.screenshot(`${out}/${tier}-zoom-${zoom}-stop-${frame}.png`);
    }
    writeJson(`${out}/${tier}-zoom-${zoom}.json`, { ...setup, end, errors: session.errors });
    if (session.errors.length) throw new Error(session.errors.join('\n'));
    console.log(`${tier} zoom ${zoom}: ${JSON.stringify(setup)}`);
  } finally { await session.close(); stopServer(); }
}
