import { expect, test, type Page } from '@playwright/test';
import { oracle } from '../oracles';

const baseline = process.env.QA_INVARIANTS_BASELINE ?? 'https://minor-incident.com';
const levels = ['L1','L2','L3','L4','L5','L6','L7','L8','L9','L10'];

async function measure(page: Page, url: string, level: string): Promise<number> {
  await page.goto(`${url}${url.includes('?') ? '&' : '?'}quality=low&renderer=webgpu&dpr=1&seed=1&test=1&ui=1&debug=1`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('menu-title')).toBeVisible({ timeout: 120_000 });
  await page.getByTestId('start-game').click();
  await page.getByTestId('character-female').click();
  const t0 = await page.evaluate(() => performance.now());
  await page.getByTestId(`level-${level}`).click();
  await expect(page.getByTestId('pause-button')).toBeVisible({ timeout: 180_000 });
  const renderMode = await page.evaluate(() => window.__SS__!.perf());
  expect(renderMode.backend, `${level} renderer requested WebGPU`).toBe('webgpu');
  expect(renderMode.quality.tier, `${level} quality requested low`).toBe('low');
  await page.evaluate(() => window.__SS__!.screenshotReady());
  return page.evaluate(start => performance.now() - start, t0);
}

test('8 load time: each level click-to-playable stays within PROD + max(10%, 1 s)', async ({ page }) => {
  const report: Record<string, { candidateMs: number; baselineMs: number; limitMs: number }> = {};
  for (const level of levels) {
    const candidateMs = await measure(page, '/', level);
    const baselineMs = await measure(page, baseline, level);
    const limitMs = baselineMs + Math.min(1000, baselineMs * .1);
    report[level] = { candidateMs: Math.round(candidateMs), baselineMs: Math.round(baselineMs), limitMs: Math.round(limitMs) };
    expect(oracle.load({ candidateMs, baselineMs }), `${level}: candidate ${candidateMs.toFixed(0)} ms; PROD ${baselineMs.toFixed(0)} ms; allowed ${limitMs.toFixed(0)} ms`).toBe(false);
  }
  console.log(`[qa:invariants] level load timings ${JSON.stringify(report)}`);
});
