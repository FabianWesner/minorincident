import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Browser } from '@playwright/test';
import { newCampaign, preset, type ProgressionPreset } from '../../../../src/sim/progression/Campaign';
import { oracle } from '../oracles';
import { SceneSession, readSpec, stopServer } from '../../../../tools/scenelab/session';

const baseline = process.env.QA_INVARIANTS_BASELINE ?? 'https://minor-incident.com';
const levels = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'] as const;

async function measure(browser: Browser, origin: string, level: typeof levels[number]) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    const url = new URL(origin);
    for (const [key, value] of Object.entries({ quality: 'low', renderer: 'webgpu', dpr: '1', seed: '1', test: '1', ui: '1', profile: '1', audio: 'muted' })) url.searchParams.set(key, value);
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('menu-title')).toBeVisible({ timeout: 120_000 });
    await page.waitForFunction(() => !!window.__SS__);
    const save = level === 'L1' ? newCampaign() : preset((level === 'L9' ? 'L8-default' : `${level}-default`) as ProgressionPreset);
    save.unlockedLevel = Number(level.slice(1)) as typeof save.unlockedLevel;
    save.completedLevels = save.unlockedLevel - 1; save.settings.quality = 'low';
    await page.evaluate(save => { window.__SS__!.campaign.restore(save); window.__SS__!.campaign.menu(); window.__SS__!.settings.set({ quality: 'low' }); }, save);
    await page.getByTestId('start-game').click();
    if (await page.getByTestId('character-female').isVisible()) await page.getByTestId('character-female').click();
    const t0 = await page.evaluate(() => performance.now());
    await page.getByTestId(`level-${level}`).click();
    // A briefing is part of preparing the playable level. Activate Begin as soon as it is ready,
    // then stop the timer on the first drawn gameplay frame; no human reading delay is measured.
    await page.waitForFunction(() => {
      const begin = document.querySelector<HTMLElement>('[data-testid=mission-button]');
      const pause = document.querySelector<HTMLElement>('[data-testid=pause-button]');
      return !!begin && !begin.hidden && begin.getBoundingClientRect().height > 0 || !!pause && !pause.hidden && pause.getBoundingClientRect().height > 0;
    }, undefined, { timeout: 180_000 });
    if (await page.getByTestId('mission-button').isVisible() && /Begin/.test(await page.getByTestId('mission-button').innerText())) await page.getByTestId('mission-button').click();
    await expect(page.getByTestId('pause-button')).toBeVisible({ timeout: 180_000 });
    await page.evaluate(() => window.__SS__!.screenshotReady());
    const result = await page.evaluate(start => ({ ms: performance.now() - start, backend: window.__SS__!.perf().backend, quality: window.__SS__!.perf().quality.tier, tick: window.__SS__!.tick() }), t0);
    expect(result.backend, `${level} requires WebGPU`).toBe('webgpu');
    expect(result.quality, `${level} requires low quality`).toBe('low');
    return result;
  } finally { await context.close(); }
}

for (const [index, level] of levels.entries()) test(`8 load time ${level}: level click → playable versus PROD, WebGPU low`, async ({ browser, baseURL }, info) => {
  test.setTimeout(240_000);
  // Alternate order, with a fresh storage/cache context for every observation, using one browser.
  const results = new Map<string, Awaited<ReturnType<typeof measure>>>();
  for (const [name, origin] of index % 2 ? [['baseline', baseline], ['candidate', baseURL!]] : [['candidate', baseURL!], ['baseline', baseline]]) results.set(name, await measure(browser, origin, level));
  const candidate = results.get('candidate')!, reference = results.get('baseline')!;
  const receipt = { level, candidate, baseline: reference, baselineURL: baseline, limitMs: reference.ms + Math.min(1000, reference.ms * .1) };
  mkdirSync('test-results/qa-invariants', { recursive: true });
  writeFileSync(`test-results/qa-invariants/load-${level}.json`, JSON.stringify(receipt, null, 2) + '\n');
  await info.attach('load-time', { body: JSON.stringify(receipt, null, 2), contentType: 'application/json' });
  expect(oracle.load({ candidateMs: candidate.ms, baselineMs: reference.ms }), `${level} load invariant: ${JSON.stringify(receipt)}`).toBe(false);
});


test('Scene Lab: scripted cast is submitted and drawn on both quality paths', async ({ browser }, info) => {
  test.setTimeout(180_000);
  try {
    for (const tier of ['low', 'high'] as const) {
      const session = new SceneSession({ backend: 'webgpu', tier });
      try {
        await session.open(browser);
        await session.load(readSpec('tests/scenes/catalog/ped-l1-staged-cast.json'));
        await session.ready(); await session.step(3);
        const metrics = await session.metrics();
        for (const [id, actor] of Object.entries(metrics.actors)) {
          expect.soft(actor.drawnFrames, `${tier}/${id} must be drawn`).toBeGreaterThan(0);
          expect.soft(actor.missedInViewFrames, `${tier}/${id} disappeared while in view`).toBe(0);
        }
        expect.soft(Object.keys(metrics.actors)).toEqual(expect.arrayContaining(['clerk', 'tech-a', 'tech-b', 'firefighter']));
        await info.attach(`scripted-cast-${tier}`, { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
        expect.soft(session.errors, `${tier} Scene Lab errors`).toEqual([]);
      } finally { await session.close(); }
    }
  } finally { stopServer(); }
});
