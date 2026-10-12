import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { test, expect, boot, testUrl } from '../fixtures';

/** PO 2026-10-12: "When I walk north, the screen gets fully blie" / "High buildigs block th eview".
 * North of Kessler's Hardware (the cellar door, objective "Find somewhere to hide") the follow camera
 * hangs 2-5 m above the store's pitched roof; the roof filled the whole frame except the courier-sized
 * see-through circle (or all of it). Real keyboard input walks to the cellar door; every frame must show content. */
const output = 'test-results/epics/E22/blank-viewport';
/** Share of the most common colour (16 levels per channel) and luminance spread of the 3D canvas. */
const frameContent = (buf: Buffer) => {
  const p = PNG.sync.read(buf), buckets = new Map<number, number>(); let n = 0, sum = 0, sq = 0;
  for (let i = 0; i < p.data.length; i += 4 * 5) {
    const r = p.data[i], g = p.data[i + 1], b = p.data[i + 2], key = (r >> 4) << 8 | (g >> 4) << 4 | b >> 4, l = r * .3 + g * .59 + b * .11;
    buckets.set(key, (buckets.get(key) ?? 0) + 1); n++; sum += l; sq += l * l;
  }
  const mean = sum / n;
  return { dominant: +(Math.max(...buckets.values()) / n).toFixed(3), sd: +Math.sqrt(sq / n - mean * mean).toFixed(1) };
};

for (const renderer of ['webgl', 'webgpu'] as const) test(`T-E22-blank @E22 L4 the walk to Kessler's cellar door never leaves the viewport one flat colour (${renderer})`, async ({ page }) => {
  test.setTimeout(300_000); page.setDefaultTimeout(120_000); mkdirSync(output, { recursive: true });
  for (const file of readdirSync(output)) if (file.startsWith(`${renderer}-`)) rmSync(`${output}/${file}`);
  if (renderer === 'webgpu') {
    await page.goto('/');
    const adapter = await page.evaluate(async () => Boolean(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()));
    test.skip(!adapter && process.platform !== 'darwin', 'No WebGPU adapter in this headless browser');
  }
  await boot(page, `${testUrl.replace('renderer=webgl', `renderer=${renderer}`)}&ui=1`);
  await page.evaluate(() => window.__SS__!.loadLevel('L4', { seed: 1, progression: 'L4-default' }));
  await page.evaluate(() => window.__SS__!.pause());
  await page.getByRole('button', { name: 'Begin mission' }).click();
  const start = { x: 54, z: 27.5 }; // the layout's kessler-cellar-door is at (69.6, 29.66)
  await page.evaluate(async start => {
    const a = window.__SS__!; a.pause(); a.cheats.god(true);
    for (const id of ['ride', 'quartermaster']) { a.cheats.completeObjective(id); await a.step(30); }
    // The war runs its course (the line breaks on its own); skipping 'hold' by cheat leaves the courier unable to move.
    a.teleport(1, { x: -21.5, z: 3 });
    for (let i = 0; i < 400 && !a.missions.state()!.l4!.lineBreakAt; i++) await a.step(30);
    // North-west of the store: the strip in front of the cellar door, where the PO stood.
    a.teleport(1, start); a.camera.follow(); await a.step(5);
  }, start);
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.steps.hide.status)).toBe('active');
  await page.evaluate(() => document.body.classList.add('ui-hidden'));
  const frames: { x: number; z: number; dominant: number; sd: number; cover: number; hits: string[] }[] = [];
  // Real input, real time: D+S is world east (+x) for the isometric follow camera; the courier runs
  // along the store's north side toward the cellar door.
  await page.evaluate(() => window.__SS__!.resume()); await page.waitForTimeout(400);
  await page.keyboard.down('d'); await page.keyboard.down('s');
  for (let i = 0; i < 40; i++) {
    const buf = await page.locator('canvas').first().screenshot();
    const state = await page.evaluate(() => {
      const a = window.__SS__!, s = a.getState(), probe = a.debug.renderProbe() as { hits: ({ path: string } | null)[] };
      return { x: s.player!.transform.x, z: s.player!.transform.z, cover: (s.render.districts as { seeThrough: { cover: number } }).seeThrough.cover, hits: probe.hits.map(h => h?.path.split('/').at(-2) ?? 'none') };
    });
    const content = frameContent(buf); frames.push({ ...state, ...content });
    if (i % 4 === 0 || content.dominant > .3 || content.sd < 25) writeFileSync(`${output}/${renderer}-${String(i).padStart(2, '0')}-x${state.x.toFixed(1)}.png`, buf);
    if (state.x > 66) break;
  }
  await page.keyboard.up('d'); await page.keyboard.up('s');
  await page.evaluate(() => window.__SS__!.pause());
  writeFileSync(`${output}/${renderer}.json`, JSON.stringify(frames, null, 1) + '\n');
  // The walk crossed the band where the roof hugged the lens (z 26-28.5 with the default zoom).
  // Before the fix the roof filled the frame for courier x 58-63 (camera 2.5-5 m above the pitched roof). The camera now follows the
  // player's y and the cutaway scales to the group, so the hugging span is wider and a real-time sample lands every ~1.7 m: count x 56-65 (>= 3 samples).
  expect(frames.filter(f => f.x > 56 && f.x < 65).length, 'sampled the roof band').toBeGreaterThanOrEqual(3);
  expect(frames.at(-1)!.x, 'walked east toward the door').toBeGreaterThan(66);
  for (const f of frames) {
    expect(f.dominant, `one colour fills the frame at x=${f.x.toFixed(1)} z=${f.z.toFixed(1)} (${f.hits.join(',')})`).toBeLessThan(.4);
    expect(f.sd, `flat frame at x=${f.x.toFixed(1)} z=${f.z.toFixed(1)}`).toBeGreaterThan(20);
  }
});
