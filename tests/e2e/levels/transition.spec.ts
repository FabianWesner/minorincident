import { mkdirSync, writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { devices } from '@playwright/test';
import { PNG } from 'pngjs';
import { test, expect } from '../fixtures';

const phase = process.env.TRANSITION_PHASE ?? 'after';
const out = 'test-results/level-transition';
declare global {
  interface Window {
    transitionProbe?: { done: boolean; error?: string; start: number; ready: number; frames: number[]; previous: number; recording: boolean; stopped: boolean };
  }
}
for (const tier of ['high', 'phone'] as const) test.describe(tier, () => {
  if (tier === 'phone') test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true });
  test(`@transition menu and every campaign load retain a picture ${tier}`, async ({ page, context }) => {
    test.setTimeout(900_000); page.setDefaultTimeout(180_000); mkdirSync(out, { recursive: true });
    if (tier === 'phone') await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
    // Exercise production prewarming, including its asynchronous briefing path in the baseline.
    await page.goto(`/?debug=true&renderer=webgl&quality=${tier === 'high' ? 'high' : 'low'}&dpr=1&audio=muted&seed=1&preload=0`);
    await page.waitForFunction(() => !!window.__SS__);
    await page.evaluate(() => window.__SS__!.ready);
    await page.getByTestId('start-game').click(); await page.getByTestId('character-female').click();
    const rows: object[] = [];
    for (const level of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L6'] as const) {
      const restart = level === 'L6' && rows.length === 6;
      const finalObjective = ({ L2: 'firestation', L3: 'bridge', L4: 'checkpoint', L5: 'wait', L6: 'metro' } as Record<string, string>)[level];
      if (level !== 'L1' && !restart) {
        await page.evaluate(async final => {
          const a = window.__SS__!; a.pause();
          for (let i = 0; i < 80 && a.missions.state()!.steps[final]?.status !== 'active'; i++) {
            const state = a.missions.state()!;
            const active = Object.entries(state.steps).find(([id, step]) => id !== final && step.status === 'active');
            if (active) a.missions.completeObjective(active[0]);
            else {
              // completeObjective() in a scripted gap also completes the newly activated goal.
              // Set the gap signal separately so the final goal remains available for the timed handoff.
              const level = a.getState().scenario;
              const key = level === 'L1' ? 'exited' : level === 'L2' ? 'radio' : level === 'L3' ? state.states.attack ? 'fallback' : 'attack' : level === 'L4' ? state.states.turned ? 'line-broken' : 'turned' : 'searching';
              a.missions.setState(key, true);
            }
            if (a.missions.state()!.steps[final]?.status !== 'active') await a.step(1);
          }
        }, finalObjective);
        expect(await page.evaluate(final => window.__SS__!.missions.state()!.steps[final]?.status, finalObjective)).toBe('active');
        // Standardized final-objective/outro window for the next level's HTTP prefetch.
        await page.waitForTimeout(2000);
      }
      await page.evaluate(({ level, restart, finalObjective }) => {
        const a = window.__SS__!; performance.clearMeasures();
        const probe: NonNullable<Window['transitionProbe']> = window.transitionProbe = { done: false, start: performance.now(), ready: 0, frames: [] as number[], previous: 0, recording: false, stopped: false };
        const frame = (now: number) => { if (probe.recording && probe.previous) probe.frames.push(now - probe.previous); probe.previous = now; if (!probe.stopped) requestAnimationFrame(frame); };
        requestAnimationFrame(frame);
        if (restart) {
          document.querySelector<HTMLButtonElement>('[data-testid=pause-button]')!.click();
          document.querySelector<HTMLButtonElement>('[data-testid=pause-restart]')!.click();
          document.querySelector<HTMLButtonElement>('[data-testid=restart-confirm-yes]')!.click();
        } else if (level !== 'L1') {
          a.missions.completeObjective(finalObjective);
          // L1 has a Continue button; exclude the player's reading time from the measurement.
          if (a.missions.state()?.phase === 'result') a.missions.continue();
        }
      }, { level, restart, finalObjective });
      if (level === 'L1') await page.getByTestId('level-L1').click();
      await page.evaluate(level => {
        void (async () => {
          await new Promise(resolve => requestAnimationFrame(resolve));
          while (window.__SS__!.getState().scenario !== level || window.__SS__!.missions.state()?.phase !== 'briefing' || document.querySelector('[data-testid=menu-loading]:not([hidden])') || document.querySelector('[data-testid=level-transition]:not([hidden])')) await new Promise(resolve => requestAnimationFrame(resolve));
          await window.__SS__!.screenshotReady(); window.transitionProbe!.ready = performance.now(); window.transitionProbe!.done = true;
        })().catch(error => { window.transitionProbe!.done = true; window.transitionProbe!.error = String(error); });
      }, level);
      let samples = 0, cardSamples = 0, emptySamples = 0;
      const progress: number[] = [];
      while (!await page.evaluate(() => window.transitionProbe!.done)) {
        const card = await page.getByTestId('level-transition').isVisible();
        if (card) { cardSamples++; progress.push(await page.getByTestId('transition-progress').evaluate(element => (element as HTMLProgressElement).value)); }
        const png = PNG.sync.read(await page.screenshot());
        // Central canvas region avoids hint bars, menus and controls. A flat clear color has no variation.
        const colors = new Set<string>();
        for (let y = Math.floor(png.height * .4); y < png.height * .65; y += 12) for (let x = Math.floor(png.width * .3); x < png.width * .7; x += 12) {
          const i = (y * png.width + x) * 4; colors.add(`${png.data[i] >> 3},${png.data[i + 1] >> 3},${png.data[i + 2] >> 3}`);
        }
        if (!card && colors.size <= 8) emptySamples++;
        if (phase !== 'before') expect(card || colors.size > 8, `${level} sample ${samples}: uncovered empty canvas`).toBe(true);
        samples++; await page.waitForTimeout(250);
      }
      {
        const result = await page.evaluate(() => window.transitionProbe!);
        expect(result.error).toBeUndefined();
        if (phase !== 'before') {
          await expect(page.getByTestId('level-transition')).toBeHidden();
          expect(cardSamples, `${level}: transition card was sampled`).toBeGreaterThan(0);
          expect(progress.every((value, i) => i === 0 || value >= progress[i - 1]), `${level}: monotonic work progress`).toBe(true);
          expect(await page.getByTestId('transition-progress').evaluate(element => (element as HTMLProgressElement).value)).toBe(1);
        }
        await page.getByRole('button', { name: 'Begin mission' }).click();
      }
      await page.evaluate(() => { window.__SS__!.cheats.god(true); const p = window.transitionProbe!; if (!p.ready) p.ready = performance.now(); p.done = true; p.previous = 0; p.recording = true; });
      await page.waitForTimeout(5000);
      const result = await page.evaluate(() => { const p = window.transitionProbe!; p.recording = false; p.stopped = true; return { loadTiming: window.__SS__!.perf().loadTiming, phases: performance.getEntriesByType('measure').map(entry => ({ name: entry.name, ms: entry.duration })), ms: p.ready - p.start, maxFrame: Math.max(...p.frames), over50: p.frames.filter(ms => ms > 50), frames: p.frames }; });
      rows.push({ level: restart ? 'restart L6' : level, ...result, samples, cardSamples, emptySamples, progress });
      writeFileSync(`${out}/${phase}-${tier}.json`, JSON.stringify({ load: loadavg(), rows }, null, 2));
      console.log(`${phase} ${tier} ${restart ? 'restart' : level}: ${result.ms.toFixed(0)}ms, play max ${result.maxFrame.toFixed(1)}ms, over50 ${result.over50.length}`);
    }
  });
});


test('@transition compact controls HUD also covers L2 to L3 loading', async ({ page }) => {
  test.skip(phase === 'before', 'Regression assertion for the shared card');
  test.setTimeout(180_000);
  await page.goto('/?test=1&renderer=webgl&quality=high&audio=muted');
  await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate(async () => { const a = window.__SS__!; await a.ready; await a.loadLevel('L2', { progression: 'L2-default' }); a.pause(); });
  await page.evaluate(() => { void window.__SS__!.loadLevel('L3', { progression: 'L3-default' }); });
  await expect(page.getByTestId('level-transition')).toBeVisible();
  await expect(page.getByTestId('transition-title')).toHaveText('Level 3 · The Police Collapse');
  await expect(page.getByTestId('transition-story')).not.toHaveText('');
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await expect(page.getByTestId('level-transition')).toBeHidden();
  expect(await page.evaluate(() => window.__SS__!.perf().renderedFrames)).toBeGreaterThan(0);
});

test('@transition selecting a production menu preload retains the card until the scene is drawn', async ({ page }) => {
  test.skip(phase === 'before', 'Regression assertion for the shared card');
  test.setTimeout(180_000);
  await page.goto('/?debug=true&renderer=webgl&quality=high&dpr=1&audio=muted&seed=1');
  await page.waitForFunction(() => window.__SS__?.getState().scenario === 'L1');
  await page.getByTestId('start-game').click();
  await page.getByTestId('character-female').click();
  await page.getByTestId('level-L1').click();
  await expect(page.getByTestId('level-transition')).toBeVisible();
  await expect(page.getByTestId('transition-title')).toHaveText('Level 1 · Stop the Outbreak');
  await expect(page.getByTestId('level-transition')).toBeHidden({ timeout: 120_000 });
  await expect(page.getByRole('button', { name: 'Begin mission' })).toBeVisible();
  expect(await page.evaluate(() => window.__SS__!.perf().renderedFrames)).toBeGreaterThan(0);
});
