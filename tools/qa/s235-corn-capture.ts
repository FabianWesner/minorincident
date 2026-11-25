import { resolve } from 'node:path';
import { SceneSession, stopServer, writeJson } from '../scenelab/session';

const out = resolve(process.env.S235_OUT ?? '/private/tmp/s235-corn');
for (const tier of ['high', 'low'] as const) for (const zoom of [1, 1.5]) {
  const session = new SceneSession({ tier, viewport: { width: 1280, height: 720 }, seed: 32 });
  try {
    await session.open(); await session.inspectLevel('L10');
    const setup = await session.page.evaluate(async ({ tier, zoom }) => {
      const a = window.__SS__!; a.pause(); await a.loadLevel('L10', { seed: 32 }); a.pause(); a.missions.begin(); a.cheats.god(true);
      a.settings.set({ quality: tier, cameraShake: false }); a.camera.follow(); a.camera.zoom(zoom);
      a.teleport('player', { x: 555, z: 42 });
      const dog = a.query({}).find(e => e.companion); if (dog) a.teleport(dog.id, { x: 554.2, z: 42 });
      await a.step(12); a.input.set({ move: { x: 1, z: 0 } }); await a.step(45);
      const p = a.getEntity(1)!; return { x: p.transform.x, z: p.transform.z, dog: dog?.id, quality: a.getState().render.quality, zoom };
    }, { tier, zoom });
    await session.screenshot(`${out}/${tier}-zoom-${zoom}.png`);
    writeJson(`${out}/${tier}-zoom-${zoom}.json`, { ...setup, errors: session.errors });
    if (session.errors.length) throw new Error(session.errors.join('\n'));
    console.log(`${tier} zoom ${zoom}: ${JSON.stringify(setup)}`);
  } finally { await session.close(); stopServer(); }
}
