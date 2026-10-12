import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { test, expect, boot, testUrl } from '../fixtures';

/**
 * PO 10-12 (L4): "buildings are so high, the hide everything else". Any building between the camera and the courier (or the vehicle the
 * courier rides in) must be cut away over the whole subject. Pixel check: the normal frame is compared with a reference frame whose
 * see-through hole covers the whole screen; inside the subject's screen box at least 80 % of the pixels must already match the reference.
 */
test.use({ trace: 'off' });
const out = process.env.SEETHROUGH_SHOTS; // keeps the frames of the worst sample, e.g. docs/reports/fix-camera-ramp/after
const MIN_VISIBLE = .8;

async function box(page: Page, size: { width: number; height: number }) {
  return page.evaluate(({ width, height }) => {
    const a = window.__SS__!, p = a.getState().player!.transform, seated = a.missions.state()?.l4?.seated || a.missions.state()?.l2?.seated;
    const feet = p.y - .72, half = seated ? 2.5 : .5, top = seated ? 3.2 : 1.8, xs: number[] = [], ys: number[] = [];
    for (const dx of [-half, half]) for (const dz of [-half, half]) for (const y of [feet, feet + top]) { const n = a.camera.project(p.x + dx, y, p.z + dz); xs.push((n[0] + 1) / 2 * width); ys.push((1 - n[1]) / 2 * height); }
    return { x0: Math.max(0, Math.floor(Math.min(...xs))), x1: Math.min(width - 1, Math.ceil(Math.max(...xs))), y0: Math.max(0, Math.floor(Math.min(...ys))), y1: Math.min(height - 1, Math.ceil(Math.max(...ys))), seated: !!seated };
  }, size);
}
/** Fraction of pixels in the box that match the unobstructed reference frame. */
async function visibleShare(page: Page, size: { width: number; height: number }, label: string) {
  await page.evaluate(async () => { window.__SS__!.settings.set({ seeThroughReference: false }); await window.__SS__!.step(12); await window.__SS__!.screenshotReady(); });
  const normal = await page.screenshot();
  await page.evaluate(async () => { window.__SS__!.settings.set({ seeThroughReference: true }); await window.__SS__!.screenshotReady(); });
  const reference = await page.screenshot();
  await page.evaluate(() => window.__SS__!.settings.set({ seeThroughReference: false }));
  const b = await box(page, size), A = PNG.sync.read(normal), B = PNG.sync.read(reference);
  let same = 0, total = 0;
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
    const i = (y * A.width + x) * 4; total++;
    if (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) < 36) same++;
  }
  const share = total ? same / total : 1;
  if (out && label) { mkdirSync(out, { recursive: true }); writeFileSync(`${out}/${label}.png`, normal); }
  return { share, box: b, strength: await page.evaluate(() => (window.__SS__!.getState().render.districts as { seeThrough?: { strength: number } } | null)?.seeThrough?.strength ?? 0) };
}
const begin = async (page: Page, level: string, progression: string) => {
  await boot(page, `${testUrl}&ui=1`);
  await page.evaluate(({ level, progression }) => window.__SS__!.loadLevel(level, { seed: 1, progression: progression as 'L4-default' }), { level, progression });
  await page.evaluate(() => window.__SS__!.pause());
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(() => window.__SS__!.pause());
};

for (const [name, size] of [['desktop', { width: 1600, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
  test(`@seethrough L4 convoy ride (${name}): the rider's vehicle stays at least 80 % unoccluded`, async ({ page }) => {
    test.setTimeout(300000);
    await page.setViewportSize(size); await begin(page, 'L4', 'L4-default');
    const samples: { tick: number; share: number; strength: number; at: number[] }[] = [];
    for (let i = 0; i < 40; i++) {
      const phase = await page.evaluate(() => window.__SS__!.missions.state()?.l4?.phase);
      if (phase !== 'convoy') break;
      await page.evaluate(() => window.__SS__!.step(150));
      const r = await visibleShare(page, size, `l4-convoy-${name}-${i}`);
      const p = await page.evaluate(() => window.__SS__!.getState().player!.transform);
      samples.push({ tick: i, share: r.share, strength: r.strength, at: [Math.round(p.x), Math.round(p.z)] });
    }
    console.log(name, JSON.stringify(samples));
    expect(samples.length).toBeGreaterThan(3);
    for (const s of samples) expect(s.share, JSON.stringify(s)).toBeGreaterThanOrEqual(MIN_VISIBLE);
  });
}

test('@seethrough Fairhaven streets on foot (L4/L5, desktop): the courier stays at least 80 % unoccluded behind tall blocks', async ({ page }) => {
  test.setTimeout(300000);
  const size = { width: 1600, height: 900 }; await page.setViewportSize(size);
  const stops: [string, string, number, number][] = [['L5', 'L5-default', -17, 3], ['L5', 'L5-default', 37, -44], ['L5', 'L5-default', -60, 20], ['L5', 'L5-default', 10, 30], ['L5', 'L5-default', -40, -30], ['L5', 'L5-default', 60, 10]];
  const results: unknown[] = []; let occluded = 0, current = '';
  for (const [level, progression, x, z] of stops) {
    if (current !== level) { await begin(page, level, progression); current = level; }
    await page.evaluate(({ x, z }) => { const a = window.__SS__!; for (const e of a.query({ kind: 'infected' })) e.health.current = 0; a.teleport('player', { x, z }); }, { x, z });
    await page.evaluate(() => window.__SS__!.step(60));
    const r = await visibleShare(page, size, `fairhaven-${x}_${z}`);
    results.push({ level, x, z, share: +r.share.toFixed(3), strength: +r.strength.toFixed(2) }); if (r.strength > .5) occluded++;
    expect(r.share, JSON.stringify(results.at(-1))).toBeGreaterThanOrEqual(MIN_VISIBLE);
  }
  console.log(JSON.stringify(results));
  expect(occluded, 'at least one stop sits behind a tall block').toBeGreaterThan(0);
});
