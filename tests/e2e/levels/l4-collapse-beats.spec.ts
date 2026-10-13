import { mkdirSync, writeFileSync } from 'node:fs';
import { devices, type Page } from '@playwright/test';
import { test, expect, boot, testUrl } from '../fixtures';

/**
 * l4-collapse game-camera captures (desktop and phone): the turn inside the perimeter, the line-1 overrun (its camera beat), the Alphas at
 * the gun nests (the broken E26 slot), the swarmed tank (its camera beat), "Fall back!" and the collapse. Each capture records the live
 * infected in view against the drawn crowd figures (no invisible-but-active infected) and close character pairs (pile-up clipping).
 * Headless through tools/e2e-lock.sh. Courier idle (god) at the plaza centre.
 */
const output = 'test-results/epics/E22/collapse-beats';
test.use({ trace: 'off' });

async function run(page: Page, tag: string, url: string): Promise<void> {
  mkdirSync(output, { recursive: true });
  await boot(page, url);
  await page.evaluate(() => window.__SS__!.loadLevel('L4', { seed: 2, progression: 'L4-default' }));
  await page.evaluate(() => window.__SS__!.pause());
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(async () => { const a = window.__SS__!; a.pause(); a.cheats.god(true); a.cheats.completeObjective('ride'); await a.step(120); a.cheats.completeObjective('quartermaster'); a.teleport('player', { x: -21.5, z: 3 }); await a.step(5); });
  const state = () => page.evaluate(() => { const m = window.__SS__!.missions.state()!; const s = m.l4!; return { phase: m.phase, l4: s.phase, turnAt: s.turnAt, tick: window.__SS__!.tick(), lines: s.director.lines.map(l => l.brokeAt), lineBreakAt: s.lineBreakAt, cinematic: m.cinematic?.id ?? null }; });
  const report: Record<string, unknown> = {};
  const shot = async (name: string) => {
    const m = await page.evaluate(async () => {
      // Headless stepping renders once per step: let the presentation clock run so transient blast flashes decay as they do in play.
      const a = window.__SS__!; if (!a.missions.state()!.cinematic) a.vfx.stepRender(1.5); await a.screenshotReady();
      const figures = new Map(a.crowdFigures().map(f => [f.id, f.drawn]));
      const live = a.query({ kind: 'infected' }).filter(e => e.health.current > 0 && !e.hidden);
      const inView = live.filter(e => { const p = a.camera.project(e.transform.x, 1, e.transform.z); return Math.abs(p[0]) < .95 && Math.abs(p[1]) < .95 && p[2] < 1; });
      const people = [...live, ...a.query({ kind: 'civilian' }).filter(e => e.health.current > 0 && !e.hidden)];
      let close = 0; for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) if (Math.hypot(people[i].transform.x - people[j].transform.x, people[i].transform.z - people[j].transform.z) < .3) close++;
      const s = a.missions.state()!.l4!;
      return { tick: a.tick(), t: +((a.tick() - s.turnAt) / 60).toFixed(1), inView: inView.length, undrawn: inView.filter(e => figures.get(e.id) === false).map(e => e.id), untracked: inView.filter(e => !figures.has(e.id)).length, close, soldiers: s.soldierIds.filter(id => a.query({ kind: 'civilian' }).some(e => e.id === id && e.health.current > 0)).length, cinematic: a.missions.state()!.cinematic?.id ?? null };
    });
    await page.screenshot({ path: `${output}/${tag}-${name}.png` });
    report[name] = m;
  };
  // The turn: evacuees collapse in the crowd behind the soldiers and rise (3 s).
  for (let i = 0; i < 200 && !(await state()).turnAt; i++) await page.evaluate(() => window.__SS__!.step(60));
  await page.evaluate(() => window.__SS__!.step(200)); await shot('1-turn');
  // Beats: step to each, capture the camera beat (sim paused) and the follow camera a moment later.
  const until = async (done: (s: Awaited<ReturnType<typeof state>>) => boolean, chunk = 30) => { for (let i = 0; i < 2000; i++) { const s = await state(); if (done(s)) return s; await page.evaluate(n => window.__SS__!.step(n), chunk); } throw new Error('beat not reached'); };
  await until(s => s.lines[0] > 0 || s.cinematic === 'l4-line-1', 10);
  if ((await state()).cinematic) { await page.evaluate(async () => { const a = window.__SS__!; await a.step(40); a.vfx.stepRender(1.1); }); await shot('2-line1-camera-beat'); }
  await until(s => !s.cinematic, 20); await page.evaluate(() => window.__SS__!.step(90)); await shot('3-line1-fallback');
  // The nests: shoot while the Alphas charge (from the earliest nests beat), then the broken slot after the beat.
  await until(s => (s.tick - s.turnAt) / 60 >= 111, 60); await shot('4-alphas-at-nests');
  await until(s => s.lines[1] > 0, 30); await page.evaluate(() => window.__SS__!.step(60)); await shot('5-nests-lost');
  await until(s => s.lines[2] > 0 || s.cinematic === 'l4-armor', 10);
  if ((await state()).cinematic) { await page.evaluate(async () => { const a = window.__SS__!; await a.step(40); a.vfx.stepRender(1.1); }); await shot('6-tank-camera-beat'); }
  await until(s => !s.cinematic, 20); await page.evaluate(() => window.__SS__!.step(120)); await shot('7-retreat');
  await until(s => s.lineBreakAt > 0, 30); await page.evaluate(() => window.__SS__!.step(150)); await shot('8-fall-back');
  writeFileSync(`${output}/${tag}.json`, JSON.stringify(report, null, 1) + '\n');
  for (const [name, r] of Object.entries(report) as [string, { undrawn: number[] }][]) expect(r.undrawn, `${tag} ${name}: live infected in view but not drawn`).toEqual([]);
}

test.describe('L4 collapse beats (game camera)', () => {
  test('desktop', async ({ page }) => { test.setTimeout(1_800_000); page.setDefaultTimeout(180_000); await run(page, 'desktop', `${testUrl}&ui=1`); });
  test.describe('phone', () => {
    test.use({ viewport: devices['iPhone 13'].viewport, deviceScaleFactor: 2, userAgent: devices['iPhone 13'].userAgent, isMobile: true, hasTouch: true });
    test('phone', async ({ page }) => { test.setTimeout(1_800_000); page.setDefaultTimeout(180_000); await run(page, 'phone', '/?test=1&renderer=webgl&dpr=2&quality=low&audio=muted&seed=1&ui=1'); });
  });
});
