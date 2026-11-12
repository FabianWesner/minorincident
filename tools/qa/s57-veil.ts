/** Same-frame DOM-veil isolation for the S57 flock flight review. Run through e2e-lock on port 4958. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';
const out = 'test-results/s57-veil';
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'low' });
try {
  await session.open();
  await session.load(readSpec('tests/scenes/catalog/flamingo-flock-contact.json'));
  await session.page.evaluate(async () => { await window.__SCENE__!.step(60); });
  await session.screenshot(`${out}/with-veil.png`);
  const veil = await session.page.locator('[data-testid="flamingo-feathers"]').evaluate((element: HTMLElement) => {
    const before = { style: element.style.cssText, opacity: getComputedStyle(element).opacity };
    element.style.visibility = 'hidden';
    return before;
  });
  await session.screenshot(`${out}/without-veil.png`);
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ frame: 60, veil, errors: session.errors }, null, 2));
} finally { await session.close(); stopServer(); }
