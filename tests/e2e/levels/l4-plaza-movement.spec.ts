import { mkdirSync, writeFileSync } from 'node:fs';
import type { CDPSession, Page } from '@playwright/test';
import { boot, expect, test } from '../fixtures';

type Point = { x: number; z: number };
const d = 6 / Math.SQRT2;
const position = (page: Page) => page.evaluate(() => window.__SS__!.getState().player!.transform);
const step = (page: Page, n: number) => page.evaluate(n => window.__SS__!.step(n), n);
const distance = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.z - q.z);
async function reset(page: Page, at: Point, settle = 30): Promise<void> {
  await page.evaluate(({ at, settle }) => { const a = window.__SS__!; a.input.clear(); a.teleport('player', at); if (!settle) { const r = a.getState().render.camera.radius, off = r * Math.sin(Math.PI * .3) / Math.SQRT2; a.camera.cinematic({ position: [at.x + off, r * Math.cos(Math.PI * .3), at.z + off], target: [at.x, 0, at.z] }, true); } }, { at, settle });
  await step(page, settle);
}
/** Close framing cannot display a six metre goal in every direction. Click visible ground
 * on that route, then the final goal once it enters the follow camera; all input is real. */
async function clickTo(page: Page, target: Point, capture?: string): Promise<void> {
  for (let i = 0; i < 8 && distance(await position(page), target) >= .4; i++) {
    const p = await position(page);
    let point = target, screen = { x: 0, y: 0 }, fraction = 1;
    for (let j = 0; j < 12; j++) {
      point = { x: p.x + (target.x - p.x) * fraction, z: p.z + (target.z - p.z) * fraction };
      screen = await page.evaluate(p => window.__SS__!.input.project(p), point);
      if (await page.evaluate(({ x, y }) => x > 60 && x < innerWidth - 60 && y > 110 && y < innerHeight - 90 && document.elementFromPoint(x, y)?.tagName === 'CANVAS', screen)) break;
      fraction *= .7;
    }
    await page.mouse.click(screen.x, screen.y); await step(page, 1);
    const input = await page.evaluate(() => window.__SS__!.getState().input.frame);
    expect(input.moveTarget, JSON.stringify({ point, screen, input, picks: await page.evaluate(() => window.__SS__!.input.lastPick()) })).toBeDefined();
    expect(distance(input.moveTarget!, point)).toBeLessThan(.05);
    await step(page, 60);
    if (capture && i === 0) { await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: capture }); }
  }
  expect(distance(await position(page), target)).toBeLessThan(1);
}
async function touch(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x === undefined ? [] : [{ id: 1, x, y: y!, radiusX: 1, radiusY: 1 }] });
  await cdp.send('Runtime.evaluate', { expression: 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))', awaitPromise: true });
}
async function stickTo(page: Page, cdp: CDPSession, target: Point): Promise<void> {
  const origin = { x: 240, y: 400 };
  await touch(cdp, 'touchStart', origin.x, origin.y);
  for (let i = 0; i < 30; i++) {
    const p = await position(page), dx = target.x - p.x, dz = target.z - p.z, length = Math.hypot(dx, dz);
    if (length < .4) break;
    await touch(cdp, 'touchMove', origin.x + (dx - dz) / Math.SQRT2 / length * 60, origin.y + (dx + dz) / Math.SQRT2 / length * 60);
    await step(page, Math.min(12, Math.max(1, Math.floor(length / 4.5 * 60))));
    expect(await page.evaluate(() => window.__SS__!.getState().input.scheme)).toBe('touch');
  }
  await touch(cdp, 'touchEnd'); await step(page, 10);
  expect(distance(await position(page), target)).toBeLessThan(1);
}

test.use({ viewport: { width: 1280, height: 720 }, hasTouch: true, launchOptions: { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu'] } });
for (const renderer of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) for (const zoom of [1, .5]) for (const phase of ['plaza', 'war', 'respawn'] as const) {
  test(`@E22 L4 ${phase}: mouse WASD stick ${renderer} ${quality} zoom ${zoom}`, async ({ page, context }) => {
    test.setTimeout(600_000); page.setDefaultTimeout(120_000);
    // Calm routes also clear the pending quartermaster's click area along intermediate close-zoom clicks.
    const center = phase === 'plaza' ? { x: -21.5, z: 6.5 } : { x: -18.2, z: 4 };
    const targets = [
      { name: 'left', key: 'a', x: center.x - d, z: center.z + d },
      { name: 'right', key: 'd', x: center.x + d, z: center.z - d },
      { name: 'up', key: 'w', x: center.x - d, z: center.z - d },
      { name: 'down', key: 's', x: center.x + d, z: center.z + d },
    ];

    await boot(page, `/?test=1&renderer=${renderer}&quality=${quality}&audio=muted&dpr=1&ui=1`);
    await page.evaluate(async quality => { const a = window.__SS__!; a.settings.set({ quality }); await a.loadLevel('L4', { seed: 2, progression: 'L4-default' }); a.pause(); }, quality);
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(() => { window.__SS__!.pause(); window.__SS__!.cheats.god(true); });
    for (let i = 0; i < 80 && await page.evaluate(() => window.__SS__!.missions.state()!.l4!.phase === 'convoy'); i++) await step(page, 30);
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.l4!.phase)).toBe('plaza');
    // Pickup now starts war on the same tick; calm movement must run before that interaction.
    if (phase !== 'plaza') await page.evaluate(() => window.__SS__!.cheats.completeObjective('quartermaster'));
    if (phase !== 'plaza') {
      for (let i = 0; i < 60 && !await page.evaluate(() => window.__SS__!.missions.state()!.l4!.turnAt); i++) await step(page, 60);
      await step(page, 180);
      expect(await page.evaluate(() => window.__SS__!.missions.state()!.l4!.phase)).toBe('war');
    }
    if (phase === 'respawn') {
      await page.evaluate(() => { const a = window.__SS__!; a.cheats.god(false); a.survivor.damage(1000); });
      expect((await page.evaluate(() => window.__SS__!.getState().player!.health.current))).toBe(0);
      await step(page, 180);
      expect((await page.evaluate(() => window.__SS__!.getState().player!.health.current))).toBeGreaterThan(0);
      expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('turn');
      await page.evaluate(() => window.__SS__!.cheats.god(true));
    }
    for (let i = 0; i < 20 && Math.abs(await page.evaluate(() => window.__SS__!.getState().render.camera.targetZoom as number) - zoom) > .02; i++) { await page.mouse.move(640, 360); await page.mouse.wheel(0, -120); await step(page, 2); }
    await step(page, 30);
    expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe(renderer);
    expect(await page.evaluate(() => window.__SS__!.perf().quality.tier)).toBe(quality);
    const out = `test-results/l4-walk-left/${renderer}-${quality}-z${zoom}-${phase}`;
    mkdirSync(out, { recursive: true });
    const results: unknown[] = [];
    // Valid capsule position at the south-west corner of the L4 armory table.
    // A square nav margin used to reject every outward step here.
    const corner = { x: -25.855, z: 1.855 }, away = { x: corner.x - 2 / Math.SQRT2, z: corner.z + 2 / Math.SQRT2 };
    await reset(page, corner, 0); await clickTo(page, away, `${out}/corner-left-walking.png`); await page.evaluate(() => window.__SS__!.camera.follow()); await step(page, 65);
    const cdp = await context.newCDPSession(page);
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.l4!.phase)).toBe(phase === 'plaza' ? 'plaza' : 'war');
    for (const input of ['mouse', 'keyboard', 'stick']) for (const target of targets) {
      await reset(page, center);
      if (input === 'mouse') await clickTo(page, target, target.name === 'left' ? `${out}/left-walking.png` : undefined);
      if (input === 'keyboard') {
        await page.keyboard.down(target.key); await step(page, 82); await page.keyboard.up(target.key); await step(page, 10);
        expect(distance(await position(page), target)).toBeLessThan(1);
      }
      if (input === 'stick') await stickTo(page, cdp, target);
      const perf = await page.evaluate(() => { const p = window.__SS__!.perf(); return { backend: p.backend, tier: p.quality.tier, draws: p.drawCalls, triangles: p.triangles }; });
      expect(perf.draws).toBeLessThanOrEqual(quality === 'high' ? 600 : 300);
      expect(perf.triangles).toBeLessThanOrEqual(quality === 'high' ? 1_500_000 : 500_000);
      results.push({ input, target, reached: await position(page), perf });
    }
    writeFileSync(`${out}/movement.json`, JSON.stringify(results, null, 2));
  });
}
