/** Before/after native-GPU crowd variety and E18 measurements, under e2e-lock. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, readSpec, stopServer, evaluate } from './session';
const phase = process.argv[2] ?? 'after';
const output = `test-results/crowd-variety/${phase}`;
mkdirSync(output, { recursive: true });
try {
  for (const tier of ['high', 'low'] as const) {
    const session = new SceneSession({ tier, viewport: tier === 'high' ? { width: 1280, height: 720 } : { width: 390, height: 844 }, nativeFrameTiming: true });
    try {
      await session.open();
      for (const name of ['l2-fight', 'infected-20', 'l1-street']) {
        const spec = readSpec(`tests/scenes/crowd-variety/${name}.json`);
        if (tier === 'low') spec.camera = { mode: 'game', target: [0, 1], zoom: 1.45 };
        await session.load(spec);
        await session.step(1); await session.screenshot(`${output}/${name}-${tier}.png`);
        const metrics = await session.metrics();
        const checks = phase === 'after' ? evaluate(spec, metrics, await session.clipping(), session.errors) : null;
        if (checks && !checks.pass) throw new Error(`${name} ${tier}: ${JSON.stringify(checks.checks.filter(c=>!c.pass))}`);
        const looks = await session.page.evaluate(() => window.__SS__!.query({}).filter(e => e.infected || e.civilian).map(e => ({ id: e.id, model: e.appearance?.asset ?? e.infected?.model ?? e.infected?.variant ?? e.civilian?.model, tint: e.appearance?.tint })));
        writeFileSync(`${output}/${name}-${tier}.json`, JSON.stringify({ metrics, checks, looks, errors: session.errors }, null, 2));
      }
      if (process.argv.includes('--captures-only')) continue;
      const perf = await session.page.evaluate(async tier => {
        const a = window.__SS__!; await a.loadScenario(tier === 'high' ? 'perf-horde-200' : 'perf-horde-100'); a.pause(); a.cheats.god(true); a.camera.preset('perf-horde'); await a.screenshotReady(); const fixed = a.perf(); a.resume();
        const frames: number[] = []; let previous = 0; const start = performance.now();
        for (let i = 0; i < 720 || performance.now() - start < 12000; i++) {
          const now = await new Promise<number>(r => requestAnimationFrame(r)); if (i >= 120 && previous) frames.push(now - previous); previous = now;
        }
        a.pause(); const sorted = frames.sort((x,y) => x-y);
        return { fixed, final: a.perf(), count: a.getState().ai!.count, frameMsP95: sorted[Math.ceil(sorted.length * .95)-1] };
      }, tier);
      writeFileSync(`${output}/horde-${tier}.json`, JSON.stringify({ ...perf, errors: session.errors }, null, 2));
      if (phase === 'after' && (perf.count !== (tier === 'high' ? 200 : 100) || perf.fixed.drawCalls > (tier === 'high' ? 600 : 300) || perf.fixed.triangles > (tier === 'high' ? 1500000 : 500000) || perf.frameMsP95 > (tier === 'high' ? 16.7 : 1000/30))) throw new Error(`E18 ${tier} budget: ${JSON.stringify(perf)}`);
      console.log(JSON.stringify({ phase, tier, draws: perf.fixed.drawCalls, triangles: perf.fixed.triangles, p95: perf.frameMsP95, errors: session.errors }));
    } finally { await session.close(); }
  }
} finally { stopServer(); }
