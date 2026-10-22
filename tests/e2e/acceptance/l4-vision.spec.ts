import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../fixtures';
import { l4Anchors } from '../../../src/data/l4';

const backend = process.env.AC_VISION_BACKEND === 'webgpu' ? 'webgpu' : 'webgl';
test.use({ headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] } });
for (const tier of ['high', 'low'] as const) test(`T-E22-19-production @E22-AC19 named L4 vision phases ${backend} ${tier}`, async ({ page }) => {
  test.setTimeout(600_000);
  if (tier === 'low') await page.setViewportSize({ width: 390, height: 844 });
  const out = `test-results/ac-close/l4-production/${backend}-${tier}`;
  mkdirSync(out, { recursive: true });
  await boot(page, `/?test=1&scenelab=1&renderer=${backend}&quality=${tier}&audio=muted&dpr=1&ui=1`);
  await page.evaluate(async tier => { const a = window.__SS__!; a.settings.set({ quality: tier }); await a.loadLevel('L4', { seed: 1, progression: 'L4-default' }); a.pause(); a.missions.begin(); a.cheats.god(true); a.bot.start('complete'); }, tier);
  const until = async (condition: string, limit = 1600, step = 15) => {
    for (let i = 0; i < limit && !await page.evaluate(condition); i++) await page.evaluate(step => window.__SS__!.step(step), step);
    expect(await page.evaluate(condition), condition).toBe(true);
  };
  const snap = async (name: string) => {
    const [x, z] = l4Anchors[`photo-${name}`];
    await page.evaluate(async ({ name, x, z }) => { const a = window.__SS__!; a.teleport(1, { x, z }); a.camera.preset(`D-FAIR/W0/${name}`); await a.screenshotReady(); }, { name, x, z });
    await page.screenshot({ path: `${out}/${name}.png` });
    const proof = await page.evaluate(() => { const a = window.__SS__!; return { state: a.missions.state(), perf: a.perf(), camera: a.getState().render.camera, player: a.getEntity(1), figures: a.getState().render.crowd }; });
    writeFileSync(`${out}/${name}.json`, JSON.stringify(proof, null, 2));
    expect(proof.perf.backend).toBe(backend); expect(proof.perf.quality.tier).toBe(tier);
    await page.evaluate(() => window.__SS__!.camera.follow());
  };
  const state = 'window.__SS__.missions.state().l4';
  await until(`${state}.phase === 'plaza'`);
  await page.evaluate(() => window.__SS__!.bot.stop());
  await snap('l4-plaza-safe');
  await page.evaluate(() => window.__SS__!.bot.start('complete'));
  await until(`${state}.phase === 'war' && ${state}.tankPhase === 'hold' && ${state}.heliPhase === 'orbit' && ${state}.alphaIds.length >= 3`);
  await snap('l4-war-line');
  const previousShots = await page.evaluate(() => window.__SS__!.missions.state()!.l4!.tankShots);
  await until(`${state}.tankShots > ${previousShots}`, 1200, 1); await snap('l4-tank');
  await until(`${state}.lineBreakAt > 0`);
  await page.evaluate(async () => { const a = window.__SS__!; a.bot.stop(); await a.step(150); });
  await snap('l4-collapse');
});
