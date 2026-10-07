import { mkdirSync } from 'node:fs';
import { open, origin } from './browser';

/** Quick L1 look: load the level with/without ?skin=1, walk a few seconds, screenshot frames. */
const out = process.argv[2] ?? 'test-results/skinpilot';
const skin = process.argv[3] ?? '1';
mkdirSync(out, { recursive: true });
const { page, close } = await open();
try {
  await page.goto(`${origin}/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1&skin=${skin}`);
  await page.waitForFunction(() => Boolean(window.__SS__), null, { timeout: 120_000 });
  await page.evaluate(async () => { const a = window.__SS__!; await a.ready; await a.loadLevel('L1'); });
  const begin = page.getByRole('button', { name: 'Begin mission' });
  if (await begin.isVisible().catch(() => false)) await begin.click();
  await page.evaluate(async () => { const a = window.__SS__!; a.pause(); await a.step(2); });
  console.log(JSON.stringify(await page.evaluate(() => window.__SS__!.getState().render.character)));
  await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${out}/skin${skin}-idle.png` });
  await page.evaluate(() => window.__SS__!.input.set({ move: { x: 1, z: 0 } }));
  for (let i = 0; i < 4; i++) { await page.evaluate(() => window.__SS__!.step(9)); await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${out}/skin${skin}-walk${i}.png` }); }
} finally { await close(); }
