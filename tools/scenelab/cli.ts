import { basename, resolve } from 'node:path';
import { SceneSession, encodeWebm, evaluate, readSpec, stopServer, writeJson, type Backend } from './session';

/** npm run scene -- <spec.json> [more.json ...] [--frames N] [--shots t1,t2] [--video secs] [--backend webgl2|webgpu] [--tier high|low] [--out dir] [--size WxH] [--query key=value]...
 * Headless and deterministic (spec seed, fixed 60 Hz ticks). Per spec: screenshots, optional WebM, metrics.json.
 * Several specs share one browser session. Exit 1 when any `expect` gate fails or a scene throws. */
const args = process.argv.slice(2), flag = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const files = args.filter((a, i) => a.endsWith('.json') && !args[i - 1]?.startsWith('--'));
if (!files.length) { console.error('usage: npm run scene -- specs/scenes/<name>.json [...] [--frames N] [--shots 0,60] [--video 4] [--backend webgl2|webgpu] [--tier high|low] [--out dir] [--size 1280x720]'); process.exit(2); }
const backend = (flag('backend') ?? 'webgl2') as Backend, tier = (flag('tier') ?? 'high') as 'high' | 'low';
const [width, height] = (flag('size') ?? '1280x720').split('x').map(Number);
const query = Object.fromEntries(args.flatMap((a, i) => a === '--query' ? [args[i + 1].split('=') as [string, string]] : []));
const session = new SceneSession({ backend, tier, viewport: { width, height }, query });
const summary: unknown[] = [];
let code = 0;
try {
  const started = Date.now();
  await session.open();
  const openMs = Date.now() - started;
  for (const file of files) {
    const spec = readSpec(resolve(file)), name = spec.name ?? basename(file, '.json');
    const video = Number(flag('video') ?? spec.video ?? 0);
    const shots = (flag('shots')?.split(',').map(Number) ?? spec.shots ?? [0]).filter(Number.isFinite).sort((a, b) => a - b);
    const frames = Math.max(Number(flag('frames') ?? spec.frames ?? 120), video * 60, ...shots);
    const out = resolve(files.length === 1 && flag('out') ? flag('out')! : `${flag('out') ?? 'test-results/scenes'}/${name}${backend === 'webgpu' ? '-webgpu' : ''}${tier === 'low' ? '-low' : ''}`);
    const errorsBefore = session.errors.length, t0 = Date.now();
    try {
      const scene = await session.load(spec);
      const loadMs = Date.now() - t0, written: string[] = [], jpegs: Buffer[] = [];
      // Step in batches inside the page; stop only where a capture happens.
      const stops = new Set(shots);
      if (video) for (let f = 0; f <= video * 60; f += 3) stops.add(f);
      let frame = 0;
      for (const stop of [...stops].sort((a, b) => a - b)) {
        if (stop > frames) break;
        if (stop > frame) frame = await session.step(stop - frame);
        if (shots.includes(stop)) { const path = `${out}/shot-${String(stop).padStart(4, '0')}.png`; await session.screenshot(path); written.push(path); }
        if (video && stop <= video * 60 && stop % 3 === 0) jpegs.push(await session.page.screenshot({ type: 'jpeg', quality: 80 }));
      }
      if (frame < frames) await session.step(frames - frame);
      if (jpegs.length) { const path = `${out}/video.webm`; encodeWebm(jpegs, path); written.push(path); }
      const clipping = await session.clipping(), metrics = await session.metrics(), errors = session.errors.slice(errorsBefore);
      const result = evaluate(spec, metrics, clipping, errors);
      const timing = { openMs, loadMs, runMs: Date.now() - t0 - loadMs, sceneMs: Date.now() - t0 };
      writeJson(`${out}/metrics.json`, { spec: file, backend: metrics.backend, requestedBackend: backend, tier, frames: metrics.frame, timing, checks: result, consoleErrors: errors, scene, metrics, clipping });
      written.push(`${out}/metrics.json`);
      summary.push({ scene: name, pass: result.pass, backend: metrics.backend, frames: metrics.frame, seconds: timing.sceneMs / 1000, failed: result.checks.filter(c => !c.pass), clipping: clipping.summary, files: written });
      if (!result.pass) code = 1;
    } catch (error) {
      summary.push({ scene: name, pass: false, error: String(error), consoleErrors: session.errors.slice(errorsBefore) }); code = 1;
    }
  }
} catch (error) {
  console.error(error); console.error(session.errors.join('\n')); code = 1;
} finally { await session.close(); stopServer(); }
console.log(JSON.stringify(summary.length === 1 ? summary[0] : summary, null, 2));
process.exit(code);
