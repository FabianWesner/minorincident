/** Capped, single-browser CPU attribution, allowed alongside another lane.
 * No frame-budget results: use the unchanged l4-budgets.spec.ts through quiet-run
 * for acceptance. SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh
 * npx tsx tools/perf/l4-alarm-cpu-profile.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer, origin } from '../scenelab/session';

if (process.env.MI_E2E_LOCK_HELD !== '1') throw Error('Use tools/e2e-lock.sh');
const out = process.env.L4_CPU_OUT ?? 'test-results/perf-l4-l6/alarm-cpu-profile';
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgpu', tier: 'low', phone: true, viewport: { width: 390, height: 844 }, seed: 2, query: { profile: '1', dpr: '1.5' } });
try {
  if (await fetch(origin).then(() => true, () => false)) throw Error(`Scene preview port is already occupied: ${origin}`);
  await session.open();
  await session.page.evaluate('globalThis.__name = fn => fn');
  const cdp = await session.page.context().newCDPSession(session.page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await session.page.evaluate(async () => {
    const a = window.__SS__!; a.settings.set({ quality: 'low' });
    await a.loadLevel('L4', { seed: 2, progression: 'L4-default' }); a.pause(); a.missions.begin(); a.cheats.god(true); a.bot.start('complete');
    for (let i = 0; i < 800 && a.missions.state()!.l4!.phase !== 'plaza'; i++) await a.step(15);
  });
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
  const beforeStartAt = await session.page.evaluate(() => performance.now());
  await cdp.send('Profiler.start');
  const afterStartAt = await session.page.evaluate(() => performance.now());
  const rows = await session.page.evaluate(async () => {
    const a = window.__SS__!, rows: { at: number; tick: number; sim: number; simFrame: number; update: number; render: number }[] = [];
    const deadline = performance.now() + 60_000; a.resume();
    while (performance.now() < deadline) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const p = a.perf(); rows.push({ at: performance.now(), tick: a.tick(), sim: p.simTickMs, simFrame: p.simMs, update: p.updateCpuMs, render: p.renderCpuMs });
      const turn = a.missions.state()!.l4!.turnAt; if (turn && a.tick() >= turn + 120) break;
    }
    a.pause(); return rows;
  });
  const beforeStopAt = await session.page.evaluate(() => performance.now()), profile = await cdp.send('Profiler.stop');
  const state = await session.page.evaluate(() => ({ turnAt: window.__SS__!.missions.state()!.l4!.turnAt, tick: window.__SS__!.tick(), backend: window.__SS__!.perf().backend }));
  writeFileSync(`${out}/low.json`, JSON.stringify({ diagnostic: true, capped: true, sharedHost: true, beforeStartAt, afterStartAt, beforeStopAt, state, rows, ...profile }));
  console.log(JSON.stringify({ diagnostic: true, ...state, rows: rows.length }));
  if (!state.turnAt || state.backend !== 'webgpu' || session.errors.length) throw Error(`Incomplete diagnostic: ${session.errors.join('\n')}`);
} finally { await session.close(); stopServer(); }
