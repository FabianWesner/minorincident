import { SceneSession, readSpec, stopServer, writeJson } from './session';
const session = new SceneSession({ viewport: { width: 1280, height: 720 } });
const out = 'docs/reports/alpha-s2/after/qa-alpha-escort';
try {
  await session.open(); await session.load(readSpec('tests/scenes/alpha-s2/qa-alpha-ground-slam.json')); await session.step(59);
  const id = await session.page.evaluate(() => window.__SS__!.npcs.escort({ x: 0, z: 2 }));
  const samples = [];
  for (const [frame, ticks] of [[59, 0], [90, 31], [150, 60]] as const) {
    if (ticks) await session.step(ticks);
    await session.screenshot(`${out}/shot-${String(frame).padStart(4, '0')}.png`);
    samples.push(await session.page.evaluate(id => ({ frame: window.__SCENE__!.frame, entity: window.__SS__!.getEntity(id), render: window.__SS__!.getState().render.npcs }), id));
  }
  writeJson(`${out}/proof.json`, { samples, errors: session.errors, metrics: await session.metrics(), clipping: await session.clipping() });
} finally { await session.close(); stopServer(); }
