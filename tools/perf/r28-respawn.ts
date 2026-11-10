/* eslint-disable @typescript-eslint/no-explicit-any */
/** r28-l7l10: frame times around player.respawned. Run through tools/e2e-lock.sh with SCENE_PORT=4883.
 *  R28_LEVEL=L10|L8|L9 R28_BACKEND=webgl2|webgpu R28_TIER=low|high R28_DEATHS=3 R28_OUT=dir */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, origin, stopServer } from '../scenelab/session';

const level = process.env.R28_LEVEL ?? 'L10', backend = process.env.R28_BACKEND === 'webgpu' ? 'webgpu' : 'webgl2', tier = process.env.R28_TIER === 'high' ? 'high' : 'low';
const deaths = Number(process.env.R28_DEATHS ?? 3), out = process.env.R28_OUT ?? 'test-results/r28-respawn';
const session = new SceneSession({ backend, tier, viewport: { width: 1600, height: 900 } });
try {
  await session.open();
  const page = session.page; page.setDefaultTimeout(180_000);
  await page.goto(`${origin}/?test=poses&testApi=1&scenelab=1&debug=1&quality=${tier}&seed=1&audio=muted&dpr=1&profile=1${backend === 'webgl2' ? '&renderer=webgl' : ''}`);
  await page.waitForFunction(() => !!window.__SS__ && !!window.__SCENE__);
  await page.evaluate(async () => { await window.__SS__!.ready; localStorage.removeItem('minor-incident.campaign'); });
  await page.evaluate('globalThis.__name = fn => fn');
  await page.getByTestId('start-game').click(); await page.getByTestId('character-female').click();
  await page.getByTestId(`level-${level}`).click({ force: true });
  await page.waitForFunction(l => { const g = (window.__SCENE__ as any).game; return g.world.scenario === l && !g.loading; }, level);
  await page.evaluate(() => {
    const g = (window.__SCENE__ as any).game, t = window as any; t.tr = []; t.ev = []; t.run = true;
    g.world.events.on('player.died', (e: any) => t.ev.push({ type: 'died', tick: e.tick, at: performance.now() }));
    g.world.events.on('player.respawned', (e: any) => t.ev.push({ type: 'respawned', tick: e.tick, at: performance.now() }));
    let last = performance.now();
    const f = (now: number) => { const p = window.__SS__!.perf(); t.tr.push({ at: now, dt: now - last, tick: g.world.tick, sim: p.simMs, update: p.updateCpuMs, render: p.renderCpuMs, builds: p.nodeBuilds }); last = now; if (t.run) requestAnimationFrame(f); };
    requestAnimationFrame(f); window.__SS__!.resume();
  });
  await page.waitForTimeout(4000);
  const cdp = process.env.R28_PROFILE === '1' ? await page.context().newCDPSession(page) : null;
  let nav = 0, startedAt = 0;
  if (cdp) {
    await cdp.send('Performance.enable'); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    nav = (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'NavigationStart')!.value * 1000;
    startedAt = await page.evaluate(() => performance.now()); await cdp.send('Profiler.start');
  }
  for (let i = 0; i < deaths; i++) {
    const n = await page.evaluate(() => (window as any).ev.filter((e: any) => e.type === 'respawned').length);
    await page.evaluate(() => { const g = (window.__SCENE__ as any).game; g.world.combat.damage.god = false; const p = g.world.entities.get(1); g.world.player.damage(p.health.max * 10, g.world.tick, true); });
    try { await page.waitForFunction(k => (window as any).ev.filter((e: any) => e.type === 'respawned').length > k, n, { timeout: 60_000 }); } catch (error) {
      console.log(JSON.stringify(await page.evaluate(() => { const g = (window.__SCENE__ as any).game, p = g.world.entities.get(1); return { ev: (window as any).ev, hp: p.health.current, diedAt: p.survivor?.diedAt, tick: g.world.tick, phase: g.world.missions?.state.phase, passengerOf: p.passengerOf, god: g.world.combat.damage.god }; })));
      throw error;
    }
    await page.waitForTimeout(4000);
  }
  const res = await page.evaluate(() => { const t = window as any; t.run = false; window.__SS__!.pause(); return { ev: t.ev, tr: t.tr, backend: window.__SS__!.perf().backend }; });
  mkdirSync(out, { recursive: true });
  if (cdp) { const { profile } = await cdp.send('Profiler.stop'); writeFileSync(`${out}/${level}-${tier}-${backend}.cpuprofile`, JSON.stringify({ ...profile, performanceNavigationStartMs: nav, performanceStartedAt: startedAt })); }
  const tag = `${level}-${tier}-${backend}`; writeFileSync(`${out}/${tag}.json`, JSON.stringify(res));
  for (const r of res.ev.filter((e: any) => e.type === 'respawned')) {
    const near = res.tr.filter((f: any) => f.at >= r.at - 100 && f.at <= r.at + 1500);
    const worst = near.reduce((a: any, b: any) => b.dt > a.dt ? b : a, near[0]);
    console.log(`${tag} respawn tick ${r.tick}: worst dt ${worst.dt.toFixed(0)} ms (sim ${worst.sim?.toFixed?.(1)} update ${worst.update?.toFixed?.(1)} render ${worst.render?.toFixed?.(1)} builds ${worst.builds})`);
  }
  const all = res.tr.map((f: any) => f.dt).sort((a: number, b: number) => a - b); console.log(`${tag} frames ${all.length} p95 ${all[Math.floor(all.length * .95)].toFixed(1)} max ${all[all.length - 1].toFixed(0)}`);
} finally { await session.close(); stopServer(); }
