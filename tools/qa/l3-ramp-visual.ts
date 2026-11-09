/** Diagnose the reported L3 pose without changing collision or authored geometry. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
import type { DistrictParts } from '../../src/render/district/DistrictBuild';

const out = 'test-results/qa/l3-ramp-visual'; mkdirSync(out, { recursive: true });
const s = new SceneSession({ tier: 'low', backend: 'webgl2' });
try {
  await s.open(); await s.page.evaluate('window.__name=f=>f');
  await s.page.evaluate(async () => {
    const api = window.__SS__!; await api.loadLevel('L3', { seed: 1, progression: 'L3-default' });
    api.missions.begin(); api.pause();
    const game = (window.__SCENE__ as unknown as { game: Game }).game, w = game.world, p = w.entities.get(1)!;
    Object.assign(p.transform, { x: 159.34, y: 5.69, z: -1.32 });
    w.physics.playerBody!.setTranslation(p.transform, true); w.solids.remember(p, 'qa.visual-pose');
    w.previousPlayer = { ...p.transform }; api.camera.follow(); api.camera.zoom(1.5); await api.step(1);
  });
  const read = () => s.page.evaluate(() => {
    const game = (window.__SCENE__ as unknown as { game: Game }).game, d = game.view.labProbes().districts!;
    const parts = (d as unknown as { parts: DistrictParts }).parts;
    return { player: game.world.entities.get(1)!.transform, camera: game.view.view.getState(), entries: parts.lodBatches.filter(x => x.id === 'kit.highway-onramp').map(e => ({ height: e.height, radius: e.radius, foot: e.foot, refs: e.refs.map(r => ({ position: r.position.toArray(), scale: r.scale.toArray(), hidden: r.userData.interiorHidden, highOnly: r.userData.highOnly, destructed: r.userData.destructed, owner: r.userData.interiorBuilding?.userData.placementId })) })), lod: d.lodState().filter(x => x.assetId === 'kit.highway-onramp'), batches: d.getState().batches.filter(x => x.assetId === 'kit.highway-onramp'), occlusion: d.occlusion.interiorState() };
  });
  const before = await read(); await s.screenshot(`${out}/before.png`);
  await s.page.evaluate(async () => { const game = (window.__SCENE__ as unknown as { game: Game }).game; game.view.labProbes().districts!.occlusion.seeThroughOff = true; await window.__SS__!.step(1); });
  const noCut = await read(); await s.screenshot(`${out}/no-cut.png`);
  await s.page.evaluate(async () => { const game = (window.__SCENE__ as unknown as { game: Game }).game; game.view.labProbes().districts!.occlusion.interiorCullOff = true; await window.__SS__!.step(1); });
  const noInterior = await read(); await s.screenshot(`${out}/no-interior.png`);
  writeFileSync(`${out}/receipt.json`, JSON.stringify({ before, noCut, noInterior, errors: s.errors }, null, 2) + '\n');
  console.log(JSON.stringify({ before, noCut, noInterior, errors: s.errors }));
} finally { await s.close(); stopServer(); }
