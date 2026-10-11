import { SceneSession, stopServer, writeJson } from './session';

/** Live campaign gate using Scene Lab's capsule metric. Run through tools/e2e-lock.sh. */
const session = new SceneSession();
const output = 'test-results/ped-props/campaign';
let pass = true;
try {
  await session.open();
  for (const level of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']) {
    const before = session.errors.length;
    await session.page.evaluate(async level => {
      const a = window.__SS__!;
      await a.loadLevel(level); a.pause(); a.missions.begin(); a.cheats.god(true); a.bot.start('complete');
      window.__SCENE__!.samplePropPenetration(true);
    }, level);
    for (let batch = 0; batch < 20; batch++) await session.page.evaluate(async () => {
      for (let f = 0; f < 60; f++) { await window.__SS__!.step(1); window.__SCENE__!.samplePropPenetration(); }
    });
    const metrics = await session.page.evaluate(() => window.__SCENE__!.samplePropPenetration());
    const errors = session.errors.slice(before), checks = { pass: metrics.samples > 1200 && metrics.framesMax <= 2 && errors.length === 0 };
    writeJson(`${output}/${level}.json`, { level, frames: 1200, metrics, errors, checks });
    console.log(JSON.stringify({ level, ...checks, samples: metrics.samples, propPenetrationFramesMax: metrics.framesMax, pairs: metrics.pairs.filter(p => p.max > 2) }));
    pass &&= checks.pass;
  }
} finally { await session.close(); stopServer(); }
process.exitCode = pass ? 0 : 1;
