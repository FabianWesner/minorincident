/**
 * Story audit probe (docs/reports/story-audit): for each level, what a first-time player reads on screen at the start —
 * the loading card (title + story line), the mission panel (if any), the objective tracker and subtitles in the first
 * seconds. Loads levels through the QA hook, observes only DOM text. Usage (preview server on E2E_PORT):
 *   sh tools/e2e-lock.sh node --import tsx tools/playtest/story-cards.ts <outDir> L6 L7 ...
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchBrowser } from '../browser-pool/client';
import type { Game } from '../../src/Game';

const [out, ...levels] = process.argv.slice(2);
const origin = `http://127.0.0.1:${process.env.E2E_PORT ?? 4791}`;
const shots = new Set((process.env.SHOTS ?? '').split(',').filter(Boolean));
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.addInitScript('window.__name = f => f');
await page.goto(`${origin}/?testApi=1&scenelab=1&renderer=webgl&dpr=1&audio=muted&quality=low`);
await page.waitForFunction(() => !!window.__SS__);
await page.evaluate(() => window.__SS__!.ready);
const report: Record<string, unknown> = {};
const read = () => page.evaluate(() => {
  const t = (s: string) => { const e = document.querySelector<HTMLElement>(s); return e && !e.closest('[hidden]') && e.getClientRects().length ? e.textContent?.trim() ?? '' : ''; };
  const id = (n: string) => t(`[data-testid="mission-${n}"]`);
  return { card: `${t('.transition-title')} | ${t('.transition-story')}`, panel: `${id('heading')} | ${id('detail')}`, tracker: document.querySelector('[data-testid="mission-tracker"]')?.textContent ?? '', subtitle: id('subtitle'), toast: id('toast'), phase: window.__SS__!.missions.state()?.phase };
});
for (const id of levels) {
  const seen: unknown[] = [];
  const load = page.evaluate(async id => { const g = (window.__SCENE__ as unknown as { game: Game }).game; await g.loadLevel(id, { seed: 1 }); }, id);
  let shot = false;
  for (let i = 0; i < 400; i++) {
    const s = await read(); const last = JSON.stringify(seen.at(-1)); if (JSON.stringify(s) !== last) seen.push(s);
    if (!shot && shots.has(`${id}-card`) && s.card.length > 3) { await page.screenshot({ path: join(out, `${id}-card.png`) }); shot = true; }
    if (await Promise.race([load.then(() => true), new Promise(r => setTimeout(() => r(false), 150))])) break;
  }
  await load;
  // A few seconds of play-time observation (briefing panels stay up; auto-begin levels run).
  for (let i = 0; i < 25; i++) { await page.waitForTimeout(200); const s = await read(); if (JSON.stringify(s) !== JSON.stringify(seen.at(-1))) seen.push(s); }
  if (await page.evaluate(() => window.__SS__!.missions.state()?.phase === 'briefing')) await page.getByTestId('mission-button').click();
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(200); const s = await read(); if (JSON.stringify(s) !== JSON.stringify(seen.at(-1))) seen.push(s); }
  if (shots.has(`${id}-start`)) await page.screenshot({ path: join(out, `${id}-start.png`) });
  // The real loading card component, as the campaign shows it on the way into this level.
  const card = await page.evaluate(id => { const g = (window.__SCENE__ as unknown as { game: { transition: { begin(id: string): void; root: HTMLElement } } }).game; g.transition.begin(id); return g.transition.root.innerText; }, id);
  seen.push({ loadingCard: card });
  if (shots.has(`${id}-card`)) await page.screenshot({ path: join(out, `${id}-card.png`) });
  await page.evaluate(() => (window.__SCENE__ as unknown as { game: { transition: { finish(): void } } }).game.transition.finish());
  report[id] = seen;
  console.log(id, JSON.stringify(seen, null, 1));
}
writeFileSync(join(out, 'cards.json'), JSON.stringify(report, null, 2));
await browser.close();
