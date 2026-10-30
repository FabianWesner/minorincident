/** Replay the exact L10 epilogue save; isolate the static-console visual fault. Shared headless pool only. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
const label = process.argv[2] ?? 'review';
const out = fileURLToPath(new URL(`../../docs/reports/triage-b/captures/epilogue-${label}/`, import.meta.url));
mkdirSync(out, { recursive: true });
const saved = JSON.parse(gunzipSync(readFileSync(new URL('../../docs/reports/triage-b/checks/n1/resume.json.gz', import.meta.url))).toString());
const tier = process.env.TRIAGE_TIER === 'high' ? 'high' : 'low';
saved.settings.quality = tier;
const session = new SceneSession({ backend: process.env.TRIAGE_BACKEND === 'webgl2' ? 'webgl2' : 'webgpu', tier, viewport: { width: 1280, height: 720 } });
try {
  await session.open();
  await session.page.evaluate(async save => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    await game.continueCampaign(save); window.__SS__!.pause();
  }, saved);
  await session.ready();
  for (const tick of [0, 120, 600, 1800, 2700]) {
    const current = await session.page.evaluate(() => window.__SS__!.tick());
    if (tick > current) await session.step(tick - current);
    await session.screenshot(`${out}/tick-${tick}.png`);
  }
  await session.page.evaluate(async () => { for (let i = 0; i < 60; i++) await new Promise(requestAnimationFrame); });
  await session.page.screenshot({ path: `${out}/raw-after-60-raf.png` });
  await session.page.evaluate(() => window.__SS__!.settings.set({ seeThroughOff: true }));
  await session.screenshot(`${out}/no-reveal.png`);
  await session.page.evaluate(() => window.__SS__!.settings.set({ seeThroughOff: false }));
  const state = await session.page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    const district = (g.view as unknown as { districts: { lodBatches: { id: string; hero: import('three').Group; near: import('three').Group; far: import('three').Group }[] } }).districts;
    const meshes: unknown[] = [];
    for (const e of district.lodBatches) if (e.id === 'kit.dispersal-console') for (const group of [e.hero, e.near, e.far]) group.traverse(o => {
      const m = o as import('three').InstancedMesh; if (!m.geometry || !m.count) return;
      const p = m.geometry.getAttribute('position'), index = m.geometry.index;
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < p.count; i++) for (let c = 0; c < 3; c++) { const v = c === 0 ? p.getX(i) : c === 1 ? p.getY(i) : p.getZ(i); min[c] = Math.min(min[c], v); max[c] = Math.max(max[c], v); }
      let badIndex = 0; if (index) for (let i = 0; i < index.count; i++) if (index.getX(i) >= p.count) badIndex++;
      const a = m.geometry.getAttribute('_placement0') as import('three').InterleavedBufferAttribute;
      meshes.push({ name: m.name, count: m.count, min, max, vertices: p.count, badIndex, samePlacementArray: a?.data.array === m.instanceMatrix.array, matrix: [...m.instanceMatrix.array].slice(0, 16) });
    });
    return { meshes, camera: g.view.view.getState(), missionPhase: g.world.missions!.state.epilogue?.phase };
  });
  await session.page.evaluate(() => { (window.__SCENE__ as unknown as { game: Game }).game.view.vfx!.visible = false; });
  await session.screenshot(`${out}/no-vfx.png`);
  await session.page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game; g.view.vfx!.visible = true;
    g.view.scene.traverse(o => { if (o.name.startsWith('corpses:')) { const m = (o as import('three').Mesh).material; for (const v of Array.isArray(m) ? m : [m]) v.visible = false; } });
  });
  await session.screenshot(`${out}/no-corpses.png`);
  await session.page.evaluate(() => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game;
    const district = (g.view as unknown as { districts: { lodBatches: { id: string; hero: import('three').Group; near: import('three').Group; far: import('three').Group }[] } }).districts;
    for (const e of district.lodBatches) if (e.id === 'kit.dispersal-console') for (const group of [e.hero, e.near, e.far]) group.traverse(o => { if ((o as import('three').Mesh).geometry) o.layers.set(31); });
  });
  await session.screenshot(`${out}/no-console.png`);
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ serverRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), tier, state, errors: session.errors }, null, 2));
} finally { await session.close(); stopServer(); }
