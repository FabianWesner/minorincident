import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, test } from '../e2e/fixtures';

// Diagnostic only: retain the category/asset causes of remaining campaign gates.
for (const tier of ['high', 'low'] as const) for (const scenario of ['perf-l6-mainstreet', 'perf-l5-bridge']) {
  test(`remaining world budget profile ${scenario} ${tier} @profile`, async ({ page }) => {
    test.setTimeout(180_000);
    await boot(page, `/?test=1&renderer=webgl&quality=${tier}&audio=muted&dpr=1&profile`);
    const proof = await page.evaluate(async scenario => {
      const a = window.__SS__!; await a.loadScenario(scenario); a.pause(); await a.screenshotReady(); return a.perf();
    }, scenario);
    const dir = 'test-results/epics/E18/horde'; mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/world-${scenario}-${tier}.json`, JSON.stringify(proof, null, 2));
    console.log(JSON.stringify({ scenario, tier, draws: proof.drawCalls, triangles: proof.triangles, profile: proof.profile, assets: proof.profileAssets }));
  });
}
