import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, boot } from '../fixtures';

/** fix-l5-alpha-lowtier: PO #33 (L5 opens with a cut from Kessler's cellar to the street) and PO #49 (the scripted metro closing
 * camera lost the courier). Real game, paused stepping, headless. PROBE_RENDERER=webgpu runs the same checks on WebGPU. */
const fair = JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8')) as { anchors: Record<string, { position: number[] }> };
const renderer = process.env.PROBE_RENDERER ?? 'webgl';
const out = process.env.PROBE_OUT ?? 'test-results/l5-camera';
test.use({ trace: 'off', ...(process.platform === 'darwin' ? { launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', ...(renderer === 'webgpu' ? ['--enable-unsafe-webgpu'] : [])] } } : {}) });

const begin = async (page: Page) => {
  await boot(page, `/?test=1&renderer=${renderer}&dpr=1&quality=high&audio=muted&seed=1&ui=1`);
  await page.evaluate(() => window.__SS__!.loadLevel('L5', { seed: 1, progression: 'L5-default' }));
  await page.evaluate(() => window.__SS__!.pause());
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent === 'Begin mission')!; b.addEventListener('click', () => queueMicrotask(() => window.__SS__!.pause()), { once: true }); });
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(() => window.__SS__!.pause());
  await page.evaluate(() => window.__SS__!.screenshotReady());
};
const step = (page: Page, n: number) => page.evaluate(count => { const a = window.__SS__!; a.pause(); return a.step(count); }, n);
const sample = (page: Page) => page.evaluate(() => {
  const a = window.__SS__!, s = a.getState(), p = s.player!.transform, camera = s.render.camera;
  const [x, y] = a.camera.project(p.x, p.y, p.z);
  return { tick: s.tick, x: p.x, z: p.z, focus: camera.focus, spot: camera.spot, ndc: { x, y }, drawn: s.render.character?.visible ?? false, fadeAt: a.missions.state()?.l5?.emergeFadeAt ?? 0, fading: !!a.missions.state()?.l5 && a.missions.state()!.l5!.phase === 'cellar' && !!a.missions.state()!.l5!.emergeFadeAt };
});
const shot = async (page: Page, name: string) => { await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${out}/${renderer}-${name}.png` }); };

test('T-fix-l5-start @E23 the cellar exit dips to black; the move happens in the dark and the courier is framed right after', async ({ page }) => {
  test.setTimeout(300_000); mkdirSync(out, { recursive: true });
  await begin(page);
  const cellar = await sample(page);
  // Real input: stand at the brace and hold E (the unbarring), as the L5 playthrough does. completeObjective is an instant cheat path.
  const c = fair.anchors['cellar-interior'].position;
  await page.evaluate(at => { const a = window.__SS__!; a.cheats.god(true); a.teleport('player', at); }, { x: c[0] - .4, z: c[2] + 2.6 });
  await step(page, 5);
  const brace = await sample(page);
  for (let i = 0; i < 20 && !(await sample(page)).fading; i++) { await page.keyboard.down('e'); await step(page, 3); await page.keyboard.up('e'); await step(page, 20); }
  const dimming = await sample(page), fadeStart = dimming.fadeAt;
  expect(dimming.fading).toBe(true);
  expect(Math.hypot(dimming.x - brace.x, dimming.z - brace.z)).toBeLessThan(.5);
  await page.waitForTimeout(500);
  await shot(page, 'cellar-fading-out');
  const overlayOpacity = await page.evaluate(() => Number([...document.querySelectorAll<HTMLElement>('body > div[aria-hidden="true"]')].find(d => d.style.position === 'fixed' && d.style.background.includes('0, 0, 0'))?.style.opacity ?? -1));
  expect(overlayOpacity).toBe(1);
  // The move comes once the screen is dark (0.65 s), never before the fade-out has had 0.4 s.
  let moved = -1;
  for (let i = 3; i < 90 && moved < 0; i++) { await step(page, 1); const s = await sample(page); if (Math.hypot(s.x - brace.x, s.z - brace.z) > 20) moved = s.tick - fadeStart; }
  expect(moved).toBeGreaterThanOrEqual(24);
  expect(moved).toBeLessThanOrEqual(60);
  const street = await sample(page);
  expect(street.fading).toBe(false);
  // First frame on the street: the camera is already on her (no travelling pan) and she is inside the frame.
  expect(Math.hypot(street.focus[0] - street.x, street.focus[2] - street.z)).toBeLessThan(.5);
  expect(Math.abs(street.ndc.x)).toBeLessThan(.5); expect(Math.abs(street.ndc.y)).toBeLessThan(.5);
  expect(street.drawn).toBe(true);
  await page.waitForTimeout(1400);
  await shot(page, 'street-faded-in');
  expect(await page.evaluate(() => Number([...document.querySelectorAll<HTMLElement>('body > div[aria-hidden="true"]')].find(d => d.style.position === 'fixed' && d.style.background.includes('0, 0, 0'))?.style.opacity ?? -1))).toBe(0);
});

test('T-fix-l5-ingress @E23 the closing camera keeps the courier in frame and drawn while she goes down the stairs', async ({ page }) => {
  test.setTimeout(600_000); mkdirSync(out, { recursive: true });
  await begin(page);
  await page.evaluate(() => { const a = window.__SS__!; a.cheats.god(true); a.cheats.completeObjective('emerge'); });
  await step(page, 60 * 11);
  await page.evaluate(() => { window.__SS__!.cheats.completeObjective('look'); });
  await step(page, 30);
  await page.evaluate(() => { window.__SS__!.teleport('player', { x: 38.29, z: -51.23 }); });
  await step(page, 20);
  let closed = false;
  for (let i = 0; i < 160 && !closed; i++) { await step(page, 30); closed = await page.evaluate(() => (window.__SS__!.missions.state()?.l5?.shutterAt ?? 0) > 0); }
  expect(closed).toBe(true);
  // ~100 ticks into the closing shot: the PO's frame ("Down the stairs, quick" at 38.29, -51.23).
  for (const [ticks, name, limit] of [[10, 't10', .7], [90, 't100', .45]] as const) {
    await step(page, ticks);
    const s = await sample(page);
    writeFileSync(`${out}/${renderer}-ingress-${name}.json`, JSON.stringify(s));
    expect(s.spot).toBe('l5-metro-closing');
    expect(s.drawn).toBe(true);
    expect(Math.abs(s.ndc.x), `${name} courier x in frame`).toBeLessThan(limit);
    expect(Math.abs(s.ndc.y), `${name} courier y in frame`).toBeLessThan(limit);
    await shot(page, `closing-${name}`);
  }
});
