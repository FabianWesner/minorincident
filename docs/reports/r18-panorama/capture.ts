/** One production ending replay, one pooled headless context, 600 s outer watchdog. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { gzipSync, gunzipSync } from 'node:zlib';
import { SceneSession, stopServer } from '../../../tools/scenelab/session';

const [tier = 'low', backend = 'webgl2', aspect = 'landscape'] = process.argv.slice(2);
const root = 'docs/reports/r18-panorama', tag = `${tier}-${backend}-${aspect}`;
const raw = `/private/tmp/r18-panorama/final/${tag}`;
mkdirSync(raw, { recursive: true });
const session = new SceneSession({ tier: tier as 'high' | 'low', backend: backend as 'webgl2' | 'webgpu', viewport: aspect === 'portrait' ? { width: 720, height: 1280 } : { width: 1280, height: 720 }, query: { ui: '1' } });
const sha = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const seedBytes = readFileSync(`${root}/seeds/L10-${tier}-release.json.gz`);
const report: any = { tag, tier, backend, aspect, method: 'Production pre-release campaign save; natural simulation clock through the ending, completion bot detached at release. Paused screenshots. One headless SceneSession/browser-pool context. Portrait uses real touch controls. Every rendered ending frame contributes geometry maxima; no frame-time claim.', revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceDiff: execFileSync('git', ['diff', '--', 'src'], { encoding: 'utf8' }), producerSha256: sha(readFileSync(import.meta.filename)), seedSha256: sha(seedBytes), captures: [], errors: [], warnings: [] };
report.sourceFiles = Object.fromEntries(execFileSync('git', ['diff', '88f67901', '--name-only', '--', 'src'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).map(path => [path, sha(readFileSync(path))]));
function save() { writeFileSync(`${root}/${tag}.json.gz`, gzipSync(JSON.stringify(report))); }
async function state() {
  return session.page.evaluate(() => {
    const api = window.__SS__!, game = window.__SCENE__.game, world = game.world, mission = world.missions!.state, perf = api.perf();
    const visible = (n: Element) => { const s = getComputedStyle(n); return s.display !== 'none' && s.visibility !== 'hidden' && !!n.getBoundingClientRect().width; };
    const hud = [...document.querySelectorAll('.hud,.onboarding,.mission-marker,[data-touch-controls],[data-touch-stick],[data-testid=pause-button]')].filter(visible).map(n => n.getAttribute('data-testid') ?? n.className);
    const gl = (game.view.renderer.backend as any).gl, glVersion = gl ? String(gl.getParameter(gl.VERSION)) : null;
    const actualBackend = glVersion?.includes('WebGL 2') ? 'webgl2' : perf.backend;
    const bounds = world.districts!.nav;
    const corners = [bounds.min[0], bounds.max[0]].flatMap(x => [bounds.min[1], bounds.max[1]].map(z => game.view.camera.position.clone().set(x, 0, z).project(game.view.camera).toArray()));
    const overview = (game.view as any).districts?.overviewView;
    return { tick: world.tick, elapsed: mission.cureFront?.elapsed ?? -1, phase: mission.epilogue?.phase ?? mission.phase, phaseTicks: mission.epilogue?.phaseTicks ?? 0, backend: actualBackend, glVersion, quality: game.quality.tier, draws: perf.drawCalls, triangles: perf.triangles, camera: game.view.view.getState(), corners, hud, worldBars: (game.view as any).healthBars?.count ?? 0, cinematicUi: document.body.classList.contains('cinematic-ui'), touch: document.body.classList.contains('touch-ui'), overview: overview && { visible: overview.visible, woodlandInstances: overview.forest.count, mistInstances: overview.mist.count, groundSize: overview.landscape.geometry.parameters }, endingErrors: (game.view as any).endingView?.errors ?? [] };
  });
}
async function photo(label: string) {
  await session.page.evaluate(async () => { window.__SS__!.pause(); await window.__SS__!.screenshotReady(); });
  const file = `${raw}/${label}.jpg`, current = await state();
  await session.page.screenshot({ path: file, type: 'jpeg', quality: 88 });
  report.captures.push({ label, file, sha256: sha(readFileSync(file)), state: current });
  save(); console.log(tag, label, current.elapsed, current.draws, current.triangles, `HUD=${current.hud.length}`);
}
try {
  await session.open();
  await session.page.evaluate('window.__name=f=>f');
  session.page.on('console', m => { if (m.type() === 'warning') report.warnings.push(m.text()); });
  await session.page.evaluate(() => {
    const game = window.__SCENE__.game, original = game.view.update.bind(game.view);
    const sample = { frames: 0, maxDraws: 0, maxTriangles: 0, phases: {} as Record<string, { frames: number; draws: number; triangles: number }> };
    (window as any).__R18_GEOMETRY__ = sample;
    game.view.update = (...args: Parameters<typeof original>) => {
      original(...args);
      const phase = game.world.missions?.state.epilogue?.phase;
      if (!phase || phase === 'done') return;
      const perf = window.__SS__!.perf(); sample.frames++;
      sample.maxDraws = Math.max(sample.maxDraws, perf.drawCalls); sample.maxTriangles = Math.max(sample.maxTriangles, perf.triangles);
      const row = sample.phases[phase] ??= { frames: 0, draws: 0, triangles: 0 };
      row.frames++; row.draws = Math.max(row.draws, perf.drawCalls); row.triangles = Math.max(row.triangles, perf.triangles);
      // UI updates later in the same RAF; per-photo HUD probes verify the finished frame.
    };
  });
  await session.page.evaluate(async ({ seed, tier, portrait }) => {
    const api = window.__SS__!, game = window.__SCENE__.game;
    api.pause(); api.campaign.restore(seed); await api.loadLevel('L10', { seed: 42 }); api.pause();
    api.settings.set({ quality: tier as 'high' | 'low' });
    if (portrait) { game.input.setScheme('touch'); document.body.classList.add('touch-ui'); }
    api.bot.start('complete');
  }, { seed: JSON.parse(gunzipSync(seedBytes).toString()), tier, portrait: aspect === 'portrait' });
  // Remove only Scene Lab's isolation stylesheet, so production HUD behavior is tested.
  for (const style of await session.page.locator('style').all()) if ((await style.textContent())?.includes('#hud:not([data-scene-hud])')) await style.evaluate(n => n.remove());
  await photo('pre-release');
  await session.page.evaluate(() => window.__SS__!.resume());
  const seen = new Set<string>(), started = Date.now();
  const times = [10, 30, 45, 50, 55, 60];
  while (Date.now() - started < 420000) {
    const q = await state();
    if (q.phase === 'playable') {
      await session.page.evaluate(() => window.__SS__!.bot.stop());
      const label = !seen.has('release-0s') ? 'release-0s' : times.find(t => q.elapsed >= t * 60 && !seen.has(`ending-${t}s`));
      if (label !== undefined) { const name = typeof label === 'number' ? `ending-${label}s` : label; seen.add(name); await photo(name); await session.page.evaluate(() => window.__SS__!.resume()); }
    } else if (['title', 'credits', 'thanks'].includes(q.phase)) {
      const label = q.phase === 'title' ? 'ending-65s' : q.phase;
      if (!seen.has(label)) { seen.add(label); await photo(label); await session.page.evaluate(() => window.__SS__!.resume()); }
      if (q.phase === 'credits') await session.page.getByTestId('ending-credits-back').click();
      if (q.phase === 'thanks' && q.phaseTicks > 180) break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  report.finished = seen.has('credits') && seen.has('thanks');
  if (!report.finished) report.errors.push('Ending failed to reach credits and thanks');
  for (const t of times) if (!seen.has(`ending-${t}s`)) report.errors.push(`Missing ending ${t}s`);
} catch (error) { report.errors.push(String(error)); }
finally {
  report.errors.push(...session.errors);
  report.frames = await session.page?.evaluate(() => (window as any).__R18_GEOMETRY__).catch(() => null);
  report.geometry = { maxDraws: report.frames?.maxDraws ?? 0, maxTriangles: report.frames?.maxTriangles ?? 0, drawLimit: tier === 'low' ? 300 : 600, triangleLimit: tier === 'low' ? 500000 : 1500000 };
  report.geometry.pass = report.frames?.frames > 0 && report.geometry.maxDraws <= report.geometry.drawLimit && report.geometry.maxTriangles <= report.geometry.triangleLimit;
  for (const c of report.captures) {
    if (c.state.backend !== backend || c.state.quality !== tier) report.errors.push(`Wrong backend/tier at ${c.label}`);
    if (c.label !== 'pre-release' && (c.state.hud.length || c.state.worldBars)) report.errors.push(`HUD visible at ${c.label}: ${c.state.hud.join(',')}`);
    report.errors.push(...c.state.endingErrors);
  }
  save(); await session.close(); stopServer();
  console.log(JSON.stringify({ tag, captures: report.captures.length, frames: report.frames?.frames, geometry: report.geometry, errors: report.errors }));
  if (!report.geometry.pass || report.errors.length) process.exitCode = 1;
}
