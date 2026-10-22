import { writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect } from '../e2e/fixtures';

/** Pause keeps the same peak population while the actual follow rig changes player zoom. */
export async function gameplayZoomCounters(page: Page, tier: 'high' | 'low', evidencePath: string) {
  const rows = [];
  await page.evaluate(() => window.__SS__!.camera.follow());
  for (const zoom of [.5, 1, 1.5]) {
    const row = await page.evaluate(async zoom => {
      const a = window.__SS__!; a.camera.zoom(zoom); await a.screenshotReady();
      return { zoom: a.getState().render.camera.zoom, perf: a.perf() };
    }, zoom);
    rows.push(row); writeFileSync(evidencePath, JSON.stringify(rows, null, 2));
    expect(row.zoom).toBeCloseTo(zoom, 3);
    expect(row.perf.quality.tier).toBe(tier);
    expect(row.perf.drawCalls).toBeLessThanOrEqual(tier === 'high' ? 600 : 300);
    expect(row.perf.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000);
    expect(row.perf.awakeProps).toBeLessThanOrEqual(tier === 'high' ? 150 : 60);
    expect(row.perf.lighting!.heroLights).toBeLessThanOrEqual(tier === 'high' ? 8 : 3);
    expect(row.perf.lighting!.shadowMaps).toBeLessThanOrEqual(tier === 'high' ? 3 : 1);
    const effects = row.perf.effects!;
    expect(effects.particles).toBeLessThanOrEqual(tier === 'high' ? 6000 : 2000);
    expect(effects.gibs).toBeLessThanOrEqual(tier === 'high' ? 80 : 30);
    expect(effects.blasts.puffs).toBeLessThanOrEqual(tier === 'high' ? 400 : 120);
    expect(effects.blasts.chunks).toBeLessThanOrEqual(tier === 'high' ? 120 : 40);
  }
  await page.evaluate(async () => { const a = window.__SS__!; a.camera.zoom(1); await a.screenshotReady(); });
  return rows;
}
