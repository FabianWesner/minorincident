import { mkdirSync, writeFileSync } from 'node:fs';
import { lookViewpoints } from '../../src/data/lookViewpoints';
import { test, expect, boot } from '../e2e/fixtures';
const phase = process.env.PERF_HORDE_PHASE ?? 'after';
for (const tier of ['high', 'low'] as const) test(`L1 game camera photo spots ${tier} @E18-AC01 @perf`, async ({ page }) => {
  test.setTimeout(180_000); await boot(page, `/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=1&profile`);
  await page.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L1'); a.missions.begin(); a.pause(); });
  const proofs = [];
  for (const spot of lookViewpoints) {
    const proof = await page.evaluate(async spot => {
      const a = window.__SS__!; a.teleport('player', spot); await a.step(1); a.camera.preset(spot.id); await a.screenshotReady(); return a.perf();
    }, spot);
    proofs.push({ spot: spot.id, ...proof });
    const dir = 'test-results/epics/E18/horde'; mkdirSync(dir, { recursive: true });
    await page.locator('canvas').screenshot({ path: `${dir}/${phase}-L1-${tier}-${spot.id}.png`, scale: 'css' });
  }
  writeFileSync(`test-results/epics/E18/horde/${phase}-L1-${tier}.json`, JSON.stringify(proofs, null, 2));
  console.log(JSON.stringify({ phase, tier, spots: proofs.map(p => ({ spot: p.spot, triangles: p.triangles, draws: p.drawCalls, profile: p.profile })) }));
  if (phase !== 'before') for (const proof of proofs) { expect(proof.drawCalls).toBeLessThanOrEqual(tier === 'high' ? 600 : 300); expect(proof.triangles).toBeLessThanOrEqual(tier === 'high' ? 1_500_000 : 500_000); }
});
