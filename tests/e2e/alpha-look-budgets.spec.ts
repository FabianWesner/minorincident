import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from './fixtures';
import { cureRegions } from '../../src/levels/L10/mission';
import { cureAlphaCap } from '../../src/levels/L10/alphaContracts';

test.use({ launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

// Renderer stress fixtures only: keep every region's maximum regular Alpha count
// visible together without changing campaign counts, health, damage or speed.
// Freeze simulation after filling the quota so campaign spawners cannot compete
// with the synthetic stress actors; this measures submission counters, not timing.
for (const backend of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) {
  test(`Alpha visual budgets ${backend} ${quality} @E18-AC01 @E07-AC01`, async ({ page }) => {
    test.setTimeout(360_000);
    const rows = [];
    const out = 'docs/reports/alpha-look/budgets'; mkdirSync(out, { recursive: true });
    const url = `/?test=1${backend === 'webgl' ? '&renderer=webgl' : ''}&quality=${quality}&audio=muted&dpr=1`;
    const spots = [[547, 0], [937, 80], [1517, 100], [2060, -75], [2707, 45], [3317, 95], [4002, -27]];
    const cases = [
      ...cureRegions.map((r, i) => ({ level: 'L10', at: spots[i], checkpoint: r.checkpoint, region: r.id, count: cureAlphaCap(r.id, quality) })),
      { level: 'L5', at: [-14, 8], checkpoint: undefined, region: undefined, count: 2 },
    ];
    for (const entry of cases) for (const zoom of [1, .5]) {
      await boot(page, url); // Fresh view: checkpoint reload otherwise retains the previous wheel zoom.
      await page.evaluate(async ({ entry, quality }) => {
        const a = window.__SS__!;
        a.settings.set({ quality });
        await a.loadLevel(entry.level, { seed: 32, ...(entry.checkpoint ? { checkpoint: entry.checkpoint } : {}) });
        a.pause(); a.cheats.god(true);
        if (entry.level === 'L5') { a.missions.begin(); a.cheats.completeObjective('emerge'); await a.step(660); a.teleport('player', { x: -14, z: 8 }); }
        if (entry.level === 'L10') { a.teleport('player', { x: entry.at[0], z: entry.at[1] }); await a.step(3601); }
        a.camera.follow(); await a.step(30); await a.screenshotReady();
      }, { entry, quality });
      const size = page.viewportSize()!; await page.mouse.move(size.width / 2, size.height / 2);
      for (let i = 0; i < 12; i++) {
        const current = await page.evaluate(() => window.__SS__!.getState().render.camera.zoom);
        if (Math.abs(current - zoom) < .005) break;
        await page.mouse.wheel(0, current > zoom ? -100 : 100);
        await page.waitForTimeout(150); // Allow wheel delivery and camera easing before the next input.
        await page.evaluate(async () => { await window.__SS__!.step(30); });
      }
      const row = await page.evaluate(async entry => {
        const a = window.__SS__!;
        const player = a.query({ kind: 'player' })[0];
        const alphas = a.query({}).filter(e => e.archetype === 'infected.alpha' && !e.infected?.pursuit && (!entry.region || e.infected?.cureRegion === entry.region));
        let placed = 0;
        for (let probe = 0; placed < entry.count && probe < 48; probe++) {
          const angle = probe * 2.399963, radius = 2 + Math.floor(probe / 12);
          const at = { x: player.transform.x + Math.cos(angle) * radius, z: player.transform.z + Math.sin(angle) * radius };
          if (!a.input.visible(at)) continue;
          if (alphas[placed]) a.teleport(alphas[placed].id, at);
          else {
            try { a.spawn('infected.alpha', at, { state: 'chase', ...(entry.region ? { cureRegion: entry.region } : {}) }); }
            catch (error) { if (String(error).includes('inside collider or outside grid')) continue; throw error; }
          }
          placed++;
        }
        if (placed !== entry.count) throw new Error(`Could not place full Alpha count at ${entry.checkpoint ?? entry.level}`);
        await a.screenshotReady();
        const state = a.getState(), perf = a.perf();
        return { player: state.entities.find(e => e.kind === 'player')?.transform, backend: perf.backend, tier: perf.quality.tier, zoom: state.render.camera.zoom, draws: perf.drawCalls,
          triangles: perf.triangles, alphas: state.entities.filter(e => e.archetype === 'infected.alpha' && !e.infected?.pursuit && e.health.current > 0).length,
          drawnAlphas: state.render.crowd!.batches.filter(b => /^inf\.alpha(-|$)/.test(b.id)).reduce((n, b) => n + b.instances, 0) };
      }, entry);
      rows.push({ ...entry, ...row });
      writeFileSync(`${out}/${backend}-${quality}.json`, JSON.stringify(rows, null, 2) + '\n');
      expect(row.backend).toBe(backend); expect(row.tier).toBe(quality); expect(row.zoom).toBeCloseTo(zoom, 2);
      expect(row.alphas).toBeGreaterThanOrEqual(entry.count); expect(row.drawnAlphas).toBeGreaterThanOrEqual(entry.count);
      expect(row.draws).toBeLessThanOrEqual(quality === 'high' ? 600 : 300);
      expect(row.triangles).toBeLessThanOrEqual(quality === 'high' ? 1_500_000 : 500_000);
    }
  });
}
