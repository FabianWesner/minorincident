import { levelFourLayouts } from '../../../src/levels/L4/layout';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../fixtures';

const cellar = levelFourLayouts([JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8')) as DistrictLayout])[0].anchors['kessler-cellar-door'].position;

test.use({ viewport: { width: 1280, height: 720 }, launchOptions: { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu'] } });
for (const renderer of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) for (const zoom of [1, .5]) {
  test(`@E22 line-broken cellar guidance ${renderer} ${quality} zoom ${zoom}`, async ({ page }) => {
    test.setTimeout(300_000); page.setDefaultTimeout(120_000);
    await boot(page, `/?test=1&renderer=${renderer}&quality=${quality}&audio=muted&dpr=1&ui=1`);
    await page.evaluate(async quality => { const a = window.__SS__!; a.settings.set({ quality }); await a.loadLevel('L4', { seed: 2, progression: 'L4-default' }); a.pause(); }, quality);
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(() => { const a = window.__SS__!; a.pause(); a.cheats.god(true); a.cheats.completeObjective('ride'); a.cheats.completeObjective('quartermaster'); });
    const step = (n: number) => page.evaluate(n => window.__SS__!.step(n), n);
    for (let i = 0; i < 60 && !await page.evaluate(() => window.__SS__!.missions.state()!.l4!.turnAt); i++) await step(60);
    await page.evaluate(() => window.__SS__!.teleport('player', { x: -18, z: 4.5 })); await step(20);
    for (let i = 0; i < 20 && Math.abs(await page.evaluate(() => window.__SS__!.getState().render.camera.targetZoom as number) - zoom) > .02; i++) { await page.mouse.move(640, 360); await page.mouse.wheel(0, -120); await step(2); }
    await page.evaluate(() => window.__SS__!.cheats.completeObjective('hold')); await step(1);
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.checkpoint)).toBe('line-break');
    await expect(page.getByTestId('mission-tracker')).toHaveAttribute('data-objective', 'hide');
    await expect(page.getByTestId('mission-tracker')).toContainText('Run to the cellar');
    await expect(page.getByTestId('mission-tracker')).toContainText(/\b[23]\d{2}\s*m/);
    await expect(page.getByTestId('objective-text')).toContainText(/\b[23]\d{2}\s*m/);
    await expect(page.getByTestId('minimap-route')).toBeVisible();
    await expect(page.getByTestId('mission-subtitle')).toContainText('Get to the cellar!');
    const arrow = page.getByTestId('mission-marker');
    await expect(arrow).toBeVisible(); await expect(arrow).toHaveAttribute('data-anchor', 'l4-cellar-door');
    await expect(arrow).toHaveAttribute('data-offscreen', 'true'); await expect(arrow).toHaveText('➜');
    const proof = await page.evaluate(position => {
      const a = window.__SS__!, anchor = { id: 'l4-cellar-door', position }, marker = a.getState().render.missionMarker!;
      const ndc = a.camera.project(anchor.position[0], 1.8, anchor.position[2]), flip = ndc[2] > 1 ? -1 : 1;
      const expectedAngle = Math.atan2(-ndc[1] * innerHeight * flip, ndc[0] * innerWidth * flip);
      const arrow = document.querySelector<HTMLElement>('[data-testid=mission-marker]')!, rect = arrow.getBoundingClientRect();
      return { anchor, marker, angle: parseFloat(arrow.style.getPropertyValue('--direction')), expectedAngle, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, backend: a.perf().backend, tier: a.perf().quality.tier };
    }, cellar);
    expect(proof.backend).toBe(renderer); expect(proof.tier).toBe(quality);
    expect(proof.marker.visible).toBe(true);
    expect(proof.marker.position[0]).toBe(proof.anchor.position[0]); expect(proof.marker.position[2]).toBe(proof.anchor.position[2]);
    expect(Math.abs(Math.atan2(Math.sin(proof.angle - proof.expectedAngle), Math.cos(proof.angle - proof.expectedAngle)))).toBeLessThan(.01);
    expect(proof.rect.x).toBeGreaterThanOrEqual(0); expect(proof.rect.y).toBeGreaterThanOrEqual(0);
    expect(proof.rect.x + proof.rect.width).toBeLessThanOrEqual(1280); expect(proof.rect.y + proof.rect.height).toBeLessThanOrEqual(720);
    const out = `test-results/l4-walk-left/guidance-${renderer}-${quality}-z${zoom}`;
    mkdirSync(out, { recursive: true }); await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${out}/plaza-arrow.png` });
    await page.evaluate(p => window.__SS__!.teleport('player', { x: p[0] - 1.5, z: p[2] + 1.5 }), proof.anchor.position); await step(90);
    await expect(arrow).toHaveAttribute('data-offscreen', 'false');
    expect(await page.evaluate(() => window.__SS__!.getState().render.missionMarker!.visible)).toBe(true);
    await page.evaluate(() => window.__SS__!.screenshotReady()); await page.screenshot({ path: `${out}/cellar-beacon.png` });
    writeFileSync(`${out}/guidance.json`, JSON.stringify(proof, null, 2));
  });
}
