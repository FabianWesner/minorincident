/** fix-reveal (Q-50): replay the triage-b L10 epilogue save at low/high and zoom 1/1.5, with the reveal on and off. Shared headless pool only.
 * SCENE_PORT=33971 E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/fix-reveal-epilogue.ts <label> */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
const label = process.argv[2] ?? 'review';
const out = fileURLToPath(new URL(`../../test-results/fix-reveal/epilogue-${label}/`, import.meta.url));
mkdirSync(out, { recursive: true });
const saved = JSON.parse(gunzipSync(readFileSync(new URL('../../docs/reports/triage-b/checks/n1/resume.json.gz', import.meta.url))).toString());
const receipt: Record<string, unknown> = {};
for (const tier of (process.env.TRIAGE_TIERS ?? 'low,high').split(',') as ('low' | 'high')[]) {
  saved.settings.quality = tier;
  const session = new SceneSession({ backend: process.env.TRIAGE_BACKEND === 'webgl2' ? 'webgl2' : 'webgpu', tier, viewport: { width: 1280, height: 720 } });
  try {
    await session.open();
    await session.page.evaluate(async save => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      await game.continueCampaign(save); window.__SS__!.pause();
    }, saved);
    await session.ready();
    await session.step(120);
    for (const zoom of [1, 1.5]) {
      await session.page.evaluate(z => window.__SS__!.camera.zoom(z), zoom);
      await session.step(2);
      await session.page.evaluate(async () => { for (let i = 0; i < 30; i++) await new Promise(requestAnimationFrame); });
      await session.page.screenshot({ path: `${out}/${tier}-z${zoom}.png` });
      receipt[`${tier}-z${zoom}`] = await session.page.evaluate(() => {
        const g = (window.__SCENE__ as unknown as { game: Game }).game as unknown as { view: { districts?: { seeThroughAudit(): unknown }; view: { getState(): unknown } } };
        return { audit: g.view.districts?.seeThroughAudit(), camera: g.view.view.getState(), subject: (g.view as unknown as { revealSubject: unknown }).revealSubject };
      });
      await session.page.evaluate(() => window.__SS__!.settings.set({ seeThroughOff: true }));
      await session.step(1);
      await session.page.screenshot({ path: `${out}/${tier}-z${zoom}-off.png` });
      await session.page.evaluate(() => window.__SS__!.settings.set({ seeThroughOff: false }));
    }
  } finally { await session.close(); }
}
writeFileSync(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
stopServer();
