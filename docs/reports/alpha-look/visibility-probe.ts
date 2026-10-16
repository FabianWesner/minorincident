/** Inspect the relative visibility probe at the same pose and camera distance. */
import { SceneSession, readSpec, stopServer, writeJson } from '../../../tools/scenelab/session';
import { measureCourierShare } from '../../../tools/scenelab/run';
const out = process.argv[2] ?? 'docs/reports/alpha-look/visibility';
const session = new SceneSession({ backend: 'webgl2', tier: 'high', viewport: { width: 960, height: 540 } });
try {
  await session.open();
  const spec = readSpec('tests/scenes/catalog/l10-mega-close-contact.json');
  await session.load({ ...spec, camera: { ...spec.camera!, zoom: 1.5 } });
  await session.step(160); await session.ready();
  const result = await measureCourierShare(session, true);
  writeJson(`${out}/metrics.json`, result);
  await session.screenshot(`${out}/mega.png`);
  await session.page.evaluate(() => window.__SCENE__!.alphaReferenceProbe(true));
  await session.ready(); await session.screenshot(`${out}/alpha.png`);
  await session.page.evaluate(() => window.__SCENE__!.hideProbe(false, true));
  await session.ready(); await session.screenshot(`${out}/background.png`);
  console.log(JSON.stringify(result));
} finally { await session.close(); stopServer(); }
