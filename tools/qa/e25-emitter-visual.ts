/** Accepted-level prop and native-view A/B matrix: real authored placements, both tiers, zoom 1/1.5. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { productionIds } from '../../src/assets/productionIds';
import { variantPath, type AssetDef } from '../../src/assets/types';
import { levelOneLayouts } from '../../src/levels/L1/layout';
import { levelTwoLayouts } from '../../src/levels/L2/layout';
import { levelFourLayouts } from '../../src/levels/L4/layout';
import { levelFiveLayouts } from '../../src/levels/L5/layout';
import type { DistrictLayout, DistrictId } from '../../src/levels/districts/types';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import type { Game } from '../../src/Game';
import type { CameraPose } from '../../src/render/View';
import type { DistrictView } from '../../src/render/DistrictView';
import { cameraFraming } from '../../src/data/cameraFraming';
import equipment from '../assets/equipment-lights.json';

const tier = process.argv.includes('--low') ? 'low' : 'high', out = `${process.env.E25_OUT ?? 'test-results/epics/E25/emitters-visual'}/${tier}`;
mkdirSync(out, { recursive: true });
const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
const changed = new Set(execFileSync('git', ['diff', '--name-only', process.env.E25_BEFORE_REF ?? 'ac0a9e26', '--', 'public/assets/models'], { encoding: 'utf8' }).trim().split('\n'));
const levels = [['L1', 'D-GROVE', 0, levelOneLayouts], ['L2', 'D-GROVE', 1, levelTwoLayouts], ['L4', 'D-FAIR', 0, levelFourLayouts], ['L5', 'D-FAIR', 5, levelFiveLayouts]] as const;
const fixtures: { name: string; level: string; asset: string; decay?: string; placement?: string; spec: SceneSpec }[] = [];
for (const [level, district, worldTier, prepare] of levels) {
  const source = JSON.parse(readFileSync(`public/assets/layouts/${district}.layout.json`, 'utf8')) as DistrictLayout;
  const [layout] = prepare([source]), seen = new Set<string>();
  for (const p of layout.placements) {
    if (p.minTier > worldTier || p.maxTier < worldTier) continue;
    const def = manifest.find(d => d.id === (productionIds[p.assetId] ?? p.assetId)); if (!def?.glb) continue;
    const key = `${p.assetId}:${p.decay ?? ''}`; if (seen.has(key)) continue;
    if (![def.glb, def.lods?.lod1, def.lods?.lod2].some(path => path && changed.has(variantPath(path, p.decay)))) continue;
    seen.add(key);
    const box = p.visualAabb, target = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2] as [number, number, number];
    fixtures.push({ name: `${level}-${p.assetId}${p.decay ? '.' + p.decay : ''}`, level, asset: p.assetId, decay: p.decay, placement: p.id,
      spec: { name: `emitter-${level}-${key}`, seed: 1, ground: 'district', time: level, tier: worldTier, dof: false,
        layout: { level, district: district as DistrictId, ids: [p.id], bbox: [[box.min[0] - 3, box.min[2] - 3], [box.max[0] + 3, box.max[2] + 3]] },
        camera: { mode: 'game', target, zoom: 1 } } });
  }
}
for (const def of equipment) fixtures.push({ name: `equipment-${def.id}`, level: 'equipment-night', asset: def.id, spec: { name: `emitter-${def.id}`, seed: 1, time: 'night', ground: 'asphalt', dof: false, size: 60,
  props: [{ asset: def.id, at: [0, 0] }], camera: { mode: 'game', target: [0, (manifest.find(d => d.id === def.id)?.dimensions.y ?? 2) / 2, 0], zoom: 1 } } });
if (process.argv.includes('--list')) { console.log(JSON.stringify(fixtures, null, 2)); process.exit(0); }
// The before phase runs with baseline GLBs restored; preserve the originally selected matrix in a separate file.
const fixturePath = process.env.E25_FIXTURE_FILE;
const rows = fixturePath ? JSON.parse(readFileSync(fixturePath, 'utf8')) as typeof fixtures : fixtures;
const s = new SceneSession({ backend: 'webgl2', tier }), results: unknown[] = [];
type SavedCapture = { name: string; zoom: number; tier: string; kind: string; camera: { zoom: number }; actualRadius: number; calibratedZoom: number; errors: string[]; path: string; sha256: string };
const saved = process.argv.includes('--resume') ? JSON.parse(readFileSync(`${out}/captures.json`, 'utf8')) as SavedCapture[] : [];
for (const r of saved) {
  if (r.tier !== tier || r.errors.length || ![1, 1.5].includes(r.zoom) || !r.camera ||
      !(Math.abs(r.camera.zoom - r.zoom) < 1e-6) || !(Math.abs(r.calibratedZoom - r.zoom) < 1e-6) ||
      r.kind === 'prop' && !(Math.abs(r.actualRadius - cameraFraming.radiusM * r.zoom) < 1e-6) ||
      !r.path.startsWith(`${out}/`) || createHash('sha256').update(readFileSync(r.path)).digest('hex') !== r.sha256) throw Error(`Cannot resume invalid capture ${r.name}`);
}
const done = new Set(saved.map(r => r.name));
for (const name of done) if (saved.filter(r => r.name === name).length !== 2 || new Set(saved.filter(r => r.name === name).map(r => r.zoom)).size !== 2) throw Error(`Cannot resume incomplete zoom pair ${name}`);
results.push(...saved);
let cameraBase: CameraPose;
async function openFrozen() {
  await s.open(); await s.page.evaluate('globalThis.__name = (fn) => fn');
  await s.page.evaluate(() => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game, reset = game.clock.reset.bind(game.clock);
    game.clock.reset = () => { reset(); game.clock.pause(); }; game.clock.resume = () => {}; game.clock.pause();
  });
}

async function capture(name: string, zoom: number, detail: object) {
  // Presets ignore follow-camera zoom. Scale the actual pose about its fixed target,
  // matching View's production zoom convention (1.5 means 1.5 times the radius).
  if (zoom === 1) cameraBase = await s.page.evaluate(() => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    const state = game.view.view.getState();
    return { position: state.position as [number, number, number], target: state.target as [number, number, number] };
  });
  await s.page.evaluate(({ base, zoom }) => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    const rig = game.view.view;
    rig.follow(); rig.zoom(Math.log(zoom / rig.getState().targetZoom), true);
    rig.preset('e25-calibrated-zoom', { target: base.target,
      position: base.position.map((v, i) => base.target[i]! + (v - base.target[i]!) * zoom) as [number, number, number] });
    game.view.update(1);
  }, { base: cameraBase, zoom });
  await s.ready();
  const state = await s.page.evaluate(async () => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game;
    // Content and world transforms, rather than asynchronous allocation IDs or repaired node names, break depth ties.
    const keys = new WeakMap<import('three').Object3D, string>();
    const key = (o: import('three').Object3D | null) => {
      if (!o) return ''; const cached = keys.get(o); if (cached) return cached;
      const mesh = o as import('three').Mesh, geometry = mesh.geometry; let hash = 2166136261;
      for (const a of [geometry?.getAttribute('position')?.array, geometry?.index?.array]) if (a) for (const v of a) hash = Math.imul(hash ^ Math.round(v * 1e5), 16777619);
      const material = mesh.material, materials = Array.isArray(material) ? material.map(m => m.name) : material?.name;
      const value = JSON.stringify([o.matrixWorld.elements, hash >>> 0, materials]); keys.set(o, value); return value;
    };
    game.view.renderer.setOpaqueSort((a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0) || (a.renderOrder ?? 0) - (b.renderOrder ?? 0) || (a.z ?? 0) - (b.z ?? 0) || key(a.object).localeCompare(key(b.object)));
    game.view.renderer.setTransparentSort((a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0) || (a.renderOrder ?? 0) - (b.renderOrder ?? 0) || (b.z ?? 0) - (a.z ?? 0) || key(a.object).localeCompare(key(b.object)));
    const frame = (game.view.renderer as unknown as { _nodes: { nodeFrame: { time: number; deltaTime: number } } })._nodes.nodeFrame;
    for (let i = 0; i < 4; i++) { game.view.renderer.nextNodeFrame(); frame.time = frame.deltaTime = 0; game.view.update(1); await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); }
    game.view.renderer.nextNodeFrame(); frame.time = frame.deltaTime = 0; game.view.update(1);
    const districts = (game.view as unknown as { districts: DistrictView }).districts;
    return { camera: game.view.view.getState(), tick: game.world.tick, tier: game.view.getState().quality, lods: districts.lodState(), png: game.view.renderer.domElement.toDataURL('image/png').split(',')[1] };
  });
  const path = `${out}/${name}-z${zoom}.png`, bytes = Buffer.from(state.png, 'base64'); writeFileSync(path, bytes);
  const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]!));
  const actualRadius = distance(state.camera.position, state.camera.target), baseRadius = distance(cameraBase.position, cameraBase.target);
  if ('kind' in detail && detail.kind === 'prop' && Math.abs(baseRadius - cameraFraming.radiusM) > 1e-6) throw Error(`Nonproduction radius: ${name} ${baseRadius}`);
  if (Math.abs(actualRadius / baseRadius - zoom) > 1e-6 || Math.abs(state.camera.zoom - zoom) > 1e-6) throw Error(`Camera zoom mismatch: ${name} ${zoom}`);
  const metrics = { tick: state.tick, tier: state.tier, lods: state.lods, camera: state.camera, baseRadius, actualRadius, calibratedZoom: actualRadius / baseRadius }; results.push({ name, zoom, ...detail, ...metrics, path, sha256: createHash('sha256').update(bytes).digest('hex'), errors: [...s.errors] });
}
try {
  await openFrozen(); let batchRows = 0;
  for (const row of rows) {
    if (done.has(row.name)) continue;
    // Keep each lease well below the shared ten-minute browser cap.
    if (batchRows >= 24) { await s.close(); await openFrozen(); batchRows = 0; }
    await s.load(row.spec); await s.ready(); await s.step(1);
    for (const zoom of [1, 1.5]) await capture(row.name, zoom, { level: row.level, asset: row.asset, decay: row.decay, placement: row.placement, kind: 'prop' });
    console.log(`${tier} ${row.name}`); batchRows++;
  }
  for (const [level, suffix] of [['L1', ''], ['L2', 'l2-streets-w1'], ['L4', 'l4-plaza-safe'], ['L5', 'pair-plaza']]) {
    if (process.env.E25_NATIVE_LEVEL && level !== process.env.E25_NATIVE_LEVEL) continue;
    if (done.has(`native-${level}`)) continue;
    await s.close(); await s.open(); await s.page.evaluate('globalThis.__name = (fn) => fn');
    await s.page.evaluate(async ({ level, tier }: { level: string; tier: 'high' | 'low' }) => {
      window.__SS__!.settings.set({ quality: tier });
      const game = (window.__SCENE__ as unknown as { game: Game }).game, reset = game.clock.reset.bind(game.clock);
      game.clock.reset = () => { reset(); game.clock.pause(); }; game.clock.resume = () => {}; game.clock.pause();
      await window.__SS__!.loadLevel(level, { seed: 1 }); window.__SS__!.pause();
    }, { level, tier } as const);
    const pose = await s.page.evaluate(async suffix => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game, districts = (game.view as unknown as { districts: DistrictView }).districts;
      const key = [...districts.spots.keys()].find(k => k.endsWith(`/${suffix}`) || k === suffix);
      if (suffix && !key) throw Error(`Missing accepted photo spot ${suffix}`);
      if (key) { const pose = districts.spots.get(key)!; window.__SS__!.teleport('player', { x: pose.target[0], z: pose.target[2] }); window.__SS__!.camera.preset(key); }
      window.__SS__!.cheats.god(true); await window.__SS__!.step(120); if (key) window.__SS__!.camera.preset(key);
      return key ?? 'entry';
    }, suffix);
    for (const zoom of [1, 1.5]) await capture(`native-${level}`, zoom, { level, kind: 'native', pose });
    console.log(`${tier} native ${level}`);
  }
} finally { writeFileSync(`${out}/captures.json`, JSON.stringify(results, null, 2) + '\n'); await s.close(); stopServer(); }
