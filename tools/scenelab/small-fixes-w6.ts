import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import { runSpec } from './run';
import { windowLine } from '../../tests/helpers/window-parallax';
import type { SceneSpec } from '../../src/debug/scenelab/spec';

// One bounded, headless batch; invoke through quiet-run.sh / e2e-lock.sh after a fresh build.
const out = resolve(process.argv[2] ?? 'docs/reports/small-fixes-w6/evidence/browser');
// W6_TIMING=0 runs pixel/layout proofs under the ordinary browser lock.
// Default timing measurements require quiet-run.sh.
const measureTiming = process.env.W6_TIMING !== '0';
const rows: unknown[] = [], failures: string[] = [];
const specs = ['tests/scenes/catalog/wave3-zoo-routines.json', 'tests/scenes/catalog/qa-w6-phone-gate.json', 'tests/scenes/catalog/qa-w6-window-depth.json'];
const luminance = (image: PNG, point: number[]) => {
  const x = Math.round((point[0] + 1) * image.width / 2), y = Math.round((1 - point[1]) * image.height / 2);
  const at = (y * image.width + x) * 4;
  const linear = (v: number) => v / 255 <= .04045 ? v / 3294.6 : ((v / 255 + .055) / 1.055) ** 2.4;
  return .2126 * linear(image.data[at]) + .7152 * linear(image.data[at + 1]) + .0722 * linear(image.data[at + 2]);
};
try {
  for (const backend of ['webgl2', 'webgpu'] as const) for (const tier of ['high', 'low'] as const) {
    for (const file of specs) {
      const base = readSpec(file), phone = base.name === 'qa-w6-phone-gate';
      for (const profile of phone ? ['pixel-7', 'pixel-7-landscape'] : ['desktop']) {
        const viewport = profile === 'pixel-7' ? { width: 390, height: 844 } : profile === 'pixel-7-landscape' ? { width: 844, height: 390 } : { width: 1280, height: 720 };
        const session = new SceneSession({ backend, tier, phone, viewport, nativeFrameTiming: measureTiming, query: phone ? { ui: '1' } : {} });
        try {
          await session.open();
          for (const zoom of base.name === 'wave3-zoo-routines' ? [.5, 1, 1.5] : [.5, 1]) {
            const name = `${base.name}-${backend}-${tier}-${profile}-z${zoom}`, dir = `${out}/${name}`;
            try {
              const failuresBefore = failures.length;
              const spec: SceneSpec = { ...base, camera: { ...base.camera!, zoom } as SceneSpec['camera'], sheet: 2 };
              const result = await runSpec(session, spec, { out: dir, file });
              if (!result.pass) failures.push(`${name}: ${result.failed.map(f => f.name).join(',')}`);
              if (phone) {
                const rectangles = await session.page.evaluate(() => {
                  const prompt = document.querySelector<HTMLElement>('[data-testid=interaction-prompt]')!;
                  const a = prompt.getBoundingClientRect();
                  const panels = [...document.querySelectorAll<HTMLElement>('.hud-tracker,.hud-survivor-vitals,.mission-subtitle,.story-bubble')].filter(p => !p.hidden && getComputedStyle(p).visibility !== 'hidden').map(p => ({ class: p.className, rect: p.getBoundingClientRect().toJSON() }));
                  return { visible: !prompt.hidden && getComputedStyle(prompt).visibility !== 'hidden' && a.width > 0 && a.height > 0, withinViewport: a.left >= 0 && a.top >= 0 && a.right <= innerWidth && a.bottom <= innerHeight, prompt: a.toJSON(), panels, overlaps: panels.filter(p => p.rect.width && p.rect.height && a.left < p.rect.right && a.right > p.rect.left && a.top < p.rect.bottom && a.bottom > p.rect.top) };
                });
                writeJson(`${dir}/hud-separation.json`, rectangles);
                await session.page.screenshot({ path: `${dir}/phone-hud.png` });
                if (!rectangles.visible || !rectangles.withinViewport || rectangles.overlaps.length) failures.push(`${name}: phone prompt hidden/overlapping`);
              }
              if (base.name === 'qa-w6-window-depth' && zoom === 1) {
                const samples = [], cells = [];
                for (const angle of [45, 60]) {
                  await session.page.evaluate(angle => window.__SCENE__!.setCamera({ mode: 'orbit', radius: 19, polar: 54, azimuth: angle, target: [0, 1.3, 0] }), angle);
                  await session.ready();
                  const line = await windowLine(session.page);
                  if (line.length !== 200) throw Error(`window scanline has ${line.length} samples`);
                  const image = PNG.sync.read(await session.page.locator('canvas').screenshot({ path: `${dir}/angle-${angle}.png` }));
                  const values = line.map(p => luminance(image, p));
                  let edge = 0, gradient = -Infinity;
                  // Track the depth seam across the pane, excluding its fixed frame and mullion.
                  for (let i = 20; i < 180; i++) if (i < 88 || i > 112) { const delta = values[i - 2] - values[i + 2]; if (delta > gradient) { gradient = delta; edge = i; } }
                  const width = Math.hypot((line[199][0] - line[0][0]) * image.width / 2, (line[199][1] - line[0][1]) * image.height / 2);
                  samples.push({ angle, line, values, edge, width, gradient }); cells.push({ frame: angle, jpeg: await session.snapshot() });
                }
                const shiftPx = Math.abs(samples[0].edge - samples[1].edge) / 199 * Math.min(samples[0].width, samples[1].width);
                await session.load({ ...spec, props: spec.props!.map(prop => ({ ...prop, powered: false })), camera: { mode: 'orbit', radius: 19, polar: 54, azimuth: 45, target: [0, 1.3, 0] } });
                const darkImage = PNG.sync.read(await session.page.locator('canvas').screenshot({ path: `${dir}/unpowered.png` }));
                const dark = samples[0].line.map(p => luminance(darkImage, p));
                const glowRatio = Math.max(...samples[0].values) / Math.max(...dark);
                cells.push({ frame: 0, jpeg: await session.snapshot() });
                await session.makeSheet(cells, `${dir}/parallax-sheet.jpg`, 640);
                writeJson(`${dir}/parallax.json`, { samples, shiftPx, glowRatio, dark });
                if (!(shiftPx >= 4 && glowRatio > 4)) failures.push(`${name}: parallax ${shiftPx.toFixed(2)}px / glow ${glowRatio.toFixed(2)}`);
              }
              const perf = await session.page.evaluate(async measureTiming => {
                const api = window.__SS__!, game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
                const startFrames = api.perf().renderedFrames;
                const frameMs: number[] = []; let previous = 0;
                // Scene Lab keeps the sim paused; the normal ticker deliberately skips rendering.
                // Submit each sampled frame explicitly so this measures drawing, not idle RAF cadence.
                for (let i = 0; i < (measureTiming ? 180 : 0); i++) { game.view.update(1); const now = await new Promise<number>(r => requestAnimationFrame(r)); if (i >= 60 && previous) frameMs.push(now - previous); previous = now; }
                const sorted = [...frameMs].sort((a, b) => a - b);
                return { renderedFrames: api.perf().renderedFrames - startFrames, frameMs, frameP95: measureTiming ? sorted[Math.ceil(sorted.length * .95) - 1] : null, perf: api.perf() };
              }, measureTiming);
              // E18 budgets the JS heap, as in l8-budgets.spec.ts. performance.memory
              // also counts Rapier/geometry backing stores and cannot gate that budget.
              const cdp = await session.page.context().newCDPSession(session.page);
              for (let i = 0; i < 3; i++) { await cdp.send('HeapProfiler.collectGarbage'); await session.page.evaluate(() => new Promise(r => requestAnimationFrame(r))); }
              const heapAudit = await cdp.send('Runtime.getHeapUsage');
              await cdp.detach();
              const heapBytes = heapAudit.usedSize;
              writeJson(`${dir}/perf.json`, { ...perf, heapBytes, heapAudit });
              const budget = tier === 'high' ? { draws: 600, triangles: 1_500_000, frameMs: 16.7, heap: 400_000_000 } : { draws: 300, triangles: 500_000, frameMs: 33.3, heap: 250_000_000 };
              const perfPass = perf.perf.drawCalls <= budget.draws && perf.perf.triangles <= budget.triangles && (perf.frameP95 === null || perf.renderedFrames >= 180 && Math.round(perf.frameP95 * 1e6) / 1e6 <= budget.frameMs) && heapBytes <= budget.heap;
              if (!perfPass) failures.push(`${name}: E18 draws/triangles/frame/heap budget`);
              rows.push({ name, pass: failures.length === failuresBefore, sceneGatesPass: result.pass, actualBackend: result.backend, actualTier: result.actualTier, timingMeasured: measureTiming, renderedFrames: perf.renderedFrames, perfPass, drawCalls: perf.perf.drawCalls, triangles: perf.perf.triangles, heapBytes, frameP95: perf.frameP95, sheet: result.sheet });
              console.log(name, result.pass, perfPass);
            } catch (error) { failures.push(`${name}: ${String(error)}`); console.error(name, error); }
            writeJson(`${out}/summary.json`, { rows, failures });
          }
        } finally { await session.close(); }
      }
    }
  }
} finally { stopServer(); writeJson(`${out}/summary.json`, { rows, failures }); }
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
