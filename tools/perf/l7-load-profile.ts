/** CPU attribution for the actual L7 -> L8 loading path; not an acceptance fixture. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';

const out = process.env.L7_LOAD_OUT ?? 'test-results/l7-perf/load-profile';
mkdirSync(out, { recursive: true });
try {
  const session = new SceneSession({ backend: 'webgl2', tier: 'high', nativeFrameTiming: true,
    viewport: { width: 1600, height: 900 }, query: { loadProfile: '2' } });
  try {
    await session.open();
    await session.page.evaluate(async () => { await window.__SS__!.loadLevel('L7', { seed: 29, progression: 'L7-default' }); window.__SS__!.pause(); });
    const cdp = await session.page.context().newCDPSession(session.page);
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
    const result = await session.page.evaluate(async () => {
      performance.clearMeasures();
      const tasks: { start: number; duration: number }[] = [];
      const observer = new PerformanceObserver(list => { for (const entry of list.getEntries()) tasks.push({ start: entry.startTime, duration: entry.duration }); });
      observer.observe({ type: 'longtask', buffered: false });
      await window.__SS__!.loadLevel('L8', { seed: 29 });
      await new Promise(resolve => setTimeout(resolve, 100)); observer.disconnect();
      return { measures: performance.getEntriesByType('measure').map(e => ({ name: e.name, start: e.startTime, duration: e.duration })), tasks, perf: window.__SS__!.perf() };
    });
    writeFileSync(`${out}/load.cpuprofile`, JSON.stringify((await cdp.send('Profiler.stop')).profile));
    writeFileSync(`${out}/load.json`, JSON.stringify(result));
    console.log(JSON.stringify({ tasks: result.tasks, measures: result.measures }));
    if (session.errors.length) throw Error(session.errors.join('\n'));
    await cdp.detach();
  } finally { await session.close(); }
} finally { stopServer(); }
