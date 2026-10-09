import { basename, resolve } from 'node:path';
import { SceneSession, readSpec, stopServer, writeJson, type Backend } from './session';
import { runSpec } from './run';

/** npm run scene -- <spec.json> [more.json ...] [--frames N] [--shots t1,t2] [--video secs] [--sheet N] [--backend webgl2|webgpu] [--tier high|low] [--out dir] [--size WxH] [--query key=value]...
 * Headless and deterministic (spec seed, fixed 60 Hz ticks). Per spec: screenshots, optional WebM, metrics.json.
 * `--sheet N` writes one sheet.jpg contact sheet (a labelled low-res snapshot every N frames, max 24 cells).
 * Several specs share one browser session. Exit 1 when any `expect` gate fails or a scene throws. */
const args = process.argv.slice(2), flag = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const files = args.filter((a, i) => a.endsWith('.json') && !args[i - 1]?.startsWith('--'));
if (!files.length && !flag('inspect-level')) { console.error('usage: npm run scene -- specs/scenes/<name>.json [...] [--frames N] [--shots 0,60] [--video 4] [--sheet 30] [--backend webgl2|webgpu] [--tier high|low] [--out dir] [--size 1280x720]'); process.exit(2); }
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
  if (flag('inspect-level')) {
    const level = flag('inspect-level')!, out = resolve(flag('out') ?? `test-results/inspect/scene-${level}`);
    const anchors = await session.inspectLevel(level, flag('bot') === 'complete');
    const selected = flag('anchor') ? anchors.filter(a => a.id === flag('anchor')) : anchors.filter(a => a.kind === 'objective').slice(0, 3);
    if (!selected.length) throw new Error('No matching inspection anchors');
    const files: string[] = [];
    for (const [i, anchor] of selected.entries()) {
      await session.page.evaluate(id => window.__SS__!.inspect.jump(id), anchor.id);
      const path = `${out}/anchor-${i}.png`; await session.screenshot(path); files.push(path);
    }
    const state = await session.page.evaluate(() => window.__SS__!.inspect.state());
    writeJson(`${out}/metrics.json`, { level, anchors: selected, state, consoleErrors: session.errors, checks: { pass: session.errors.length === 0 } });
    summary.push({ level, pass: session.errors.length === 0, files, metrics: `${out}/metrics.json`, drawCalls: state.perf.drawCalls, triangles: state.perf.triangles });
    if (session.errors.length) code = 1;
  }
  for (const file of files) {
    const spec = readSpec(resolve(file)), name = spec.name ?? basename(file, '.json');
    const out = resolve(files.length === 1 && flag('out') ? flag('out')! : `${flag('out') ?? 'test-results/scenes'}/${name}${backend === 'webgpu' ? '-webgpu' : ''}${tier === 'low' ? '-low' : ''}`);
    const errorsBefore = session.errors.length;
    try {
      const r = await runSpec(session, spec, { file, out, openMs, inspect: flag('inspect') === 'true', frames: flag('frames') ? Number(flag('frames')) : undefined, video: flag('video') ? Number(flag('video')) : undefined, sheet: flag('sheet') ? Number(flag('sheet')) : undefined, shots: flag('shots')?.split(',').map(Number) });
      summary.push({ scene: name, pass: r.pass, backend: r.backend, frames: r.frames, seconds: r.seconds, failed: r.failed, clipping: r.clipping, sheet: r.sheet, files: r.files });
      if (!r.pass) code = 1;
    } catch (error) {
      summary.push({ scene: name, pass: false, error: String(error), consoleErrors: session.errors.slice(errorsBefore) }); code = 1;
    }
  }
} catch (error) {
  console.error(error); console.error(session.errors.join('\n')); code = 1;
} finally { await session.close(); stopServer(); }
console.log(JSON.stringify(summary.length === 1 ? summary[0] : summary, null, 2));
process.exit(code);
