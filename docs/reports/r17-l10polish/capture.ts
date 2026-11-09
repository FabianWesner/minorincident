/** Actual L10 appearance fixtures and production ending replay; one pooled headless context per invocation. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { gzipSync, gunzipSync } from 'node:zlib';
import { SceneSession, stopServer } from '../../../tools/scenelab/session';
import { cure } from '../../../src/levels/L10/district';
import { cureCrossingLines } from '../../../src/levels/L10/crossingStories';

const [mode = 'environment', tier = 'low', backend = 'webgl2', aspect = 'landscape'] = process.argv.slice(2);
const carried = process.env.R17_CARRIED === '1';
const fast = process.env.R17_FAST === '1';
const root = 'docs/reports/r17-l10polish', tag = `${mode}-${tier}-${backend}-${aspect}${carried ? '-carried' : ''}${fast ? '-fast' : ''}`;
const raw = `/private/tmp/r17-l10polish/${tag}`;
mkdirSync(raw, { recursive: true });
const session = new SceneSession({ tier: tier as any, backend: backend as any, viewport: aspect === 'portrait' ? { width: 720, height: 1280 } : { width: 1280, height: 720 }, query: { ui: '1' } });
const sha = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const report: any = { tag, mode, tier, backend, aspect, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceDiff: execFileSync('git', ['diff', '--', 'src', 'tools/blender'], { encoding: 'utf8' }), producerSha256: sha(readFileSync(import.meta.filename)), captures: [], errors: [], warnings: [] };
function save() { writeFileSync(`${root}/${tag}.json.gz`, gzipSync(JSON.stringify(report))); }
async function state() {
  return session.page.evaluate(() => {
    const api = window.__SS__!, game = window.__SCENE__.game, w = game.world, m = w.missions!.state, perf = api.perf();
    const barn = w.destruction?.objects.find(o => o.placement.id === 'l10-find-farm-barn');
    const courier = w.entities.get(1)!.transform;
    const nearbyCrops = w.districts?.districts.flatMap(d => d.decay.placements.filter(p => p.assetId === 'veg.corn-block' && Math.hypot(p.position[0] + d.origin[0] - courier.x, p.position[2] + d.origin[1] - courier.z) < 25).map(p => ({ id: p.id, position: p.position })));
    const propane = [...w.entities.iterate()].filter(e => e.hazard?.kind === 'propane').map(e => ({ id: e.id, position: e.transform, exploded: e.hazard!.exploded }));
    return { nearbyCrops, propane, tick: w.tick, position: { ...w.entities.get(1)!.transform }, phase: m.epilogue?.phase ?? m.phase, elapsed: m.cureFront?.elapsed ?? -1, phaseTicks: m.epilogue?.phaseTicks ?? 0, camera: api.getState().render.camera, lighting: api.getState().render.lighting, actualBackend: perf.backend, actualQuality: api.getState().render.quality, draws: perf.drawCalls, triangles: perf.triangles, barn: barn && { id: barn.id, state: barn.state, roofParts: barn.parts.map((p, i) => ({ role: p.role, hp: barn.state.hp[i] })).filter(p => p.role === 'roof') }, decals: (game.view as any).districts?.parts?.cureDecals?.visibleIds(), roofBatches: (game.view as any).districts?.lodBatches?.filter((b: any) => b.id === 'bld.cure-motor-shelter').map((b: any) => ({ refs: b.refs.map((r: any) => ({ id: r.userData.placementId, hidden: r.userData.roofHidden })), meshes: b.hero.children.map((n: any) => n.name) })) };
  });
}
async function photo(label: string, follow = true) {
  await session.page.evaluate(() => window.__SS__!.pause());
  for (const zoom of [1, 1.5]) {
    await session.page.evaluate(async ({ zoom, follow }) => {
      const api = window.__SS__!, g = window.__SCENE__.game;
      if (follow) { g.view.view.reset(g.world.entities.get(1)!.transform); api.camera.follow(); }
      api.camera.zoom(zoom); await api.screenshotReady();
    }, { zoom, follow });
    const file = `${raw}/${report.captures.length}-${label}-z${zoom}.jpg`;
    await session.page.screenshot({ path: file, type: 'jpeg', quality: 88 });
    report.captures.push({ label, zoom, file, sha256: sha(readFileSync(file)), state: await state() });
  }
  if (/ending-(45|50|55|60)s|credits/.test(label)) report.profiles ??= [];
  if (/ending-(45|50|55|60)s|credits/.test(label)) report.profiles.push({ label, meshes: await session.page.evaluate(() => {
    const rows: any[] = [];
    window.__SCENE__.game.view.scene.traverseVisible((n: any) => { if (!n.isMesh) return; const triangles = (n.geometry.index?.count ?? n.geometry.attributes.position?.count ?? 0) / 3 * (n.isInstancedMesh ? n.count : 1); if (!triangles) return; const path = []; for (let p = n; p; p = p.parent) path.unshift(p.name || p.type); rows.push({ path: path.join('/'), triangles, groups: n.geometry.groups.length, count: n.count }); });
    return rows.sort((a, b) => b.triangles - a.triangles).slice(0, 40);
  }) });
  save(); console.log(tag, label, report.captures.at(-1).state.draws, report.captures.at(-1).state.triangles);
}
async function pose(x: number, z: number, ticks = 60) {
  await session.page.evaluate(async ({ x, z, ticks }) => { const api = window.__SS__!; api.teleport('player', { x, z }); await api.step(ticks); window.__SCENE__.game.view.frame(ticks / 60); }, { x, z, ticks });
}
try {
  await session.open();
  await session.page.evaluate('window.__name=f=>f');
  await session.page.evaluate(() => {
    const game = window.__SCENE__.game, original = game.view.update.bind(game.view);
    const samples = { frames: 0, maxDraws: 0, maxTriangles: 0, phases: {} as Record<string, { frames: number; draws: number; triangles: number }> };
    (window as any).__R17_GEOMETRY__ = samples;
    game.view.update = (...args: Parameters<typeof original>) => {
      original(...args);
      const phase = game.world.missions?.state.epilogue?.phase;
      if (!phase) return;
      const perf = window.__SS__!.perf(); samples.frames++;
      if (perf.triangles > samples.maxTriangles) (samples as any).trianglePeak = { elapsed: game.world.missions!.state.cureFront?.elapsed, tick: game.world.tick, camera: game.view.view.getState() };
      samples.maxDraws = Math.max(samples.maxDraws, perf.drawCalls); samples.maxTriangles = Math.max(samples.maxTriangles, perf.triangles);
      const row = samples.phases[phase] ??= { frames: 0, draws: 0, triangles: 0 };
      row.frames++; row.draws = Math.max(row.draws, perf.drawCalls); row.triangles = Math.max(row.triangles, perf.triangles);
    };
  });
  session.page.on('console', m => { if (m.type() === 'warning') report.warnings.push(m.text()); });
  if (mode === 'barn') {
    report.method = 'Actual L10 intact barn at the QA courier pose after the opening radio caption expires. Protected teleport only; no geometry or mission edits.';
    await session.page.evaluate(async tier => { const api = window.__SS__!; await api.loadLevel('L10', { seed: 42, progression: 'L10-default' }); api.pause(); api.bot.stop(); api.settings.set({ quality: tier as any }); api.cheats.god(true); if (api.missions.state()?.phase === 'briefing') api.missions.begin(); }, tier);
    for (const style of await session.page.locator('style').all()) { if ((await style.textContent())?.includes('#hud:not([data-scene-hud])')) await style.evaluate(n => n.remove()); }
    await pose(944, -26, 600); await photo('barn-graves');
  } else if (mode === 'environment') {
    report.method = 'Actual seed42 L10, protected teleported courier, ordinary production follow camera. Barn collapse uses normalized damage on real placement parts. No difficulty or frame-time claim.';
    await session.page.evaluate(async tier => { const api = window.__SS__!; await api.loadLevel('L10', { seed: 42, progression: 'L10-default' }); api.pause(); api.settings.set({ quality: tier as any }); api.bot.stop(); api.cheats.god(true); if (api.missions.state()?.phase === 'briefing') api.missions.begin(); }, tier);
    for (const style of await session.page.locator('style').all()) { if ((await style.textContent())?.includes('#hud:not([data-scene-hud])')) await style.evaluate(n => n.remove()); }
    await pose(858.66, -93.68); await photo('farm-PO');
    for (const x of [1350, 1650, 3150, 3450]) {
      const lines = x < 1750 ? [cureCrossingLines.find(r => r.theme === 'depot')!.line] : [[cure.anchors['cure-corridor'], cure.anchors['corridor-breach'], cure.anchors['cure-complex']]];
      const segments = lines.flatMap(line => line.slice(1).map((b, i) => [line[i], b]));
      const segment = segments.find(([a, b]) => Math.min(a[0], b[0]) <= x && Math.max(a[0], b[0]) >= x && a[0] !== b[0])!;
      const [a, b] = segment, z = a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
      await pose(x, z); await photo(`farm-route-${x}`);
    }
    await pose(944, -26); await photo('barn-intact');
    await pose(951, -19, 1);
    await session.page.evaluate(async () => { const api = window.__SS__!, d = window.__SCENE__.game.world.destruction!, o = d.objects.find(o => o.placement.id === 'l10-find-farm-barn')!; for (let i = 0; i < o.parts.length; i++) d.damage({ object: o, part: i, local: o.parts[i].bounds.min, distance: 0, normal: [0, 1, 0] }, 'weapon.rocket-launcher', 3000); for (let i = 0; i < 5; i++) { await api.step(60); window.__SCENE__.game.view.frame(1); } });
    await photo('barn-collapsed');
    await session.page.evaluate(() => { const g = window.__SCENE__.game; g.world.missions!.loadCheckpoint('cure-research-entry'); });
    await pose(2699.5, 65.5, 180); await photo('hangar-interior');
    await pose(2707, 43); await photo('hangar-exterior');
    await session.page.evaluate(async tier => { const api = window.__SS__!; await api.loadLevel('L10', { seed: 42, progression: 'L10-default' }); api.pause(); api.bot.stop(); api.settings.set({ quality: tier as any }); api.cheats.god(true); if (api.missions.state()?.phase === 'briefing') api.missions.begin(); }, tier);
    await pose(858.66, -93.68, 60); await session.page.evaluate(() => window.__SS__!.spawn('hazard.propane', { x: 856.5, z: -93.68 })); await photo('propane-tank');
  } else {
    const seedName = carried ? 'L10-low-webgpu-complete-carried-release-save.json.gz' : `L10-${tier}-webgpu-complete-clean-release-save.json.gz`;
    const seedFile = existsSync(`${root}/seeds/${seedName}`) ? `${root}/seeds/${seedName}` : `/Users/wesner/Workspace/minorincident/docs/reports/qa-browser2/${seedName}`;
    const bytes = readFileSync(seedFile), seed = JSON.parse(gunzipSync(bytes).toString());
    report.seed = { file: seedFile, sha256: sha(bytes) };
    report.method = 'Natural-clock production Resume from actual completed-route pre-release campaign save; bot until release, then detached. Paused same-state zoom photos. No mission/cast edits and no live frame-time claim.';
    if (fast) report.method = 'Accelerated production ticks from the same actual pre-release save; geometry/composition diagnostic only, no natural-clock or performance timing claim.';
    await session.page.evaluate(async ({ seed, tier }) => { const api = window.__SS__!; api.pause(); api.campaign.restore(seed); await api.loadLevel('L10', { seed: 42 }); api.pause(); api.settings.set({ quality: tier as any }); api.bot.start('complete'); }, { seed, tier });
    for (const style of await session.page.locator('style').all()) { if ((await style.textContent())?.includes('#hud:not([data-scene-hud])')) await style.evaluate(n => n.remove()); }
    await session.page.evaluate(() => window.__SS__!.resume());
    const seen = new Set<string>(), started = Date.now();
    while (Date.now() - started < 300000) {
      const q = await state();
      if (q.phase === 'playable') {
        await session.page.evaluate(() => window.__SS__!.bot.stop());
        const bucket = Math.floor(q.elapsed / 300) * 5;
        if (!seen.has(`playable-${bucket}`)) { seen.add(`playable-${bucket}`); await photo(`ending-${bucket}s`, false); await session.page.evaluate(() => window.__SS__!.resume()); }
      } else if (q.phase === 'title' || q.phase === 'credits' || q.phase === 'thanks') {
        if (!seen.has(q.phase)) { seen.add(q.phase); await photo(q.phase, false); await session.page.evaluate(() => window.__SS__!.resume()); }
        if (q.phase === 'credits') { await session.page.getByTestId('ending-credits-back').click(); }
        if (q.phase === 'thanks' && q.phaseTicks > 180) break;
      }
      if (fast) await session.page.evaluate(async () => { const api = window.__SS__!; api.pause(); await api.step(120); window.__SCENE__.game.view.frame(2); });
      else await new Promise(resolve => setTimeout(resolve, 150));
    }
    report.finished = seen.has('credits') && seen.has('thanks');
    if (!report.finished) report.errors.push('Ending did not reach credits and thanks inside 300s');
  }
} catch (error) { report.errors.push(String(error)); console.error(error); process.exitCode = 1; }
finally {
  report.errors.push(...session.errors);
  report.context = await session.page?.evaluate(() => { const game = window.__SCENE__.game, renderer = game.view.renderer, gl = (renderer.backend as any).gl; return { backend: renderer.selectedBackend, webglVersion: gl ? gl.getParameter(gl.VERSION) : null, graves: game.world.districts?.districts.flatMap(d => d.decay.placements.filter(p => p.id.startsWith('l10-barn-grave-')).map(p => ({ id: p.id, position: p.position }))) }; }).catch(() => null);
  if (report.context && (backend === 'webgl2' ? !report.context.webglVersion?.includes('WebGL 2') : report.context.backend !== 'webgpu')) report.errors.push('Requested renderer was not active');
  report.renderFrames = await session.page?.evaluate(() => (window as any).__R17_GEOMETRY__).catch(() => null);
  report.geometry = { maxDraws: Math.max(report.renderFrames?.maxDraws ?? 0, ...report.captures.map((c: any) => c.state.draws)), maxTriangles: Math.max(report.renderFrames?.maxTriangles ?? 0, ...report.captures.map((c: any) => c.state.triangles)), drawLimit: tier === 'low' ? 300 : 600, triangleLimit: tier === 'low' ? 500000 : 1500000 };
  report.geometry.pass = report.geometry.maxDraws <= report.geometry.drawLimit && report.geometry.maxTriangles <= report.geometry.triangleLimit;
  if (!report.geometry.pass || report.errors.length) process.exitCode = 1;
  save(); await session.close(); stopServer(); console.log(JSON.stringify({ tag, captures: report.captures.length, geometry: report.geometry, errors: report.errors }));
}
